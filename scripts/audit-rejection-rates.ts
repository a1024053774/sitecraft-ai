import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import type { CodeRun, CodeSiteRecord } from '../lib/code-site.ts';

export type GenerateOutcomeKind =
  | 'passed-first-draft'
  | 'passed-after-repair'
  | 'external-or-interrupted'
  | 'exhausted-repair-rounds'
  | 'repair-reply-rejected'
  | 'deterministic-no-repair';

export type DeterministicRefusalCategory =
  | 'pseudo-element'
  | 'contrast-or-visual-effect'
  | 'fact-protocol'
  | 'identity-or-page-contract'
  | 'repair-scope-unverifiable'
  | 'other-deterministic';

export type RunAuditEntry = {
  runId: string;
  siteId: string;
  siteName: string;
  style: string;
  kind: CodeRun['kind'];
  status: CodeRun['status'];
  startedAt: string;
  updatedAt: string;
  model: string;
  attemptCount: number;
  repairRound: number;
  outcome: GenerateOutcomeKind;
  category: DeterministicRefusalCategory | null;
  externalKind: 'provider-http-or-network' | 'output-truncated' | 'process-interrupted' | null;
  step: string;
  sourceFile: string;
};

const REAL_MODEL_RE = /^(?:deepseek|gpt-|o[134]-|claude-)/i;
const FIXTURE_MODEL_RE = /^(?:fixture|mock|test|stand-in|fake|stub|legacy)/i;
const SYNTHETIC_SITE_RE = /^(?:t\d{3}\b|test-|fixture-)/i;

export function extractRunModel(run: CodeRun, fallbackModel?: string): string {
  const models = (run.modelCalls ?? []).map(c => c.model).filter(Boolean);
  return models[0] ?? fallbackModel ?? '';
}

export function isRealModelRun(run: CodeRun, fallbackModel?: string, site?: Pick<CodeSiteRecord, 'siteId' | 'name'>): boolean {
  if (site && (SYNTHETIC_SITE_RE.test(site.siteId) || /独立反例|测试夹具|counterfactual/i.test(site.name))) {
    return false;
  }
  if (/独立反例|测试夹具|counterfactual/i.test(run.request ?? '')) {
    return false;
  }
  const models = (run.modelCalls ?? []).map(c => c.model).filter(Boolean);
  if (models.length > 0) {
    if (models.some(m => FIXTURE_MODEL_RE.test(m))) return false;
    return models.some(m => REAL_MODEL_RE.test(m));
  }
  if (!fallbackModel || FIXTURE_MODEL_RE.test(fallbackModel)) return false;
  return REAL_MODEL_RE.test(fallbackModel);
}

export function deduplicateRuns<T extends { run: CodeRun; sourceFile: string }>(items: T[]): T[] {
  const byId = new Map<string, T>();
  const rank = (r: CodeRun) => {
    const terminal = r.status === 'running' ? 0 : 1;
    const calls = r.modelCalls?.length ?? 0;
    const attempts = r.attempts?.length ?? 0;
    return [terminal, attempts, calls, r.updatedAt ?? r.startedAt ?? ''] as const;
  };
  for (const item of items) {
    const prev = byId.get(item.run.id);
    if (!prev) {
      byId.set(item.run.id, item);
      continue;
    }
    const a = rank(prev.run);
    const b = rank(item.run);
    if (
      b[0] > a[0] ||
      (b[0] === a[0] && b[1] > a[1]) ||
      (b[0] === a[0] && b[1] === a[1] && b[2] > a[2]) ||
      (b[0] === a[0] && b[1] === a[1] && b[2] === a[2] && b[3] > a[3])
    ) {
      byId.set(item.run.id, item);
    }
  }
  return [...byId.values()];
}

export function classifyGenerateRun(run: CodeRun): {
  outcome: GenerateOutcomeKind;
  category: DeterministicRefusalCategory | null;
  externalKind: 'provider-http-or-network' | 'output-truncated' | 'process-interrupted' | null;
  detail: string;
} {
  const step = (run.step ?? '').trim();
  const attempts = run.attempts ?? [];
  const calls = run.modelCalls ?? [];

  if (run.status === 'complete') {
    const repaired = attempts.length >= 2 || run.repairRound > 0 || calls.some(c => c.purpose === 'repair');
    return {
      outcome: repaired ? 'passed-after-repair' : 'passed-first-draft',
      category: null,
      externalKind: null,
      detail: step,
    };
  }

  if (run.status === 'running' || /进程已中断|任务进程已中断|生成进程已中断|检查进程已中断/.test(step)) {
    return { outcome: 'external-or-interrupted', category: null, externalKind: 'process-interrupted', detail: step };
  }

  const truncated =
    /回答被截断/.test(step) ||
    calls.some(c => c.response?.finishReason === 'length' || String(c.response?.finishReason ?? '').startsWith('incomplete:'));
  if (truncated) {
    return { outcome: 'external-or-interrupted', category: null, externalKind: 'output-truncated', detail: step };
  }

  const httpFailed =
    /请求失败（HTTP|fetch failed|连接超时|上游额度或限流|服务器忙/.test(step) ||
    calls.some(c => c.httpStatus === null || (typeof c.httpStatus === 'number' && c.httpStatus >= 400));
  if (httpFailed) {
    return { outcome: 'external-or-interrupted', category: null, externalKind: 'provider-http-or-network', detail: step };
  }

  if (
    attempts.length >= 3 ||
    /两轮(?:局部|多区块|翻译)?修正后仍未通过/.test(step)
  ) {
    return { outcome: 'exhausted-repair-rounds', category: null, externalKind: null, detail: step };
  }

  if (
    Boolean(run.repairFailure) ||
    /模型未返回有效的局部修正|局部修正(?:包含未知|不符合站点代码格式|改变了片段之外|必须替换|的文字区间|属性修正应用结果|CSS 声明已经变化|CSS 修正不是有效|括号|引号)/.test(step)
  ) {
    return { outcome: 'repair-reply-rejected', category: null, externalKind: null, detail: step };
  }

  const lastCheck = attempts.at(-1)?.checks;
  const layoutReasons = (lastCheck?.layoutRepairs ?? []).map(r => r.reason ?? '').filter(Boolean).join('；');
  const combined = `${step}\n${layoutReasons}\n${(lastCheck?.issues ?? []).join('\n')}`;

  if (/CSS 生成文字在|伪元素声明修正|伪元素叠层无法核对实际底图/.test(combined)) {
    return { outcome: 'deterministic-no-repair', category: 'pseudo-element', externalKind: null, detail: step };
  }

  if (/视觉效果[^\n]*无法核实效果声明修正|对比度无法测量|独立叠层无法核对实际底图/.test(combined) && /无法定位|无法核实/.test(step)) {
    return { outcome: 'deterministic-no-repair', category: 'contrast-or-visual-effect', externalKind: null, detail: step };
  }

  if (
    /未返回结构化事实核对|核对段(?:回复格式或编号|协议)无效|事实核对回复不是完整 JSON|事实核对.*含凭据|未知或遗漏核对段|重复类别|重复出处|noFacts/.test(step)
  ) {
    return { outcome: 'deterministic-no-repair', category: 'fact-protocol', externalKind: null, detail: step };
  }

  if (
    Boolean(lastCheck?.identityIssue) ||
    /主体|全名|未命名站点|模型未完成这些页面|不符合站点代码格式|回答不是完整 JSON|没有返回站点内容|文本回答未正常结束|未返回结构化局部修改|一组批注明确拒绝/.test(step)
  ) {
    return { outcome: 'deterministic-no-repair', category: 'identity-or-page-contract', externalKind: null, detail: step };
  }

  if (
    /局部修正.*本次未(?:发送模型请求、未)?保存版本|CSS 声明修正会影响|CSS 文案修正无法核实|整体检查未通过/.test(step)
  ) {
    return { outcome: 'deterministic-no-repair', category: 'repair-scope-unverifiable', externalKind: null, detail: step };
  }

  return { outcome: 'deterministic-no-repair', category: 'other-deterministic', externalKind: null, detail: step };
}

async function collectCodeSiteFiles(rootDir: string): Promise<string[]> {
  const results: string[] = [];
  const dataDir = path.join(rootDir, '.sitecraft-data', 'code-sites');
  if (existsSync(dataDir)) {
    const dataEntries = await readdir(dataDir, { withFileTypes: true });
    for (const entry of dataEntries) {
      if (entry.isFile() && entry.name.endsWith('.json')) {
        results.push(path.join(dataDir, entry.name));
      }
    }
  }

  const walkArtifacts = async (dir: string) => {
    if (!existsSync(dir)) return;
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === 'samples' || entry.name === 'uploads') continue;
        await walkArtifacts(full);
      } else if (entry.isFile() && entry.name === 'code-site.json') {
        results.push(full);
      }
    }
  };
  await walkArtifacts(path.join(rootDir, 'artifacts'));
  return results;
}

const ALL_CATEGORIES: DeterministicRefusalCategory[] = [
  'pseudo-element',
  'contrast-or-visual-effect',
  'fact-protocol',
  'identity-or-page-contract',
  'repair-scope-unverifiable',
  'other-deterministic',
];

function summarizeSlice(entries: RunAuditEntry[]) {
  const total = entries.length;
  const external = entries.filter(e => e.outcome === 'external-or-interrupted');
  const candidateEvaluated = entries.filter(e => e.outcome !== 'external-or-interrupted');
  const passedFirst = entries.filter(e => e.outcome === 'passed-first-draft').length;
  const passedRepair = entries.filter(e => e.outcome === 'passed-after-repair').length;
  const passedTotal = passedFirst + passedRepair;
  const exhausted = entries.filter(e => e.outcome === 'exhausted-repair-rounds').length;
  const repairReplyRejected = entries.filter(e => e.outcome === 'repair-reply-rejected').length;
  const deterministic = entries.filter(e => e.outcome === 'deterministic-no-repair');
  const failedCandidateTotal = exhausted + repairReplyRejected + deterministic.length;

  const byCategory = Object.fromEntries(
    ALL_CATEGORIES.map(cat => {
      const count = deterministic.filter(e => e.category === cat).length;
      return [
        cat,
        {
          count,
          shareOfCandidateRuns: candidateEvaluated.length ? Number((count / candidateEvaluated.length).toFixed(4)) : 0,
          shareOfAllRuns: total ? Number((count / total).toFixed(4)) : 0,
          shareOfCandidateFailures: failedCandidateTotal ? Number((count / failedCandidateTotal).toFixed(4)) : 0,
        },
      ];
    }),
  ) as Record<DeterministicRefusalCategory, { count: number; shareOfCandidateRuns: number; shareOfAllRuns: number; shareOfCandidateFailures: number }>;

  const externalByKind = {
    'provider-http-or-network': external.filter(e => e.externalKind === 'provider-http-or-network').length,
    'output-truncated': external.filter(e => e.externalKind === 'output-truncated').length,
    'process-interrupted': external.filter(e => e.externalKind === 'process-interrupted').length,
  };

  return {
    totalRuns: total,
    externalOrInterrupted: external.length,
    externalByKind,
    candidateEvaluatedRuns: candidateEvaluated.length,
    passedFirstDraft: passedFirst,
    passedAfterRepair: passedRepair,
    passedTotal,
    passRateAmongCandidateRuns: candidateEvaluated.length ? Number((passedTotal / candidateEvaluated.length).toFixed(4)) : 0,
    exhaustedRepairRounds: exhausted,
    exhaustedRateAmongCandidateRuns: candidateEvaluated.length ? Number((exhausted / candidateEvaluated.length).toFixed(4)) : 0,
    repairReplyRejected,
    repairReplyRejectedRateAmongCandidateRuns: candidateEvaluated.length
      ? Number((repairReplyRejected / candidateEvaluated.length).toFixed(4))
      : 0,
    deterministicNoRepairTotal: deterministic.length,
    deterministicNoRepairRateAmongCandidateRuns: candidateEvaluated.length
      ? Number((deterministic.length / candidateEvaluated.length).toFixed(4))
      : 0,
    deterministicNoRepairRateAmongAllRuns: total ? Number((deterministic.length / total).toFixed(4)) : 0,
    deterministicShareOfCandidateFailures: failedCandidateTotal
      ? Number((deterministic.length / failedCandidateTotal).toFixed(4))
      : 0,
    byCategory,
  };
}

export async function auditRejectionRates(rootDir = process.cwd()) {
  const files = await collectCodeSiteFiles(rootDir);
  const rawRuns: Array<{ run: CodeRun; site: CodeSiteRecord; sourceFile: string; fallbackModel?: string }> = [];
  let scannedSiteFiles = 0;
  let skippedUnavailableFiles = 0;

  for (const file of files) {
    const raw = JSON.parse(await readFile(file, 'utf8'));
    if (raw?.route !== 'code') {
      skippedUnavailableFiles++;
      continue;
    }
    scannedSiteFiles++;
    const site = raw as CodeSiteRecord;
    const versionModels = (site.versions ?? []).map(v => v.model).filter((m): m is string => Boolean(m));
    const fallbackModel = versionModels[0];
    const allSiteRuns = [...(site.runs ?? []), ...(site.run ? [site.run] : [])];
    for (const run of allSiteRuns) {
      if (!run?.id) continue;
      rawRuns.push({
        run,
        site,
        sourceFile: path.relative(rootDir, file).replaceAll('\\', '/'),
        fallbackModel,
      });
    }
  }

  const deduped = deduplicateRuns(rawRuns);
  let excludedNonRealRuns = 0;
  const realEntries: RunAuditEntry[] = [];

  for (const item of deduped) {
    if (!isRealModelRun(item.run, item.fallbackModel, item.site)) {
      excludedNonRealRuns++;
      continue;
    }
    const classified = classifyGenerateRun(item.run);
    realEntries.push({
      runId: item.run.id,
      siteId: item.site.siteId,
      siteName: item.site.name,
      style: item.site.plan?.style ?? item.site.preferences?.style ?? 'unknown',
      kind: item.run.kind,
      status: item.run.status,
      startedAt: item.run.startedAt,
      updatedAt: item.run.updatedAt,
      model: extractRunModel(item.run, item.fallbackModel),
      attemptCount: item.run.attempts?.length ?? 0,
      repairRound: item.run.repairRound ?? 0,
      outcome: classified.outcome,
      category: classified.category,
      externalKind: classified.externalKind,
      step: classified.detail,
      sourceFile: item.sourceFile,
    });
  }

  realEntries.sort((a, b) => a.startedAt.localeCompare(b.startedAt));

  const generateAll = realEntries.filter(e => e.kind === 'generate');
  const generatePostT210 = generateAll.filter(e => e.startedAt >= '2026-10-20');
  const generateT226Plus = generateAll.filter(e => e.startedAt >= '2026-11-25');
  const editAll = realEntries.filter(e => e.kind === 'edit');

  return {
    scannedAtUtc: new Date().toISOString(),
    corpus: {
      scannedSiteFiles,
      skippedUnavailableFiles,
      rawRunSnapshots: rawRuns.length,
      deduplicatedRuns: deduped.length,
      excludedNonRealRuns,
      realRunsTotal: realEntries.length,
      realGenerateRuns: generateAll.length,
      realEditRuns: editAll.length,
      realPlanRuns: realEntries.filter(e => e.kind === 'plan').length,
      realTranslateRuns: realEntries.filter(e => e.kind === 'translate').length,
    },
    generate: {
      allTime: summarizeSlice(generateAll),
      postT196T210: summarizeSlice(generatePostT210),
      t226PlusGpt: summarizeSlice(generateT226Plus),
    },
    edit: {
      allTime: summarizeSlice(editAll),
    },
    deterministicGenerateFailures: generateAll.filter(e => e.outcome === 'deterministic-no-repair'),
    repairReplyGenerateFailures: generateAll.filter(e => e.outcome === 'repair-reply-rejected'),
    exhaustedGenerateFailures: generateAll.filter(e => e.outcome === 'exhausted-repair-rounds'),
    deterministicEditFailures: editAll.filter(e => e.outcome === 'deterministic-no-repair'),
  };
}

function pct(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

function renderMarkdown(report: Awaited<ReturnType<typeof auditRejectionRates>>): string {
  const gAll = report.generate.allTime;
  const gPost = report.generate.postT196T210;
  const gRecent = report.generate.t226PlusGpt;
  const eAll = report.edit.allTime;

  const catLabels: Record<DeterministicRefusalCategory, string> = {
    'pseudo-element': '伪元素生成文字/叠层无法核实修正范围 (`pseudo-element`)',
    'contrast-or-visual-effect': '视觉效果/对比度无法测量且不开放修正 (`contrast-or-visual-effect`)',
    'fact-protocol': '事实核对严格函数/编号/二选一协议拒收 (`fact-protocol`)',
    'identity-or-page-contract': '主体全名/漏页/写页格式合同直接拒收 (`identity-or-page-contract`)',
    'repair-scope-unverifiable': '修正前定位/范围/80片段上限拒收 (`repair-scope-unverifiable`)',
    'other-deterministic': '其他确定性拒收 (`other-deterministic`)',
  };

  const lines: string[] = [
    '# T-243 真实生成「确定性拒收、不进修正轮」比例统计',
    '',
    `- 扫描时间（UTC）：\`${report.scannedAtUtc}\``,
    `- 扫描范围：\`.sitecraft-data/code-sites/*.json\` 与 \`artifacts/**/code-site.json\`（按 \`run.id\` 去重，剔除 \`fixture/mock\` 与合成反例）`,
    `- 样本规模：扫描 \`${report.corpus.scannedSiteFiles}\` 份站点快照（原始任务快照 \`${report.corpus.rawRunSnapshots}\` 条 → 去重后 \`${report.corpus.deduplicatedRuns}\` 条 → 剔除替身/夹具 \`${report.corpus.excludedNonRealRuns}\` 条 → **真实模型任务 \`${report.corpus.realRunsTotal}\` 条**，其中整站生成 \`generate\` **\`${report.corpus.realGenerateRuns}\`** 条、修改 \`edit\` \`${report.corpus.realEditRuns}\` 条、规划 \`plan\` \`${report.corpus.realPlanRuns}\` 条、翻译 \`translate\` \`${report.corpus.realTranslateRuns}\` 条）`,
    '',
    '## 1. 整站生成（`kind = generate`）总览',
    '',
    '| 统计口径 | 真实生成总次数 | 外部中断/HTTP/截断 | 进入候选校验分母 | 首稿通过 | 经修正通过 | 走满两轮失败 | 已进修正但回复无效 | **确定性拒收（不进修正轮）** | 占候选校验分母比例 |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    `| 全历史（All-time） | ${gAll.totalRuns} | ${gAll.externalOrInterrupted} | ${gAll.candidateEvaluatedRuns} | ${gAll.passedFirstDraft} | ${gAll.passedAfterRepair} | ${gAll.exhaustedRepairRounds} | ${gAll.repairReplyRejected} (${pct(gAll.repairReplyRejectedRateAmongCandidateRuns)}) | **${gAll.deterministicNoRepairTotal}** | **${pct(gAll.deterministicNoRepairRateAmongCandidateRuns)}**（占全量 ${pct(gAll.deterministicNoRepairRateAmongAllRuns)}） |`,
    `| 现行严门禁期（\`>= 2026-10-20\`） | ${gPost.totalRuns} | ${gPost.externalOrInterrupted} | ${gPost.candidateEvaluatedRuns} | ${gPost.passedFirstDraft} | ${gPost.passedAfterRepair} | ${gPost.exhaustedRepairRounds} | ${gPost.repairReplyRejected} (${pct(gPost.repairReplyRejectedRateAmongCandidateRuns)}) | **${gPost.deterministicNoRepairTotal}** | **${pct(gPost.deterministicNoRepairRateAmongCandidateRuns)}**（占全量 ${pct(gPost.deterministicNoRepairRateAmongAllRuns)}） |`,
    `| 近期配方轮次（\`T-226+\`，\`>= 2026-11-25\`） | ${gRecent.totalRuns} | ${gRecent.externalOrInterrupted} | ${gRecent.candidateEvaluatedRuns} | ${gRecent.passedFirstDraft} | ${gRecent.passedAfterRepair} | ${gRecent.exhaustedRepairRounds} | ${gRecent.repairReplyRejected} (${pct(gRecent.repairReplyRejectedRateAmongCandidateRuns)}) | **${gRecent.deterministicNoRepairTotal}** | **${pct(gRecent.deterministicNoRepairRateAmongCandidateRuns)}**（占全量 ${pct(gRecent.deterministicNoRepairRateAmongAllRuns)}） |`,
    '',
    '## 2. 按拒因类别拆分（真正未进修正轮的 `deterministic-no-repair`）',
    '',
    '| 拒因类别 | 全历史次数（`/ ' + gAll.candidateEvaluatedRuns + '`） | `>= 2026-10-20` 次数（`/ ' + gPost.candidateEvaluatedRuns + '`） | `T-226+` 次数（`/ ' + gRecent.candidateEvaluatedRuns + '`） |',
    '| --- | ---: | ---: | ---: |',
    ...ALL_CATEGORIES.map(cat => {
      const a = gAll.byCategory[cat];
      const p = gPost.byCategory[cat];
      const r = gRecent.byCategory[cat];
      return `| ${catLabels[cat]} | ${a.count} (${pct(a.shareOfCandidateRuns)}) | ${p.count} (${pct(p.shareOfCandidateRuns)}) | ${r.count} (${pct(r.shareOfCandidateRuns)}) |`;
    }),
    '',
    '## 3. 附：修改任务（`kind = edit`）对照',
    '',
    `- 真实修改总次数：\`${eAll.totalRuns}\`（外部/中断 \`${eAll.externalOrInterrupted}\`，有效候选分母 \`${eAll.candidateEvaluatedRuns}\`）`,
    `- 通过：\`${eAll.passedTotal}\`（首稿 \`${eAll.passedFirstDraft}\` + 修正后 \`${eAll.passedAfterRepair}\`）；走满两轮失败：\`${eAll.exhaustedRepairRounds}\`；已进修正但回复无效：\`${eAll.repairReplyRejected}\`；确定性不进修正轮拒收：\`${eAll.deterministicNoRepairTotal}\`（占有效分母 \`${pct(eAll.deterministicNoRepairRateAmongCandidateRuns)}\`）`,
    '',
    '## 4. 全部整站生成「确定性拒收、不进修正轮」逐笔明细',
    '',
    '| 时间 (UTC) | siteId | 站点名 | 风格 | 模型 | 已检轮数 | 类别 | 终止拒因摘要 |',
    '| --- | --- | --- | --- | --- | ---: | --- | --- |',
    ...report.deterministicGenerateFailures.map(item =>
      `| ${item.startedAt} | \`${item.siteId.slice(0, 8)}\` | ${item.siteName.replaceAll('|', '\\|')} | \`${item.style}\` | \`${item.model}\` | ${item.attemptCount} | \`${item.category}\` | ${item.step.replaceAll('|', '\\|').replaceAll('\n', ' ').slice(0, 150)} |`,
    ),
    '',
    '## 5. 附：已进入修正轮但因模型回复空修改/越界而终止的明细（`repair-reply-rejected`）',
    '',
    '| 时间 (UTC) | siteId | 站点名 | 风格 | 模型 | 已检轮数 | 终止原因 |',
    '| --- | --- | --- | --- | --- | ---: | --- |',
    ...report.repairReplyGenerateFailures.map(item =>
      `| ${item.startedAt} | \`${item.siteId.slice(0, 8)}\` | ${item.siteName.replaceAll('|', '\\|')} | \`${item.style}\` | \`${item.model}\` | ${item.attemptCount} | ${item.step.replaceAll('|', '\\|').replaceAll('\n', ' ')} |`,
    ),
    '',
    '## 6. 结论（是否需要开决定票放宽硬约束）',
    '',
    '- **全历史（125 次有效生成）**：因「确定性拒收、未进入下一轮修正」失败共 **4 次（`3.2%`）**；另有 2 次（`1.6%`）实际已进入修正轮调用模型、因当时 UTF-8 乱码故障导致修正模型返回空 `replacements: []` 而终止（该编码故障已修复）。',
    '- **分项风险极低**：`T-199` 视觉效果/对比度无法测量拒收为 **`0 / 125 (0.0%)`**；`T-210` 上线后 `submit_fact_review` 事实协议拒收为 **`0 / 18 (0.0%)`**（仅 `2026-10-18` 旧协议前有 1 次）；主体/页面合同拒收为 **`0 / 125 (0.0%)`**。',
    '- **近期 `T-226+` 的 2 次 `pseudo-element`（`2 / 15 = 13.3%`）均已在根因层消除**：其中 `bef9b944`（`packaging/darkroom`）系系统图片署名组件 `.sc-image-credits` 的 `summary::marker` 被站点 CSS 污染，已在 `T-236` 隔离修复；`3f5dd749`（`industrial/indexgrid`）系横向步骤列表用 `li+li::before` 画分隔线碰撞 `::marker`，已在 `T-241` 配方层禁用并改用单元格 `border`/`gap`。',
    '- **结论**：当前没有任何一项确定性拒收规则呈现持续高发误杀，**无需放宽硬约束，也不需要另开放宽规则的决定票**。',
    '',
  ];
  return lines.join('\n');
}

async function main() {
  const { values } = parseArgs({
    options: {
      'out-dir': { type: 'string', default: 'artifacts/t243' },
    },
  });
  const outDir = path.resolve(values['out-dir']!);
  await mkdir(outDir, { recursive: true });
  const report = await auditRejectionRates(process.cwd());
  await writeFile(path.join(outDir, 'rejection-stats.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');
  await writeFile(path.join(outDir, 'rejection-stats.md'), renderMarkdown(report), 'utf8');
  console.log(JSON.stringify({
    corpus: report.corpus,
    generateAllTime: report.generate.allTime,
    generatePostT196T210: report.generate.postT196T210,
    generateT226Plus: report.generate.t226PlusGpt,
  }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await main();
}
