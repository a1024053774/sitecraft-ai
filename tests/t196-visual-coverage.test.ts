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
const review3: Record<string, SiteCode> = JSON.parse(await readFile(new URL('./fixtures/t196-review3-overlay-inputs.json', import.meta.url), 'utf8'));
const review4: Record<string, SiteCode> = JSON.parse(await readFile(new URL('./fixtures/t196-review4-inputs.json', import.meta.url), 'utf8'));
const review5: Record<string, SiteCode> = JSON.parse(await readFile(new URL('./fixtures/t196-review5-overlay-inputs.json', import.meta.url), 'utf8'));
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

async function contrastState(name: string, code: SiteCode, pseudo: string, status: 'measured' | 'unmeasured') {
  const checks = await run(name, code, true);
  const observations = JSON.parse(await readFile(`${out}/${name}-visitor.json`, 'utf8'));
  assert.deepEqual(checks.viewports.map(view => view.width), widths);
  for (const width of widths) {
    const state = observations.find((item: { width: number }) => item.width === width);
    const entries = state.scan.textContrast.filter((item: { key: string; element: string }) => pseudo ? item.key.endsWith(pseudo) : item.element === 'probe');
    assert.ok(entries.length > 0, `${name}/${width} 必须保留实际文字`);
    for (const entry of entries) {
      assert.equal(entry.status, status, `${name}/${width}: ${JSON.stringify(entry)}`);
      if (status === 'unmeasured') {
        assert.equal(entry.ratio, null);
        assert.match(entry.reason, /伪元素叠层无法核对实际底图/);
      } else assert.equal(typeof entry.ratio, 'number');
    }
    if (status === 'unmeasured') assert.ok(checks.issues.some(issue => issue.startsWith(`home/${width} `) && /伪元素叠层无法核对实际底图/.test(issue)), JSON.stringify(checks.issues));
  }
  assert.equal(checks.passed, status === 'measured', JSON.stringify(checks.issues));
}

test('review5 兄弟节点空 after 覆盖生成文字须拒收，无绘制层仍测量', async () => {
  // 独立访客截图：白色 after 完全遮住文字；只改为透明后文字恢复。
  await contrastState('sibling-pseudo-no-paint', review5['sibling-pseudo-no-paint'], '::before', 'measured');
  await contrastState('sibling-pseudo-overlay', review5['sibling-pseudo-overlay'], '::before', 'unmeasured');
});

test('review5 非祖先节点的 before 超出宿主盒覆盖文字也须拒收，透明对照通过', async () => {
  const source = review5['sibling-pseudo-overlay'];
  // 宿主放在文字右侧，before 向左溢出；再隔一层，不能只扫兄弟宿主盒。
  const code = { ...source, pages: source.pages.map(page => ({ ...page, html: page.html.replace('<div class="cover"></div>', '<div><div class="cover"></div></div>') })),
    css: source.css.replace('.cover{position:absolute;left:0;top:0;width:280px;', '.cover{position:absolute;left:250px;top:0;width:20px;').replace('.cover::after{content:"";position:absolute;inset:0;', '.cover::before{content:"";position:absolute;left:-250px;top:0;width:280px;height:80px;') };
  await contrastState('cousin-pseudo-overflow-no-paint', { ...code, css: code.css.replace('background:white;z-index:2', 'background:transparent;z-index:2') }, '::before', 'measured');
  await contrastState('cousin-pseudo-overflow-overlay', code, '::before', 'unmeasured');
});

test('review5 独立 after 绘制层与文字不相交时仍测量', async () => {
  const source = review5['sibling-pseudo-overlay'];
  // 宿主盒仍覆盖文字，实际 after 移到下方；按实际伪元素盒核对相交。
  const code = { ...source, css: source.css.replace('inset:0;background:white', 'left:0;top:90px;width:280px;height:20px;background:white') };
  await contrastState('sibling-pseudo-disjoint-safe', code, '::before', 'measured');
});

for (const position of ['inside', 'outside']) {
  test(`review4 首行背景：${position} 编号拒收，无首行背景测量`, async () => {
    const name = `marker-${position}-firstline-bg`, code = review4[name];
    const safe = { ...code, css: code.css.replace('color:white;background:#111', 'color:#111') };
    await contrastState(`${name}-no-firstline-background-safe`, safe, '::marker', 'measured');
    await contrastState(name, code, '::marker', 'unmeasured');
  });
}
test('review4 祖先首行背景的反向误拒不再返回错误比值', async () => {
  // 访客看得清的反向输入也不能继续报告按错误深底得出的 1.053。
  await contrastState('marker-ancestor-firstline-near-dark', review4['marker-ancestor-firstline-near-dark'], '::marker', 'unmeasured');
});

for (const name of ['negative-generated-host-white', 'negative-generated-host-transparent-control']) {
  test(`review4 负层文字：${name} 拒收，仅去掉 z-index 后测量`, async () => {
    const code = review4[name], safe = { ...code, css: code.css.replace('z-index:-1', 'z-index:auto') };
    await contrastState(`${name}-auto-safe`, safe, '::before', 'measured');
    await contrastState(name, code, '::before', 'unmeasured');
  });
}

for (const [name, rule] of [
  ['host-z-index-zero', '#probe{z-index:0}'],
  ['pseudo-z-index-zero', '#probe::before{z-index:0}'],
  ['pseudo-z-index-positive', '#probe::before{z-index:1}'],
]) test(`收口 a：${name} 拒收，auto 测量`, async () => {
  const source = review4['negative-generated-host-white'];
  const safe = { ...source, css: source.css.replace('z-index:-1', 'z-index:auto') };
  await contrastState(`${name}-auto-safe`, safe, '::before', 'measured');
  await contrastState(name, { ...safe, css: safe.css + rule }, '::before', 'unmeasured');
});

for (const fragment of ['first-line', 'first-letter']) for (const selector of ['#probe', '.stage']) {
  test(`收口 b：${selector}::${fragment} 背景拒收，无背景测量`, async () => {
    const source = review3['marker-first-line-safe'];
    const name = `fragment-${fragment}-${selector === '#probe' ? 'host' : 'ancestor'}`;
    const rule = `${selector}::${fragment}{background:white}`;
    await contrastState(`${name}-no-background-safe`, { ...source, css: source.css + rule.replace('background:white', 'background:transparent') }, '::marker', 'measured');
    await contrastState(name, { ...source, css: source.css + rule }, '::marker', 'unmeasured');
  });
}

test('收口 c：inside 编号的宿主有背景即拒收，无背景或 outside 测量', async () => {
  const source = review3['marker-first-line-safe'];
  await contrastState('marker-inside-no-host-background-safe', source, '::marker', 'measured');
  const painted = { ...source, css: source.css + '#probe{background:white}' };
  await contrastState('marker-outside-host-background-safe', { ...painted, css: painted.css.replace('list-style-position:inside', 'list-style-position:outside') }, '::marker', 'measured');
  await contrastState('marker-inside-host-background', painted, '::marker', 'unmeasured');
});

for (const fragment of ['first-letter', 'first-line']) for (const condition of ['host-z-index', 'background']) {
  test(`真实文字 ::${fragment} 同样拒收 ${condition}，简单正文测量`, async () => {
    const source = review1['pseudo-first-letter-safe'];
    const safe = { ...source, css: source.css.replace('::first-letter', `::${fragment}`) };
    const name = `dom-${fragment}-${condition}`;
    await contrastState(`${name}-simple-safe`, safe, '', 'measured');
    const rule = condition === 'host-z-index' ? '#probe{z-index:0}' : `#probe::${fragment}{background:white}`;
    await contrastState(name, { ...safe, css: safe.css + rule }, '', 'unmeasured');
  });
}

for (const name of ['overlay-fully-opaque-same-as-host-above', 'overlay-semi-transparent-65-same-as-host-above', 'overlay-partial-65-same-as-host-above']) {
  test(`同底色覆盖层仍遮挡生成文字：${name} 三档拒收，无绘制层对照通过`, async () => {
    // 独立复审的访客截图：全白层使文字消失，65% 白层使文字变浅，55% 宽层只遮前半段。
    // 不能只算白层对白底不变；保守合同要求无法核实叠层时拒收，不报告未经证明的比值。
    const code = review3[name];
    const bad = await run(name, code, true);
    const safe = { ...code, css: code.css.replace(/background:(white|rgba\(255,255,255,\.65\));z-index:2/, 'background:transparent;z-index:2').replace('z-index:1', 'z-index:auto') };
    const good = await run(`${name}-no-paint-safe`, safe, true);
    assert.equal(good.passed, true, JSON.stringify(good.issues));
    const observations = JSON.parse(await readFile(`${out}/${name}-visitor.json`, 'utf8'));
    for (const width of widths) {
      assert.ok(bad.issues.some(issue => issue.startsWith(`home/${width} `) && issue.includes('伪元素叠层无法核对实际底图')), JSON.stringify(bad.issues));
      const generated = observations.find((state: { width: number }) => state.width === width).scan.textContrast.filter((item: { key: string }) => item.key.endsWith('::before'));
      assert.ok(generated.length > 0, '真实绘制的生成文字不能被删掉');
      for (const item of generated) {
        assert.equal(item.status, 'unmeasured');
        assert.equal(item.ratio, null, '未核实覆盖层不能返回宿主底色的比值');
      }
    }
  });
}

test('marker 颜色不随 first-line 改变：浅灰编号拒收，深色编号通过', async () => {
  // 独立复审三档原样绘制确认 marker 不受 first-line 的颜色影响。
  const bad = await run('marker-first-line-low', review3['marker-first-line-low'], true);
  assert.ok(bad.viewports.every(view => view.contrastIssues > 0));
  assert.equal(bad.passed, false);
  const good = await run('marker-first-line-safe', review3['marker-first-line-safe'], true);
  assert.equal(good.passed, true, JSON.stringify(good.issues));
  assert.equal(good.viewports.length, widths.length);
});

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
  const safe = { ...code, css: code.css.replace('background:white}', 'background:transparent}').replace('z-index:1', 'z-index:auto') };
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
