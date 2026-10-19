import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { codeCheckBrowser } from '../lib/code-site-browser.ts';
import { checkSiteCode } from '../lib/code-site-check.ts';
import { renderSiteCode, type SiteCode } from '../lib/code-site.ts';
import type { SiteImageRecord } from '../lib/site-images.ts';
import { codeCheckDocument } from './fixtures/code-check-document.ts';

// Oracle: only painted text can collide. Small nonzero clips remain measurable;
// the existing >2px overlap tolerance applies to the exposed fragment, not its full Range.
// Failure modes: hidden captions collide; an ancestor hides descendants; all clipping
// is exempted; an overflowing 1px box is exempted without clipping; visible collisions escape.
const fixture = JSON.parse(await readFile(new URL('./fixtures/t195-packaging-hidden-caption.json', import.meta.url), 'utf8')) as {
  siteId: string; materials: string; code: SiteCode; images: SiteImageRecord[];
};
const images = new Map(await Promise.all(fixture.images.map(async image => [image.imageId,
  await readFile(new URL(`./fixtures/company-images/packaging/${image.originalName}`, import.meta.url))] as const)));
let unexpectedRequests = 0;
const server = createServer((req, res) => {
  const image = images.get(req.url?.split('/').at(-1) ?? '');
  if (image) { res.setHeader('content-type', 'image/jpeg'); res.end(image); }
  else if (req.url === '/code-check.html') { res.setHeader('content-type', 'text/html'); res.end(codeCheckDocument); }
  else { unexpectedRequests++; res.writeHead(404); res.end('未配置的测试请求'); }
});
await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
process.env.SITECRAFT_BASE = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
const output = `artifacts/t195/replay-${Date.now()}-${process.pid}`;
await mkdir(output, { recursive: true });
console.log(`T-195 证据：${output}`);
test.after(async () => {
  await new Promise<void>(resolve => server.close(() => resolve()));
  assert.equal(unexpectedRequests, 0, '测试不得请求模型或未配置的资源');
});
const scanSource = (await readFile('scripts/visitor-layout-scan.js', 'utf8'))
  .replace('export function', 'function').replace('export default scanVisitorLayout;', '');
type Scan = { textOverlaps: Array<{ key: string; targets: string[]; amount: number }>;
  overflowElements: Array<{ key: string }>; horizontalScroll: boolean;
  textContrast: Array<{ element: string; ratio: number }> };
const widths = [375, 768, 1440];
async function scan(code: SiteCode, label: string, captures = false) {
  const browser = await codeCheckBrowser();
  const reports: Array<{ pageId: string; width: number; layout: Scan; captions: unknown }> = [];
  try {
    await browser.loadPage('Page.navigate', { url: `${process.env.SITECRAFT_BASE}/code-check.html` });
    const { frameTree } = await browser.send<{ frameTree: { frame: { id: string } } }>('Page.getFrameTree');
    for (const page of code.pages) for (const width of widths) {
      await browser.send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
      await browser.send('Page.setDocumentContent', { frameId: frameTree.frame.id,
        html: renderSiteCode(fixture.siteId, code, page.id, '', fixture.images.map(i => i.attribution)) });
      await browser.evaluate('document.fonts.ready.then(()=>Promise.all([...document.images].map(i=>i.decode())))');
      const report = await browser.evaluate<{ layout: Scan; captions: unknown }>(`(() => {${scanSource};
        const rect = r => ({left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height});
        return {layout:scanVisitorLayout(document),captions:[...document.querySelectorAll('caption')].map(el=>{
          const s=getComputedStyle(el),r=document.createRange();r.selectNodeContents(el);
          return {text:el.textContent,box:rect(el.getBoundingClientRect()),textRects:[...r.getClientRects()].map(rect),
            clip:s.clip,clipPath:s.clipPath,overflow:s.overflow,opacity:s.opacity,visibility:s.visibility};})};})()`);
      reports.push({ pageId: page.id, width, ...report });
      if (captures && page.id === 'products') {
        const { data } = await browser.send<{ data: string }>('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
        await writeFile(`${output}/${label}-${width}.png`, Buffer.from(data, 'base64'));
      }
    }
  } finally { await browser.close(); }
  await writeFile(`${output}/${label}-scan.json`, JSON.stringify(reports, null, 2), 'utf8');
  return reports;
}
async function check(code: SiteCode, label: string) {
  // Offline deterministic contract: no fact-model calls and no version writes.
  const result = await checkSiteCode({ siteId: fixture.siteId, code, materials: fixture.materials, images: fixture.images, legacyImport: true });
  await writeFile(`${output}/${label}-checks.json`, JSON.stringify(result, null, 2), 'utf8');
  return result.checks;
}

test('C7 保存候选：视觉隐藏 caption 不触发三档重叠，生产提交检查通过', async () => {
  const reports = await scan(fixture.code, 'c7', true);
  const checks = await check(fixture.code, 'c7');
  for (const report of reports) assert.equal(report.layout.textOverlaps.length, 0,
    `${report.pageId}/${report.width} 隐藏 caption 没有可见文字重叠`);
  assert.equal(checks.passed, true, JSON.stringify(checks.issues));
});

test('可见 caption 的相同碰撞仍由生产扫描和提交检查拒收', async () => {
  const code = { ...fixture.code, css: fixture.code.css + '\n.visually-hidden{clip:auto;width:auto;height:auto;overflow:visible}' };
  const reports = await scan(code, 'visible-caption');
  const checks = await check(code, 'visible-caption');
  for (const width of widths) {
    const report = reports.find(r => r.pageId === 'products' && r.width === width)!;
    assert.ok(report.layout.textOverlaps.some(pair => pair.key.includes('规格参数')), `${width} 可见 caption 必须被检出`);
    assert.ok(checks.issues.includes(`products/${width} 文字重叠`));
  }
  assert.equal(checks.passed, false);
});

const make = (style: string, ancestor = false): SiteCode => ({ header: '', footer: '',
  css: `body{margin:0;color:#111;background:#fff;font:16px/20px monospace}main{padding:20px}h1{margin:0 0 20px;font-size:24px;line-height:30px}
    .stage{position:relative;height:60px}.text{position:absolute;left:0;top:0;margin:0;white-space:nowrap;width:200px;height:20px}
    .probe{${style}}`,
  pages: [{ id: 'home', title: '可见性', html: `<main><h1>可见性</h1><div class="stage"><p class="text">VISIBLE TEXT COLLISION</p>
    ${ancestor ? '<div class="text probe"><span id="probe">HIDDEN TEXT COLLISION</span></div>' : '<p id="probe" class="text probe">HIDDEN TEXT COLLISION</p>'}</div></main>` }] });

test('零裁切、1px 裁切和透明隐藏含祖先均排除，低对比度隐藏文字也不参与检查', async () => {
  for (const style of ['clip:rect(0px,0px,0px,0px)', 'clip-path:inset(50%)', 'clip-path:circle(0px)',
    'clip-path:ellipse(0px 10px)', 'clip-path:polygon(0 0,0 0,0 0)',
    'width:1px;height:1px;overflow:hidden', 'opacity:0', 'visibility:hidden']) {
    const reports = await scan(make(`${style};color:#eee`, true), `hidden-${style.split(':')[0]}-${crypto.randomUUID()}`);
    for (const { layout, width } of reports) {
      assert.equal(layout.textOverlaps.length, 0, `${style}/${width}`);
      assert.ok(!layout.textContrast.some(t => t.element === 'probe'), `${style} 隐藏文字不测对比度`);
    }
  }
});

test('非零小裁切保留露出片段；未裁切的 1px 盒和半透明文字不能按隐藏放过', async () => {
  for (const [style, overlap] of [
    ['clip:rect(0px,1px,20px,0px)', false],
    ['clip-path:inset(0 199px 0 0)', false],
    ['clip:rect(0px,4px,20px,0px)', true],
    ['clip-path:inset(0 196px 0 0)', true],
    ['width:1px;height:1px;overflow:visible', true], ['opacity:.01', true],
  ] as const) {
    const reports = await scan(make(style), `partial-${crypto.randomUUID()}`);
    for (const { layout, width } of reports) {
      assert.equal(layout.textOverlaps.length > 0, overlap, `${style}/${width} 仅按露出区域应用既有 2px 容差`);
      assert.ok(layout.textContrast.some(t => t.element === 'probe'), `${style} 非零可见文字仍测对比度`);
    }
  }
});

test('共用可见性同时约束元素溢出和对比度，可见的低对比度溢出仍保留', async () => {
  for (const [style, hidden] of [
    ['clip:rect(0px,0px,0px,0px)', true], ['clip-path:inset(50%)', true],
    ['opacity:0', true], ['visibility:hidden', true], ['opacity:.1', false],
    ['clip:rect(0px,4px,20px,0px)', false],
  ] as const) {
    const reports = await scan(make(`left:-100px;color:#eee;${style}`), `overflow-${crypto.randomUUID()}`);
    for (const { layout } of reports) {
      assert.equal(layout.overflowElements.length > 0, !hidden, style);
      const contrast = layout.textContrast.find(t => t.element === 'probe');
      if (hidden) assert.equal(contrast, undefined, style);
      else assert.ok(contrast && contrast.ratio < 4.5, `${style} 可见的低对比度文字不能漏检`);
    }
  }
});

test('不足 1px 的非零裁切仍测对比度，不能因 clientWidth 取整变成隐藏', async () => {
  const reports = await scan(make('width:.25px;height:20px;overflow:hidden'), 'fractional');
  for (const { layout } of reports) {
    assert.equal(layout.textOverlaps.length, 0, '不足 2px 的露出片段沿用原容差');
    assert.ok(layout.textContrast.some(t => t.element === 'probe'), '非零宽度不能取整为零');
  }
});

test('变换后的可见文字和逃出非定位 overflow 容器的绝对定位文字仍须检查', async () => {
  const scaled = make('clip:rect(0px,2px,20px,0px);transform:scale(2);transform-origin:top left');
  const scaledInset = make('clip-path:inset(0 120px 0 0);transform:scale(.5);transform-origin:top left');
  const escaped = make('');
  escaped.pages[0].html = `<main><h1>可见性</h1><div class="stage"><p class="text">VISIBLE TEXT COLLISION</p>
    <div style="width:1px;height:1px;overflow:hidden"><p id="probe" class="text">ESCAPED TEXT COLLISION</p></div></div></main>`;
  for (const [label, code] of [['scaled', scaled], ['scaled-inset', scaledInset], ['escaped', escaped]] as const) {
    const reports = await scan(code, label);
    for (const { layout } of reports) {
      assert.ok(layout.textOverlaps.length > 0, `${label} 实际露出的碰撞不能被隐藏判断放过`);
      assert.ok(layout.textContrast.some(t => t.element === 'probe'));
    }
  }
});
