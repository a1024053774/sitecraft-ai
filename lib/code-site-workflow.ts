import { after } from 'next/server.js';
import { z } from 'zod';
import { getCodeSite, updateCodeSite, commitSiteCode } from './code-site-store.ts';
import { currentCodeVersion, codeFactMaterials, type CodeRun, type CodeSiteRecord } from './code-site.ts';
import { planSiteCode, selectCodeReferences, writeSiteCode, codeModelCalls } from './code-site-model.ts';
import { listSiteImages } from './site-images.ts';
import { applyConversationAlignmentAction, appendConversationTurn, getConversation, updateConversationAlignment } from './conversation-store.ts';
import { AlignmentActionError, AlignmentTextTooLongError, applyCommittedResult, publicAlignmentView, type CurrentQuestion } from './alignment.ts';
import { getExistingSite } from './site-store.ts';

const requestSchema = z.object({
  action: z.enum(['start', 'select', 'confirm', 'state', 'cancel']).optional(), message: z.string().trim().min(1).max(4000).optional(),
  baseRevision: z.number().int().nonnegative().optional(), questionId: z.string().max(100).optional(),
  questionRevision: z.number().int().nonnegative().optional(), optionId: z.string().max(80).optional(),
  preferences: z.object({ style: z.enum(['auto', 'precision', 'documentary']), layout: z.number().int().min(1).max(10), density: z.number().int().min(1).max(10) }).optional(),
});
const active = (globalThis as typeof globalThis & { __codeRuns?: Set<string> }).__codeRuns ??= new Set<string>();
export async function codeWorkspaceState(site: CodeSiteRecord) {
  try {
    const conversation = await getConversation(site.siteId, site.conversationId);
    return { codeSite: site, conversationId: site.conversationId,
      alignment: conversation ? publicAlignmentView(conversation.alignment) : null, turns: conversation?.turns ?? [] };
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
    options: [{ id: 'auto', label: '帮我选', description: '按公司资料安排视觉重点' },
      { id: 'precision', label: '精密工程', description: '细线、规整网格、参数目录' },
      { id: 'documentary', label: '现场实拍', description: '照片与大字，尺度更鲜明' }] };
}
async function runStep(siteId: string, runId: string, patch: Partial<CodeRun>) {
  return updateCodeSite(siteId, site => {
    if (site.run?.id !== runId) throw new Error('任务已经更新');
    return { run: { ...site.run, ...patch, ...(codeModelCalls.getStore() ? { modelCalls: codeModelCalls.getStore() } : {}), updatedAt: new Date().toISOString() } };
  });
}
async function claimRun(siteId: string, kind: CodeRun['kind'], request: string, baseRevision: number) {
  return updateCodeSite(siteId, site => {
    if (site.run?.status === 'running') throw new Error('当前任务还在进行，请等待完成。');
    if ((currentCodeVersion(site)?.revision ?? 0) !== baseRevision) throw new Error('版本已经更新，请刷新后再试。');
    const now = new Date().toISOString();
    return { run: { id: crypto.randomUUID(), kind, status: 'running', step: kind === 'plan' ? '读资料，规划页面大纲' : kind === 'edit' ? '理解修改要求，查阅版本目录' : '按方案写站点代码',
      request, baseRevision, startedAt: now, updatedAt: now, repairRound: 0, issues: [], attempts: [] } };
  });
}
function schedule(site: CodeSiteRecord) {
  const run = site.run!; active.add(run.id);
  after(() => codeModelCalls.run([], async () => {
    try { await execute(site.siteId, run.id); }
    catch (error) {
      // An explicitly deleted site has no workspace or records to receive a failed run.
      if (!await getExistingSite(site.siteId)) return;
      const message = error instanceof Error ? error.message : '本次任务失败，未保存版本。';
      await runStep(site.siteId, run.id, { status: 'error', step: message });
      await updateConversationAlignment(site.siteId, site.conversationId, record => ({ ...record, alignment: applyCommittedResult(record.alignment, { status: 'error', summary: message }) }));
      await appendConversationTurn({ siteId: site.siteId, conversationId: site.conversationId, userMessage: run.request, aiSummary: message, appliedOperationsSummary: '未保存版本', outcome: 'error' });
    } finally { active.delete(run.id); }
  }));
}
async function execute(siteId: string, runId: string) {
  let site = (await getCodeSite(siteId))!; const run = site.run!;
  if (run.id !== runId) throw new Error('任务已经更新');
  if (run.kind === 'plan') {
    const result = await planSiteCode(site.materials, site.preferences, run.request);
    site = await updateCodeSite(siteId, () => ({ plan: result.plan }));
    await updateConversationAlignment(siteId, site.conversationId, record => {
      const epoch = record.alignment.epoch + 1, questionId = `code-confirm-${crypto.randomUUID()}`;
      const summary = result.plan.summary;
      return { ...record, alignment: { ...record.alignment, state: 'awaiting_confirmation', epoch, inflightRunId: null, confirmClaimed: false,
        currentQuestion: { questionId, questionRevision: epoch, kind: 'confirm_ops', prompt: summary, options: [{ id: 'approve', label: '确认并生成', description: '按下面的大纲写网站' }], allowOther: false },
        proposedChange: { questionId, questionRevision: epoch, summary, operations: [], rejected: [], baseRevision: run.baseRevision, model: result.model, latencyMs: 0 } } };
    });
    await runStep(siteId, runId, { status: 'complete', step: '页面大纲已保存，等待确认' });
    return;
  }
  if (!site.plan) throw new Error('缺少已确认的页面大纲。');
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
  let result = await writeSiteCode({ materials, preferences: site.preferences, plan: site.plan, images, request: run.request,
    references,
    ...(run.kind === 'edit' ? { current: currentCodeVersion(site)!.code } : {}) });
  for (let round = 0; round <= 2; round++) {
    await runStep(siteId, runId, { step: '清理资源，检查事实与三档页面布局', repairRound: round });
    // A plan cannot be silently reduced by the writer, including during repairs.
    const missing = site.plan.pages.filter(p => !result.code.pages.some(page => page.id === p.id));
    if (missing.length) throw new Error(`模型未完成这些页面：${missing.map(p => p.title).join('、')}；没有保存版本。`);
    const committed = await commitSiteCode({ siteId, baseRevision: run.baseRevision, code: result.code,
      author: 'assistant', summary: run.kind === 'edit' ? run.request.slice(0, 100) : `生成${site.plan.pages.map(p => p.title).join('、')}`,
      request: run.request, model: result.model });
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
    result = await writeSiteCode({ materials, preferences: site.preferences, plan: site.plan, images,
      request: run.request, current: committed.code, issues: committed.checks.issues, references });
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
    if (site.run?.status === 'running') return Response.json({ userMessage: '当前任务还在进行，请等待完成。' }, { status: 409 });
    if (input.baseRevision !== undefined && input.baseRevision !== (currentCodeVersion(site)?.revision ?? 0)) return Response.json({ userMessage: '版本已经更新，请刷新后再试。' }, { status: 409 });
    const conversation = (await getConversation(siteId, site.conversationId))!;
    if (input.action === 'cancel') {
      await applyConversationAlignmentAction({ siteId, conversationId: site.conversationId, action: 'cancel' });
    } else if (input.action === 'select') {
      if (conversation.alignment.currentQuestion?.kind !== 'style') return Response.json({ userMessage: '当前不是风格选择，请使用当前卡片。' }, { status: 409 });
      if (input.preferences && input.preferences.style !== input.optionId) return Response.json({ userMessage: '风格与选项不一致。' }, { status: 400 });
      const selected = await applyConversationAlignmentAction({ siteId, conversationId: site.conversationId, action: 'select', questionId: input.questionId, questionRevision: input.questionRevision, optionId: input.optionId });
      const style = z.enum(['auto', 'precision', 'documentary']).parse(selected.record.alignment.styleOptionId);
      site = await updateCodeSite(siteId, () => ({ preferences: input.preferences ?? { ...site.preferences, style } }));
      if (selected.result.ok && selected.result.shouldContinue) {
        site = await claimRun(siteId, 'plan', site.materials, currentCodeVersion(site)?.revision ?? 0); schedule(site);
      }
    } else if (input.action === 'confirm') {
      const confirmed = await applyConversationAlignmentAction({ siteId, conversationId: site.conversationId, action: 'confirm', questionId: input.questionId, questionRevision: input.questionRevision });
      if (confirmed.result.ok && confirmed.result.shouldCommit) {
        site = await claimRun(siteId, 'generate', site.materials, currentCodeVersion(site)?.revision ?? 0); schedule(site);
      }
    } else if (input.message) {
      if (currentCodeVersion(site)) {
        site = await claimRun(siteId, 'edit', input.message, currentCodeVersion(site)!.revision); schedule(site);
      } else {
        if (conversation.alignment.currentQuestion) return Response.json({ userMessage: '请先完成当前风格选择或方案确认。' }, { status: 409 });
        if (conversation.alignment.styleOptionId) await updateConversationAlignment(siteId, site.conversationId, record => ({ ...record, alignment: { ...record.alignment, styleOptionId: null, confirmClaimed: false, lastResult: null } }));
        const company = input.message.match(/公司名[：:]\s*([^\n]+)/)?.[1]?.trim();
        site = await updateCodeSite(siteId, () => ({ materials: input.message!, ...(company ? { name: company.slice(0, 100) } : {}) }));
        await applyConversationAlignmentAction({ siteId, conversationId: site.conversationId, action: 'start',
          pendingRequest: { message: input.message, baseRevision: 0, selectedTarget: null }, startQuestion: styleQuestion(conversation.alignment.epoch) });
      }
    } else return Response.json({ userMessage: '请提供公司资料或选择当前方案。' }, { status: 400 });
    return Response.json(await codeWorkspaceState((await getCodeSite(siteId))!), { status: site.run?.status === 'running' ? 202 : 200 });
  } catch (error) {
    return Response.json({ userMessage: error instanceof Error ? error.message : '请求失败，未保存版本。' }, { status: error instanceof AlignmentActionError ? error.status : 422 });
  }
}
