import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { localEndpoint } from './local-endpoint.ts';
import { codeCheckBrowser } from '../lib/code-site-browser.ts';
import { codeFactMaterials, renderSiteCode, type CodeSiteRecord } from '../lib/code-site.ts';
import { readCodeFactSegments, pendingCodeFactSegments, type CodeFactReview, type CodeFactSegment } from '../lib/code-site-fact-segments.ts';
import { codeFactAuditInput } from '../lib/code-site-model.ts';

localEndpoint('SITECRAFT_BASE');
const source = process.argv[2];
if (!source) throw new Error('Usage: t154-replay-fact-segments.ts <read-only private/default/code-site.json>');
const site: CodeSiteRecord = JSON.parse(await readFile(source, 'utf8'));
const run = site.runs.find(run => run.kind === 'generate' && run.attempts.length === 3);
if (!run) throw new Error('Expected the recorded three-candidate generation');
// Historical audit findings are an external oracle. They have no segment IDs.
// Mark every segment containing a rejected quote as uncertain, including issues
// only discovered in a later round: this avoids claiming savings by hiding a
// known missed defect in an earlier apparently passed segment.
const rejectedQuotes = run.attempts.flatMap(attempt => attempt.checks.issues.map(issue => {
  const quote = [...issue.matchAll(/“([^”]+)”/g)].at(-1)?.[1];
  if (!quote) throw new Error(`Historical finding needs manual phrase mapping: ${issue}`);
  return { issue, quote };
}));
const materials = codeFactMaterials({ ...site, versions: [], currentVersionId: null }, run.request, null, true);
const browser = await codeCheckBrowser();
const reviews: CodeFactReview[] = [], rounds: unknown[] = [];
const factCalls = run.modelCalls!.filter(call => call.purpose === 'facts');
const estimate = (text: string) => {
  const han = (text.match(/\p{Script=Han}/gu) ?? []).length;
  return Math.ceil(han * 1.5 + (text.length - han) / 3);
};
try {
  await browser.send('Network.enable'); await browser.send('Network.setBlockedURLs', { urls: ['*'] });
  const { frameTree } = await browser.send<{ frameTree: { frame: { id: string } } }>('Page.getFrameTree');
  for (const [round, attempt] of run.attempts.entries()) {
    const found = new Map<string, CodeFactSegment>();
    for (const page of attempt.code.pages) for (const width of [375, 768, 1440]) {
      await browser.send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
      await browser.send('Page.setDocumentContent', { frameId: frameTree.frame.id, html: renderSiteCode(site.siteId, attempt.code, page.id) });
      const segments = await browser.evaluate<CodeFactSegment[]>(`(${readCodeFactSegments.toString()})(${JSON.stringify(attempt.code)},${JSON.stringify(page.id)})`);
      for (const segment of segments) found.set(segment.text, segment);
    }
    const nameText = `站点公司名检查（系统观察）：记录公司名「${site.name}」，完整名称${[...found.values()].some(segment => segment.text.includes(site.name)) ? '已出现' : '未出现'}。`;
    found.set(nameText, { text: nameText, context: { pageId: 'site', outline: [], headings: [] } });
    const segments = [...found.values()];
    const { pending, reused } = pendingCodeFactSegments(segments, materials, reviews, site.materials);
    const uncertain = segments.filter(segment => rejectedQuotes.some(({ quote }) => segment.text.includes(quote)));
    reviews.push({ format: 1, sourceMaterials: site.materials, materials, audited: pending.length, reused: reused.length,
      segments: segments.map(segment => ({ text: segment.text, issues: uncertain.includes(segment) ? ['历史核对曾拒绝的原句或关联条件；保守重核'] : [] })) });
    const payload = JSON.stringify(codeFactAuditInput(materials, pending));
    // Fixed instructions are unchanged in substance; use a conservative 1,800
    // token allowance. Output/thinking is unknowable without the real model.
    const inputEstimate = pending.length ? estimate(payload) + 1800 : 0;
    const old = factCalls[round].usage!;
    const visibleChars = segments.reduce((sum, segment) => sum + segment.text.length, 0);
    const pendingChars = pending.reduce((sum, segment) => sum + segment.text.length, 0);
    rounds.push({ round, total: segments.length, audited: pending.length, reused: reused.length,
      uncertain: uncertain.length, inputEstimate, oldTokens: old, pendingChars, visibleChars,
      // A transparent scenario, not measured/billed tokens. Also report the
      // unchanged-completion scenario so savings do not depend on this guess.
      proportionalCompletionScenario: inputEstimate + Math.ceil(old.completionTokens * pendingChars / visibleChars),
      unchangedCompletionScenario: inputEstimate + old.completionTokens,
      pending: codeFactAuditInput(materials, pending).segments });
  }
} finally { await browser.close(); }
const folder = path.resolve(`artifacts/t154/replay-${new Date().toISOString().replace(/[:.]/g, '-')}`);
await mkdir(folder, { recursive: true });
const result = { rejectedQuotes, source: path.resolve(source), createdAt: new Date().toISOString(), realModelCalled: false,
  method: '真实候选、三档渲染提取；按历史拒因最后一个引号内原句保守关联（映射随报告保存），后续轮才发现的问题也排除复用；中文字×1.5、其他字符÷3，加固定提示预算1800；completion按文字占比/保持原值两种情景，均非实测。',
  historicalRepairAuditTokens: factCalls.slice(1).reduce((sum, call) => sum + call.usage!.totalTokens, 0), rounds };
await writeFile(path.join(folder, 'replay.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify({ folder, historicalRepairAuditTokens: result.historicalRepairAuditTokens,
  rounds: rounds.map((round: any) => ({ ...round, pending: undefined })) }, null, 2));
