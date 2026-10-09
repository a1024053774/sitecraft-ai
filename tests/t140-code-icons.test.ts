import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { registerHooks } from 'node:module';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { renderSiteCode, type SiteCode } from '../lib/code-site.ts';
import { codeCheckBrowser } from '../lib/code-site-browser.ts';

registerHooks({ resolve(specifier, context, next) {
  if (!specifier.startsWith('@/')) return next(specifier, context);
  const file = path.join(process.cwd(), specifier.slice(2));
  return next(pathToFileURL(existsSync(`${file}.ts`) ? `${file}.ts` : file).href, context);
} });
const { updateCodeSite, commitSiteCode, getCodeSite } = await import('../lib/code-site-store.ts');
const { POST: createSite } = await import('../app/api/sites/route.ts');

// T-140: the real commit boundary must accept every registered icon, keep
// distinct Lucide shapes, remove model children, and reject unknown ids.
// Only the factual model response is a local fixture; Chrome and storage are real.
const icons = ['arrow', 'mail', 'phone', 'map-pin', 'download', 'file-text', 'certificate', 'factory', 'cog', 'inspection', 'package', 'truck', 'clock', 'wrench'];
const labels = ['看产品', '邮箱', '电话', '位置', '下载资料', '文档', '证书', '工厂', '加工', '检测', '包裹', '物流', '交期', '维修'];
const out = path.resolve('artifacts/t140', `icons-${crypto.randomUUID()}`);
const server = createServer(async (request, response) => {
  response.setHeader('content-type', request.method === 'GET' ? 'text/html' : 'application/json');
  if (request.method === 'GET') return response.end('<!doctype html><html><body></body></html>');
  let raw = ''; for await (const chunk of request) raw += chunk;
  const body = JSON.parse(raw); assert.ok(body.messages[0].content.includes('事实校对员'));
  response.end(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: '{"issues":[]}' } }] }));
});
await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
process.env.SITE_STORE = 'fs'; process.env.SITECRAFT_BASE = base;
process.env.DEEPSEEK_BASE_URL = base; process.env.DEEPSEEK_API_KEY = 'local-fixture-only'; process.env.DEEPSEEK_MODEL = 'local-fixture-only';
test.after(() => new Promise<void>(resolve => server.close(() => resolve())));
const code: SiteCode = { header: '<header>曜石零件</header>', footer: '<footer>联系方式待补充</footer>',
  css: 'body{margin:0;background:#fff;color:#222;font:16px/1.6 sans-serif}header,footer,main{padding:24px}h1{font-size:28px}p{max-width:30em}.icons{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:16px;list-style:none;padding:0}.icons li{display:flex;align-items:center;gap:8px}svg{flex:none}',
  pages: [{ id: 'home', title: '曜石零件', html: '<main><h1>曜石零件</h1><p>精密零件加工。电话与地址待补充。</p><ul class="icons">' + icons.map((id, i) => `<li><span data-system-icon="${id}">模型遗留文字</span><span>${labels[i]}</span></li>`).join('') + '</ul></main>' }] };

test('all semantic icons save through the commit entry and render distinct accessible SVG at three widths', async () => {
  await mkdir(out, { recursive: true });
  const created = await createSite(new Request(base + '/api/sites', { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: '曜石零件' }) }));
  assert.equal(created.status, 201);
  const { id } = await created.json();
  await updateCodeSite(id, () => ({ materials: `公司名：曜石零件。精密零件加工。电话、地址、联系方式：待补充。${labels.join('；')}。` }));
  const result = await commitSiteCode({ siteId: id, baseRevision: 0, code, author: 'user', summary: '系统图标夹具', request: '' });
  await writeFile(path.join(out, 'commit.json'), JSON.stringify(result, null, 2));
  assert.equal(result.status, 'applied', 'registered B2B icons must pass the real commit boundary');
  if (result.status !== 'applied') return;
  assert.equal(result.version.checks.viewports.length, 3);
  assert.doesNotMatch(result.version.code.pages[0].html, /模型遗留文字/);
  const html = renderSiteCode(id, result.version.code, 'home', result.version.id);
  await writeFile(path.join(out, 'rendered.html'), html);
  const browser = await codeCheckBrowser();
  try {
    await browser.send('Page.navigate', { url: base });
    await browser.evaluate('new Promise(r=>{const poll=()=>document.readyState==="complete"?r(true):setTimeout(poll,20);poll()})');
    const { frameTree } = await browser.send<{ frameTree: { frame: { id: string } } }>('Page.getFrameTree');
    await browser.send('Page.setDocumentContent', { frameId: frameTree.frame.id, html });
    const glyphs = await browser.evaluate<Array<{ name: string; shape: string; hidden: string | null; width: number }>>(`Array.from(document.querySelectorAll('svg')).map(svg=>({name:svg.getAttribute('data-system-rendered-icon'),shape:svg.innerHTML,hidden:svg.getAttribute('aria-hidden'),width:svg.getBoundingClientRect().width}))`);
    assert.deepEqual(glyphs.map(g => g.name), icons);
    assert.equal(new Set(glyphs.map(g => g.shape)).size, 14, 'no repeated paper-plane geometry');
    assert.ok(glyphs.every(g => g.hidden === 'true' && g.width === 20));
    for (const width of [1440, 768, 375]) {
      await browser.send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
      await browser.evaluate('document.fonts.ready.then(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))');
      assert.equal(await browser.evaluate('document.documentElement.scrollWidth > innerWidth'), false);
      const shot = await browser.send<{ data: string }>('Page.captureScreenshot', { format: 'png' });
      await writeFile(path.join(out, `icons-${width}.png`), Buffer.from(shot.data, 'base64'));
    }
  } finally { await browser.close(); }
  for (const unknown of ['external-link', 'unknown', 'constructor', '__proto__']) {
    const candidate = structuredClone(code); candidate.pages[0].html = `<main><h1>曜石零件</h1><p>精密零件加工。</p><span data-system-icon="${unknown}"></span></main>`;
    const refused = await commitSiteCode({ siteId: id, baseRevision: 1, code: candidate, author: 'user', summary: '未知图标', request: '' });
    assert.equal(refused.status, 'rejected');
    if (refused.status === 'rejected') assert.ok(refused.checks.issues.includes('系统图标编号无效'));
  }
  assert.equal((await getCodeSite(id))!.versions.length, 1, 'rejected icons never add a version');
});
