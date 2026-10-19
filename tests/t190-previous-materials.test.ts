import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { compareRounds, type EvalCase, type EvalRound } from '../scripts/eval-set-report.ts';

// 失效方式：开关未接入 CLI；资料豁免连带放过其他条件；按数组位置配对；
// 旧快照中已有的滑杆被忽略；把缺失版本当作一致；仅在内存记下资料变化。
// 比较门禁本身是纯逻辑；CLI 用本地 health 拒绝在任何生成或外部截图之前停止。
type RecordedCase = EvalCase & {
  preferences?: { style: string; layout: number; density: number };
  pageRequest?: string;
  styleRegistration?: { skill: string; previewRevision: number | null; previewVersionId: string | null };
};
type RecordedRound = EvalRound & { previousMaterialsChanged?: boolean; cases: RecordedCase[] };
const pageRequest = '页面要求：首页、产品两个独立页面。只做中文。';
function item(pack: string, style: string): RecordedCase {
  return { key: `${pack}/${style}`, pack, style, materials: `公司资料\n${pageRequest}`, outcome: 'not-run', elapsedMs: 0,
    attempts: [], modelCalls: [], pages: [], preferences: { style, layout: 5, density: 6 }, pageRequest,
    styleRegistration: { skill: `site-code-${style}/SKILL.md`, previewRevision: 1, previewVersionId: 'registered-v1' } };
}
function round(): RecordedRound {
  return { schemaVersion: 1, profile: 'full', cases: [item('industrial', 'precision'), item('export', 'documentary')],
    startedAt: '2026-10-19T00:00:00Z', command: 'local-fixture', commit: 'fixture', dirty: false,
    base: 'fixture', status: 'INCOMPLETE', controls: [], errors: [] };
}
function compare(current: RecordedRound, previous: RecordedRound) {
  return Reflect.apply(compareRounds, undefined, [current, previous, { currentSource: '/current/private/round.json', previousSource: '/previous/private/round.json' }]) as any[];
}
test('默认仍拒收不同资料；显式开关只允许资料变化并按 key 记录双方来源和长度', () => {
  const previous = round(), current = round();
  current.cases[0].materials = `新增企业资料\n${pageRequest}`;
  assert.throws(() => compare(current, previous), /资料或组合已变化/);
  current.previousMaterialsChanged = true;
  previous.cases.reverse();
  const pairs = compare(current, previous);
  assert.deepEqual(pairs.map(p => [p.key, p.materialsChanged]), [['industrial/precision', true], ['export/documentary', false]]);
  assert.deepEqual(pairs[0].currentMaterials, { length: `新增企业资料\n${pageRequest}`.length, source: '/current/private/round.json#/cases/0/materials' });
  assert.deepEqual(pairs[0].previousMaterials, { length: `公司资料\n${pageRequest}`.length, source: '/previous/private/round.json#/cases/1/materials' });
  assert.deepEqual(pairs[0].unverifiedFields, []);
});

const mutations: Array<[string, (r: RecordedRound) => void, RegExp]> = [
  ['profile', r => { r.profile = 'quick'; }, /profile/],
  ['style', r => { r.cases[0].style = 'editorial'; }, /style/],
  ['preferences.style', r => { r.cases[0].preferences!.style = 'editorial'; }, /style/],
  ['layout', r => { r.cases[0].preferences!.layout = 8; }, /layout/],
  ['density', r => { r.cases[0].preferences!.density = 2; }, /density/],
  ['页面要求', r => { r.cases[0].pageRequest = '页面要求：只生成首页。'; r.cases[0].materials = '公司资料\n页面要求：只生成首页。'; }, /pageRequest/],
  ['风格登记 revision', r => { r.cases[0].styleRegistration!.previewRevision = 2; }, /styleRegistration/],
  ['风格登记 versionId', r => { r.cases[0].styleRegistration!.previewVersionId = 'registered-v2'; }, /styleRegistration/],
  ['风格 skill', r => { r.cases[0].styleRegistration!.skill = 'other/SKILL.md'; }, /styleRegistration/],
  ['缺少组合', r => { r.cases.pop(); }, /组合/],
  ['新增组合', r => { r.cases.push(item('molding', 'precision')); }, /组合/],
  ['替换组合', r => { r.cases[1] = item('export', 'editorial'); }, /组合/],
  ['重复组合', r => { r.cases[1] = structuredClone(r.cases[0]); }, /组合/],
  ['pack 与 key 不符', r => { r.cases[0].pack = 'molding'; }, /pack/],
];
for (const [name, mutate, reason] of mutations) test(`开关不放宽 ${name}（两侧分别变更）`, () => {
  for (const changedSide of ['current', 'previous']) {
    const current = round(), previous = round(); current.previousMaterialsChanged = true;
    mutate(changedSide === 'current' ? current : previous);
    assert.throws(() => compare(current, previous), reason);
    current.cases[0].materials = `额外企业资料\n${current.cases[0].pageRequest}`;
    assert.throws(() => compare(current, previous), reason);
  }
});

test('旧记录缺失的条件逐项列明，已保存的页面要求仍校验', () => {
  const current = round(), previous = round(); current.previousMaterialsChanged = true;
  for (const c of previous.cases) { delete c.preferences; delete c.pageRequest; delete c.styleRegistration; }
  const pairs = compare(current, previous);
  assert.deepEqual(pairs[0].unverifiedFields, ['previous.layout', 'previous.density', 'previous.styleRegistration']);
  previous.cases[0].materials = '公司资料\n页面要求：只生成首页。';
  assert.throws(() => compare(current, previous), /pageRequest/);
  const partial = round(); delete partial.profile;
  partial.cases[0].styleRegistration!.previewVersionId = null;
  assert.deepEqual(compare(current, partial)[0].unverifiedFields, ['previous.profile', 'previous.styleRegistration.previewVersionId']);
});

test('真实 CLI 保存逐组合资料变化，旧私有快照的滑杆变更仍在 health 前拒收', async () => {
  const root = path.resolve('artifacts/t190', `previous-materials-${crypto.randomUUID()}`);
  const before = path.join(root, 'previous'); await mkdir(path.join(before, 'private'), { recursive: true });
  let healthCalls = 0, otherCalls = 0;
  const server = createServer((request, response) => {
    if (request.url === '/api/health') healthCalls++; else otherCalls++;
    response.writeHead(503, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ userMessage: '本地夹具在生成前停止，无模型或外部截图调用。' }));
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  async function cli(label: string, changed: boolean) {
    const out = path.join(root, label);
    const command = ['--experimental-strip-types', 'scripts/eval-new-route.ts', '--base', base, '--previous', before,
      '--only', 'industrial/precision,export/documentary', '--out', out, ...(changed ? ['--previous-materials-changed'] : [])];
    const child = spawn(process.execPath, command, { env: { ...process.env, CHROME_PATH: '' }, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = ''; child.stdout.on('data', data => { output += data; }); child.stderr.on('data', data => { output += data; });
    const code = await new Promise<number | null>((resolve, reject) => { child.once('error', reject); child.once('close', resolve); });
    await writeFile(path.join(root, `${label}-command.json`), JSON.stringify({ command, code, output }, null, 2));
    assert.equal(code, 1, '夹具未生成站点，评估不能报 PASS');
    const resultFile = path.join(out, 'private/round.json');
    const result = JSON.parse(await readFile(resultFile, 'utf8').catch(() => assert.fail(`CLI 必须接受开关并保存结果：${output}`)));
    return { out, result };
  }
  try {
    await writeFile(path.join(before, 'private/round.json'), JSON.stringify({ ...round(), cases: [] }));
    const { result: seed } = await cli('seed', false);
    assert.equal(healthCalls, 0);
    for (let i = 0; i < seed.cases.length; i++) {
      const c = seed.cases[i];
      c.materials = `此前的企业资料-${i}\n${c.materials.split('\n').at(-1)}`;
      delete c.preferences; delete c.styleRegistration; delete c.pageRequest;
      c.siteId = `prior-site-${i}`;
      const folder = path.join(before, 'private', `case-${i + 1}`); await mkdir(folder, { recursive: true });
      await writeFile(path.join(folder, 'code-site.json'), JSON.stringify({ siteId: c.siteId, preferences: { style: c.style, layout: 5, density: 6 } }));
    }
    await writeFile(path.join(before, 'private/round.json'), JSON.stringify(seed));
    const strict = await cli('strict', false);
    assert.ok(strict.result.errors.some((s: string) => s.includes('资料或组合已变化'))); assert.equal(healthCalls, 0);
    const accepted = await cli('accepted', true);
    assert.equal(healthCalls, 1, '只有比较门禁通过后才能访问 health'); assert.equal(otherCalls, 0);
    assert.equal(accepted.result.previousMaterialsChanged, true);
    const comparison = JSON.parse(await readFile(path.join(accepted.out, 'private/comparison.json'), 'utf8'));
    assert.deepEqual(accepted.result.comparison, comparison);
    assert.deepEqual(comparison.map((p: any) => [p.key, p.materialsChanged]), [['industrial/precision', true], ['export/documentary', true]]);
    for (let i = 0; i < comparison.length; i++) {
      const p = comparison[i];
      assert.deepEqual(p.previousMaterials, { length: seed.cases[i].materials.length, source: `${before}/private/round.json#/cases/${i}/materials` });
      assert.deepEqual(p.currentMaterials, { length: accepted.result.cases[i].materials.length, source: `${accepted.out}/private/round.json#/cases/${i}/materials` });
      assert.deepEqual(p.unverifiedFields, ['previous.styleRegistration']);
    }
    const snapshot = path.join(before, 'private/case-1/code-site.json');
    await writeFile(snapshot, JSON.stringify({ siteId: 'prior-site-0', preferences: { style: 'precision', layout: 8, density: 6 } }));
    const refused = await cli('slider-refused', true);
    assert.ok(refused.result.errors.some((s: string) => s.includes('layout')));
    assert.equal(healthCalls, 1, '旧快照已知的不同滑杆必须在请求前拒收'); assert.equal(otherCalls, 0);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});
