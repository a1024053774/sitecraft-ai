import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

// CLI failure modes: only accepts the default style; changes materials for a
// style comparison; summary omits the requested style; permits unknown styles.
test('同一非工业资料可通过真实评估 CLI 选择邻里日常与品牌画册，默认矩阵不变', async () => {
  const folder = path.resolve('artifacts/t159', `cli-contract-${crypto.randomUUID()}`);
  const before = path.join(folder, 'before');
  await mkdir(path.join(before, 'private'), { recursive: true });
  await writeFile(path.join(before, 'private/round.json'), JSON.stringify({ cases: [] }), 'utf8');
  const run = async (style: string) => {
    const out = path.join(folder, style);
    const args = ['--experimental-strip-types', 'scripts/eval-new-route.ts', '--quick', '--only', `restaurant/${style}`, '--prepare-only', '--previous', before, '--out', out];
    const result = spawnSync(process.execPath, args, { encoding: 'utf8', env: { ...process.env, SITECRAFT_DATA_ROOT: path.join(process.env.SITECRAFT_DATA_ROOT!, path.basename(folder), style) } });
    await writeFile(path.join(folder, `${style}.json`), JSON.stringify({ args, status: result.status, stdout: result.stdout, stderr: result.stderr }, null, 2), 'utf8');
    assert.doesNotMatch(result.stderr, /only必须/, '已登记风格应进入组合构造；本测试在不匹配的旧轮次前停下，不调用模型或浏览器');
    const round = JSON.parse(await readFile(path.join(out, 'private/round.json'), 'utf8'));
    assert.equal(result.status, 1);
    assert.ok(round.errors.some((error: string) => error.includes('资料或组合已变化')));
    assert.deepEqual(round.cases.map((c: any) => c.key), [`restaurant/${style}`]);
    assert.ok(round.cases[0].materials.includes('首页（home）、菜单（menu）两个独立页面'));
    const summary = JSON.parse(await readFile(path.join(out, 'private/summary.json'), 'utf8'));
    assert.deepEqual(summary.styles.map((s: any) => s.style), [style]);
    return round.cases[0].materials;
  };
  assert.equal(await run('editorial'), await run('neighborly'), '成对比较必须使用完全相同的资料');
});
