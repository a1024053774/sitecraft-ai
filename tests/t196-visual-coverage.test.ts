import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { checkSiteCode } from '../lib/code-site-check.ts';
import { codeCheckBrowser } from '../lib/code-site-browser.ts';
import { readGeneratedLayout } from '../lib/code-site-generated-layout.ts';
import { renderSiteCode, type SiteCode } from '../lib/code-site.ts';
import { codeCheckDocument } from './fixtures/code-check-document.ts';

// 原输入来自复审三；预期来自访客原样绘制：浅灰碰撞、视口左侧裁字。
// 对照保留 aria/details/小盒/生成内容，只消除碰撞、低对比或越界。
const inputs: Record<string, SiteCode> = JSON.parse(await readFile(new URL('./fixtures/t196-review3-inputs.json', import.meta.url), 'utf8'));
// 只复制独立审查的页面输入；低对比期望来自实际深／浅实色叠底。
const review1: Record<string, SiteCode> = JSON.parse(await readFile(new URL('./fixtures/t196-review1-inputs.json', import.meta.url), 'utf8'));
const review2: Record<string, SiteCode> = JSON.parse(await readFile(new URL('./fixtures/t196-review2-inputs.json', import.meta.url), 'utf8'));
const scan = (await readFile(new URL('../scripts/visitor-layout-scan.js', import.meta.url), 'utf8')).replace('export function', 'function').replace('export default scanVisitorLayout;', '');
let unexpected = 0;
const server = createServer((req, res) => {
  if (req.url !== '/code-check.html') { unexpected++; res.writeHead(404); res.end(); return; }
  res.setHeader('content-type', 'text/html'); res.end(codeCheckDocument);
});
await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
process.env.SITECRAFT_BASE = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
const out = `artifacts/t196/probes-${Date.now()}-${process.pid}`;
await mkdir(out, { recursive: true });
console.log(`T-196 证据：${out}`);
test.after(async () => { await new Promise<void>(resolve => server.close(() => resolve())); assert.equal(unexpected, 0); });
const widths = [375, 768, 1440];
async function run(name: string, code: SiteCode, capture = false, translationSource?: SiteCode) {
  const checked = await checkSiteCode({ siteId: 't196', code, materials: 'Visibility VISIBLE COLLISION Details content OVERLAP 30 L/min 12', images: [], legacyImport: true, translationSource });
  await writeFile(`${out}/${name}-checks.json`, JSON.stringify(checked, null, 2), 'utf8');
  if (capture) {
    const browser = await codeCheckBrowser();
    const observations = [];
    try {
      await browser.loadPage('Page.navigate', { url: `${process.env.SITECRAFT_BASE}/code-check.html` });
      const { frameTree } = await browser.send<{ frameTree: { frame: { id: string } } }>('Page.getFrameTree');
      for (const width of widths) {
        await browser.send('Emulation.setDeviceMetricsOverride', { width, height: 300, deviceScaleFactor: 1, mobile: false });
        await browser.send('Page.setDocumentContent', { frameId: frameTree.frame.id, html: renderSiteCode('t196', checked.code, 'home') });
        await browser.evaluate('document.fonts.ready');
        const generated = await readGeneratedLayout(browser);
        observations.push({ width, generated, ...await browser.evaluate<Record<string, unknown>>(`(() => {${scan};
          const el=document.getElementById('probe'),s=getComputedStyle(el),p=getComputedStyle(el,'::before');
          const range=document.createRange();range.selectNodeContents(el);const r=range.getBoundingClientRect();
          return {visibility:s.visibility,display:s.display,aria:el.getAttribute('aria-hidden'),open:el.closest('details')?.open,
            range:{left:r.left,right:r.right,width:r.width,height:r.height},pseudo:{content:p.content,visibility:p.visibility,color:p.color},
            hit:document.elementsFromPoint(25,75).includes(el),scan:scanVisitorLayout(document,{},${JSON.stringify(generated)})};
        })()`) });
        const { data } = await browser.send<{ data: string }>('Page.captureScreenshot', { format: 'png' });
        await writeFile(`${out}/${name}-${width}.png`, Buffer.from(data, 'base64'));
      }
    } finally { await browser.close(); }
    await writeFile(`${out}/${name}-visitor.json`, JSON.stringify(observations, null, 2), 'utf8');
  }
  return checked.checks;
}

test('原生 normal 列表编号与显式编号均按实际文字检查，安全编号通过', async () => {
  const failures: string[] = [];
  for (const kind of ['normal', 'explicit']) {
    const bad = await run(`marker-${kind}-bad`, review2[`marker-${kind}-bad`], true);
    for (const width of widths) if (!bad.viewports.some(v => v.width === width && v.contrastIssues > 0)) failures.push(`${kind}/${width} 浅灰编号未拒收`);
    const good = await run(`marker-${kind}-good`, review2[`marker-${kind}-good`], true);
    assert.equal(good.passed, true, JSON.stringify(good.issues));
  }
  for (const kind of ['counter', 'attr']) {
    const bad = await run(`${kind}-bad`, review2[`${kind}-bad`]);
    assert.ok(bad.viewports.every(v => v.contrastIssues > 0));
    const good = await run(`${kind}-good`, review2[`${kind}-good`]);
    assert.equal(good.passed, true, JSON.stringify(good.issues));
  }
  assert.deepEqual(failures, []);
});

test('first-line 改变生成文字实际样式而快照不能证明覆盖时明确拒收', async () => {
  const code = review2['first-line-inherit-bad'];
  const bad = await run('first-line-inherit-bad', code, true);
  for (const width of widths) assert.ok(bad.issues.some(i => i.startsWith(`home/${width} `) && /无法测量/.test(i)), JSON.stringify(bad.issues));
  const safe = { ...code, css: code.css.replace(/#probe::first-line\{[^}]*\}/g, '') };
  assert.equal((await run('first-line-no-fragment-safe', safe)).passed, true);
});

test('空宿主 after 的 first-letter 不丢首字母，不能证明自身样式时明确拒收', async () => {
  const failures: string[] = [];
  for (const name of ['after-first-letter-bad', 'after-first-letter-safe-control']) {
    const checks = await run(name, review2[name], true);
    for (const width of widths) if (!checks.issues.some(i => i.startsWith(`home/${width} `) && /生成文字.*无法测量/.test(i))) failures.push(`${name}/${width} 未拒绝不完整分片测量`);
  }
  // 同一段生成文字，移除特殊分片后能完整测量；真实 DOM 首字母的安全对照另有既有用例。
  const safe = review2['after-first-letter-safe-control'];
  assert.equal((await run('after-no-fragment-safe', { ...safe, css: safe.css.replace(/#probe::first-letter\{[^}]*\}/g, '') })).passed, true);
  assert.deepEqual(failures, []);
});

test('空 content 不证明没有绘制层：同宿主与祖先叠层无法核实时不报告错误比值', async () => {
  const failures: string[] = [];
  for (const name of ['empty-after-background-overlay', 'empty-after-background-safe-control']) {
    const code = review2[name];
    for (const ancestor of [false, true]) {
      const variant = ancestor ? { ...code, css: code.css.replaceAll('#probe::after', '.stage::after') } : code;
      const checks = await run(`${name}-${ancestor ? 'ancestor' : 'host'}`, variant, true);
      for (const width of widths) if (!checks.issues.some(i => i.startsWith(`home/${width} `) && /无法测量.*叠层/.test(i))) failures.push(`${name}/${ancestor}/${width} 未说明叠层无法测量`);
      const observations = JSON.parse(await readFile(`${out}/${name}-${ancestor ? 'ancestor' : 'host'}-visitor.json`, 'utf8'));
      for (const state of observations) for (const text of state.scan.textContrast.filter((t: { key: string }) => t.key.endsWith('::before'))) {
        if (text.status !== 'unmeasured' || text.ratio !== null) failures.push(`${name}/${ancestor}/${state.width} 返回了未经证明的比值`);
      }
      // 原始白字/黑字只改变前景；两个都不能凭宿主深底返回可能错误的数值。
    }
  }
  const code = review2['empty-after-background-overlay'];
  const safe = { ...code, css: code.css.replace('background:white}', 'background:transparent}') };
  assert.equal((await run('empty-after-no-paint-safe', safe, true)).passed, true);
  assert.equal((await run('empty-content-good', review2['empty-content-good'])).passed, true);
  assert.equal((await run('attr-empty-good', review2['attr-empty-good'])).passed, true);
  assert.deepEqual(failures, []);
});

test('生成文字在宿主内外均按实际叠底检查：深底灰字和浅底白字拒收，安全颜色通过', async () => {
  const failures: string[] = [];
  for (const name of ['pseudo-bg-low-contrast', 'pseudo-bg-host-covered']) {
    const outside = review1[name];
    const inside = { ...outside, css: outside.css.replace('left:110px', 'left:0') };
    const bad = await run(name, outside, true);
    for (const width of widths) {
      if (!bad.issues.some(issue => issue.startsWith(`home/${width} `) && /对比度|无法/.test(issue))) failures.push(`${name}/${width} 未拒绝实际低对比叠底`);
    }
    const good = await run(`${name}-inside-safe`, inside);
    assert.equal(good.passed, true, JSON.stringify(good.issues));
  }
  const safe = await run('pseudo-bg-safe-control', review1['pseudo-bg-safe-control'], true);
  assert.equal(safe.passed, true, JSON.stringify(safe.issues));
  assert.deepEqual(failures, []);
});

test('非空生成内容缺少快照行明确拒收：content-visibility 不构成第三条排除规则', async () => {
  const missing = await run('pseudo-cv-hidden-host', review1['pseudo-cv-hidden-host'], true);
  for (const width of widths) {
    assert.ok(missing.issues.some(issue => issue.startsWith(`home/${width} `) && /生成文字.*无法测量.*文字行/.test(issue)), JSON.stringify(missing));
    assert.ok(missing.layoutRepairs?.some(repair => repair.generatedPositions?.some(p => p.width === width && p.pseudo === '::before') && repair.reason), '无法测量仍保存位置并拒绝不安全修正');
  }
  for (const name of ['pseudo-cv-visible-control', 'dom-cv-hidden-control']) {
    const bad = await run(name, review1[name]);
    assert.equal(bad.passed, false);
    assert.ok(bad.viewports.every(view => view.contrastIssues > 0));
  }
  const hidden = await run('pseudo-visibility', review1['pseudo-visibility']);
  assert.equal(hidden.passed, true, JSON.stringify(hidden.issues));
  const srOnly = review1['pseudo-cv-hidden-host'];
  const safe = await run('pseudo-complete-sr-only', { ...srOnly, css: srOnly.css + '#probe{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}' });
  assert.equal(safe.passed, true, JSON.stringify(safe.issues));
});

test('真实 DOM 的 first-letter／first-line 不是生成内容：安全正文通过，组合 before 的碰撞仍拒收', async () => {
  const code = review1['pseudo-first-letter-safe'];
  for (const [name, css] of [['pseudo-first-letter-safe', code.css], ['pseudo-first-line-safe', code.css.replace('::first-letter', '::first-line')]]) {
    const safe = await run(name, { ...code, css }, true);
    assert.equal(safe.passed, true, JSON.stringify(safe.issues));
    assert.equal(safe.viewports.length, widths.length);
  }
  const bad = await run('pseudo-before-first-letter', review1['pseudo-before-first-letter']);
  assert.equal(bad.passed, false);
  assert.ok(bad.viewports.every(view => view.contrastIssues > 0) || bad.issues.some(issue => /生成文字.*无法/.test(issue)), JSON.stringify(bad));
  // Chrome 可把生成文字的首字母放在宿主的独立 first-letter 分片中。
  // 只有首字母白字白底、其余文字正常，不能只测其余字符就接受。
  const split = review1['pseudo-before-first-letter'];
  const incomplete = await run('pseudo-first-letter-split', { ...split, css: split.css + '#probe{top:40px}#probe::before{color:#111}#probe::first-letter{color:white}' }, true);
  assert.equal(incomplete.passed, false, '生成首字母不可读，必须测得低对比或明确拒绝不完整测量');
});

test('aria 属性保留：按属性恢复可见的文字与不依赖属性的对照均拒收；正常排版通过', async () => {
  const failures: string[] = [];
  for (const name of ['aria-visibility', 'aria-display', 'aria-control']) {
    const code = inputs[name], bad = await run(name, code, true);
    for (const width of widths) {
      const v = bad.viewports.find(v => v.width === width)!;
      if (!(v.overlaps > 0 && v.contrastIssues > 0)) failures.push(`${name}/${width} 漏检访客可见碰撞或浅灰文字`);
    }
    const good = await run(`${name}-safe`, { ...code, css: code.css + '#probe{top:40px;color:#111}' });
    assert.equal(good.passed, true, JSON.stringify(good.issues));
  }
  assert.deepEqual(failures, []);
});

test('details 默认关闭与展开均扫描：summary 两种隐藏方式不掩盖关闭时碰撞；安全折叠通过', async () => {
  const failures: string[] = [];
  for (const name of ['details-summary-isolated', 'details-summary-visibility']) {
    const code = inputs[name], bad = await run(name, code, true);
    for (const width of widths) {
      const v = bad.viewports.find(v => v.width === width)!;
      if (!(v.overlaps > 0 && v.contrastIssues > 0)) failures.push(`${name}/${width} 漏检关闭时的 summary`);
    }
    const good = await run(`${name}-safe`, { ...code, css: code.css + '#probe{top:20px;color:#111}' });
    assert.equal(good.passed, true, JSON.stringify(good.issues));
  }
  assert.deepEqual(failures, []);
});

test('微小与零盒仍检查文字水平边界：负向和正向越界拒收；同尺寸视口内通过', async () => {
  const failures: string[] = [];
  for (const name of ['overflow-tiny', 'overflow-zero', 'overflow-normal-negative', 'overflow-tiny-positive']) {
    const code = inputs[name], bad = await run(name, code, true);
    for (const width of name.endsWith('positive') ? [375] : widths) {
      if (!bad.issues.includes(`home/${width} 横向溢出`)) failures.push(`${name}/${width} 漏检可见文字越界`);
    }
    const good = await run(`${name}-safe`, { ...code, css: code.css + '#probe{left:0}' });
    assert.equal(good.passed, true, JSON.stringify(good.issues));
  }
  assert.deepEqual(failures, []);
});

test('生成文字自身可见性：正常宿主与隐藏宿主恢复 visible 均测量或明确拒收；安全生成文字通过', async () => {
  const failures: string[] = [];
  for (const name of ['pseudo-visible', 'pseudo-visibility-restored']) {
    const code = inputs[name], bad = await run(name, code, true);
    for (const width of widths) {
      const v = bad.viewports.find(v => v.width === width)!;
      if (!(v.overlaps > 0 && v.contrastIssues > 0) && !bad.issues.some(i => i.includes(`home/${width}`) && /生成文字.*无法/.test(i))) failures.push(`${name}/${width} 生成文字未测量也未明确拒收`);
      if (!bad.layoutRepairs?.some(repair => repair.generatedPositions?.some(position => position.pageId === 'home' && position.width === width && position.pseudo === '::before' && position.path.join('/') === '1/0/1/1') && repair.reason?.includes('无法核实'))) failures.push(`${name}/${width} 未保存 T-173 位置或未明确拒绝不安全修正`);
    }
    const good = await run(`${name}-safe`, { ...code, css: code.css + '#probe{top:40px}#probe::before{color:#111}' });
    assert.equal(good.passed, true, JSON.stringify(good.issues));
  }
  // 相同的已知数值在默认态出现、展开态消失；译文未改它，不能误报新增。
  const rawSource: SiteCode = { header: '', footer: '',
    css: 'body{margin:0;color:#111;background:#fff;font:16px/24px sans-serif}main{padding:20px}summary::before{content:"30 L/min";margin-right:1em}details[open] summary::before{content:none}',
    pages: [{ id: 'home', title: 'Flow', html: '<main><h1>Flow</h1><details><summary>Rate</summary><p>Details content</p></details></main>' }] };
  const normalized = await checkSiteCode({ siteId: 't196', code: rawSource, materials: 'Flow Rate Details content 30 L/min', images: [], legacyImport: true });
  assert.equal(normalized.checks.passed, true, JSON.stringify(normalized.checks.issues));
  const source = normalized.code;
  const same = await run('pseudo-translation-same', source, false, source);
  assert.equal(same.passed, true, JSON.stringify(same.issues));
  const changed = await run('pseudo-translation-changed', { ...source, css: source.css.replace('30 L/min', '30 L/h') }, false, source);
  assert.equal(changed.passed, false, '改变已知单位仍须由 CSS 保真检查拒收');
  assert.match(changed.issues.join('\n'), /CSS.*保真/);
  assert.deepEqual(failures, []);
});
