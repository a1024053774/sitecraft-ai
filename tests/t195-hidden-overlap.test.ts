import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { codeCheckBrowser } from '../lib/code-site-browser.ts';
import { checkSiteCode } from '../lib/code-site-check.ts';
import { renderSiteCode, type SiteCode } from '../lib/code-site.ts';
import type { SiteImageRecord } from '../lib/site-images.ts';
import { codeCheckDocument } from './fixtures/code-check-document.ts';

// 期望来自负责人收窄后的合同：只排除文字自身 visibility 非 visible，
// 或有盒节点的完整 sr-only 写法；其余保留完整 Range，允许保守误拒。
// 复审探针的 inline/contents 文字确实绘制；透明或其他裁切只作合同对照。
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
type Probe = { hit: boolean; transform: string; scale: string; rotate: string; translate: string; overflowClipMargin: string };
async function scan(code: SiteCode, label: string, captures = false) {
  const browser = await codeCheckBrowser();
  const reports: Array<{ pageId: string; width: number; layout: Scan; captions: unknown; probe: Probe | null }> = [];
  try {
    await browser.loadPage('Page.navigate', { url: `${process.env.SITECRAFT_BASE}/code-check.html` });
    const { frameTree } = await browser.send<{ frameTree: { frame: { id: string } } }>('Page.getFrameTree');
    for (const page of code.pages) for (const width of widths) {
      await browser.send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
      await browser.send('Page.setDocumentContent', { frameId: frameTree.frame.id,
        html: renderSiteCode(fixture.siteId, code, page.id, '', fixture.images.map(i => i.attribution)) });
      await browser.evaluate('document.fonts.ready.then(()=>Promise.all([...document.images].map(i=>i.decode())))');
      const report = await browser.evaluate<{ layout: Scan; captions: unknown; probe: Probe | null }>(`(() => {${scanSource};
        const rect = r => ({left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height});
        const p=document.querySelector('#probe'),s=p&&getComputedStyle(p),r=p&&p.getBoundingClientRect();
        const probe=p?{hit:document.elementsFromPoint(r.left+5,r.top+5).some(el=>el===p),
          transform:s.transform,scale:s.scale,rotate:s.rotate,translate:s.translate,
          overflowClipMargin:getComputedStyle(p.parentElement).overflowClipMargin}:null;
        return {layout:scanVisitorLayout(document),probe,captions:[...document.querySelectorAll('caption')].map(el=>{
          const s=getComputedStyle(el),r=document.createRange();r.selectNodeContents(el);
          return {text:el.textContent,box:rect(el.getBoundingClientRect()),textRects:[...r.getClientRects()].map(rect),
            clip:s.clip,clipPath:s.clipPath,overflow:s.overflow,opacity:s.opacity,visibility:s.visibility};})};})()`);
      reports.push({ pageId: page.id, width, ...report });
      if (captures && (page.id === 'products' || code.pages.length === 1)) {
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

test('完整 sr-only 与文字自身 visibility 隐藏含继承均排除', async () => {
  for (const style of ['width:1px;height:1px;overflow:hidden;clip:rect(0px,0px,0px,0px)',
    'width:1px;height:1px;overflow:clip;clip-path:inset(50%)', 'visibility:hidden']) {
    const reports = await scan(make(`${style};color:#eee`, true), `hidden-${style.split(':')[0]}-${crypto.randomUUID()}`);
    for (const { layout, width } of reports) {
      assert.equal(layout.textOverlaps.length, 0, `${style}/${width}`);
      assert.ok(!layout.textContrast.some(t => t.element === 'probe'), `${style} 隐藏文字不测对比度`);
    }
  }
});

test('非零裁切保守保留完整 Range；未裁切的 1px 盒和半透明文字不能排除', async () => {
  for (const style of [
    'clip:rect(0px,1px,20px,0px)', 'clip-path:inset(0 199px 0 0)',
    'clip:rect(0px,4px,20px,0px)', 'clip-path:inset(0 196px 0 0)',
    'width:1px;height:1px;overflow:visible', 'opacity:.01',
  ]) {
    const reports = await scan(make(style), `partial-${crypto.randomUUID()}`);
    for (const { layout, width } of reports) {
      assert.ok(layout.textOverlaps.length > 0, `${style}/${width} 无全隐藏证明时不缩小 Range`);
      assert.ok(layout.textContrast.some(t => t.element === 'probe'), `${style} 非零可见文字仍测对比度`);
    }
  }
});

test('共用可见性同时约束元素溢出和对比度，可见的低对比度溢出仍保留', async () => {
  for (const [style, hidden] of [
    ['width:1px;height:1px;overflow:hidden;clip:rect(0px,0px,0px,0px)', true],
    ['width:1px;height:1px;overflow:clip;clip-path:inset(50%)', true],
    ['opacity:0', false], ['visibility:hidden', true], ['opacity:.1', false],
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

test('不足 1px 的非零裁切仍按完整 Range 测量，不能因取整变成隐藏', async () => {
  const reports = await scan(make('width:.25px;height:20px;overflow:hidden'), 'fractional');
  for (const { layout } of reports) {
    assert.ok(layout.textOverlaps.length > 0, '无法证明全隐藏时不按露出片段豁免');
    assert.ok(layout.textContrast.some(t => t.element === 'probe'), '非零宽度不能取整为零');
  }
});

// 两个探针保留独立审查原输入；通过生产清理和 checkSiteCode 三档验证。
const reviewProbe = (css: string, html: string): SiteCode => ({ header: '', footer: '',
  css: 'body{margin:0;color:#111;background:#fff;font:16px/20px monospace}main{padding:20px}h1{margin:0 0 20px;font-size:24px;line-height:30px}.stage{position:relative;height:80px}.text{position:absolute;left:0;top:0;margin:0;white-space:nowrap;width:200px;height:20px}.probe{color:#eee}' + css,
  pages: [{ id: 'home', title: 'Visibility', html: '<main><h1>Visibility</h1><div class="stage">' + html + '</div></main>' }] });
const visibleCollision = '<p class="text">VISIBLE COLLISION</p>';
const probeText = '<p id="probe" class="text probe">VISIBLE COLLISION</p>';

const review2Cases = JSON.parse(await readFile(new URL('./fixtures/t195-review2-visible.json', import.meta.url), 'utf8')) as Record<string, SiteCode>;

test('复审两项 P2：inline/contents 的 content-visibility hidden/visible 与 contents opacity 0/1，碰撞及单独低对比度均拒收', async () => {
  const failures: string[] = [];
  for (const [name, original] of Object.entries(review2Cases)) for (const control of [false, true]) for (const alone of [false, true]) {
    const label = `review2-${name}-${control ? 'control' : 'original'}-${alone ? 'alone' : 'collision'}`;
    const code = { ...original, css: control ? original.css.replace('content-visibility:hidden', 'content-visibility:visible').replace('opacity:0', 'opacity:1') : original.css,
      pages: original.pages.map(page => ({ ...page, html: alone ? page.html.replace(visibleCollision, '') : page.html })) };
    const reports = await scan(code, label, !control && !alone);
    const checks = await check(code, label);
    for (const { width, layout, probe } of reports) {
      if (!probe?.hit) failures.push(`${label}/${width} 浏览器实际可见文字未命中`);
      if ((layout.textOverlaps.length > 0) !== !alone) failures.push(`${label}/${width} 重叠结果不符`);
      if (!layout.textContrast.some(t => t.element === 'probe' && t.ratio < 4.5)) failures.push(`${label}/${width} 漏掉白底浅灰文字`);
      const viewport = checks.viewports.find(v => v.width === width)!;
      if ((viewport.overlaps > 0) !== !alone || viewport.contrastIssues < 1) failures.push(`${label}/${width} 生产提交拒因不符`);
    }
    if (checks.passed) failures.push(`${label} 被生产提交入口放过`);
  }
  assert.deepEqual(failures, []);
});

test('两条排除规则：sr-only 必须有盒且条件齐全；visibility 可继承也可由后代恢复', async () => {
  const failures: string[] = [];
  const sr = 'width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)';
  for (const [name, style, tag, display, childStyle, exclude] of [
    ['sr-block', sr, 'div', 'block', '', true],
    ['sr-inset-inline-block', 'width:1px;height:1px;overflow:clip;clip-path:inset(50%)', 'span', 'inline-block', '', true],
    ['sr-contents', sr, 'div', 'contents', '', false],
    ['sr-inline', sr, 'span', 'inline', '', false],
    ['sr-contents-inset', 'width:1px;height:1px;overflow:clip;clip-path:inset(50%)', 'div', 'contents', '', false],
    ['sr-inline-inset', 'width:1px;height:1px;overflow:clip;clip-path:inset(50%)', 'span', 'inline', '', false],
    ['missing-size', 'overflow:hidden;clip:rect(0 0 0 0)', 'div', 'block', '', false],
    ['missing-overflow', 'width:1px;height:1px;clip:rect(0 0 0 0)', 'div', 'block', '', false],
    ['missing-zero-clip', 'width:1px;height:1px;overflow:hidden', 'div', 'block', '', false],
    ['one-axis', 'width:1px;height:1px;overflow-x:clip;overflow-y:visible;clip:rect(0 0 0 0)', 'div', 'block', '', false],
    ['visibility-inherited', 'visibility:hidden', 'div', 'block', '', true],
    ['visibility-self', '', 'div', 'block', 'visibility:hidden', true],
    ['visibility-contents', 'visibility:hidden', 'div', 'contents', '', true],
    ['visibility-restored', 'visibility:hidden', 'div', 'block', 'visibility:visible', false],
    ['visibility-contents-restored', 'visibility:hidden', 'div', 'contents', 'visibility:visible', false],
    ['visible', '', 'div', 'block', '', false],
  ] as const) {
    // 普通 inline/contents 不定位，防止 absolute 将 inline 的 display 块化。
    const code = reviewProbe(`.wrapper{position:absolute;left:0;top:0}.candidate{${style};display:${display}${display === 'inline' || display === 'contents' ? '' : ';position:absolute'}}#probe{${childStyle}}`,
      visibleCollision + `<div class="wrapper"><${tag} class="candidate"><span id="probe" class="probe">VISIBLE COLLISION</span></${tag}></div>`);
    const reports = await scan(code, `rules-${name}`);
    const checks = await check(code, `rules-${name}`);
    for (const { width, layout } of reports) {
      if ((layout.textOverlaps.length === 0) !== exclude) failures.push(`${name}/${width} 重叠排除不符`);
      if (layout.textContrast.some(t => t.element === 'probe') === exclude) failures.push(`${name}/${width} 对比度排除不符`);
      const viewport = checks.viewports.find(v => v.width === width)!;
      if ((viewport.overlaps === 0) !== exclude || (viewport.contrastIssues === 0) !== exclude) failures.push(`${name}/${width} 生产提交拒因不符`);
    }
    if (checks.passed !== exclude) failures.push(`${name} 生产提交结果不符`);
  }
  assert.deepEqual(failures, []);
});

test('移除其他全隐藏捷径：有盒 opacity 0/1、content-visibility hidden/visible 和独立零裁剪均保守拒收', async () => {
  const failures: string[] = [];
  for (const style of ['opacity:0', 'opacity:1', 'content-visibility:hidden', 'content-visibility:visible',
    'clip:rect(0 0 0 0)', 'clip-path:inset(50%)', 'clip-path:circle(0px)',
    'clip-path:ellipse(0px 10px)', 'clip-path:polygon(0 0,0 0,0 0)']) {
    const code = make(`${style};color:#eee`, true);
    const label = `conservative-${crypto.randomUUID()}`;
    const reports = await scan(code, label);
    const checks = await check(code, label);
    for (const { width, layout } of reports) {
      if (!layout.textOverlaps.length || !layout.textContrast.some(t => t.element === 'probe' && t.ratio < 4.5)) failures.push(`${style}/${width} 未按可见处理`);
      const viewport = checks.viewports.find(v => v.width === width)!;
      if (!viewport.overlaps || !viewport.contrastIssues) failures.push(`${style}/${width} 生产提交未拒收两项`);
    }
    if (checks.passed) failures.push(`${style} 被生产提交入口放过`);
  }
  assert.deepEqual(failures, []);
});

test('审查 P2-1：自身及祖先的独立变换与 transform 等价写法均拒收重叠和低对比度', async () => {
  const failures: string[] = [];
  for (const [name, independent, transform] of [
    ['scale', 'scale:.5', 'transform:scale(.5)'],
    ['rotate', 'rotate:1deg', 'transform:rotate(1deg)'],
    ['translate', 'translate:1px', 'transform:translateX(1px)'],
  ]) for (const ancestor of [false, true]) for (const [syntax, declaration] of [['independent', independent], ['transform', transform]]) {
    const label = `review-${name}-${ancestor ? 'ancestor' : 'self'}-${syntax}`;
    const code = reviewProbe('.probe{clip-path:inset(0 120px 0 0)}' +
      `${ancestor ? '.transformed' : '.probe'}{${declaration};transform-origin:top left}`,
      visibleCollision + (ancestor ? `<div class="text transformed">${probeText}</div>` : probeText));
    const reports = await scan(code, label, name === 'scale');
    const checks = await check(code, label);
    for (const { width, layout, probe } of reports) {
      if (!probe?.hit) failures.push(`${label}/${width} 访客可见位置未命中探针`);
      if (!layout.textOverlaps.length) failures.push(`${label}/${width} 漏掉可见碰撞`);
      if (!layout.textContrast.some(t => t.element === 'probe' && t.ratio < 4.5)) failures.push(`${label}/${width} 漏掉低对比度`);
      const viewport = checks.viewports.find(v => v.width === width)!;
      if (!(viewport.overlaps > 0 && viewport.contrastIssues > 0)) failures.push(`${label}/${width} 生产提交检查未同时拒收两项`);
    }
    if (checks.passed) failures.push(`${label} 被生产提交入口放过`);
  }
  assert.deepEqual(failures, []);
});

test('审查 P2-2：clip margin=0/100px 的 1px/20px 盒均不满足完整 sr-only，保守拒收', async () => {
  const failures: string[] = [];
  for (const size of [20, 1]) for (const margin of [0, 100]) {
    const label = `review-clip-margin-${size}-${margin}`;
    const code = reviewProbe(`.clipper{position:relative;width:${size}px;height:${size}px;overflow:clip;overflow-clip-margin:${margin}px}.text{left:50px}`,
      visibleCollision + `<div class="clipper">${probeText}</div>`);
    const reports = await scan(code, label, true);
    const checks = await check(code, label);
    for (const { width, layout, probe } of reports) {
      if (probe?.hit !== (margin > 0)) failures.push(`${label}/${width} 浏览器实际裁切与场景预期不符`);
      const exclude = false;
      if ((layout.textOverlaps.length === 0) !== exclude) failures.push(`${label}/${width} 重叠保守规则不符`);
      if (layout.textContrast.some(t => t.element === 'probe' && t.ratio < 4.5) === exclude) failures.push(`${label}/${width} 对比度保守规则不符`);
      const viewport = checks.viewports.find(v => v.width === width)!;
      if ((viewport.overlaps === 0) !== exclude || (viewport.contrastIssues === 0) !== exclude) failures.push(`${label}/${width} 生产拒因不符`);
    }
    if (checks.passed) failures.push(`${label} 生产提交结果不符`);
  }
  assert.deepEqual(failures, []);
});

test('完整 sr-only 排除；缺少零裁切、小盒子、其他零裁切与变换均保守保留', async () => {
  const failures: string[] = [];
  for (const [name, style, ancestorStyle] of [
    ['standard-hidden', 'width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)', ''],
    ['standard-clip', 'width:1px;height:1px;overflow:clip;clip-path:inset(50%)', ''],
    ['only-overflow', 'width:1px;height:1px;overflow:hidden', ''],
    ['scaled-tiny', 'width:1px;height:1px;overflow:hidden;scale:10;transform-origin:top left', ''],
    ['ancestor-scaled-tiny', 'width:1px;height:1px;overflow:hidden', 'scale:10;transform-origin:top left'],
    ['contain', 'width:20px;height:20px;contain:paint', ''],
    ['nested-clips', 'clip-path:inset(0 199px 0 0)', 'clip-path:inset(0 199px 0 0)'],
    ['zero-clip-transformed', 'clip:rect(0 0 0 0);scale:.5', 'rotate:1deg'],
    ['zero-inset-transformed', 'clip-path:inset(50%);scale:.5', 'translate:1px'],
  ]) {
    const code = make(style + ';color:#eee');
    code.css += `.outer{position:absolute;left:0;top:0;width:200px;height:20px;${ancestorStyle}}`;
    code.pages[0].html = code.pages[0].html.replace('<p id="probe"', '<div class="outer"><p id="probe"').replace('</p></div></main>', '</p></div></div></main>');
    const reports = await scan(code, name);
    const exclude = name.startsWith('standard-');
    for (const { width, layout } of reports) {
      if ((layout.textOverlaps.length === 0) !== exclude) failures.push(`${name}/${width} 重叠可见性不符`);
      if (layout.textContrast.some(t => t.element === 'probe') === exclude) failures.push(`${name}/${width} 对比度可见性不符`);
    }
  }
  assert.deepEqual(failures, []);
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
