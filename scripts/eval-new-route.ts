import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { codeCheckBrowser } from '../lib/code-site-browser.ts';
import { simulatedPacks, MATERIALS_CHAT_LIMIT, type SimulatedPackId } from '../lib/simulated-packs.ts';
import type { CodeSiteRecord } from '../lib/code-site.ts';
import { buildBlindPackage, compareRounds, summarize, tokenUsage, requireWholeSitePlan, type EvalRound, type EvalCase } from './eval-set-report.ts';

const { values } = parseArgs({ options: {
  base: { type: 'string', default: process.env.SITECRAFT_BASE || 'http://127.0.0.1:3142' },
  out: { type: 'string' }, previous: { type: 'string' }, 'prepare-only': { type: 'boolean', default: false }, help: { type: 'boolean' },
} });
if (values.help) {
  console.log('npm run eval:new-route -- [--base http://127.0.0.1:3142] [--out artifacts/t130/round-...] [--previous <round>] [--prepare-only]\n默认生成4家公司×precision/documentary整站，自动匹配上一轮。--prepare-only只采集真实官网对照和评审提示词，不调用模型，不是生成验收。review/mixed与review/company分别交不同的新评审实例；comparison-review单独交跨轮比较实例，private/由主控保管。');
  process.exit(0);
}
const base = values.base!.replace(/\/$/, '');
assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(new URL(base).hostname), '评估只连接本机开发服务');
const root = path.resolve('artifacts/t130');
await mkdir(root, { recursive: true });
const directory = path.resolve(values.out || path.join(root, `round-${new Date().toISOString().replace(/[:.]/g, '-')}`));
await mkdir(directory); // Refuse overwriting any earlier round, including failures.
await mkdir(path.join(directory, 'private'));
const quote = (text: string) => `'${text.replaceAll("'", "'\\''")}'`;
const command = ['CHROME_PATH=' + quote(process.env.CHROME_PATH || ''), 'SITECRAFT_BASE=' + quote(base),
  'node --experimental-strip-types scripts/eval-new-route.ts', ...process.argv.slice(2).map(quote)].join(' ');
// Old fixture page notes are replaced as explicit user page requests; facts are unchanged.
const requests: Record<SimulatedPackId, string> = {
  industrial: '首页、产品、联系三个独立页面。', export: '首页、产品、认证与材料追溯、资料索取、联系五个独立页面。资料索取用询盘表单，不伪造下载链接。',
  molding: '首页、产品、生产与质检、常见问题、联系五个独立页面。', packaging: '首页、包装产品、打样与订购、联系四个独立页面。',
};
type Photo = { file: string; category: string; apiLicense: string; sourceUrl: string; licenseUrl: string; author: string; attribution: string; downloadedAt: string; caption: string; limitations?: string };
const photos: Partial<Record<SimulatedPackId, Photo[]>> = {};
for (const pack of ['industrial', 'export', 'molding'] as const) {
  const manifest = JSON.parse(await readFile(path.join('tests/fixtures/company-images', pack, 'manifest.json'), 'utf8'));
  photos[pack] = ['product', 'equipment'].map(category => {
    const photo = manifest.images.find((p: Photo) => p.category === category);
    assert.ok(photo?.apiLicense && photo?.licenseUrl && photo?.sourceUrl && photo?.attribution, `${pack}/${category}缺少许可`);
    return photo;
  });
}
const emailDomains = { industrial: 'xinzhou-drive', export: 'waigaoqiao-fluid', molding: 'ninghai-mould', packaging: 'qinghe-pack' };
const cases: EvalCase[] = [];
for (const packId of ['industrial', 'export', 'molding', 'packaging'] as const) {
  const pack = simulatedPacks[packId];
  const companyName = pack.companyName.replace(/P3[A-Z]$/, '');
  const materials = pack.body.replaceAll(pack.companyName, companyName).replaceAll(pack.email, `${pack.email.split('@')[0]}@${emailDomains[packId]}.example`).replaceAll(pack.nonce, '').replace(/。核验记号：。/, '。').replace(/^页面(?:要求)?：.*$/m, '') + (photos[packId]?.map(p => `\n授权行业配图${p.file}：${p.caption}。${p.limitations || '只作对应内容配图，不推导公司新事实。'}不是该公司的实拍。`).join('') || '') + `\n页面要求：${requests[packId]}只做中文。没有授权照片时采用无图或标明示意的CSS图。`;
  assert.ok(materials.length <= MATERIALS_CHAT_LIMIT, `${packId}资料不能截断`);
  for (const style of ['precision', 'documentary']) cases.push({ key: `${packId}/${style}`, pack: packId, style, materials,
    outcome: 'not-run', elapsedMs: 0, attempts: [], modelCalls: [], pages: [] });
}
const round: EvalRound = { schemaVersion: 1, startedAt: new Date().toISOString(), command,
  commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  dirty: !!execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(), base, status: 'INCOMPLETE', cases, controls: [], errors: [] };
await writeFile(path.join(directory, 'command.sh'), command + '\n', 'utf8');
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
async function save() {
  await writeFile(path.join(directory, 'private', 'round.json'), JSON.stringify(round, null, 2), 'utf8');
  await writeFile(path.join(directory, 'private', 'summary.json'), JSON.stringify({ status: round.status, ...summarize(cases),
    groups: [...new Set(cases.map(c => c.pack))].map(pack => ({ pack, ...summarize(cases.filter(c => c.pack === pack)) })),
    styles: ['precision', 'documentary'].map(style => ({ style, ...summarize(cases.filter(c => c.style === style)) })) }, null, 2), 'utf8');
}
await save();
let previous: { round: EvalRound; directory: string } | undefined;
async function previousRound() {
  if (values.previous) return { round: JSON.parse(await readFile(path.join(values.previous, 'private', 'round.json'), 'utf8')) as EvalRound, directory: path.resolve(values.previous) };
  const entries = await readdir(root, { withFileTypes: true });
  const rounds = [];
  for (const entry of entries) if (entry.isDirectory() && entry.name.startsWith('round-') && path.join(root, entry.name) !== directory) {
    const folder = path.join(root, entry.name);
    const candidate: EvalRound = JSON.parse(await readFile(path.join(folder, 'private', 'round.json'), 'utf8'));
    if (candidate.cases.some(c => c.outcome !== 'not-run') && candidate.cases.length === cases.length && candidate.cases.every(c => cases.some(n => n.key === c.key && n.materials === c.materials))) rounds.push({ round: candidate, directory: folder });
  }
  return rounds.sort((a, b) => b.round.startedAt.localeCompare(a.round.startedAt))[0];
}
async function json<T>(endpoint: string, body?: unknown): Promise<T> {
  const response = await fetch(base + endpoint, { method: body ? 'POST' : 'GET', cache: 'no-store',
    headers: { 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(30000) });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`${endpoint} HTTP ${response.status}: ${error.userMessage || '请求失败'}`);
  }
  return response.json();
}
async function readSite(id: string) { return (await json<{ codeSite: CodeSiteRecord }>(`/api/sites/${id}/draft`)).codeSite; }
async function waitRun(id: string) {
  const deadline = Date.now() + 1800000;
  while (Date.now() < deadline) {
    const state = await readSite(id); if (state.run?.status !== 'running') return state;
    await pause(1500);
  }
  throw new Error('后台任务30分钟未结束；本命令没有重试或重发');
}
function collect(c: EvalCase, site: CodeSiteRecord) {
  c.modelCalls = site.runs.flatMap(run => run.modelCalls || []);
  c.attempts = site.runs.filter(run => run.kind === 'generate').flatMap(run => run.attempts.map((attempt, round) => ({ round, checks: attempt.checks })));
}
let browser: Awaited<ReturnType<typeof codeCheckBrowser>> | undefined;
async function capture(url: string, prefix: string, company?: string, widths = [1440, 375], full = true) {
  browser ??= await codeCheckBrowser();
  const screenshots: Record<string, string> = {};
  for (const width of widths) {
    await browser.send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
    const navigation = await browser.send<{ errorText?: string; loaderId?: string }>('Page.navigate', { url });
    if (navigation.errorText) throw new Error(`页面导航失败：${navigation.errorText}`);
    const deadline = Date.now() + 25000;
    let ready = false;
    while (Date.now() < deadline) {
      const frame = await browser.send<{ frameTree: { frame: { loaderId: string } } }>('Page.getFrameTree');
      ready = (!navigation.loaderId || frame.frameTree.frame.loaderId === navigation.loaderId) && await browser.evaluate<boolean>(`location.href !== 'about:blank' && document.readyState === 'complete' && document.body.innerText.trim().length > 30`);
      if (ready) break; await pause(200);
    }
    assert.ok(ready, `页面未载入或为空：${url}`);
    await browser.evaluate('document.fonts.ready');
    // Trigger below-fold lazy images before the full-page capture.
    if (full) await browser.evaluate(`(async()=>{for(let y=0;y<document.documentElement.scrollHeight;y+=800){scrollTo(0,y);await new Promise(r=>setTimeout(r,80))}scrollTo(0,0)})()`);
    const observed: { text: string; images: number; failedImages: number } = await browser.evaluate(`({text:document.body.innerText,images:document.images.length,failedImages:[...document.images].filter(i=>i.currentSrc&&(!i.complete||!i.naturalWidth)).length})`);
    if (company) assert.ok(observed.text.includes(company), '截图必须显示对应公司');
    assert.equal(observed.failedImages, 0, `截图含未加载图片：${url}`);
    assert.doesNotMatch(observed.text, /This site can.t be reached|ERR_[A-Z_]+|Access Denied|Just a moment|Checking your browser/i, '不能把错误或验证页当官网');
    await pause(800);
    const metrics = await browser.send<{ cssContentSize: { width: number; height: number } }>('Page.getLayoutMetrics');
    assert.ok(metrics.cssContentSize.height > 100, '不能截空页面');
    const image = await browser.send<{ data: string }>('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true,
      clip: { x: 0, y: 0, width, height: full ? metrics.cssContentSize.height : 1000, scale: 1 } });
    const file = `${prefix}-${width}.png`;
    await mkdir(path.dirname(path.join(directory, file)), { recursive: true });
    await writeFile(path.join(directory, file), Buffer.from(image.data, 'base64'));
    screenshots[String(width)] = file;
  }
  return screenshots;
}
try {
  const found = await previousRound();
  if (found) { compareRounds(round, found.round); previous = found; round.previous = found.directory; }
  if (!values['prepare-only']) {
    const health = await json<{ testIdentity?: { cwd: string }; persistence: { driver: string }; deepseek: { configured: boolean; model: string } }>('/api/health');
    assert.equal(health.testIdentity?.cwd, process.cwd(), '只能使用自己的worktree dev server');
    assert.equal(health.persistence.driver, 'development-file'); assert.ok(health.deepseek.configured);
    for (let index = 0; index < cases.length; index++) {
      const c = cases[index], start = Date.now(), folder = path.join('private', `case-${index + 1}`);
      await mkdir(path.join(directory, folder));
      await writeFile(path.join(directory, folder, 'materials.txt'), c.materials, 'utf8');
      try {
        const created = await json<{ id: string }>('/api/sites', { name: simulatedPacks[c.pack as SimulatedPackId].companyName.replace(/P3[A-Z]$/, ''), templateId: 'forge', locales: ['zh'], generationRoute: 'code' });
        c.siteId = created.id;
        for (const photo of photos[c.pack as SimulatedPackId] || []) {
          const form = new FormData();
          form.set('file', new Blob([await readFile(path.join('tests/fixtures/company-images', c.pack, photo.file))], { type: 'image/jpeg' }), photo.file);
          for (const [key, value] of Object.entries({ license: photo.apiLicense, sourceUrl: photo.sourceUrl, licenseUrl: photo.licenseUrl,
            author: photo.author, attribution: photo.attribution, usageScope: 'current-site-only', usageCategory: photo.category, retrievedAt: photo.downloadedAt })) form.set(key, value);
          const uploaded = await fetch(`${base}/api/sites/${created.id}/images`, { method: 'POST', body: form, signal: AbortSignal.timeout(30000) });
          assert.equal(uploaded.status, 201, `上传${photo.file}失败`);
          const receipt = await uploaded.json(); assert.ok(receipt.image?.imageId);
        }
        let state = await json<{ alignment: { questionId: string; questionRevision: number } }>(`/api/sites/${created.id}/chat`, { message: c.materials, baseRevision: 0 });
        await json(`/api/sites/${created.id}/chat`, { action: 'select', questionId: state.alignment.questionId, questionRevision: state.alignment.questionRevision, optionId: c.style,
          preferences: { style: c.style, layout: 5, density: 6 }, baseRevision: 0 });
        let site = await waitRun(created.id); collect(c, site);
        if (site.run?.status === 'error') throw new Error(site.run.step);
        assert.equal(site.plan?.style, c.style);
        requireWholeSitePlan(c.pack as SimulatedPackId, site.plan!.pages.length);
        state = await json(`/api/sites/${created.id}/chat`, { action: 'state' });
        await json(`/api/sites/${created.id}/chat`, { action: 'confirm', questionId: state.alignment.questionId, questionRevision: state.alignment.questionRevision, baseRevision: 0 });
        site = await waitRun(created.id); collect(c, site);
        if (site.run?.status === 'error') throw new Error(site.run.step);
        const version = site.versions.find(v => v.id === site.currentVersionId); assert.ok(version);
        assert.equal(version.checks.passed, true); assert.equal(site.versions.length, 1);
        assert.ok(site.plan?.pages.every(p => version.code.pages.some(v => v.id === p.id)), '整站不能静默缺页');
        c.versionId = version.id;
        for (const page of version.code.pages) c.pages.push({ id: page.id, screenshots: await capture(
          `${base}/api/sites/${created.id}/code-preview?page=${page.id}&version=${version.id}`, `${folder}/${page.id}`, simulatedPacks[c.pack as SimulatedPackId].companyName.replace(/P3[A-Z]$/, '')) });
        c.mixedScreenshot = (await capture(`${base}/api/sites/${created.id}/code-preview?page=home&version=${version.id}`, `${folder}/home-fold`, undefined, [1440], false))['1440'];
        c.outcome = 'generated';
      } catch (error) {
        if (c.siteId) collect(c, await readSite(c.siteId));
        c.error = error instanceof Error ? error.message : String(error);
        const providerFailed = c.modelCalls.some(call => call.httpStatus === null || call.httpStatus >= 400);
        c.outcome = providerFailed ? 'blocked' : c.attempts.length === 3 && c.attempts.every(a => !a.checks.passed) ? 'rejected' : 'error';
      }
      c.elapsedMs = Date.now() - start;
      await writeFile(path.join(directory, folder, 'report.json'), JSON.stringify({ ...c, usage: tokenUsage(c.modelCalls) }, null, 2), 'utf8');
      await save(); console.log(`${c.key}: ${c.outcome} (${c.elapsedMs}ms)`);
      if (c.outcome === 'blocked') { round.errors.push(c.error!); break; } // One provider failure; never retry the remaining matrix.
    }
  }
  // Real controls are private, internal-review artifacts, never runtime assets or repository contents.
  const sources = {
    industrial: ['https://www.guomaoreducer.com/', 'https://www.ngcgears.com/zh/home'],
    export: ['https://www.fitok.com/zh/index.htm', 'https://www.swagelok.com.cn/zh'],
    molding: ['https://www.fzmould.com/', 'https://www.saihao.com/'],
    packaging: ['https://cn.szyuto.com/', 'https://www.jinjia.com/index.aspx'],
  };
  for (const [pack, urls] of Object.entries(sources)) for (let i = 0; i < urls.length; i++) {
    try {
      const before = previous?.round.controls.find(c => c.pack === pack && c.url === urls[i]);
      if (before?.framing === 'fold') {
        const screenshots: Record<string, string> = {};
        for (const width of ['1440']) {
          const dest = `private/control-${pack}-${i}-${width}.png`;
          await copyFile(path.join(previous!.directory, before.screenshots[width]), path.join(directory, dest)); screenshots[width] = dest;
        }
        round.controls.push({ pack, url: urls[i], screenshots, framing: 'fold' });
      } else round.controls.push({ pack, url: urls[i], screenshots: await capture(urls[i], `private/control-${pack}-${i}`, undefined, [1440], false), framing: 'fold' });
    } catch (error) { round.errors.push(`对照 ${pack}/${i}：${String(error)}`); }
  }
} catch (error) { round.errors.push(String(error)); }
finally { if (browser) await browser.close(); }
for (let index = 0; index < cases.length; index++) {
  const folder = path.join(directory, 'private', `case-${index + 1}`);
  await mkdir(folder, { recursive: true });
  await writeFile(path.join(folder, 'materials.txt'), cases[index].materials, 'utf8');
  await writeFile(path.join(folder, 'report.json'), JSON.stringify({ ...cases[index], usage: tokenUsage(cases[index].modelCalls) }, null, 2), 'utf8');
}
if (previous) await writeFile(path.join(directory, 'private', 'comparison.json'), JSON.stringify(compareRounds(round, previous.round), null, 2), 'utf8');
const blind = await buildBlindPackage(round, directory, previous);
await writeFile(path.join(directory, 'private', 'blind-coverage.json'), JSON.stringify(blind, null, 2), 'utf8');
round.status = cases.some(c => c.outcome === 'blocked') ? 'BLOCKED' : cases.every(c => c.outcome === 'generated') && blind.complete && !round.errors.length ? 'PASS' : 'INCOMPLETE';
await save();
console.log(`${round.status}: ${directory}\n不同新评审实例分别收 ${path.join(directory, 'review/mixed')} 与 ${path.join(directory, 'review/company')}；跨轮比较单独收 ${path.join(directory, 'comparison-review')}`);
if (round.status !== 'PASS') process.exitCode = 1;
