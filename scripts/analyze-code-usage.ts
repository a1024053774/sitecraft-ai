import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { tokenUsage, usageBreakdown, summarize, type EvalRound } from './eval-set-report.ts';
import type { CodeModelCall, CodeSiteRecord } from '../lib/code-site.ts';

// Read-only: compare the round ledger with its preserved candidate snapshots.
// Never treat an unfinished snapshot as a completed evaluation.
const directories = process.argv.slice(2);
if (!directories.length) throw new Error('用法：node --experimental-strip-types scripts/analyze-code-usage.ts <round目录> [其他round目录]');
const reports = [];
for (const directory of directories) {
  const round: EvalRound = JSON.parse(await readFile(path.join(directory, 'private/round.json'), 'utf8'));
  const stages: Record<string, CodeModelCall[]> = {}, sources = [], discrepancies = [];
  const calls: CodeModelCall[] = [];
  for (let i = 0; i < round.cases.length; i++) {
    const c = round.cases[i], file = path.join(directory, `private/case-${i + 1}/code-site.json`);
    let snapshot: CodeSiteRecord | null = null;
    try { snapshot = JSON.parse(await readFile(file, 'utf8')); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    const caseCalls = snapshot ? snapshot.runs.flatMap(r => r.modelCalls || []) : c.modelCalls;
    const roundUsage = tokenUsage(c.modelCalls), snapshotUsage = tokenUsage(caseCalls);
    if (roundUsage.reported.totalTokens !== snapshotUsage.reported.totalTokens || c.modelCalls.length !== caseCalls.length) {
      discrepancies.push({ key: c.key, roundUsage, snapshotUsage, snapshotStatus: snapshot?.run?.status });
    }
    sources.push({ key: c.key, source: snapshot ? file : path.join(directory, 'private/round.json'),
      outcome: c.outcome, snapshotStatus: snapshot?.run?.status ?? null });
    // T-135 stored provider-reported reasoning separately; earlier rounds did
    // not record it. Absence remains unknown, rather than inferred from text.
    const accounting = (call: CodeModelCall) => {
      const old = (call as CodeModelCall & { response?: { reasoningTokens?: number | null } }).response?.reasoningTokens;
      return call.usage && call.usage.reasoningTokens === undefined && typeof old === 'number'
        ? { ...call, usage: { ...call.usage, reasoningTokens: old } } : call;
    };
    calls.push(...caseCalls.map(accounting));
    if (snapshot) for (const run of snapshot.runs) {
      let stage = run.kind === 'plan' ? 'plan' : 'initial', writes = 0;
      for (const call of run.modelCalls || []) {
        if (call.purpose === 'write') { writes++; if (stage === 'polish' || stage === 'polish-repair') stage = 'polish-repair'; else if (writes > 1) stage = 'repair'; }
        if (call.purpose === 'repair') stage = 'repair';
        if ((call.purpose as string) === 'polish') stage = 'polish';
        (stages[stage] ??= []).push(accounting(call));
      }
    }
  }
  const activeSites = sources.filter(s => s.snapshotStatus !== null || round.cases.find(c => c.key === s.key)!.modelCalls.length > 0).length;
  const usage = tokenUsage(calls), outcomeSummary = summarize(round.cases);
  reports.push({ directory: path.resolve(directory), commit: round.commit, roundStatus: round.status, profile: round.profile ?? 'full',
    sources, discrepancies, usage, ...usageBreakdown(calls),
    stages: Object.fromEntries(Object.entries(stages).map(([stage, calls]) => [stage, tokenUsage(calls)])),
    activeSites, averageTokensPerActiveSite: activeSites ? usage.reported.totalTokens / activeSites : null,
    outcomes: { generated: outcomeSummary.generated, rejected: outcomeSummary.finalRejections, checkedSites: outcomeSummary.checkedSites,
      firstDraftRejectionRate: outcomeSummary.firstDraftRejectionRate, finalRejectionRate: outcomeSummary.finalRejectionRate,
      blocked: outcomeSummary.blocked, notRun: outcomeSummary.notRun, errors: outcomeSummary.errors,
      note: discrepancies.length ? '轮次汇总与候选记录不同步；用量采用候选记录，结局仍为原汇总，未完成不能算通过。' : null } });
}
console.log(JSON.stringify(reports, null, 2));
