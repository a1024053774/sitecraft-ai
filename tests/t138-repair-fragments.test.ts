import assert from 'node:assert/strict';
import test from 'node:test';
import { codeRepairFragments, applyCodeRepair } from '../lib/code-site-repair.ts';
import type { SiteCode } from '../lib/code-site.ts';

// Isolated failures: duplicate text selects the wrong occurrence; split copy
// loses offsets; altered or overlapping spans apply; unknown/duplicate IDs and
// a full-site response bypass the patch contract; an unlocated refusal rewrites.
const code: SiteCode = { header: '<header>机械公司</header>', footer: '<footer>终身保修。</footer>', css: 'p{color:#111}\n@media(max-width:768px){main{width:100%}}',
  pages: [{ id: 'home', title: '首页', html: '<main><h1>机械公司</h1><p>精密加工。终身保修。</p><p>终身保修。</p></main>' },
    { id: 'products', title: '产品', html: '<main><h1>产品</h1><p>已有参数。</p></main>' }] };
test('text nodes replace every refused repeated sentence, preserving other content', async () => {
  const fragments = await codeRepairFragments(code, ['页面原句：终身保修。；资料未提供。']);
  assert.equal(fragments.length, 3);
  assert.ok(fragments.every(f => f.before === '终身保修。'));
  const result = await applyCodeRepair(code, fragments, { replacements: fragments.map(f => ({ fragmentId: f.id, after: '' })) });
  assert.equal(result.footer, '<footer></footer>');
  assert.equal(result.pages[0].html, '<main><h1>机械公司</h1><p>精密加工。</p><p></p></main>');
  assert.equal(result.pages[1].html, code.pages[1].html);
  assert.equal(result.css, code.css); assert.equal(code.footer, '<footer>终身保修。</footer>');
});
test('malformed, unknown, duplicate, stale and overlapping patches refuse visibly', async () => {
  const fragments = await codeRepairFragments(code, ['终身保修。']);
  await assert.rejects(applyCodeRepair(code, fragments, code), /有效的局部修正/);
  await assert.rejects(applyCodeRepair(code, fragments, { replacements: [] }), /有效的局部修正/);
  await assert.rejects(applyCodeRepair(code, fragments, { replacements: [{ fragmentId: 999, after: '' }] }), /未知或重复/);
  await assert.rejects(applyCodeRepair(code, fragments, { replacements: [{ fragmentId: 0, after: '' }, { fragmentId: 0, after: '' }] }), /未知或重复/);
  await assert.rejects(applyCodeRepair({ ...code, footer: '<footer>已变化</footer>' }, fragments, { replacements: [{ fragmentId: 0, after: '' }] }), /节点已经变化/);
  await assert.rejects(applyCodeRepair(code, [...fragments, { ...fragments[0], id: 10 }], { replacements: [{ fragmentId: 0, after: '' }, { fragmentId: 10, after: '' }] }), /范围重叠/);
  await assert.rejects(codeRepairFragments(code, ['没有任何代码可对应的拒因']), /无法定位/);
});
test('layout context contains shared CSS and affected markup, without unrelated page copy', async () => {
  const fragments = await codeRepairFragments(code, ['home/375 横向溢出']);
  assert.ok(fragments.some(f => f.field === 'css'));
  assert.ok(fragments.some(f => f.field === 'pages/home/html'));
  assert.ok(fragments.every(f => f.field !== 'pages/products/html'));
});
test('a known already-cleaned refusal permits a no-change candidate, without masking an unlocated issue', async () => {
  const issue = '已去掉禁止元素 script';
  const fragments = await codeRepairFragments(code, [issue], [issue]);
  assert.deepEqual(fragments, []);
  assert.deepEqual(await applyCodeRepair(code, fragments, { replacements: [] }), code);
  await assert.rejects(codeRepairFragments(code, [issue, '另一个无法定位的问题'], [issue]), /无法定位/);
  await assert.rejects(codeRepairFragments(code, ['系统图标编号无效'], ['系统图标编号无效']), /无法定位/, 'a cleanup diagnostic is not proof that its cause was removed');
});
test('partly overlapping character intervals in one text node are rejected', async () => {
  const fragments = await codeRepairFragments(code, ['终身保修。']);
  const first = fragments[0]; assert.equal(first.kind, 'text');
  if (first.kind !== 'text') throw new Error('the test requires a real text fragment');
  const overlap = { ...first, id: 99, offset: first.offset + 1, before: first.before.slice(1) };
  await assert.rejects(applyCodeRepair(code, [...fragments, overlap], { replacements: [{ fragmentId: first.id, after: '待补充。' }, { fragmentId: overlap.id, after: '' }] }), /范围重叠|区间重叠/);
});
