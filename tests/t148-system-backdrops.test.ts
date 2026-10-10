import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { registerHooks } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { codeCheckBrowser } from '../lib/code-site-browser.ts';
import { renderSiteCode, type SiteCode } from '../lib/code-site.ts';

// Independent contracts from T-148 and the controller's six-effect selection:
// registered CSS/markers save; photo roles, unknown ids, resource misuse and
// low contrast reject; missing assets never save; restores use this boundary.
// Real Chrome, filesystem and commit entry; only fact-model HTTP is a local fixture.
registerHooks({ resolve(specifier, context, next) {
  if (!specifier.startsWith('@/')) return next(specifier, context);
  const file = path.join(process.cwd(), specifier.slice(2));
  return next(pathToFileURL(existsSync(file + '.ts') ? file + '.ts' : file).href, context);
} });
const out = path.resolve('artifacts/t148', `boundary-${crypto.randomUUID()}`);
await mkdir(out, { recursive: true });
let missingAsset = false, modelCalls = 0;
const server = createServer(async (request, response) => {
  if (request.method === 'POST') {
    modelCalls++; response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: '{"issues":[]}' } }] })); return;
  }
  if (request.url?.startsWith('/system-backdrops/')) {
    const file = path.basename(request.url);
    if (!missingAsset && /^[a-z0-9_-]+\.webp$/.test(file)) {
      try { response.setHeader('Content-Type', 'image/webp'); response.end(await readFile(path.join('public/system-backdrops', file))); return; }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    }
    response.statusCode = 404; response.end('missing'); return;
  }
  response.setHeader('Content-Type', 'text/html'); response.end('<!doctype html><html><body></body></html>');
});
await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
process.env.SITE_STORE = 'fs'; process.env.SITECRAFT_BASE = base;
process.env.DEEPSEEK_BASE_URL = base; process.env.DEEPSEEK_API_KEY = 'local-fixture-only'; process.env.DEEPSEEK_MODEL = 'local-fixture-only';
const { createCodeSite, updateCodeSite, commitSiteCode, getCodeSite } = await import('../lib/code-site-store.ts');
test.after(() => new Promise<void>(resolve => server.close(() => resolve())));
const materials = '曜石加工。精密零件加工。材料与尺寸待补充。加工参数待补充。';
const light = 'bd_grid_precision-steel', dark = 'bd_linear-field_documentary-graphite';
const cssUrl = '/system-backdrops/bd_radial-field_precision-steel--1440.webp';
const code: SiteCode = {
  header: '<header>曜石加工<nav><a href="/home">首页</a><a href="/products">加工参数</a></nav></header>', footer: '<footer>材料与尺寸待补充。</footer>',
  css: 'body{margin:0;background:#fff;color:#111;font:16px/1.7 sans-serif}header,footer{padding:24px}nav{display:flex;gap:24px}main{padding:24px}h1{font-size:28px}p{max-width:30em}.hero{padding:32px;min-height:260px;background-color:#fff}.dark{padding:24px;background-color:#222;color:#fff}.css-backdrop{padding:24px;background-color:#fff;background-size:cover}.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,250px),1fr));gap:16px}.tile{padding:20px;min-height:90px;background-color:#fff;color:#111}.tile.dark{background-color:#222;color:#fff}',
  pages: [{ id: 'home', title: '曜石加工', html: `<main><section class="hero" data-system-backdrop="${light}"><h1>精密零件加工</h1><p>材料与尺寸待补充。</p></section><section class="dark" data-system-backdrop="${dark}"><p>加工参数待补充。</p></section></main>` },
    { id: 'products', title: '加工参数', html: '<main><h1>加工参数</h1><section class="css-backdrop"><p>材料与尺寸待补充。</p></section></main>' }],
};
async function freshSite() {
  const siteId = `t148-${crypto.randomUUID()}`;
  await createCodeSite(siteId, '曜石加工', `t148-conversation-${crypto.randomUUID()}`);
  await updateCodeSite(siteId, () => ({ materials })); return siteId;
}
async function submit(siteId: string, candidate: SiteCode, revision = 0) {
  const result = await commitSiteCode({ siteId, baseRevision: revision, code: candidate, author: 'user', summary: '静态底图检查', request: '' });
  await writeFile(path.join(out, `${siteId}-${crypto.randomUUID()}.json`), JSON.stringify(result, null, 2) + '\n'); return result;
}

test('registered marker and CSS backgrounds save, render at three widths and restore through the same entry', async t => {
  t.diagnostic(`T-148 artifacts: ${out}`);
  const siteId = await freshSite(), candidate = structuredClone(code);
  candidate.css += `.css-backdrop{background-image:url("${cssUrl}")}`;
  const result = await submit(siteId, candidate);
  assert.equal(result.status, 'applied', 'registered local background URLs must pass the real commit entry');
  assert.equal(result.version.checks.viewports.length, 6);
  assert.ok(result.version.checks.viewports.every(v => v.overflow === 0 && v.overlaps === 0 && v.contrastIssues === 0));
  assert.ok(result.version.checks.viewports.every(v => v.qualityFeedback), 'a backdrop version must also retain T-147 quality feedback for each viewport');
  assert.ok(result.version.checks.viewports.some(v => v.width === 375 && v.qualityFeedback!.smallTargets > 0), 'the fixture has small standalone navigation targets; feedback must run without rejecting its legal backdrop');
  assert.deepEqual(result.version.checks.issues, [], 'quality feedback must stay advisory while backdrop floor checks pass');
  const rendered = renderSiteCode(siteId, result.version.code, 'home');
  assert.match(rendered, /\/system-backdrops\/bd_grid_precision-steel--1440\.webp/);
  assert.match(rendered, /Shader Effects Inc\./);
  assert.match(rendered, /MIT License/);
  assert.doesNotMatch(rendered, /<script\b|shader.*\.js|webgpu/i);
  await writeFile(path.join(out, 'rendered.html'), rendered);
  const browser = await codeCheckBrowser();
  try {
    await browser.send('Page.navigate', { url: base });
    await browser.evaluate('new Promise(r=>{const poll=()=>document.readyState==="complete"?r(true):setTimeout(poll,20);poll()})');
    const { frameTree } = await browser.send<{ frameTree: { frame: { id: string } } }>('Page.getFrameTree');
    for (const width of [1440, 768, 375]) {
      await browser.send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
      await browser.send('Page.setDocumentContent', { frameId: frameTree.frame.id, html: rendered });
      await browser.evaluate('document.fonts.ready');
      const observed = await browser.evaluate<{ image: string; overflow: boolean; width: number }>(`({image:getComputedStyle(document.querySelector('.hero')).backgroundImage,overflow:document.documentElement.scrollWidth>innerWidth,width:innerWidth})`);
      assert.ok(observed.image.endsWith(`bd_grid_precision-steel--${width}.webp")`), `actual ${width} asset must be selected`);
      assert.equal(observed.overflow, false);
      await browser.evaluate(`new Promise((resolve,reject)=>{const image=new Image();image.src=getComputedStyle(document.querySelector('.hero')).backgroundImage.slice(5,-2);image.decode().then(resolve,reject)})`);
      const screenshot = await browser.send<{ data: string }>('Page.captureScreenshot', { format: 'png' });
      await writeFile(path.join(out, `site-${width}.png`), Buffer.from(screenshot.data, 'base64'));
    }
  } finally { await browser.close(); }
  const plain = structuredClone(code); plain.pages[0].html = '<main><h1>精密零件加工</h1><p>加工参数待补充。</p></main>';
  const edited = await submit(siteId, plain, 1); assert.equal(edited.status, 'applied');
  const restored = await commitSiteCode({ siteId, baseRevision: 2, restoreVersionId: result.version.id, author: 'user', summary: '恢复底图', request: '' });
  assert.equal(restored.status, 'applied');
  assert.equal((await getCodeSite(siteId))!.versions.length, 3);
  await writeFile(path.join(out, 'restore.json'), JSON.stringify(restored, null, 2));
});

test('marker resolves a light backdrop before contrast, instead of trusting a dark CSS fallback', async () => {
  const siteId = await freshSite(), candidate = structuredClone(code);
  candidate.css += '.hero{background-color:#111;color:#eee}';
  const result = await submit(siteId, candidate);
  assert.equal(result.status, 'rejected', 'light text on the actual light backdrop must reject');
  if (result.status === 'rejected') assert.match(result.checks.issues.join('\n'), /对比度/);
  assert.equal((await getCodeSite(siteId))!.versions.length, 0);
});

test('photo roles, unknown identifiers and non-background resource uses reject without saving', async () => {
  for (const html of [
    `<main><h1>精密零件加工</h1><img data-system-backdrop="${light}" alt="产品"></main>`,
    `<main><h1>精密零件加工</h1><figure data-system-backdrop="${light}">材料与尺寸待补充。</figure></main>`,
    `<main><h1>精密零件加工</h1><div role="img" data-system-backdrop="${light}">材料与尺寸待补充。</div></main>`,
    '<main><h1>精密零件加工</h1><section data-system-backdrop="bd_not-registered">材料与尺寸待补充。</section></main>',
  ]) {
    const siteId = await freshSite(), candidate = structuredClone(code); candidate.pages[0].html = html;
    const result = await submit(siteId, candidate); assert.equal(result.status, 'rejected', html);
    if (result.status === 'rejected') assert.match(result.checks.issues.join('\n'), /底图/);
    assert.equal((await getCodeSite(siteId))!.versions.length, 0);
  }
  for (const css of [
    '.hero{background-image:url("/system-backdrops/bd_not-registered--1440.webp")}',
    `.hero{background-image:url("https://example.com${cssUrl}")}`,
    `.hero{content:url("${cssUrl}")}`,
    `.hero{list-style-image:url("${cssUrl}")}`,
    `.hero{background-image:image-set(url("${cssUrl}") 1x)}`,
    `.hero{background-image:url("${cssUrl}?unregistered")}`,
  ]) {
    const siteId = await freshSite(), candidate = structuredClone(code); candidate.css += css;
    const result = await submit(siteId, candidate); assert.equal(result.status, 'rejected', css);
    assert.equal((await getCodeSite(siteId))!.versions.length, 0);
  }
});

test('external shader scripts are removed and rejected; missing static assets cannot save', async () => {
  const siteId = await freshSite(), candidate = structuredClone(code);
  candidate.pages[0].html += '<script src="https://example.com/shaders.js"></script>';
  const script = await submit(siteId, candidate); assert.equal(script.status, 'rejected');
  if (script.status === 'rejected') assert.doesNotMatch(script.code.pages[0].html, /<script/);
  missingAsset = true;
  try { const absent = await submit(siteId, code); assert.equal(absent.status, 'rejected'); }
  finally { missingAsset = false; }
  assert.equal((await getCodeSite(siteId))!.versions.length, 0);
});

test('controller-selected effects and palettes work through the real commit entry', async () => {
  const effects = ['grid', 'dot-grid', 'linear-field', 'radial-field', 'paper-grain', 'blue-grain'];
  const palettes = ['precision-steel', 'precision-sage', 'documentary-paper', 'documentary-graphite'];
  const siteId = await freshSite(), candidate = structuredClone(code);
  candidate.pages[0].html = '<main><h1>精密零件加工</h1><div class="tiles">' + effects.flatMap(effect => palettes.map(palette =>
    `<section class="tile${palette.endsWith('graphite') ? ' dark' : ''}" data-system-backdrop="bd_${effect}_${palette}"><p>材料与尺寸待补充。</p></section>`)).join('') + '</div></main>';
  const result = await submit(siteId, candidate); assert.equal(result.status, 'applied');
  assert.ok(modelCalls > 0, 'successful normal commits must reach the local fact boundary');
  if (result.status === 'applied') {
    assert.ok(result.version.checks.viewports.every(v => v.contrastIssues === 0));
    const rendered = renderSiteCode(siteId, result.version.code, 'home');
    for (const effect of effects) for (const palette of palettes) assert.ok(rendered.includes(`/system-backdrops/bd_${effect}_${palette}--1440.webp`), `${effect}/${palette} must resolve to a real background`);
  }
});

for (const pseudo of [true, false]) test(`unmeasurable ${pseudo ? 'pseudo' : 'independent'} scrim cannot hide white-on-white text over a dark backdrop`, async () => {
    const siteId = await freshSite(), candidate = structuredClone(code);
    candidate.pages[0].html = `<main><h1>精密零件加工</h1><section class="dark" data-system-backdrop="${dark}">${pseudo ? '' : '<div class="scrim" aria-hidden="true"></div>'}<p>加工参数待补充。</p></section></main>`;
    candidate.css += '.dark{position:relative;min-height:160px}.dark p{position:relative;z-index:1;color:#fff}' + (pseudo
      ? '.dark::before{content:"";position:absolute;inset:0;background:#fff}'
      : '.scrim{position:absolute;inset:0;background:#fff;pointer-events:none}');
    const result = await submit(siteId, candidate);
    assert.equal(result.status, 'rejected', 'an unmeasured white scrim cannot pass as white text on dark image');
    if (result.status === 'rejected') assert.match(result.checks.issues.join('\n'), /对比度.*无法测量|对比度不足或无法测量/);
    assert.equal((await getCodeSite(siteId))!.versions.length, 0);
});

for (const selector of ['.dark', '.dark p']) test(`own inset shadow on ${selector} cannot cover a dark backdrop and pass contrast`, async () => {
  const siteId = await freshSite(), candidate = structuredClone(code);
  candidate.pages[0].html = `<main><h1>精密零件加工</h1><section class="dark" data-system-backdrop="${dark}"><p>材料与尺寸待补充。</p></section></main>`;
  candidate.css += `${selector}{color:#fff;box-shadow:inset 0 0 0 1000px #fff}`;
  const result = await submit(siteId, candidate);
  assert.equal(result.status, 'rejected', 'white inset shadow over the image must not pass as white-on-dark');
  if (result.status === 'rejected') assert.match(result.checks.issues.join('\n'), /对比度不足或无法测量/);
  assert.equal((await getCodeSite(siteId))!.versions.length, 0);
});
