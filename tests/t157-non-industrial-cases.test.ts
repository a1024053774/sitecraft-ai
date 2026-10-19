import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { simulatedPackList, buildMaterialsChatMessage } from '../lib/simulated-packs.ts';
import { requireWholeSitePlan, type EvalRound } from '../scripts/eval-set-report.ts';

// Acceptance inputs: three distinct non-industrial businesses, individually
// licensed thematic images, no dynamic functions, complete input at the CLI.
const expected = [
  { id: 'restaurant', industry: /餐饮/, page: 'menu', title: '菜单' },
  { id: 'education', industry: /培训/, page: 'courses', title: '课程' },
  { id: 'design', industry: /设计/, page: 'work', title: '作品' },
];

test('three non-industrial packs retain substantial simulated material and explicit gaps', async () => {
  for (const item of expected) {
    const pack = simulatedPackList.find(pack => pack.id === item.id);
    assert.ok(pack, `${item.id} must be available at the workspace material entry`);
    assert.match(pack.industry, item.industry);
    assert.match(pack.label, /模拟/);
    assert.match(pack.body, /^资料性质：模拟/);
    assert.ok(pack.body.length >= 1800, 'material must include more than a short business card');
    assert.ok(pack.missingFacts.length >= 4);
    for (const heading of ['沿革', '地址与开放时间', '资质状态', '图片使用']) {
      assert.match(pack.body, new RegExp(`^${heading}：.+`, 'm'));
    }
    assert.match(pack.body, /堂食单份含税价|学费.*元\/期|按项目范围.*逐项核算/, '收费事实保留，不强求统一字段名');
    assert.ok(pack.body.split('\n').filter(line => /^问：.+答：.+/.test(line)).length >= 4);
    assert.doesNotMatch(pack.body, /询盘|预约|在线报名|客户Logo|好评率/);
    const wrapped = buildMaterialsChatMessage(pack);
    assert.ok(wrapped.endsWith(pack.body));
    assert.doesNotMatch(wrapped, /\[truncated\]/);
    const manifest = JSON.parse(await readFile(`fixtures/simulated-packs/${item.id}/manifest.json`, 'utf8'));
    for (const image of manifest.images) {
      assert.ok(image.sourceUrl && image.licenseUrl && image.author && image.attribution);
      assert.match(image.limitations, /配图/);
    }
    if (!manifest.images.length) assert.match(manifest.reason, /无图|未准入/);
  }
});

test('local provider propagates unseen company and tail facts through its HTTP entry point', async () => {
  assert.ok(process.env.SITECRAFT_BASE, 'Set SITECRAFT_BASE to this worktree server');
  const portProbe = createServer();
  await new Promise<void>(resolve => portProbe.listen(0, '127.0.0.1', resolve));
  const endpoint = `http://127.0.0.1:${(portProbe.address() as { port: number }).port}`;
  await new Promise<void>(resolve => portProbe.close(() => resolve()));
  const parent = path.resolve('artifacts/t157', `provider-contract-${crypto.randomUUID()}`);
  await mkdir(parent, { recursive: true });
  const args = ['--experimental-strip-types', 'scripts/t157-model-fixture.ts', '--out', path.join(parent, 'provider')];
  const child = spawn(process.execPath, args, { env: { ...process.env, SITECRAFT_FIXTURE_BASE: endpoint }, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Local provider did not start')), 15000);
      child.stdout.on('data', data => { output += data; if (output.includes('Local fixture:')) { clearTimeout(timeout); resolve(); } });
      child.stderr.on('data', data => { output += data; });
      child.on('error', error => { clearTimeout(timeout); reject(error); });
      child.on('exit', code => { clearTimeout(timeout); reject(new Error(`Local provider exited: ${code}`)); });
    });
    const receipts: unknown[] = [];
    for (const [name, title, pageId] of [['杏里小馆', '菜单', 'menu'], ['柳岸画室', '课程', 'courses'], ['青石精密', '产品', 'products']]) {
      const sentinel = `尾部-${crypto.randomUUID()}<保留边界>`;
      const material = `资料性质：模拟。\n公司名：${name}\n公司简介：按资料展示业务。\n沿革：只陈述已有资料。\n尾部事实：${sentinel}\n页面要求：只生成首页（home）、${title}（${pageId}）两个独立页面。`;
      const request = async (body: unknown) => {
        const response = await fetch(endpoint + '/chat/completions', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
        assert.equal(response.status, 200);
        return response.json();
      };
      const planning = await request({ tools: [{ function: { name: 'submit_page_plan' } }], messages: [{ content: '规划合同' }, { content: `${material}\nstyle 必须填 documentary` }] });
      const plan = JSON.parse(planning.choices[0].message.tool_calls[0].function.arguments);
      assert.ok(plan.summary.includes(name));
      assert.deepEqual(plan.pages.map((page: { id: string }) => page.id), ['home', pageId]);
      const writing = await request({ messages: [{ content: '写页合同' }, { content: `${material}\n已确认页面大纲（不能作为新增事实来源，冲突时以资料为准）：${JSON.stringify(plan)}\n本次要求：保留资料` }] });
      const code = JSON.parse(writing.choices[0].message.content);
      assert.ok(code.header.includes(name));
      assert.ok(code.pages[1].html.includes(sentinel.replaceAll('<', '&lt;').replaceAll('>', '&gt;')), 'Unseen tail fact must reach visible HTML');
      receipts.push({ name, sentinel, plan, code });
    }
    await writeFile(path.join(parent, 'observations.json'), JSON.stringify({ args, endpoint, receipts }, null, 2), 'utf8');
  } finally {
    const stopped = new Promise<void>(resolve => child.once('close', () => resolve()));
    child.kill('SIGTERM'); await stopped;
    await writeFile(path.join(parent, 'provider.log'), output, 'utf8');
  }
});

test('actual CLI only-selects non-industrial quick/full cases without losing material or coercing product pages', async () => {
  assert.ok(process.env.SITECRAFT_BASE, 'Set SITECRAFT_BASE to this worktree server');
  const root = path.resolve('artifacts/t157', `contract-${crypto.randomUUID()}`);
  await mkdir(path.join(root, 'previous/private'), { recursive: true });
  await writeFile(path.join(root, 'previous/private/round.json'), JSON.stringify({ cases: [], controls: [] }));
  for (const quick of [true, false]) {
    const out = path.join(root, quick ? 'quick' : 'full');
    const args = ['--experimental-strip-types', 'scripts/eval-new-route.ts', '--prepare-only', '--only', expected.map(item => `${item.id}/documentary`).join(','), '--previous', path.join(root, 'previous'), '--out', out, ...(quick ? ['--quick'] : [])];
    const result = spawnSync(process.execPath, args, { encoding: 'utf8' });
    await writeFile(path.join(root, `${quick ? 'quick' : 'full'}-command.json`), JSON.stringify({ args, ...result }, null, 2));
    assert.doesNotMatch(result.stderr, /only必须/, 'the selected non-industrial cases must exist');
    const round: EvalRound = JSON.parse(await readFile(path.join(out, 'private/round.json'), 'utf8'));
    assert.equal(result.status, 1, 'incompatible previous corpus stops before network calls');
    assert.ok(round.errors.some(error => error.includes('资料或组合已变化')));
    assert.deepEqual(round.cases.map(item => item.key), expected.map(item => `${item.id}/documentary`));
    for (const item of expected) {
      const material = round.cases.find(c => c.pack === item.id)!.materials;
      const pack = simulatedPackList.find(pack => pack.id === item.id)!;
      for (const line of pack.body.split('\n').filter(line => !/^资料性质：|^页面(?:要求)?：|^公司名：|^首屏可用事实：/.test(line))) {
        assert.ok(material.includes(line.replaceAll(pack.companyName, pack.companyName.replace(/P3[A-Z]$/, ''))), `${item.id}: missing ${line}`);
      }
      assert.match(material, /没有授权照片时采用无图/);
      // Author constraints precede the eval's final page-list override (T-160).
      for (const line of pack.body.split('\n').filter(line => line.startsWith('页面要求：'))) assert.ok(material.includes(line));
      const requested = material.split('\n').filter(line => line.startsWith('页面要求：')).at(-1)!;
      assert.doesNotMatch(requested, /产品|询盘|预约|联系页/);
      if (quick) assert.ok(requested.includes(`${item.title}（${item.page}）`));
      const id = item.id as Parameters<typeof requireWholeSitePlan>[0];
      assert.throws(() => requireWholeSitePlan(id, 1, quick ? 'quick' : 'full'));
      if (!quick) assert.throws(() => requireWholeSitePlan(id, 2));
      assert.doesNotThrow(() => requireWholeSitePlan(id, quick ? 2 : 3, quick ? 'quick' : 'full'));
    }
    assert.deepEqual(round.controls, []);
    assert.ok(round.cases.every(c => c.outcome === 'not-run' && c.modelCalls.length === 0));
  }
});
