import { after } from 'next/server.js';
import { codePreferencesSchema, codePreferenceStyleSchema } from './code-site-styles.ts';
import { serverCodeStyleOptions, requireModelTaskAdmission, CodeStyleAdmissionError } from './code-site-eval-styles.ts';
import { z } from 'zod';
import { getCodeSite, updateCodeSite, commitSiteCode } from './code-site-store.ts';
import { currentCodeVersion, codeFactMaterials, hasUnregisteredOriginalMaterials, type CodeRun, type CodeSiteRecord } from './code-site.ts';
import { planSiteCode, selectCodeReferences, writeSiteCode, repairSiteCode, translateSiteCode, writeLocalEdit, writeLocalEditBatch, codeModelCalls } from './code-site-model.ts';
import { annotationBatchItemSchema, annotationTargetSchema, type AnnotationBatchItem, type AnnotationTarget } from './annotations.ts';
import { localEditContext, applyLocalEdit, applyLocalEdits, attributeLocalIssues, mergeAnnotationEdits } from './code-site-local-edit.ts';
import { factSourceKey, type CodeFactSource } from './code-site-fact-segments.ts';
import { createAnnotation, replyAnnotation } from './annotation-store.ts';
import { CodeRepairError } from './code-site-repair.ts';
import { listSiteImages } from './site-images.ts';
import { applyConversationAlignmentAction, appendConversationTurn, getConversation, updateConversationAlignment } from './conversation-store.ts';
import { AlignmentActionError, AlignmentTextTooLongError, applyCommittedResult, publicAlignmentView, type CurrentQuestion } from './alignment.ts';


const requestSchema = z.object({
  action: z.enum(['start', 'select', 'confirm', 'state', 'cancel', 'translate']).optional(), message: z.string().min(1).max(4000).refine(value => value.trim().length > 0, '消息不能为空').optional(),
  baseRevision: z.number().int().nonnegative().optional(), questionId: z.string().max(100).optional(),
  questionRevision: z.number().int().nonnegative().optional(), optionId: z.string().max(80).optional(),
  selectedTarget: annotationTargetSchema.optional(), pageId: z.string().regex(/^[a-z][a-z0-9-]{0,39}$/).optional(), saveAnnotation: z.boolean().optional(),
  preferences: codePreferencesSchema.optional(),
  annotationSubmissionId: z.string().uuid().optional(), annotationOverlapConfirmed: z.boolean().optional(),
  annotationBatch: annotationBatchItemSchema.array().min(1).max(20).optional(),
  source: z.object({ type: z.literal('upload'), sourceId: z.string().min(1).max(120), name: z.string().min(1).max(200), text: z.string().min(1).max(4000) }).strict().optional(),
});
const active = (globalThis as typeof globalThis & { __codeRuns?: Set<string> }).__codeRuns ??= new Set<string>();
class CodeRunConflictError extends Error {}
export async function codeWorkspaceState(site: CodeSiteRecord) {
  try {
    const conversation = await getConversation(site.siteId, site.conversationId);
    const alignment = conversation ? publicAlignmentView(conversation.alignment) : null;
    if (alignment?.questionKind === 'style') alignment.options = alignment.options.filter(option => serverCodeStyleOptions.some(current => current.id === option.id));
    return { codeSite: site, conversationId: site.conversationId,
      alignment, turns: conversation?.turns ?? [] };
  } catch (error) {
    if (!(error instanceof AlignmentTextTooLongError)) throw error;
    // The existing conversation remains untouched and unavailable. Materials,
    // runs and checked versions belong to the site and can still be viewed.
    return { codeSite: site, conversationId: site.conversationId,
      alignment: null, turns: [], conversationError: error.message };
  }
}
function styleQuestion(epoch: number): CurrentQuestion {
  return { questionId: `code-style-${crypto.randomUUID()}`, questionRevision: epoch + 1, kind: 'style',
    prompt: '网站用哪种风格？版式与信息密度一起保存。', allowOther: false,
    options: serverCodeStyleOptions };
}
async function runStep(siteId: string, runId: string, patch: Partial<CodeRun>) {
  return updateCodeSite(siteId, site => {
    if (site.run?.id !== runId) throw new Error('任务已经更新');
    return { run: { ...site.run, ...patch, ...(codeModelCalls.getStore() ? { modelCalls: codeModelCalls.getStore() } : {}), updatedAt: new Date().toISOString() } };
  });
}
async function claimRun(siteId: string, kind: CodeRun['kind'], request: string, baseRevision: number, edit: { selectedTarget?: AnnotationTarget; pageId?: string; saveAnnotation?: boolean; annotationSubmissionId?: string; annotationBatch?: AnnotationBatchItem[]; annotationOverlapConfirmed?: boolean; source?: CodeRun['source'] } = {}) {
  return updateCodeSite(siteId, site => {
    if (edit.annotationSubmissionId && site.runs.some(run => run.annotationSubmissionId === edit.annotationSubmissionId))
      throw new CodeRunConflictError('这条批注已发送，请查看原任务状态。');
    if (site.run?.status === 'running') throw new CodeRunConflictError('当前任务还在进行，请等待完成。');
    if ((currentCodeVersion(site)?.revision ?? 0) !== baseRevision) throw new CodeRunConflictError('版本已经更新，请刷新后再试。');
    if (edit.selectedTarget && currentCodeVersion(site)?.id !== edit.selectedTarget.versionId) throw new CodeRunConflictError('锚点版本已改变，请重新点选。');
    requireModelTaskAdmission(kind === 'plan' ? site.preferences.style : site.plan?.style);
    const now = new Date().toISOString();
    return { run: { id: crypto.randomUUID(), kind, status: 'running', step: kind === 'translate' ? '按当前中文版逐页翻译英文' : kind === 'plan' ? '读资料，规划页面大纲' : kind === 'edit' ? '理解修改要求，查阅版本目录' : '按方案写站点代码',
      ...edit, request, baseRevision, startedAt: now, updatedAt: now, repairRound: 0, issues: [], attempts: [] } };
  });
}
async function registerUserSources(siteId: string, input: { message?: string; source?: Extract<CodeFactSource, { type: 'upload' }>; annotationBatch?: AnnotationBatchItem[] }) {
  if (!input.message) return undefined;
  if (input.source && input.source.text !== input.message) throw new Error('上传资料原文与发送内容不一致。');
  let allocated: CodeFactSource[] = [];
  await updateCodeSite(siteId, current => {
    // Check legacy eligibility before this message creates the first registry.
    const original = currentCodeVersion(current) && !input.source && hasUnregisteredOriginalMaterials(current);
    let messageIndex = Math.max(0, ...(current.factSources ?? []).filter(item => item.type !== 'upload').map(item => item.messageIndex));
    allocated = input.annotationBatch?.length
      ? input.annotationBatch.map(item => ({ type: 'message', messageIndex: ++messageIndex, text: item.body }))
      : [input.source ?? { type: 'message', messageIndex: ++messageIndex, text: input.message! }];
    const keys = new Set(allocated.map(factSourceKey));
    const originalSources: CodeFactSource[] = original ? [{ type: 'materials', messageIndex: ++messageIndex, text: current.materials }] : [];
    return { factSources: [...originalSources, ...(current.factSources ?? []).filter(item => !keys.has(factSourceKey(item))), ...allocated] };
  });
  return allocated;
}
function schedule(site: CodeSiteRecord) {
  const run = site.run!; active.add(run.id);
  after(() => codeModelCalls.run([], async () => {
    try { await execute(site.siteId, run.id); }
    catch (error) {
      // An explicitly deleted site has no workspace or records to receive a failed run.
      if (!await getCodeSite(site.siteId)) return;
      const message = error instanceof Error ? error.message : '本次任务失败，未保存版本。';
      const existingResults = (await getCodeSite(site.siteId))?.run?.annotationResults;
      await runStep(site.siteId, run.id, { status: 'error', step: message,
        ...(run.kind === 'translate' ? { repairRound: Math.max(0, ...(codeModelCalls.getStore() ?? []).map(call => call.translationInput?.correctionRound ?? 0)) } : {}),
        ...(error instanceof CodeRepairError ? { repairFailure: { reason: message, response: error.response } } : {}),
        ...(run.annotationBatch?.length && !existingResults ? { annotationResults: run.annotationBatch.map(item => ({ draftIds: [item.draftId], status: 'rejected' as const, message })) } : {}) });
      await updateConversationAlignment(site.siteId, site.conversationId, record => ({ ...record, alignment: applyCommittedResult(record.alignment, { status: 'error', summary: message }) }));
      const failed = await getCodeSite(site.siteId);
      if (failed?.run?.annotationId) await replyAnnotation(site.siteId, failed.run.annotationId, { body: message, author: { id: 'assistant', name: '助手' } });
      for (const record of failed?.run?.annotationIds ?? []) {
        const result = failed?.run?.annotationResults?.find(item => item.draftIds.includes(record.draftId));
        await replyAnnotation(site.siteId, record.annotationId, { body: failed?.run?.overallIssue ?? result?.message ?? message, author: { id: 'assistant', name: '助手' } });
      }
      await appendConversationTurn({ siteId: site.siteId, conversationId: site.conversationId, userMessage: run.request, aiSummary: message, appliedOperationsSummary: '未保存版本', outcome: 'error' });
    } finally { active.delete(run.id); }
  }));
}
async function executeLocalEdit(site: CodeSiteRecord, run: CodeRun) {
  const target = run.selectedTarget!, source = currentCodeVersion(site)!;
  const materials = codeFactMaterials(site, run.request, site.currentVersionId, true);
  let issues: string[] = [], annotationId = run.annotationId;
  if (run.saveAnnotation && !annotationId) {
    const created = await createAnnotation({ siteId: site.siteId, pageId: target.pageId, pagePath: `/${target.pageId}`,
      anchor: { pageId: target.pageId, pagePath: `/${target.pageId}`, revision: source.revision, locale: 'zh', target,
        snapshot: { text: target.text, label: target.label }, capturedAt: run.startedAt },
      body: run.request, author: { id: 'workspace', name: '你' } });
    annotationId = created.id; await runStep(site.siteId, run.id, { annotationId });
  }
  for (let round = 0; round <= 2; round++) {
    await runStep(site.siteId, run.id, { step: round ? `修正选中区块（${round}/2）` : `修改「${target.label}」`, repairRound: round });
    const result = await writeLocalEdit({ materials, preferences: site.preferences, plan: site.plan!, request: run.request,
      current: source.code, target, issues });
    // Preserve the reply before parsing or invoking the fact provider. A later
    // provider failure must not discard the unsaved candidate that caused it.
    await runStep(site.siteId, run.id, { localResponses: [...((await getCodeSite(site.siteId))!.run!.localResponses ?? []), { response: result.response, issues: [] }] });
    const unavailable = z.object({ cannotEdit: z.string().min(1).max(500) }).strict().safeParse(result.response);
    if (unavailable.success) throw new Error(`${unavailable.data.cannotEdit}；未保存版本。可取消点选后选择「改整页」。`);
    const parsed = z.object({ html: z.string().min(1).max(100000), css: z.string().max(30000) }).strict().safeParse(result.response);
    issues = [];
    let code;
    if (!parsed.success) issues = ['局部修改必须返回一个区块的 html 和 css，不能返回整页或整站。'];
    else {
      // Only boundary errors are correction feedback; infrastructure/provider
      // failures stop the task instead of being retried as model mistakes.
      if (/<\/?(?:html|body|head|main)\b/i.test(parsed.data.html)) issues = ['局部修改必须返回一个区块，不能返回整页。'];
      else try { code = await applyLocalEdit(source.code, target, parsed.data.html, parsed.data.css); }
      catch (error) { if (!(error instanceof CodeRepairError)) throw error; issues = [error.message]; }
    }
    if (code) {
      await runStep(site.siteId, run.id, { step: '检查修改范围、区块事实与三档布局' });
      const committed = await commitSiteCode({ siteId: site.siteId, baseRevision: run.baseRevision, code, selectedTarget: target,
        author: 'assistant', summary: `${site.plan!.pages.find(page => page.id === target.pageId)?.title || target.pageId} · ${target.label}：${run.request}`.slice(0, 200), request: run.request, model: result.model, source: run.source });
      if (committed.status === 'conflict') throw new Error('版本已经更新，本次没有覆盖当前站点。');
      const checks = committed.status === 'applied' ? committed.version.checks : committed.checks;
      await runStep(site.siteId, run.id, { issues: checks.issues, attempts: [...(await getCodeSite(site.siteId))!.run!.attempts, { code, checks }] });
      if (committed.status === 'applied') {
        const summary = `已修改「${target.label}」，保存为版本 ${committed.version.revision}。`;
        if (annotationId) await replyAnnotation(site.siteId, annotationId, { body: summary, author: { id: 'assistant', name: '助手' } });
        await updateConversationAlignment(site.siteId, site.conversationId, record => ({ ...record, alignment: applyCommittedResult(record.alignment, { status: 'applied', summary, revision: committed.version.revision }) }));
        await appendConversationTurn({ siteId: site.siteId, conversationId: site.conversationId, userMessage: run.request, aiSummary: summary, appliedOperationsSummary: committed.version.summary, outcome: 'applied' });
        await runStep(site.siteId, run.id, { status: 'complete', step: summary, versionId: committed.version.id });
        return;
      }
      issues = checks.issues;
    }
    const responses = (await getCodeSite(site.siteId))!.run!.localResponses!;
    responses[responses.length - 1].issues = issues;
    await runStep(site.siteId, run.id, { issues, localResponses: responses });
  }
  throw new Error('两轮局部修正后仍未通过检查，未保存版本。可以重新点选并调整意见，或取消点选后选择「改整页」。');
}
async function executeLocalEditBatch(site: CodeSiteRecord, run: CodeRun) {
  const source = currentCodeVersion(site)!;
  const items = run.annotationBatch ?? [];
  const groups = mergeAnnotationEdits(items, { overlapConfirmed: run.annotationOverlapConfirmed });
  // Each writer gets only its own group's new comments. The atomic commit gets
  // all original user sources so new facts can be audited and cited together.
  const materials = codeFactMaterials(site, undefined, site.currentVersionId, true);
  if (run.saveAnnotation && !run.annotationIds?.length) {
    const annotationIds: Array<{ draftId: string; annotationId: string }> = [];
    for (const item of items) {
      const created = await createAnnotation({ siteId: site.siteId, pageId: item.target.pageId, pagePath: `/${item.target.pageId}`,
        anchor: { pageId: item.target.pageId, pagePath: `/${item.target.pageId}`, revision: source.revision, locale: 'zh', target: item.target,
          snapshot: { text: item.target.text, label: item.target.label }, capturedAt: run.startedAt },
        body: item.body, author: { id: 'workspace', name: '你' } });
      annotationIds.push({ draftId: item.draftId, annotationId: created.id });
    }
    await runStep(site.siteId, run.id, { annotationIds });
  }
  let groupIssues = groups.map(() => [] as string[]);
  for (let round = 0; round <= 2; round++) {
    await runStep(site.siteId, run.id, { step: round ? `修正 ${groups.length} 个选中区块（${round}/2）` : `合并修改 ${groups.length} 个选中区块`, repairRound: round });
    const results = await writeLocalEditBatch({ materials, preferences: site.preferences, plan: site.plan!, current: source.code,
      groups, issues: groupIssues.flat(), groupIssues });
    const current = (await getCodeSite(site.siteId))!.run!;
    const responses = [...(current.localResponses ?? []), ...results.map(result => ({ response: result.response, issues: [] as string[] }))];
    await runStep(site.siteId, run.id, { localResponses: responses });
    const parsed = z.object({ html: z.string().min(1).max(100000), css: z.string().max(30000) }).strict();
    const candidates: Array<{ html: string; css: string }> = [];
    const cannotEdit = new Map<number, string>();
    groupIssues = results.map(result => {
      const unavailable = z.object({ cannotEdit: z.string().min(1).max(500) }).strict().safeParse(result.response);
      if (unavailable.success) {
        cannotEdit.set(results.indexOf(result), unavailable.data.cannotEdit);
        return [unavailable.data.cannotEdit];
      }
      const value = parsed.safeParse(result.response);
      if (!value.success) return ['局部修改必须返回一个区块的 html 和 css，不能返回整页或整站。'];
      if (/<\/?(?:html|body|head|main)\b/i.test(value.data.html)) return ['局部修改必须返回一个区块，不能返回整页。'];
      candidates.push(value.data); return [];
    });
    if (cannotEdit.size) {
      const next = (await getCodeSite(site.siteId))!.run!.localResponses ?? [];
      for (let index = 0; index < groupIssues.length; index++) next[next.length - results.length + index]!.issues = groupIssues[index];
      const annotationResults = groups.map((group, index) => ({ draftIds: group.draftIds, status: 'rejected' as const,
        message: cannotEdit.get(index) ?? '因其他组失败未保存。' }));
      await runStep(site.siteId, run.id, { issues: groupIssues.flat(), localResponses: next, annotationResults });
      throw new Error('一组批注明确拒绝，未保存版本。');
    }
    if (groupIssues.some(issues => issues.length) || candidates.length !== groups.length) {
      const next = (await getCodeSite(site.siteId))!.run!.localResponses ?? [];
      for (let index = 0; index < groupIssues.length; index++) next[next.length - results.length + index]!.issues = groupIssues[index];
      await runStep(site.siteId, run.id, { issues: groupIssues.flat(), localResponses: next });
    } else {
      let code;
      try { code = await applyLocalEdits(source.code, groups, candidates); }
      catch (error) {
        if (!(error instanceof CodeRepairError)) throw error;
        groupIssues = groups.map(() => [error.message]);
      }
      if (code) {
        await runStep(site.siteId, run.id, { step: '检查多区块范围、事实与三档布局' });
        const committed = await commitSiteCode({ siteId: site.siteId, baseRevision: run.baseRevision, code, selectedTargets: groups.map(group => group.target),
          author: 'assistant', summary: `批量修改 ${groups.map(group => group.target.label).join('、')}`.slice(0, 200), request: run.request,
          source: run.source, model: results.at(-1)?.model });
        if (committed.status === 'conflict') throw new Error('版本已经更新，本次没有覆盖当前站点。');
        const checks = committed.status === 'applied' ? committed.version.checks : committed.checks;
        await runStep(site.siteId, run.id, { issues: checks.issues, attempts: [...(await getCodeSite(site.siteId))!.run!.attempts, { code, checks }] });
        if (committed.status === 'applied') {
          const summary = `已合并修改 ${groups.length} 个区块，保存为版本 ${committed.version.revision}。`;
          const persistedRun = (await getCodeSite(site.siteId))?.run;
          for (const record of persistedRun?.annotationIds ?? []) await replyAnnotation(site.siteId, record.annotationId, { body: summary, author: { id: 'assistant', name: '助手' } });
          await updateConversationAlignment(site.siteId, site.conversationId, record => ({ ...record, alignment: applyCommittedResult(record.alignment, { status: 'applied', summary, revision: committed.version.revision }) }));
          await appendConversationTurn({ siteId: site.siteId, conversationId: site.conversationId, userMessage: run.request, aiSummary: summary, appliedOperationsSummary: committed.version.summary, outcome: 'applied' });
          await runStep(site.siteId, run.id, { status: 'complete', step: summary, versionId: committed.version.id,
            annotationResults: groups.map(group => ({ draftIds: group.draftIds, status: 'applied' as const, message: summary })) });
          return;
        }
        const attributed = attributeLocalIssues(checks.issues, groups, source.code, code);
        if (attributed.overall.length) {
          const overallIssue = `整体检查未通过：${attributed.overall.join('；')}`;
          await runStep(site.siteId, run.id, { issues: checks.issues, overallIssue,
            annotationResults: groups.map(group => ({ draftIds: group.draftIds, status: 'rejected' as const, message: '批次未保存；请查看整体检查结果。' })) });
          throw new Error(overallIssue);
        }
        groupIssues = attributed.groupIssues;
        await runStep(site.siteId, run.id, { issues: checks.issues, overallIssue: undefined });
      }
    }
    const next = (await getCodeSite(site.siteId))!.run!.localResponses ?? [];
    for (let index = 0; index < groupIssues.length; index++) next[next.length - results.length + index]!.issues = groupIssues[index];
    await runStep(site.siteId, run.id, { issues: groupIssues.flat(), localResponses: next });
  }
  const message = '两轮多区块修正后仍未通过检查，未保存版本。请查看各条批注的拒因后重新发送。';
  await runStep(site.siteId, run.id, { annotationResults: groups.map((group, index) => ({ draftIds: group.draftIds, status: 'rejected' as const,
    message: groupIssues[index]?.[0] ?? '因其他组失败未保存。' })) });
  throw new Error(message);
}
async function execute(siteId: string, runId: string) {
  let site = (await getCodeSite(siteId))!; const run = site.run!;
  if (run.id !== runId) throw new Error('任务已经更新');
  if (run.kind === 'translate') {
    const source = currentCodeVersion(site);
    if (!source?.checks.passed) throw new Error('请先完成中文版的底线检查。');
    let result = await translateSiteCode(source.code, site.name, [], 2, undefined, codeFactMaterials(site));
    let round = result.correctionRounds;
    while (round <= 2) {
      await runStep(siteId, runId, { step: '检查英文文字保真与三档页面布局', repairRound: round });
      const committed = await commitSiteCode({ siteId, baseRevision: run.baseRevision, englishCode: result.code, author: 'assistant',
        summary: source.english ? '按当前中文版重新翻译英文版' : '生成英文版', request: run.request, model: result.model });
      if (committed.status === 'conflict') throw new Error('中文版已经更新，本次没有覆盖当前站点。');
      const check = committed.status === 'applied' ? committed.version.english!.checks : committed.checks;
      await runStep(siteId, runId, { issues: check.issues, attempts: [...(await getCodeSite(siteId))!.run!.attempts, { code: result.code, checks: check }] });
      if (committed.status === 'applied') {
        const summary = `英文版已保存为版本 ${committed.version.revision}，基于中文第 ${committed.version.english!.sourceRevision} 版。`;
        await appendConversationTurn({ siteId, conversationId: site.conversationId, userMessage: run.request, aiSummary: summary, appliedOperationsSummary: committed.version.summary, outcome: 'applied' });
        await runStep(siteId, runId, { status: 'complete', step: summary, versionId: committed.version.id });
        return;
      }
      if (round === 2) throw new Error('两轮翻译修正后仍未通过检查，未保存英文版。请查看完整问题后调整中文版或重试。');
      await runStep(siteId, runId, { step: `英文版未过，修正译文（${round + 1}/2）`, repairRound: round + 1 });
      round++;
      result = await translateSiteCode(source.code, site.name, committed.checks.issues, 2 - round, result.code, codeFactMaterials(site));
      round += result.correctionRounds;
    }
    return;
  }
  if (run.kind === 'plan') {
    const result = await planSiteCode(currentCodeVersion(site) ? codeFactMaterials(site) : site.materials, site.preferences, run.request);
    site = await updateCodeSite(siteId, () => ({ plan: result.plan }));
    await updateConversationAlignment(siteId, site.conversationId, record => {
      const epoch = record.alignment.epoch + 1, questionId = `code-confirm-${crypto.randomUUID()}`;
      const summary = result.plan.summary;
      return { ...record, alignment: { ...record.alignment, state: 'awaiting_confirmation', epoch, inflightRunId: null, confirmClaimed: false,
        currentQuestion: { questionId, questionRevision: epoch, kind: 'confirm_ops', prompt: summary, options: [{ id: 'approve', label: '确认并生成', description: '按下面的大纲写网站' }], allowOther: false },
        proposedChange: { questionId, questionRevision: epoch, summary, rejected: [], baseRevision: run.baseRevision, model: result.model, latencyMs: 0 } } };
    });
    await runStep(siteId, runId, { status: 'complete', step: '页面大纲已保存，等待确认' });
    return;
  }
  if (!site.plan) throw new Error('缺少已确认的页面大纲。');
  if (run.annotationBatch?.length) return executeLocalEditBatch(site, run);
  if (run.selectedTarget) return executeLocalEdit(site, run);
  const images = await listSiteImages(siteId);
  const materials = codeFactMaterials(site, run.request);
  const references = [];
  if (run.kind === 'edit') {
    const revisions = await selectCodeReferences({ request: run.request, currentRevision: currentCodeVersion(site)!.revision,
      versions: site.versions, preferences: { ...site.preferences, style: site.plan.style } });
    const selected = revisions.map(revision => {
      const version = site.versions.find(version => version.revision === revision);
      if (!version) throw new Error(`模型指定的第 ${revision} 版不存在，本次未保存版本。`);
      return version;
    });
    await runStep(siteId, runId, { referenceVersionIds: selected.map(version => version.id), step: '按修改要求写站点代码' });
    for (const version of selected) references.push({ revision: version.revision, name: version.name, code: version.code });
  }
  let result = await writeSiteCode({ materials, preferences: site.preferences, plan: site.plan, images, request: run.pageId ? `只修改当前页 ${run.pageId}，其他页面、公共页头页脚及其样式保持。${run.request}` : run.request,
    references,
    ...(run.kind === 'edit' ? { current: currentCodeVersion(site)!.code } : {}) });
  for (let round = 0; round <= 2; round++) {
    await runStep(siteId, runId, { step: '清理资源，检查事实与三档页面布局', repairRound: round });
    // A plan cannot be silently reduced by the writer, including during repairs.
    const missing = site.plan.pages.filter(p => !result.code.pages.some(page => page.id === p.id));
    if (missing.length) throw new Error(`模型未完成这些页面：${missing.map(p => p.title).join('、')}；没有保存版本。`);
    const committed = await commitSiteCode({ siteId, baseRevision: run.baseRevision, code: result.code, pageId: run.pageId,
      author: 'assistant', summary: run.kind === 'edit' ? run.request.slice(0, 100) : `生成${site.plan.pages.map(p => p.title).join('、')}`,
      request: run.request, model: result.model, source: run.source });
    if (committed.status === 'conflict') throw new Error('版本已经更新，本次没有覆盖当前站点。');
    const check = committed.status === 'applied' ? committed.version.checks : committed.checks;
    await runStep(siteId, runId, { issues: check.issues, attempts: [...(await getCodeSite(siteId))!.run!.attempts, { code: result.code, checks: check }] });
    if (committed.status === 'applied') {
      const summary = `版本 ${committed.version.revision} 已保存，底线检查通过。`;
      await updateConversationAlignment(siteId, site.conversationId, record => ({ ...record, alignment: applyCommittedResult(record.alignment, { status: 'applied', summary, revision: committed.version.revision }) }));
      await appendConversationTurn({ siteId, conversationId: site.conversationId, userMessage: run.request, aiSummary: summary, appliedOperationsSummary: committed.version.summary, outcome: 'applied' });
      await runStep(siteId, runId, { status: 'complete', step: summary, versionId: committed.version.id });
      return;
    }
    // Full issues and all candidates were persisted above. Conversation copy
    // is a short explanation, not another archive of the entire refusal.
    if (round === 2) throw new Error('两轮修正后仍未通过底线检查，未保存版本。请查看完整问题，补充资料或调整要求后重试。');
    await runStep(siteId, runId, { step: `底线检查未过，交回模型修正（${round + 1}/2）`, repairRound: round + 1 });
    result = await repairSiteCode({ materials, preferences: { ...site.preferences, style: site.plan.style },
      current: committed.code, issues: committed.checks.issues, cleaned: committed.checks.cleaned });
  }
}
export async function handleCodeChat(siteId: string, raw: unknown) {
  const parsed = requestSchema.safeParse(raw);
  if (!parsed.success) return Response.json({ userMessage: '请求内容无效。' }, { status: 400 });
  let site = (await getCodeSite(siteId))!; const input = parsed.data;
  try {
    if (input.action === 'state') {
      const state = await codeWorkspaceState(site);
      if (state.conversationError) return Response.json(state);
      // Refreshes observe the existing job. A stopped process is reported; it never repeats a model call.
      if (site.run?.status === 'running' && !active.has(site.run.id)) {
        site = await runStep(siteId, site.run.id, { status: 'error', step: '生成进程已中断，本次未完成；请重新提交要求。' });
        await updateConversationAlignment(siteId, site.conversationId, record => ({ ...record, alignment: applyCommittedResult(record.alignment, { status: 'error', summary: site.run!.step }) }));
      }
      return Response.json(await codeWorkspaceState(site));
    }
    if (input.annotationSubmissionId) {
      if (!input.message || (!input.selectedTarget && !input.annotationBatch?.length) || !input.saveAnnotation || input.action)
        return Response.json({ userMessage: '批注发送须提供意见与选中区块。' }, { status: 400 });
      // A refresh or a lost response observes this submission; it never repeats it.
      if (site.runs.some(run => run.annotationSubmissionId === input.annotationSubmissionId))
        return Response.json(await codeWorkspaceState(site));
    }
    if (site.run?.status === 'running') return Response.json({ userMessage: '当前任务还在进行，请等待完成。' }, { status: 409 });
    if (input.baseRevision !== undefined && input.baseRevision !== (currentCodeVersion(site)?.revision ?? 0)) return Response.json({ userMessage: '版本已经更新，请刷新后再试。' }, { status: 409 });
    const conversation = (await getConversation(siteId, site.conversationId))!;
    if (input.action === 'translate') {
      if (input.baseRevision === undefined) return Response.json({ userMessage: '请提供当前版本编号。' }, { status: 400 });
      if (!currentCodeVersion(site)?.checks.passed) return Response.json({ userMessage: '请先生成并检查中文版。' }, { status: 422 });
      site = await claimRun(siteId, 'translate', currentCodeVersion(site)!.english ? '按当前中文版重新翻译英文版' : '生成英文版', input.baseRevision); schedule(site);
    } else if (input.action === 'cancel') {
      await applyConversationAlignmentAction({ siteId, conversationId: site.conversationId, action: 'cancel' });
    } else if (input.action === 'start') {
      if (!site.materials) return Response.json({ userMessage: '请先提供公司资料。' }, { status: 422 });
      if (conversation.alignment.currentQuestion) return Response.json({ userMessage: '请先完成当前风格选择或方案确认。' }, { status: 409 });
      await applyConversationAlignmentAction({ siteId, conversationId: site.conversationId, action: 'start',
        pendingRequest: { message: '调整风格与疏密，保留有效资料与已有功能入口。', baseRevision: currentCodeVersion(site)?.revision ?? 0, selectedTarget: null }, startQuestion: styleQuestion(conversation.alignment.epoch) });
    } else if (input.action === 'select') {
      if (conversation.alignment.currentQuestion?.kind !== 'style') return Response.json({ userMessage: '当前不是风格选择，请使用当前卡片。' }, { status: 409 });
      // A question saved by an evaluation process cannot keep authorizing a
      // pending candidate when reopened in an ordinary process.
      if (!serverCodeStyleOptions.some(option => option.id === input.optionId)) return Response.json({ userMessage: '未知的选项。' }, { status: 400 });
      if (input.preferences && input.preferences.style !== input.optionId) return Response.json({ userMessage: '风格与选项不一致。' }, { status: 400 });
      const selected = await applyConversationAlignmentAction({ siteId, conversationId: site.conversationId, action: 'select', questionId: input.questionId, questionRevision: input.questionRevision, optionId: input.optionId });
      const style = codePreferenceStyleSchema.parse(selected.record.alignment.styleOptionId);
      site = await updateCodeSite(siteId, () => ({ preferences: input.preferences ?? { ...site.preferences, style } }));
      if (selected.result.ok && selected.result.shouldContinue) {
        site = await claimRun(siteId, 'plan', currentCodeVersion(site) ? '调整风格与疏密，保留有效资料与已有功能入口。' : site.materials, currentCodeVersion(site)?.revision ?? 0); schedule(site);
      }
    } else if (input.action === 'confirm') {
      // A saved plan does not carry the evaluation process's admission.
      requireModelTaskAdmission(site.plan?.style);
      const confirmed = await applyConversationAlignmentAction({ siteId, conversationId: site.conversationId, action: 'confirm', questionId: input.questionId, questionRevision: input.questionRevision });
      if (confirmed.result.ok && confirmed.result.shouldCommit) {
        site = await claimRun(siteId, 'generate', currentCodeVersion(site) ? '按确认的风格、版式与信息密度重新生成，保留有效资料与已有功能入口。' : site.materials, currentCodeVersion(site)?.revision ?? 0); schedule(site);
      }
    } else if (input.message) {
      if (!currentCodeVersion(site) && input.annotationBatch?.length)
        throw new Error('批注批次须先生成中文版，再选择区块后发送。');
      if (currentCodeVersion(site)) {
        const source = await registerUserSources(siteId, input);
        site = (await getCodeSite(siteId))!;
        if (input.selectedTarget) {
          if (input.baseRevision === undefined || input.selectedTarget.versionId !== currentCodeVersion(site)!.id) throw new CodeRunConflictError('锚点版本已改变，请重新点选。');
          await localEditContext(currentCodeVersion(site)!.code, input.selectedTarget);
        }
        if (input.annotationBatch?.length) {
          if (input.baseRevision === undefined || input.annotationBatch.some(item => item.target.versionId !== currentCodeVersion(site)!.id || item.revision !== currentCodeVersion(site)!.revision)) throw new CodeRunConflictError('批注中有区块来自旧版本，请重新点选。');
          mergeAnnotationEdits(input.annotationBatch, { overlapConfirmed: input.annotationOverlapConfirmed });
          for (const item of input.annotationBatch) await localEditContext(currentCodeVersion(site)!.code, item.target);
        }
        if (input.pageId && !currentCodeVersion(site)!.code.pages.some(page => page.id === input.pageId)) throw new Error('当前页面不存在，请重新选择。');
        site = await claimRun(siteId, 'edit', input.annotationBatch?.length ? input.annotationBatch.map(item => item.body).join('\n\n') : input.message, currentCodeVersion(site)!.revision,
          { selectedTarget: input.selectedTarget, pageId: input.pageId, saveAnnotation: input.saveAnnotation,
            ...(input.annotationBatch ? { annotationBatch: input.annotationBatch, annotationOverlapConfirmed: input.annotationOverlapConfirmed } : {}),
            ...(source ? { source } : {}),
            ...(input.annotationSubmissionId ? { annotationSubmissionId: input.annotationSubmissionId } : {}) }); schedule(site);
      } else {
        if (input.selectedTarget) throw new Error('请先生成中文版，再点选区块。');
        if (conversation.alignment.currentQuestion) return Response.json({ userMessage: '请先完成当前风格选择或方案确认。' }, { status: 409 });
        if (conversation.alignment.styleOptionId) await updateConversationAlignment(siteId, site.conversationId, record => ({ ...record, alignment: { ...record.alignment, styleOptionId: null, confirmClaimed: false, lastResult: null } }));
        await registerUserSources(siteId, input);
        const company = input.message.match(/^[ \t]*公司名[：:][ \t]*([^\n]+)/m)?.[1]?.trim();
        site = await updateCodeSite(siteId, () => ({ materials: input.message!, ...(company ? { name: company.slice(0, 100) } : {}) }));
        await applyConversationAlignmentAction({ siteId, conversationId: site.conversationId, action: 'start',
          pendingRequest: { message: input.message, baseRevision: 0, selectedTarget: null }, startQuestion: styleQuestion(conversation.alignment.epoch) });
      }
    } else return Response.json({ userMessage: '请提供公司资料或选择当前方案。' }, { status: 400 });
    return Response.json(await codeWorkspaceState((await getCodeSite(siteId))!), { status: site.run?.status === 'running' ? 202 : 200 });
  } catch (error) {
    return Response.json({ userMessage: error instanceof Error ? error.message : '请求失败，未保存版本。' }, { status: error instanceof CodeRunConflictError ? 409 : error instanceof CodeStyleAdmissionError ? 400 : error instanceof AlignmentActionError ? error.status : 422 });
  }
}
