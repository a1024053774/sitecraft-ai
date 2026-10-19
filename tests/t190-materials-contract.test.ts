import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { simulatedPackList, buildMaterialsChatMessage } from '../lib/simulated-packs.ts';
import { buildBlindPackage, type EvalRound } from '../scripts/eval-set-report.ts';

// T-189/T-190: reject repeated case-field scaffolds, excessive business
// restrictions (count clauses, not lines), undated/unmarked news, missing
// image rights, and a mixed-review acceptance threshold. These are source
// contracts; they do not establish generated-page quality or legal ownership.
const servicePacks = new Set(['restaurant', 'education', 'design']);
for (const pack of simulatedPackList) {
  test(`${pack.id}: enterprise material has scoped conditions and dated simulated news`, () => {
    assert.doesNotMatch(pack.body, /需求[： ].+；(?:提供|工作|交付)[： ].+；边界[： ]|内容 .+；交付 .+；(?:常见|边界)/);
    assert.doesNotMatch(pack.body, /边界[： ]/);
    const business = pack.body.split('\n').filter(line => !/^(?:资料性质|图片使用|页面)/.test(line)).join('\n');
    // 不锈钢、不同是普通名词/形容词，其余否定词按出现次数计数，
    // 包括“不包含”“不颁发”等写法，避免只统计固定短语而漏数。
    const restrictions = business.match(/不(?!锈钢|同)|没有|未取得|仅限|只承接/g) || [];
    assert.ok(restrictions.length <= 4, `${pack.id}: ${restrictions.length} business restrictions, maximum 4`);
    assert.match(pack.body, /(?:标识|字标).*(?:主色|主用色)/);
    const news = pack.body.split('\n').filter(line => /^\d{4}-\d{2}-\d{2}/.test(line));
    assert.ok(news.length >= 3 && news.length <= 5, '每家 3–5 条动态');
    for (const line of news) {
      assert.match(line, /^\d{4}-\d{2}-\d{2}（模拟动态）：.+/);
      assert.ok(Number.isFinite(Date.parse(line.slice(0, 10))));
    }
    assert.match(pack.body, /栏目线索：.+/);
    assert.match(pack.body, /^资料性质：模拟/);
    assert.match(pack.body, /待补充/);
    assert.ok(pack.body.includes(pack.email));
    assert.match(pack.email, /\.luckye\.online$/);
    assert.ok(buildMaterialsChatMessage(pack).endsWith(pack.body), '资料完整进入工作台');
  });

  test(`${pack.id}: admitted images retain individual source and redistribution records`, async () => {
    const root = path.resolve(servicePacks.has(pack.id) ? 'fixtures/simulated-packs' : 'tests/fixtures/company-images', pack.id);
    const manifest = JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8'));
    if (!manifest.images.length) assert.match(manifest.reason, /无图|未准入/);
    for (const image of manifest.images) {
      assert.equal(new URL(image.sourceUrl).protocol, 'https:');
      assert.equal(new URL(image.licenseUrl).protocol, 'https:');
      assert.ok(image.author && image.attribution);
      assert.ok(image.verification?.checkedAt || image.accessDate);
      assert.ok((await readFile(path.join(root, image.file))).length > 0);
      if (image.admissionTicket === 'T-190') {
        assert.equal(image.verification.redistributionAllowed, true);
        assert.equal(image.verification.generatorUseAllowed, true);
        assert.ok(image.verification.rightsBasis && image.verification.subjectMatch);
        assert.match(image.limitations, /配图/);
      }
    }
  });
}

test('menu conditions belong to every named dish, including tofu serving time', () => {
  const restaurant = simulatedPackList.find(pack => pack.id === 'restaurant')!;
  for (const name of ['香菇鸡腿饭', '番茄炖牛腩', '时蔬豆腐煲', '葱油拌面', '当日清炒时蔬']) {
    const line = restaurant.body.split('\n').find(line => line.startsWith(`${name}：`));
    assert.ok(line);
    assert.match(line, /午市|晚市/, `${name}应有自己的供应时段`);
    assert.match(line, /含米饭|米饭单点/, `${name}应有自己的米饭口径`);
  }
  assert.match(restaurant.body, /^时蔬豆腐煲：.*午市和晚市供应/m);
});

test('the emitted mixed prompt is reference-only and company/comparison contracts remain present', async () => {
  const root = path.resolve('artifacts/t190', `prompts-${crypto.randomUUID()}`);
  await mkdir(path.join(root, 'private'), { recursive: true });
  const round: EvalRound = { schemaVersion: 1, startedAt: '2026-10-19', command: 'contract', commit: 'fixture', dirty: false,
    base: 'fixture', status: 'INCOMPLETE', cases: [], controls: [], errors: [] };
  await buildBlindPackage(round, root, { round, directory: root });
  const mixed = await readFile(path.join(root, 'review/mixed/prompt.txt'), 'utf8');
  assert.doesNotMatch(mixed, /≤\s*50%|须.*50%/);
  assert.match(mixed, /仅作参考/);
  assert.match(await readFile(path.join(root, 'review/company/prompt.txt'), 'utf8'), /判同模板比例须≤50%/);
  assert.match(await readFile(path.join(root, 'comparison-review/prompt.txt'), 'utf8'), /picked/);
});
