import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { simulatedPackList } from '../lib/simulated-packs.ts';

test('simulated inputs describe products without sales goals or mandatory contact pages', () => {
  for (const pack of simulatedPackList) {
    assert.doesNotMatch(pack.goal + pack.heroCta + pack.heroSubtitle, /询盘|询价|报价|索取|咨询/);
    assert.doesNotMatch(pack.body, /^目标：|主按钮：|^询盘要求：/m);
    const pages = pack.body.split('\n').filter(line => /^页面(?:要求)?：/.test(line)).join('');
    assert.doesNotMatch(pages + pack.extraPagesNote, /联系|询盘|资料索取|资料下载/);
    assert.ok(pack.body.includes(pack.email), 'existing contact facts are preserved');
    assert.match(pack.email, /\.luckye\.online$/);
    assert.match(pack.body, /规格参数|质检流程/);
  }
});

test('full and quick evaluation materials do not request inquiry or contact pages', async () => {
  const out = path.resolve('artifacts/t142', `inputs-${crypto.randomUUID()}`);
  await mkdir(path.join(out, 'previous/private'), { recursive: true });
  await writeFile(path.join(out, 'previous/private/round.json'), JSON.stringify({ cases: [], controls: [] }));
  for (const quick of [false, true]) {
    const directory = path.join(out, quick ? 'quick' : 'full');
    const command = ['--experimental-strip-types', 'scripts/eval-new-route.ts', '--prepare-only', '--previous', path.join(out, 'previous'), '--out', directory, ...(quick ? ['--quick'] : [])];
    const result = spawnSync(process.execPath, command, { encoding: 'utf8', env: { ...process.env, CHROME_PATH: '' } });
    await writeFile(path.join(out, `command-${quick}.json`), JSON.stringify({ command, status: result.status, stdout: result.stdout, stderr: result.stderr }, null, 2));
    assert.equal(result.status, 1, 'incompatible previous corpus stops before models and controls');
    const round = JSON.parse(await readFile(path.join(directory, 'private/round.json'), 'utf8'));
    assert.equal(round.cases.length, quick ? 4 : 8);
    for (const item of round.cases) {
      const requested = item.materials.split('\n').find((line: string) => line.startsWith('页面要求：'));
      assert.doesNotMatch(requested, /联系|询盘|报价|资料索取/);
      assert.doesNotMatch(item.materials, /^目标：|主按钮：|^询盘要求：/m);
      assert.equal(item.outcome, 'not-run'); assert.deepEqual(item.modelCalls, []);
    }
  }
});

test('all skeleton sequences and both styles keep inquiry optional, and the empty workspace asks for existing material', async () => {
  const cards = await readFile('skills/site-code-core/SKELETONS.md', 'utf8');
  for (const line of cards.split('\n').filter(line => line.startsWith('序列：'))) {
    assert.doesNotMatch(line, /→ 联系|→ 询盘|→ 合并联系|→ 真实联系方式|→ 带工况提示的询盘/);
  }
  for (const file of ['skills/site-code-core/SKILL.md', 'skills/site-code-precision/SKILL.md', 'skills/site-code-documentary/SKILL.md']) {
    const text = await readFile(file, 'utf8');
    assert.match(text, /只在用户资料或要求中明确(?:提出|提供)[\s\S]{0,90}才做/);
    assert.doesNotMatch(text, /无法确定时首页、产品、联系/);
  }
  const workspace = await readFile('components/code-workspace.tsx', 'utf8');
  assert.doesNotMatch(workspace, /提供产品规格、加工能力和联系方式|请先保留公司、产品参数、能力和联系方式/);
});
