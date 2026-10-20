import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { checkSiteCode } from '../lib/code-site-check.ts';
import type { SiteCode } from '../lib/code-site.ts';

// Frozen review2 inputs. Expectations come from the visitor screenshots and the
// controller's 2026-10-20 policy, not the probe's measured counts.
const fixtures: Record<string, SiteCode> = JSON.parse(await readFile(new URL('./fixtures/t198-review2-overflow.json', import.meta.url), 'utf8'));
const out = `artifacts/t198/review2/contract-${Date.now()}-${process.pid}`;
await mkdir(out, { recursive: true });
const run = async (id: string, code = fixtures[id]) => {
  const result = await checkSiteCode({ siteId: 't198-review2', code, materials: '独立审查样本。采购前请确认材料适用范围', images: [], legacyImport: true });
  await writeFile(`${out}/${id}.json`, JSON.stringify(result, null, 2));
  return result.checks;
};
const assertFloor = (checks: Awaited<ReturnType<typeof run>>, expected: number, unknownReason?: string) => {
  for (const width of [375, 768, 1440]) {
    const failures = checks.layoutRepairs?.filter(r => r.issue.startsWith(`home/${width} `) && r.issue.includes('极端窄列')) ?? [];
    assert.equal(failures.length, expected, `${width} 极端窄列`);
    const details = checks.viewports.find(v => v.width === width)!.qualityFeedback!.details.filter(d => d.kind === 'narrowColumns');
    if (unknownReason) assert.ok(details.some(d => d.detail.includes('可见行无法确定') && d.detail.includes(unknownReason)), `${width} 须注明 ${unknownReason}`);
    else assert.ok(details.every(d => !d.detail.includes('可见行无法确定')), `${width} 不应退出确定测量`);
  }
};

for (const [id, reason] of [
  ['absolute-two-visible', '定位逃逸'], ['fixed-two-visible', '定位逃逸'], ['clip-margin-two-visible', 'clip-margin'],
] as const) test(`三档 review2 A：${id} 访客每行正好两字，不拒收`, async () => {
  const checks = await run(id);
  assertFloor(checks, 0, reason);
  assert.equal(checks.passed, true);
});

test('三档统计以文字块计数，同块同原因去重；短正文不冒充八字资格', async () => {
  const base = fixtures['plain-12'];
  const code = { ...base, css: base.css + '.clip{clip-path:inset(0)}#target{clip-path:inset(0)}',
    pages: [{ ...base.pages[0], html: '<main><h1>统计样本</h1><div class="clip"><p id="target">采购前请确认材料适用范围</p><p>短标签</p></div><p>采购前请确认材料适用范围</p></main>' }] };
  const checks = await run('visibility-statistics', code);
  for (const viewport of checks.viewports) {
    assert.deepEqual(Reflect.get(viewport.qualityFeedback!, 'narrowColumnVisibility'), {
      testedBlocks: 3, uncertainBlocks: 2, reasons: { 'clip-path': 2 },
      eligibleBlocks: 2, uncertainEligibleBlocks: 1, eligibleReasons: { 'clip-path': 1 },
    });
  }
});

for (const [id, control, reason] of [
  ['absolute-escape', 'absolute-one-no-clip', '定位逃逸'],
  ['fixed-escape', 'fixed-one-no-clip', '定位逃逸'],
  ['clip-margin', 'clip-margin-no-clip', 'clip-margin'],
] as const) test(`三档 review2 B：${id} 保守退出；去掉 overflow 仍拒收`, async () => {
  assertFloor(await run(id), 0, reason);
  assertFloor(await run(control), 1);
});

for (const [id, control] of [['inline-overflow', 'inline-no-clip'], ['body-propagation', 'body-no-clip']] as const)
  test(`三档 ${id} 无效局部裁剪应跳过，完整十二行仍拒收`, async () => {
    assertFloor(await run(id), 1);
    assertFloor(await run(control), 1);
  });

test('三档 inline-block 真裁剪只见两行；完整正文对照仍拒收', async () => {
  assertFloor(await run('overflow-inline-block-two'), 0);
  assertFloor(await run('plain-12'), 1);
});

test('三档 absolute-contained-two 可见两行不拒收，按统一定位链规则保守退出', async () => {
  assertFloor(await run('absolute-contained-two'), 0, '定位逃逸');
});

test('三档 sticky 与 overflow 同链时注明定位逃逸；去掉定位仍拒收', async () => {
  assertFloor(await run('sticky-eight'), 0, '定位逃逸');
  const code = { ...fixtures['sticky-eight'], css: fixtures['sticky-eight'].css.replace('position:sticky;', '') };
  assertFloor(await run('sticky-eight-control', code), 1);
});

for (const [id, declaration] of [['html-overflow', 'html{height:64px;overflow:hidden}'], ['contents-overflow', '.clip{display:contents;overflow:hidden}']] as const)
  test(`三档 ${id} 跳过局部 overflow 后完整正文仍拒收`, async () => {
    assertFloor(await run(id, { ...fixtures['plain-12'], css: fixtures['plain-12'].css + declaration }), 1);
  });

test.after(() => console.log(`T-198 review2 证据：${out}`));
