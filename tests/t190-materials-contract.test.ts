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

// 标签本身也是事实的一部分。检查资料字段的语义角色，不以菜名、地名、
// 某个数值或改后整句作答案；生成结果是否遵守仍须另做真实评估。
test('地址字段不能把服务范围变成所在地，餐馆所在地缺口须显式保留', () => {
  for (const pack of simulatedPackList) {
    for (const clause of pack.body.split(/[。；\n]/)) {
      assert.doesNotMatch(clause, /^[^：\s]*(?:地址|所在地|位置)[^：\s]*[：\s]+服务(?:社区|区域|范围)/,
        `${pack.id}: 地址字段只能给所在地或所在地缺口：${clause}`);
    }
  }
  const restaurant = simulatedPackList.find(pack => pack.id === 'restaurant')!;
  assert.match(restaurant.body, /(?:^|[。\n])服务(?:社区|区域|范围)[：\s]+[^。\n]+/);
  assert.match(restaurant.body, /门店(?:所在区|所在地)[^。\n]*(?:未提供|待补充)/);
  assert.match(restaurant.body, /门牌地址[：\s]+待补充/);
});

test('起订量字段只说明起订量，排产、交期和付款各有自己的归属', () => {
  for (const pack of simulatedPackList) {
    for (const line of pack.body.split('\n').filter(line => /^(?:MOQ|[^：]*起订量[^：]*)[：\s]/.test(line))) {
      const value = line.replace(/^[^：]+：/, '');
      assert.doesNotMatch(value, /排产|交期|付款|贸易条款/, `${pack.id}: 起订量标签不能包办其他商业事项`);
      assert.match(value, /\d+\s*(?:台|件|套|个)|单套|待补充/, `${pack.id}: 数量未知须保留缺口`);
    }
  }
});

test('产能或产量字段不把设备台数当作产出', () => {
  for (const pack of simulatedPackList) {
    for (const line of pack.body.split('\n').filter(line => /^[^：]*(?:产能|产量)：/.test(line))) {
      assert.doesNotMatch(line.split('：').slice(1).join('：'), /(?:机|床|炉|设备)\s*\d+\s*台/,
        `${pack.id}: 设备数量须归入设备字段`);
    }
  }
});

test('认证与报告分清类别，并逐项保留已有、进行中或待补充状态', () => {
  for (const pack of simulatedPackList) {
    for (const line of pack.body.split('\n').filter(line => /^[^：]*认证[^：]*：/.test(line))) {
      const [label, ...values] = line.split('：');
      const value = values.join('：');
      if (!label.includes('报告')) assert.doesNotMatch(value, /报告/, `${pack.id}: 报告不冒充认证`);
      for (const item of value.split(/[；。]/).filter(Boolean)) {
        assert.match(item, /已有|认证中|待补充/, `${pack.id}: 认证状态不能被标签省略`);
      }
    }
  }
});

test('多材料规格中的有条件透光率在指标标签中保留材料与试样厚度', () => {
  for (const pack of simulatedPackList) {
    for (const line of pack.body.split('\n').filter(line => /规格参数：.*透光率/.test(line))) {
      const materials = line.match(/适用材料\s+([^；]+)/)?.[1].split('/');
      if (!materials || materials.length < 2) continue;
      const metric = line.split('；').find(field => field.includes('透光率'))!;
      const scope = metric.match(/透光率（([^）]+)）\s+[≥≤<>]?\d+(?:\.\d+)?%/)?.[1];
      assert.ok(scope, `${pack.id}: 指标标签须限定试样，不能暗示整组材料通用`);
      assert.ok(materials.some(material => scope.includes(material)), '限定材料须来自同项材料表');
      assert.match(scope, /\d+(?:\.\d+)?\s*mm/, '保留试样厚度条件');
    }
  }
});

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
