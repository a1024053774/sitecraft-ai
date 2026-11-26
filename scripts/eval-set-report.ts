import assert from 'node:assert/strict';
import { randomInt, randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, rename, rmdir, stat, utimes, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { crc32 } from 'node:zlib';
import { isDeepStrictEqual, parseArgs } from 'node:util';
import path from 'node:path';
import type { CodeCheck, CodeModelCall, CodeSiteRecord } from '../lib/code-site.ts';
import type { SimulatedPackId } from '../lib/simulated-packs.ts';
import { diversePacks, type DiversePackId } from '../lib/diverse-packs.ts';

export function requireWholeSitePlan(pack: SimulatedPackId | DiversePackId, pageCount: number, profile: 'full' | 'quick' = 'full') {
  if (profile === 'quick') {
    if (pageCount !== 2) throw new Error(`快速档大纲需要资料要求的两个页面，实际 ${pageCount} 页；本次不确认生成。`);
    return;
  }
  const baselineRequested: Record<SimulatedPackId, number> = {
    industrial: 2, export: 3, molding: 4, packaging: 3, restaurant: 3, education: 3, design: 3,
  };
  const requested = pack in diversePacks
    ? diversePacks[pack as DiversePackId].requestedPageCount
    : baselineRequested[pack as SimulatedPackId];
  if (pageCount < requested) throw new Error(`大纲缩减了用户点名的页面：${pack} 至少 ${requested} 页，实际 ${pageCount} 页；本次不确认生成。`);
}

export type EvalCase = {
  key: string; pack: string; style: string; materials: string;
  preferences?: { style: string; layout: number; density: number };
  pageRequest?: string;
  styleRegistration?: { skill: string; previewRevision: number | null; previewVersionId: string | null };
  outcome: 'not-run' | 'generated' | 'rejected' | 'error' | 'blocked';
  siteId?: string; versionId?: string; mixedScreenshot?: string; error?: string; elapsedMs: number;
  attempts: Array<{ round: number; checks: CodeCheck }>; modelCalls: CodeModelCall[];
  pages: Array<{ id: string; screenshots: Record<string, string> }>;
};
export type Control = { pack: string; url: string; framing?: 'fold'; screenshots: Record<string, string> };
export type EvalRound = { schemaVersion: 1; startedAt: string; command: string; commit: string; dirty: boolean; base: string;
  status: string; cases: EvalCase[]; controls: Control[]; errors: string[]; previous?: string; profile?: 'full' | 'quick';
  previousMaterialsChanged?: boolean; comparison?: EvalComparison[] };
type EvalComparison = {
  key: string; materialsChanged: boolean;
  currentMaterials: { length: number; source: string | null }; previousMaterials: { length: number; source: string | null };
  unverifiedFields: string[];
  previousOutcome: EvalCase['outcome']; currentOutcome: EvalCase['outcome']; elapsedDeltaMs: number; totalTokenDelta: number | null;
  previousAttempts: EvalCase['attempts']; currentAttempts: EvalCase['attempts']; visualPairAvailable: boolean;
};

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
  const qualityKinds = ['truncatedText', 'ungatedHover', 'smallTargets', 'coveredAnchors', 'croppedProductImages', 'narrowColumns'] as const;
  const qualityFeedback = Object.fromEntries(qualityKinds.map(kind => [kind, { attempts: 0, sites: 0, occurrences: 0, measuredAttempts: 0, measuredSites: 0 }]));
  for (const c of checked) {
    const siteKinds = new Set<string>();
    let siteHasLongLines = false;
    const qualitySiteKinds = new Set<string>(), measuredSiteKinds = new Set<string>();
    for (const a of c.attempts) {
      const longLines = a.checks.viewports.reduce((sum, viewport) => sum + viewport.longLines, 0);
      if (longLines) { lineFeedback.attempts++; lineFeedback.occurrences += longLines; siteHasLongLines = true; }
      for (const kind of qualityKinds) {
        const measured = a.checks.viewports.filter(v => typeof v.qualityFeedback?.[kind] === 'number' && (kind !== 'smallTargets' || v.width === 375));
        if (!measured.length) continue;
        qualityFeedback[kind].measuredAttempts++; measuredSiteKinds.add(kind);
        const count = measured.reduce((sum, v) => sum + v.qualityFeedback![kind]!, 0);
        if (count) { qualityFeedback[kind].attempts++; qualityFeedback[kind].occurrences += count; qualitySiteKinds.add(kind); }
      }
      const attemptKinds = new Set<string>();
      for (const issue of a.checks.issues) {
        const kind = reasonKind(issue); reasons[kind] ??= { attempts: 0, sites: 0, occurrences: 0 };
        reasons[kind].occurrences++; attemptKinds.add(kind); siteKinds.add(kind);
      }
      for (const kind of attemptKinds) reasons[kind].attempts++;
    }
    for (const kind of siteKinds) reasons[kind].sites++;
    if (siteHasLongLines) lineFeedback.sites++;
    for (const kind of qualitySiteKinds) qualityFeedback[kind].sites++;
    for (const kind of measuredSiteKinds) qualityFeedback[kind].measuredSites++;
  }
  return { planned: cases.length, generated: cases.filter(c => c.outcome === 'generated').length,
    checkedSites: checked.length, checkedAttempts: attempts.length, rejectedAttempts: refused.length,
    firstDraftRejections: firstRejected, firstDraftRejectionRate: checked.length ? firstRejected / checked.length : null,
    finalRejections: finalRejected, finalRejectionRate: checked.length ? finalRejected / checked.length : null,
    attemptRejectionRate: attempts.length ? refused.length / attempts.length : null,
    blocked: cases.filter(c => c.outcome === 'blocked').length, notRun: cases.filter(c => c.outcome === 'not-run').length,
    errors: cases.filter(c => c.outcome === 'error').length, reasons,
    qualityFeedback: { 'body-line-length': lineFeedback, ...qualityFeedback }, usage: tokenUsage(cases.flatMap(c => c.modelCalls)),
    usageBreakdown: usageBreakdown(cases.flatMap(c => c.modelCalls)) };
}
export function compareRounds(current: EvalRound, previous: EvalRound,
  sources: { currentSource?: string; previousSource?: string } = {}): EvalComparison[] {
  const refuse = (field: string) => { throw new Error(`评估资料或组合已变化：${field} 不一致，不能把两轮当成成对比较。`); };
  if ((current.profile ?? 'full') !== (previous.profile ?? 'full')) refuse('profile');
  const previousKeys = new Set(previous.cases.map(c => c.key)), currentKeys = new Set(current.cases.map(c => c.key));
  if (previousKeys.size !== previous.cases.length || currentKeys.size !== current.cases.length ||
    currentKeys.size !== previousKeys.size || [...currentKeys].some(key => !previousKeys.has(key))) refuse('组合集合');
  return current.cases.map((c, index) => {
    const beforeIndex = previous.cases.findIndex(p => p.key === c.key), before = previous.cases[beforeIndex];
    const unverifiedFields: string[] = [];
    for (const [side, item] of [['current', c], ['previous', before]] as const) {
      if (item.key !== `${item.pack}/${item.style}`) refuse(`${c.key} ${side}.pack/style 与 key`);
      if (item.preferences && item.preferences.style !== item.style) refuse(`${c.key} ${side}.preferences.style`);
    }
    const condition = (field: string, now: unknown, old: unknown) => {
      if (now == null) unverifiedFields.push(`current.${field}`);
      if (old == null) unverifiedFields.push(`previous.${field}`);
      if (now != null && old != null && !isDeepStrictEqual(now, old)) refuse(`${c.key} ${field}`);
    };
    condition('profile', current.profile, previous.profile);
    if (c.style !== before.style || c.pack !== before.pack) refuse(`${c.key} pack/style`);
    condition('layout', c.preferences?.layout, before.preferences?.layout);
    condition('density', c.preferences?.density, before.preferences?.density);
    // Historical rounds kept the exact requested page scope as the final line.
    // Do not compare the generated page count: the model may choose extra pages.
    const request = (item: EvalCase) => {
      const lastLine = item.materials.split('\n').at(-1);
      const recorded = lastLine?.startsWith('页面要求：') ? lastLine : undefined;
      if (item.pageRequest && recorded && item.pageRequest !== recorded) refuse(`${item.key} pageRequest 与资料末行`);
      return item.pageRequest ?? recorded;
    };
    condition('pageRequest', request(c), request(before));
    if (c.styleRegistration && before.styleRegistration) {
      for (const field of ['skill', 'previewRevision', 'previewVersionId'] as const)
        condition(`styleRegistration.${field}`, c.styleRegistration[field], before.styleRegistration[field]);
    } else condition('styleRegistration', c.styleRegistration, before.styleRegistration);
    const materialsChanged = before.materials !== c.materials;
    if (materialsChanged && current.previousMaterialsChanged !== true) refuse(`${c.key} materials`);
    const a = tokenUsage(c.modelCalls), b = tokenUsage(before.modelCalls);
    return { key: c.key, materialsChanged, unverifiedFields,
      currentMaterials: { length: c.materials.length, source: sources.currentSource ? `${sources.currentSource}#/cases/${index}/materials` : null },
      previousMaterials: { length: before.materials.length, source: sources.previousSource ? `${sources.previousSource}#/cases/${beforeIndex}/materials` : null },
      previousOutcome: before.outcome, currentOutcome: c.outcome,
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
  mixed: `${introduction}\n本包是一池独立的1440桌面首页，没有按公司分题，也不提供来源数量。对 tasks.json 的每份 sample 做二选一：它更像生成页还是企业自己建设的真实官网？填写 generated: true/false。只按版式、内容组织与细节判断，提交 {samples:[{id,generated,observedFiles,reason,limitations}]}。主控单独解盲计算生成页识别率及真实官网误判率，结果仅作参考；无法判定如实记录。`,
  company: `${introduction}\n按 tasks.json 的每对不同公司首页二选一：sameTemplate: true/false。比较信息层级、骨架、栅格、参数组织与图片区的位置是否只是换文案；配色或字体接近不等于同一模板。查看1440/375的正文行长、表单说明、导航折行、重叠与透明度造成的难读文字。提交 {pairs:[{id,sameTemplate,observedFiles,reason,limitations}]}。主控单独解盲；判同模板比例须≤50%，无法判定不能计通过。`,
  diversity: `${introduction}\n本包评估跨风格视觉区分度与全池模板雷同风险（见 tasks.json）：1）crossStylePairs：对每对候选首页（含1440与375截图）判定 sameTemplate: true/false，在 reason 中逐项比对页头形式、首屏构图、底面明暗与区块分隔手法后再给出结论；2）clusters：对 clusterSamples（全池匿名打乱的1440首页截图）按整体视觉骨架归簇，同一套模板构图归入同一个簇 {id,members,observedFiles,reason,limitations}。提交 {crossStylePairs:[{id,sameTemplate,observedFiles,reason,limitations}],clusters:[{id,members,observedFiles,reason,limitations}]}；无法判定如实记录。`,
  paired: `${introduction}\n按 tasks.json 比较每对同一公司的全部页面，二选一填写 picked 为更像该公司自己建设、信息更易读的候选编号。查看1440/375的正文行长、表单说明、导航折行、重叠与透明度；文件顺序与时间不表示先后轮次。提交 {pairs:[{id,picked,observedFiles,reason,limitations}]}。`,
};
type Candidate = { id: string; images: string[] };
type Pair = { id: string; candidates: Candidate[] };
type Identity = { package: 'mixed' | 'company' | 'diversity' | 'paired'; role?: 'pair' | 'cluster'; key?: string; kind?: 'generated' | 'control'; url?: string; style?: string; round?: 'current' | 'previous' };
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

// T-210: coarse filesystem clocks can give adjacent samples the same birthtime.
// A tied rank follows opaque-name order instead of the balanced write schedule.
// Reserve an empty directory only after its observed creation time advances.
async function orderedSampleDirectory(destination: string, after: number) {
  const deadline = performance.now() + 1000;
  while (true) {
    const pending = await mkdtemp(path.join(path.dirname(destination), '.pending-'));
    const time = (await stat(pending)).birthtimeMs;
    if (Number.isFinite(time) && time > 0 && time > after) {
      await rename(pending, destination);
      const actual = (await stat(destination)).birthtimeMs;
      if (!(actual > after)) throw new Error('匿名样本目录的创建时间未保持顺序，未完成盲评包。');
      return actual;
    }
    await rmdir(pending);
    if (performance.now() >= deadline) throw new Error('文件系统创建时间未推进，无法保证匿名样本顺序，未完成盲评包。');
    await new Promise(resolve => setTimeout(resolve, 1));
  }
}

function selectDiversityPairs(cases: EvalCase[], distinctStyles: string[]) {
  const all: Array<[EvalCase, EvalCase]> = [];
  for (let i = 0; i < cases.length; i++) for (let j = i + 1; j < cases.length; j++) {
    if (cases[i].style !== cases[j].style) all.push([cases[i], cases[j]]);
  }
  if (all.length <= 16) return all;
  const sameCompany = all.filter(([a, b]) => a.pack === b.pack);
  const seen = new Set(sameCompany.map(([a, b]) => `${a.key}|${b.key}`));
  const cyclic: Array<[EvalCase, EvalCase]> = [];
  for (let u = 0; u < distinctStyles.length; u++) for (let v = u + 1; v < distinctStyles.length; v++) {
    const groupA = cases.filter(c => c.style === distinctStyles[u]);
    const groupB = cases.filter(c => c.style === distinctStyles[v]);
    let picked: [EvalCase, EvalCase] | undefined;
    for (let i = 0; i < groupA.length && !picked; i++) for (let k = 0; k < groupB.length && !picked; k++) {
      const a = groupA[i], b = groupB[(u + v + i + k + 1) % groupB.length];
      if (a.pack !== b.pack && !seen.has(`${a.key}|${b.key}`) && !seen.has(`${b.key}|${a.key}`)) picked = [a, b];
    }
    if (picked) { seen.add(`${picked[0].key}|${picked[1].key}`); cyclic.push(picked); }
  }
  return [...sameCompany, ...cyclic];
}
function selectClusterCases(cases: EvalCase[], distinctStyles: string[]) {
  if (cases.length <= 8) return cases;
  const buckets = distinctStyles.map(style => cases.filter(c => c.style === style));
  const selected: EvalCase[] = [];
  for (let depth = 0; selected.length < 8; depth++) {
    let pushed = false;
    for (const bucket of buckets) if (depth < bucket.length && selected.length < 8) {
      selected.push(bucket[depth]); pushed = true;
    }
    if (!pushed) break;
  }
  return selected;
}

export async function buildBlindPackage(round: EvalRound, directory: string, previous?: { round: EvalRound; directory: string }) {
  const mapping: Record<string, unknown> = {}, missing: string[] = [], comparisonMissing: string[] = [];
  const jobs: Record<Identity['package'], Job[]> = { mixed: [], company: [], diversity: [], paired: [] };
  const mixed: Candidate[] = [], company: Pair[] = [], crossStylePairs: Pair[] = [], clusterSamples: Candidate[] = [], paired: Pair[] = [];
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
  const distinctStyles = [...new Set(round.cases.map(c => c.style))];
  for (const style of distinctStyles) {
    const cases = round.cases.filter(c => c.style === style), references = new Map<string, Candidate>();
    for (const c of cases) if (c.outcome === 'generated') references.set(c.key, candidate('company', directory, c.pages.filter(p => p.id === 'home'), { key: c.key, style }));
    for (let i = 0; i < cases.length; i++) for (let j = i + 1; j < cases.length; j++) {
      const a = cases[i], b = cases[j];
      if (!references.has(a.key) || !references.has(b.key)) { missing.push(`${a.key}/${b.key}: 换公司题缺图`); continue; }
      const id = opaque(); company.push({ id, candidates: shuffle([references.get(a.key)!, references.get(b.key)!]) }); mapping[id] = { package: 'company', keys: [a.key, b.key] };
    }
  }
  const diversityRequested = distinctStyles.length >= 2;
  if (diversityRequested) {
    const pairRefs = new Map<string, Candidate>();
    for (const c of round.cases) if (c.outcome === 'generated' && c.pages.some(p => p.id === 'home')) {
      pairRefs.set(c.key, candidate('diversity', directory, c.pages.filter(p => p.id === 'home'), { role: 'pair', key: c.key, style: c.style }));
    }
    for (const [a, b] of selectDiversityPairs(round.cases, distinctStyles)) {
      if (!pairRefs.has(a.key) || !pairRefs.has(b.key)) { missing.push(`${a.key}/${b.key}: 跨风格题缺图`); continue; }
      const id = opaque();
      crossStylePairs.push({ id, candidates: shuffle([pairRefs.get(a.key)!, pairRefs.get(b.key)!]) });
      mapping[id] = { package: 'diversity', keys: [a.key, b.key], styles: [a.style, b.style], sameCompany: a.pack === b.pack };
    }
    for (const c of selectClusterCases(round.cases, distinctStyles)) {
      if (c.outcome !== 'generated' || !c.pages.some(p => p.id === 'home')) { missing.push(`${c.key}: 归簇题缺图`); continue; }
      clusterSamples.push(candidate('diversity', directory, c.pages.filter(p => p.id === 'home'), { role: 'cluster', key: c.key, style: c.style }, ['1440']));
    }
  }
  if (previous) for (const c of round.cases) {
    const before = previous.round.cases.find(b => b.key === c.key);
    if (c.outcome !== 'generated' || before?.outcome !== 'generated') { comparisonMissing.push(`${c.key}: 两轮题缺图`); continue; }
    const id = opaque(); paired.push({ id, candidates: shuffle([
      candidate('paired', directory, c.pages, { key: c.key, round: 'current' }),
      candidate('paired', previous.directory, before.pages, { key: c.key, round: 'previous' }),
    ]) }); mapping[id] = { package: 'paired', key: c.key };
  }
  const schedules = { mixed: balancedOrder(jobs.mixed, 'kind'), company: balancedOrder(jobs.company, 'style'),
    diversity: diversityRequested ? balancedOrder(jobs.diversity, 'style') : [], paired: pairedOrder(jobs.paired, paired) };
  const tasks = { mixed: { samples: shuffle(mixed) }, company: { pairs: shuffle(company) },
    diversity: { crossStylePairs: shuffle(crossStylePairs), clusterSamples: shuffle(clusterSamples) }, paired: { pairs: shuffle(paired) } };
  const roots = { mixed: path.join(directory, 'review/mixed'), company: path.join(directory, 'review/company'),
    diversity: path.join(directory, 'review/diversity'), paired: path.join(directory, 'comparison-review') };
  await mkdir(path.join(directory, 'review'), { recursive: true });
  await mkdir(roots.paired, { recursive: true });
  const activeKinds = (['mixed', 'company', ...(diversityRequested ? ['diversity'] as const : []), 'paired'] as const);
  for (const kind of activeKinds) {
    const buffers = new Map<string, Buffer>();
    for (const job of schedules[kind]) for (const file of job.files) buffers.set(file.source, await readFile(file.source));
    const target = Math.max(0, ...[...buffers.values()].map(data => data.length)) + 12;
    const root = roots[kind]; await mkdir(root, { recursive: true });
    await mkdir(path.join(root, 'samples'), { recursive: true });
    let previousBirthtime = -Infinity;
    for (const job of schedules[kind]) {
      previousBirthtime = await orderedSampleDirectory(path.join(root, 'samples', job.candidate.id), previousBirthtime);
      for (const file of job.files) {
        const dest = path.join(root, file.destination); await mkdir(path.dirname(dest), { recursive: true });
        await writeFile(dest, paddedPng(buffers.get(file.source)!, target));
      }
    }
    await writeFile(path.join(root, 'tasks.json'), JSON.stringify(tasks[kind], null, 2), 'utf8');
    await writeFile(path.join(root, 'prompt.txt'), prompts[kind], 'utf8');
    const figures = (items: Candidate[]) => items.map(c => `<figure><figcaption>${c.id}</figcaption>${c.images.map(src => `<a href="${src}"><img src="${src}" loading="lazy"></a>`).join('')}</figure>`).join('');
    const renderPairs = (items: Pair[]) => items.map(t => `<article><h2>${t.id}</h2><section>${figures(t.candidates)}</section></article>`).join('');
    const body = kind === 'mixed' ? figures(tasks.mixed.samples)
      : kind === 'diversity' ? `<div><h2>跨风格成对对比</h2>${renderPairs(tasks.diversity.crossStylePairs)}</div><div><h2>全池模板归簇</h2>${figures(tasks.diversity.clusterSamples)}</div>`
        : renderPairs(tasks[kind].pairs);
    await writeFile(path.join(root, 'index.html'), `<!doctype html><html lang="zh"><meta charset="utf-8"><title>页面评审</title><style>body{font:16px/1.5 system-ui;margin:24px}article{margin:40px 0}article>section{display:flex;gap:24px;align-items:flex-start}figure{margin:16px 0;flex:1;min-width:0}img{width:100%;height:auto}a{color:#222}</style><h1>页面评审</h1>${body}</html>`, 'utf8');
  }
  await writeFile(path.join(directory, 'private/mapping.json'), JSON.stringify(mapping, null, 2), 'utf8');
  const normalizedTime = new Date();
  await uniformTimes(path.join(directory, 'review'), normalizedTime);
  await uniformTimes(roots.paired, normalizedTime);
  return { mixed: mixed.length, company: company.length,
    diversity: { requested: diversityRequested, crossStylePairs: crossStylePairs.length, clusterSamples: clusterSamples.length },
    paired: paired.length,
    complete: missing.length === 0 && comparisonMissing.length === 0, missing: [...missing, ...comparisonMissing],
    review: { complete: missing.length === 0, missing },
    comparison: { requested: !!previous, complete: comparisonMissing.length === 0, missing: comparisonMissing } };
}

export type BlindMappingEntry = {
  package?: Identity['package']; role?: 'pair' | 'cluster'; key?: string; keys?: string[];
  styles?: string[]; style?: string; sameCompany?: boolean; round?: 'current' | 'previous'; kind?: 'generated' | 'control';
};
export type BlindPairReviewItem = { id: string; sameTemplate?: boolean | null; undecided?: boolean };
export type BlindClusterReviewItem = { id: string; members: string[] };
export type BlindPairedReviewItem = { id: string; picked?: string | null; undecided?: boolean };
export type SummarizeBlindDiversityInput = {
  mapping: Record<string, BlindMappingEntry>;
  companyReview?: { pairs: BlindPairReviewItem[] } | null;
  diversityReview?: { crossStylePairs?: BlindPairReviewItem[]; clusters?: BlindClusterReviewItem[] } | null;
  pairedReview?: { pairs: BlindPairedReviewItem[] } | null;
};

function summarizeTemplatePairs(items: BlindPairReviewItem[], mapping: Record<string, BlindMappingEntry>, expectedPackage: 'company' | 'diversity') {
  const seen = new Set<string>();
  const resolved: Array<{ entry: BlindMappingEntry; sameTemplate: boolean | null; undecided: boolean }> = [];
  for (const item of items) {
    assert.ok(typeof item.id === 'string' && !seen.has(item.id), `无效或重复的成对题编号：${String(item?.id)}`);
    seen.add(item.id);
    const entry = mapping[item.id];
    assert.ok(entry && Array.isArray(entry.keys) && entry.keys.length === 2, `映射中不存在成对题：${item.id}`);
    if (entry.package) assert.equal(entry.package, expectedPackage, `题号包类型不匹配：${item.id}`);
    assert.ok(item.sameTemplate === undefined || item.sameTemplate === null || typeof item.sameTemplate === 'boolean', `sameTemplate 类型无效：${item.id}`);
    const undecided = item.undecided === true || item.sameTemplate === null || item.sameTemplate === undefined;
    resolved.push({ entry, sameTemplate: item.sameTemplate ?? null, undecided });
  }
  const summarizeGroup = (rows: typeof resolved) => {
    const total = rows.length;
    const sameTemplate = rows.filter(r => !r.undecided && r.sameTemplate === true).length;
    const undecided = rows.filter(r => r.undecided).length;
    return {
      total, sameTemplate, undecided,
      rate: total ? sameTemplate / total : null,
      nonPassRate: total ? (sameTemplate + undecided) / total : null,
    };
  };
  return { resolved, summarizeGroup };
}

export function summarizeBlindDiversity(input: SummarizeBlindDiversityInput) {
  const { mapping, companyReview, diversityReview, pairedReview } = input;
  assert.ok(mapping && typeof mapping === 'object', '缺少 mapping');
  const companyData = summarizeTemplatePairs(companyReview?.pairs ?? [], mapping, 'company');
  const sameStyle = companyData.summarizeGroup(companyData.resolved);

  const crossData = summarizeTemplatePairs(diversityReview?.crossStylePairs ?? [], mapping, 'diversity');
  const isSameCompany = (entry: BlindMappingEntry) => typeof entry.sameCompany === 'boolean'
    ? entry.sameCompany : entry.keys![0].split('/')[0] === entry.keys![1].split('/')[0];
  const crossStyle = {
    ...crossData.summarizeGroup(crossData.resolved),
    sameCompany: crossData.summarizeGroup(crossData.resolved.filter(r => isSameCompany(r.entry))),
    differentCompany: crossData.summarizeGroup(crossData.resolved.filter(r => !isSameCompany(r.entry))),
  };

  const knownClusterIds = Object.entries(mapping)
    .filter(([, entry]) => entry?.package === 'diversity' && entry.role === 'cluster')
    .map(([id]) => id);
  const clusterRows = diversityReview?.clusters ?? [];
  const seenMembers = new Set<string>();
  const perCluster: Array<{ id: string; size: number; styles: Record<string, number> }> = [];
  for (const cluster of clusterRows) {
    assert.ok(cluster && typeof cluster.id === 'string' && Array.isArray(cluster.members), '无效的归簇条目');
    const styleCounts: Record<string, number> = {};
    for (const memberId of cluster.members) {
      assert.ok(typeof memberId === 'string' && !seenMembers.has(memberId), `归簇样本重复：${String(memberId)}`);
      seenMembers.add(memberId);
      const entry = mapping[memberId];
      assert.ok(entry, `归簇样本不存在于 mapping：${memberId}`);
      if (entry.package) assert.equal(entry.package, 'diversity', `归簇样本包类型不匹配：${memberId}`);
      assert.equal(entry.role, 'cluster', `样本不是归簇题候选：${memberId}`);
      const style = entry.style || entry.key?.split('/')[1] || 'unknown';
      styleCounts[style] = (styleCounts[style] || 0) + 1;
    }
    perCluster.push({ id: cluster.id, size: cluster.members.length, styles: styleCounts });
  }
  const clusters = {
    sampleCount: knownClusterIds.length || seenMembers.size,
    clusterCount: perCluster.length,
    maxClusterSize: perCluster.reduce((max, c) => Math.max(max, c.size), 0),
    missingSamples: knownClusterIds.filter(id => !seenMembers.has(id)),
    perCluster,
  };

  const pairedSeen = new Set<string>();
  let currentWins = 0, previousWins = 0, pairedUndecided = 0;
  const pairedItems = pairedReview?.pairs ?? [];
  for (const item of pairedItems) {
    assert.ok(typeof item.id === 'string' && !pairedSeen.has(item.id), `无效或重复的跨轮题编号：${String(item?.id)}`);
    pairedSeen.add(item.id);
    const pairEntry = mapping[item.id];
    assert.ok(pairEntry && typeof pairEntry.key === 'string' && !pairEntry.round, `映射中不存在跨轮题：${item.id}`);
    if (pairEntry.package) assert.equal(pairEntry.package, 'paired', `跨轮题包类型不匹配：${item.id}`);
    if (item.undecided || !item.picked || item.picked === '无法判定') { pairedUndecided++; continue; }
    const picked = mapping[item.picked];
    assert.ok(picked && picked.key === pairEntry.key, `无效或跨题候选编号：${String(item.picked)}`);
    if (picked.package) assert.equal(picked.package, 'paired');
    if (picked.round === 'current') currentWins++;
    else if (picked.round === 'previous') previousWins++;
    else throw new Error(`未知轮次候选：${item.picked}`);
  }
  const pairedTotal = pairedItems.length;
  const decided = currentWins + previousWins;
  const pairedSummary = {
    total: pairedTotal, currentWins, previousWins, undecided: pairedUndecided,
    winRate: pairedTotal ? currentWins / pairedTotal : null,
    decidedWinRate: decided ? currentWins / decided : null,
  };

  return { sameStyle, crossStyle, clusters, paired: pairedSummary };
}

async function runCli() {
  const { values } = parseArgs({ options: { unblind: { type: 'string' }, company: { type: 'string' }, diversity: { type: 'string' }, paired: { type: 'string' } } });
  if (!values.unblind) throw new Error('用法：eval-set-report.ts --unblind <roundDir>');
  const dir = path.resolve(values.unblind);
  const readReview = async (explicit: string | undefined, defaultRel: string) => {
    if (explicit !== undefined) return JSON.parse(await readFile(path.resolve(explicit), 'utf8'));
    try { return JSON.parse(await readFile(path.join(dir, defaultRel), 'utf8')); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }
  };
  const mapping = JSON.parse(await readFile(path.join(dir, 'private/mapping.json'), 'utf8'));
  const companyReview = await readReview(values.company, 'review/company/result.json');
  const diversityReview = await readReview(values.diversity, 'review/diversity/result.json');
  const pairedReview = await readReview(values.paired, 'comparison-review/result.json');
  console.log(JSON.stringify(summarizeBlindDiversity({ mapping, companyReview, diversityReview, pairedReview }), null, 2));
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) await runCli();
