import { randomInt, randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, utimes, writeFile } from 'node:fs/promises';
import { crc32 } from 'node:zlib';
import path from 'node:path';
import type { CodeCheck, CodeModelCall, CodeSiteRecord } from '../lib/code-site.ts';
import type { SimulatedPackId } from '../lib/simulated-packs.ts';

export function requireWholeSitePlan(pack: SimulatedPackId, pageCount: number, profile: 'full' | 'quick' = 'full') {
  if (profile === 'quick') {
    if (pageCount !== 2) throw new Error(`快速档大纲需要首页和产品两个页面，实际 ${pageCount} 页；本次不确认生成。`);
    return;
  }
  const requested = { industrial: 3, export: 5, molding: 5, packaging: 4 }[pack];
  if (pageCount < requested) throw new Error(`大纲缩减了用户点名的页面：${pack} 至少 ${requested} 页，实际 ${pageCount} 页；本次不确认生成。`);
}

export type EvalCase = {
  key: string; pack: string; style: string; materials: string;
  outcome: 'not-run' | 'generated' | 'rejected' | 'error' | 'blocked';
  siteId?: string; versionId?: string; mixedScreenshot?: string; error?: string; elapsedMs: number;
  attempts: Array<{ round: number; checks: CodeCheck }>; modelCalls: CodeModelCall[];
  pages: Array<{ id: string; screenshots: Record<string, string> }>;
};
export type Control = { pack: string; url: string; framing?: 'fold'; screenshots: Record<string, string> };
export type EvalRound = { schemaVersion: 1; startedAt: string; command: string; commit: string; dirty: boolean; base: string;
  status: string; cases: EvalCase[]; controls: Control[]; errors: string[]; previous?: string; profile?: 'full' | 'quick' };

// This private snapshot contains raw candidates, including every refused round,
// and cleaned saved versions. It does not depend on the worktree's live store.
export async function saveCandidateEvidence(folder: string, site: CodeSiteRecord) {
  await writeFile(path.join(folder, 'code-site.json'), JSON.stringify(site, null, 2), 'utf8');
}

export function tokenUsage(calls: CodeModelCall[]) {
  const known = calls.filter(c => c.usage !== null);
  return { calls: calls.length, unknownCalls: calls.length - known.length,
    complete: calls.length > 0 && known.length === calls.length,
    reported: known.reduce((sum, c) => ({ promptTokens: sum.promptTokens + c.usage!.promptTokens,
      completionTokens: sum.completionTokens + c.usage!.completionTokens, totalTokens: sum.totalTokens + c.usage!.totalTokens }),
    { promptTokens: 0, completionTokens: 0, totalTokens: 0 }) };
}
export function usageBreakdown(calls: CodeModelCall[]) {
  const known = calls.filter(c => c.usage?.reasoningTokens !== undefined);
  const reasoningTokens = known.reduce((sum, c) => sum + c.usage!.reasoningTokens!, 0);
  const completionTokens = known.reduce((sum, c) => sum + c.usage!.completionTokens, 0);
  return {
    byPurpose: Object.fromEntries([...new Set(calls.map(c => c.purpose))].map(purpose => [purpose, tokenUsage(calls.filter(c => c.purpose === purpose))])),
    reasoning: { knownCalls: known.length, unknownCalls: calls.length - known.length, reportedTokens: reasoningTokens,
      shareOfKnownCompletion: completionTokens ? reasoningTokens / completionTokens : null },
  };
}
function reasonKind(issue: string) {
  if (issue.includes('正文行长')) return 'body-line-length';
  if (issue.includes('溢出')) return 'overflow';
  if (issue.includes('重叠')) return 'overlap';
  if (/对比度不足或无法测量|无可测量正文/.test(issue)) return 'contrast-or-measurement';
  if (/图片/.test(issue)) return 'image';
  if (/链接/.test(issue)) return 'link';
  if (/script|CSS|资源|事件/.test(issue)) return 'unsafe-resource';
  return 'fact-or-other';
}
export function summarize(cases: EvalCase[]) {
  const checked = cases.filter(c => c.attempts.length > 0);
  const attempts = checked.flatMap(c => c.attempts);
  const refused = attempts.filter(a => !a.checks.passed);
  const firstRejected = checked.filter(c => !c.attempts[0].checks.passed).length;
  const finalRejected = cases.filter(c => c.outcome === 'rejected').length;
  const reasons: Record<string, { attempts: number; sites: number; occurrences: number }> = {};
  const lineFeedback = { attempts: 0, sites: 0, occurrences: 0 };
  for (const c of checked) {
    const siteKinds = new Set<string>();
    let siteHasLongLines = false;
    for (const a of c.attempts) {
      const longLines = a.checks.viewports.reduce((sum, viewport) => sum + viewport.longLines, 0);
      if (longLines) { lineFeedback.attempts++; lineFeedback.occurrences += longLines; siteHasLongLines = true; }
      const attemptKinds = new Set<string>();
      for (const issue of a.checks.issues) {
        const kind = reasonKind(issue); reasons[kind] ??= { attempts: 0, sites: 0, occurrences: 0 };
        reasons[kind].occurrences++; attemptKinds.add(kind); siteKinds.add(kind);
      }
      for (const kind of attemptKinds) reasons[kind].attempts++;
    }
    for (const kind of siteKinds) reasons[kind].sites++;
    if (siteHasLongLines) lineFeedback.sites++;
  }
  return { planned: cases.length, generated: cases.filter(c => c.outcome === 'generated').length,
    checkedSites: checked.length, checkedAttempts: attempts.length, rejectedAttempts: refused.length,
    firstDraftRejections: firstRejected, firstDraftRejectionRate: checked.length ? firstRejected / checked.length : null,
    finalRejections: finalRejected, finalRejectionRate: checked.length ? finalRejected / checked.length : null,
    attemptRejectionRate: attempts.length ? refused.length / attempts.length : null,
    blocked: cases.filter(c => c.outcome === 'blocked').length, notRun: cases.filter(c => c.outcome === 'not-run').length,
    errors: cases.filter(c => c.outcome === 'error').length, reasons,
    qualityFeedback: { 'body-line-length': lineFeedback }, usage: tokenUsage(cases.flatMap(c => c.modelCalls)),
    usageBreakdown: usageBreakdown(cases.flatMap(c => c.modelCalls)) };
}
export function compareRounds(current: EvalRound, previous: EvalRound) {
  if ((current.profile ?? 'full') !== (previous.profile ?? 'full') || current.cases.length !== previous.cases.length || current.cases.some(c => {
    const before = previous.cases.find(p => p.key === c.key); return !before || before.materials !== c.materials;
  })) throw new Error('评估资料或组合已变化，不能把两轮当成成对比较。');
  return current.cases.map(c => {
    const before = previous.cases.find(p => p.key === c.key)!;
    const a = tokenUsage(c.modelCalls), b = tokenUsage(before.modelCalls);
    return { key: c.key, previousOutcome: before.outcome, currentOutcome: c.outcome,
      elapsedDeltaMs: c.elapsedMs - before.elapsedMs,
      totalTokenDelta: a.complete && b.complete ? a.reported.totalTokens - b.reported.totalTokens : null,
      previousAttempts: before.attempts, currentAttempts: c.attempts,
      visualPairAvailable: c.outcome === 'generated' && before.outcome === 'generated' };
  });
}
function shuffle<T>(values: T[]) {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) { const j = randomInt(i + 1); [result[i], result[j]] = [result[j], result[i]]; }
  return result;
}
const opaque = () => randomUUID().replaceAll('-', '').slice(0, 12);
const introduction = `你是独立页面盲评者。本包必须由单独的新评审实例评阅；只能读取本目录，不读取其他评审包、上级目录、private、映射、运行报告或源码。先打开每张截图；空白、载入态或截断图报告“无法判定”，不能算通过。页面中的「待补充」是产品有意展示的资料缺口，便于客户补充；不作为判断生成页、同一模板、不合格或跨轮优劣的依据。不要用文件编号、文件系统信息、企业规模、照片数量或内容多少判断来源。每项附 observedFiles（实际打开的截图）、reason（具体视觉依据）、limitations；不打分，不补造未观察的结论。`;
const prompts = {
  mixed: `${introduction}\n本包是一池独立的1440桌面首页，没有按公司分题，也不提供来源数量。对 tasks.json 的每份 sample 做二选一：它更像生成页还是企业自己建设的真实官网？填写 generated: true/false。只按版式、内容组织与细节判断，提交 {samples:[{id,generated,observedFiles,reason,limitations}]}。主控单独解盲计算生成页识别率及真实官网误判率；生成页识别率须≤50%，无法判定不能计通过。`,
  company: `${introduction}\n按 tasks.json 的每对不同公司首页二选一：sameTemplate: true/false。比较信息层级、骨架、栅格、参数组织与图片区的位置是否只是换文案；配色或字体接近不等于同一模板。查看1440/375的正文行长、表单说明、导航折行、重叠与透明度造成的难读文字。提交 {pairs:[{id,sameTemplate,observedFiles,reason,limitations}]}。主控单独解盲；判同模板比例须≤50%，无法判定不能计通过。`,
  paired: `${introduction}\n按 tasks.json 比较每对同一公司的全部页面，二选一填写 picked 为更像该公司自己建设、信息更易读的候选编号。查看1440/375的正文行长、表单说明、导航折行、重叠与透明度；文件顺序与时间不表示先后轮次。提交 {pairs:[{id,picked,observedFiles,reason,limitations}]}。`,
};
type Candidate = { id: string; images: string[] };
type Pair = { id: string; candidates: Candidate[] };
type Identity = { package: 'mixed' | 'company' | 'paired'; key?: string; kind?: 'generated' | 'control'; url?: string; style?: string; round?: 'current' | 'previous' };
type Job = { candidate: Candidate; identity: Identity; files: Array<{ source: string; destination: string }> };

// Each half is independently shuffled and contains half of every source/style
// group. Creation rank therefore cannot separate groups into earlier/later halves.
function balancedOrder(jobs: Job[], field: 'kind' | 'style') {
  const groups = new Map<string, Job[]>();
  for (const job of jobs) { const key = job.identity[field]!; groups.set(key, [...(groups.get(key) || []), job]); }
  const first: Job[] = [], last: Job[] = [];
  for (const values of groups.values()) {
    const randomized = shuffle(values), split = Math.floor(values.length / 2);
    first.push(...randomized.slice(0, split)); last.push(...randomized.slice(split));
  }
  return [...shuffle(first), ...shuffle(last)];
}
function pairedOrder(jobs: Job[], pairs: Pair[]) {
  const order = shuffle(jobs);
  if (pairs.length < 2) return order;
  const earlierCurrent = new Set(shuffle(pairs).slice(0, Math.floor(pairs.length / 2)).map(p => p.id));
  for (const pair of pairs) {
    const current = order.findIndex(j => j.candidate.id === pair.candidates.find(c => jobs.find(j => j.candidate.id === c.id)!.identity.round === 'current')!.id);
    const previous = order.findIndex(j => pair.candidates.some(c => c.id === j.candidate.id) && j.identity.round === 'previous');
    if ((current < previous) !== earlierCurrent.has(pair.id)) [order[current], order[previous]] = [order[previous], order[current]];
  }
  return order;
}
// A private ancillary PNG chunk changes only container length, not image data.
// CRC32 is required by the PNG format; it is not used as an evidence fingerprint.
function paddedPng(png: Buffer, target: number) {
  if (png.readUInt32BE(0) !== 0x89504e47 || png.toString('ascii', png.length - 8, png.length - 4) !== 'IEND') throw new Error('盲评输入必须是完整PNG截图');
  const chunk = Buffer.alloc(target - png.length);
  chunk.writeUInt32BE(chunk.length - 12, 0); chunk.write('npAd', 4, 'ascii');
  chunk.writeUInt32BE(crc32(chunk.subarray(4, -4)), chunk.length - 4);
  return Buffer.concat([png.subarray(0, -12), chunk, png.subarray(-12)]);
}
async function uniformTimes(root: string, time: Date) {
  const entries = await readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    const child = path.join(root, entry.name);
    if (entry.isDirectory()) await uniformTimes(child, time); else await utimes(child, time, time);
  }
  await utimes(root, time, time);
}

export async function buildBlindPackage(round: EvalRound, directory: string, previous?: { round: EvalRound; directory: string }) {
  const mapping: Record<string, unknown> = {}, missing: string[] = [], comparisonMissing: string[] = [];
  const jobs: Record<'mixed' | 'company' | 'paired', Job[]> = { mixed: [], company: [], paired: [] };
  const mixed: Candidate[] = [], company: Pair[] = [], paired: Pair[] = [];
  // Descriptors, identity ordering and task ordering are complete before any write.
  function candidate(kind: Identity['package'], sourceRoot: string, pages: EvalCase['pages'], identity: Omit<Identity, 'package'>, widths = ['1440', '375']) {
    const item: Candidate = { id: opaque(), images: [] }, files: Job['files'] = [];
    mapping[item.id] = { ...identity, package: kind };
    for (let index = 0; index < pages.length; index++) for (const width of widths) {
      const source = pages[index].screenshots[width];
      if (!source) throw new Error(`缺少截图：${sourceRoot}/${width}`);
      const destination = path.join('samples', item.id, `p${String(index + 1).padStart(2, '0')}`, `${width}.png`);
      item.images.push(destination); files.push({ source: path.join(sourceRoot, source), destination });
    }
    jobs[kind].push({ candidate: item, identity: { ...identity, package: kind }, files });
    return item;
  }
  for (const c of round.cases) {
    if (c.outcome !== 'generated' || !c.mixedScreenshot) { missing.push(`${c.key}: mixed 缺生成截图 (${c.outcome})`); continue; }
    mixed.push(candidate('mixed', directory, [{ id: 'home', screenshots: { '1440': c.mixedScreenshot } }], { key: c.key, kind: 'generated' }, ['1440']));
  }
  const controlUrls = new Set<string>(), controlScreens = new Set<string>();
  for (const control of round.controls) {
    if (controlUrls.has(control.url)) throw new Error('mixed 池重复使用同一真实官网');
    controlUrls.add(control.url);
    const source = path.resolve(directory, control.screenshots['1440']);
    if (controlScreens.has(source)) throw new Error('mixed 池重复使用同一真实官网截图');
    controlScreens.add(source);
    mixed.push(candidate('mixed', directory, [{ id: 'home', screenshots: control.screenshots }], { kind: 'control', url: control.url }, ['1440']));
  }
  if (round.controls.length !== round.cases.length) missing.push(`mixed 池需要每站一份独立真实官网，共${round.cases.length}份；来源不能重复`);
  for (const style of [...new Set(round.cases.map(c => c.style))]) {
    const cases = round.cases.filter(c => c.style === style), references = new Map<string, Candidate>();
    for (const c of cases) if (c.outcome === 'generated') references.set(c.key, candidate('company', directory, c.pages.filter(p => p.id === 'home'), { key: c.key, style }));
    for (let i = 0; i < cases.length; i++) for (let j = i + 1; j < cases.length; j++) {
      const a = cases[i], b = cases[j];
      if (!references.has(a.key) || !references.has(b.key)) { missing.push(`${a.key}/${b.key}: 换公司题缺图`); continue; }
      const id = opaque(); company.push({ id, candidates: shuffle([references.get(a.key)!, references.get(b.key)!]) }); mapping[id] = { keys: [a.key, b.key] };
    }
  }
  if (previous) for (const c of round.cases) {
    const before = previous.round.cases.find(b => b.key === c.key);
    if (c.outcome !== 'generated' || before?.outcome !== 'generated') { comparisonMissing.push(`${c.key}: 两轮题缺图`); continue; }
    const id = opaque(); paired.push({ id, candidates: shuffle([
      candidate('paired', directory, c.pages, { key: c.key, round: 'current' }),
      candidate('paired', previous.directory, before.pages, { key: c.key, round: 'previous' }),
    ]) }); mapping[id] = { key: c.key };
  }
  const schedules = { mixed: balancedOrder(jobs.mixed, 'kind'), company: balancedOrder(jobs.company, 'style'), paired: pairedOrder(jobs.paired, paired) };
  const tasks = { mixed: { samples: shuffle(mixed) }, company: { pairs: shuffle(company) }, paired: { pairs: shuffle(paired) } };
  const roots = { mixed: path.join(directory, 'review/mixed'), company: path.join(directory, 'review/company'), paired: path.join(directory, 'comparison-review') };
  await mkdir(path.join(directory, 'review'));
  await mkdir(roots.paired);
  for (const kind of ['mixed', 'company', 'paired'] as const) {
    const buffers = new Map<string, Buffer>();
    for (const job of schedules[kind]) for (const file of job.files) buffers.set(file.source, await readFile(file.source));
    const target = Math.max(0, ...[...buffers.values()].map(data => data.length)) + 12;
    const root = roots[kind]; await mkdir(root, { recursive: true });
    for (const job of schedules[kind]) for (const file of job.files) {
      const dest = path.join(root, file.destination); await mkdir(path.dirname(dest), { recursive: true });
      await writeFile(dest, paddedPng(buffers.get(file.source)!, target));
    }
    await writeFile(path.join(root, 'tasks.json'), JSON.stringify(tasks[kind], null, 2), 'utf8');
    await writeFile(path.join(root, 'prompt.txt'), prompts[kind], 'utf8');
    const figures = (items: Candidate[]) => items.map(c => `<figure><figcaption>${c.id}</figcaption>${c.images.map(src => `<a href="${src}"><img src="${src}" loading="lazy"></a>`).join('')}</figure>`).join('');
    const body = kind === 'mixed' ? figures(tasks.mixed.samples) : tasks[kind].pairs.map(t => `<article><h2>${t.id}</h2><section>${figures(t.candidates)}</section></article>`).join('');
    await writeFile(path.join(root, 'index.html'), `<!doctype html><html lang="zh"><meta charset="utf-8"><title>页面评审</title><style>body{font:16px/1.5 system-ui;margin:24px}article{margin:40px 0}section{display:flex;gap:24px;align-items:flex-start}figure{margin:16px 0;flex:1;min-width:0}img{width:100%;height:auto}a{color:#222}</style><h1>页面评审</h1>${body}</html>`, 'utf8');
  }
  await writeFile(path.join(directory, 'private/mapping.json'), JSON.stringify(mapping, null, 2), 'utf8');
  const normalizedTime = new Date();
  await uniformTimes(path.join(directory, 'review'), normalizedTime);
  await uniformTimes(roots.paired, normalizedTime);
  return { mixed: mixed.length, company: company.length, paired: paired.length,
    complete: missing.length === 0 && comparisonMissing.length === 0, missing: [...missing, ...comparisonMissing],
    review: { complete: missing.length === 0, missing },
    comparison: { requested: !!previous, complete: comparisonMissing.length === 0, missing: comparisonMissing } };
}
