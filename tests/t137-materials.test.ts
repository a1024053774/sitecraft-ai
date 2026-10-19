import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { simulatedPackList, buildMaterialsChatMessage } from '../lib/simulated-packs.ts';

// T-137 contract: missing subject matter, truncated input, invented contact
// details, missing image files, or untraceable licenses can each
// leave the generator without usable client facts or authorized imagery.
// T-137's production/procurement and licensed-JPEG contract belongs to the
// four industrial packs. T-157/T-190 cover the service packs.
for (const pack of simulatedPackList.filter(pack => ['industrial', 'export', 'molding', 'packaging'].includes(pack.id))) {
  test(`${pack.id}: client materials cover history, cases, production, selection and procurement without truncation`, () => {
    for (const section of ['沿革', '加工流程', '质检流程', '交付与包装', '选型资料']) {
      assert.match(pack.body, new RegExp(`^${section}：.+`, 'm'), `${pack.id}缺少${section}`);
    }
    const history = pack.body.split('\n').find(line => line.startsWith('沿革：'))!;
    assert.ok((history.match(/\d{4} 年/g) || []).length >= 3, '至少三个有事件的年份');
    const cases = pack.body.split('\n').filter(line => /^(?:配套记录|订单笔记|试制记录|做过的包装)·/.test(line));
    assert.ok(cases.length >= 2 && cases.length <= 3, '两到三个行业描述的供货案例');
    for (const line of cases) {
      assert.doesNotMatch(line, /需求：|交付：|边界：/, 'T-190 用叙述交代项目，不套字段模板');
      assert.match(line, /该(?:订单|项目|案例)|此类替换/, '项目条件有明确归属');
    }
    const products = pack.body.split('\n').filter(line => /^[^：]+规格参数：/.test(line)).map(line => line.split('规格参数：')[0]);
    assert.ok(products.length >= 2);
    for (const product of products) {
      assert.match(pack.body, new RegExp(`^${product}应用与选型：.+`, 'm'), `${product}缺少应用与选型`);
    }
    assert.ok(pack.body.split('\n').filter(line => /^问：.+答：.+/.test(line)).length >= 4);
    assert.match(pack.body, /(?:设备|主设备|车间配置|设备与工序)：[^\n]*\S+ [1-9]\d* 台/);
    assert.match(pack.body, /电话、地址：待补充/);
    assert.match(pack.body, /客户名单、评价：待补充/);
    const emails = pack.body.match(/[\w.+-]+@[\w.-]+/g) || [];
    assert.deepEqual([...new Set(emails)], [pack.email]);
    assert.match(pack.email, /\.luckye\.online$/);
    assert.doesNotMatch(pack.body, /https?:\/\/|\b1[3-9]\d{9}\b|好评|五星|满意率|客户评价：[^待]/);
    const message = buildMaterialsChatMessage(pack);
    assert.ok(message.endsWith(pack.body), '工作台资料入口必须完整保留正文');
    assert.doesNotMatch(message, /\[truncated\]/);
    assert.ok(pack.body.length <= 4000, '新路线资料入口限制');
  });

  test(`${pack.id}: 6–10 licensed industry JPEG fixtures have provenance and use limits`, () => {
    const root = new URL(`./fixtures/company-images/${pack.id}/`, import.meta.url);
    const manifest = JSON.parse(readFileSync(new URL('manifest.json', root), 'utf8'));
    assert.ok(manifest.images.length >= 6 && manifest.images.length <= 10);
    assert.equal(new Set(manifest.images.map((p: { file: string }) => p.file)).size, manifest.images.length);
    for (const photo of manifest.images) {
      assert.match(photo.license, /^(?:CC0|Public [Dd]omain|CC BY(?:-SA)? \d)/);
      assert.ok(['CC0', 'Public Domain', 'CC BY', 'CC BY-SA'].includes(photo.apiLicense));
      for (const key of ['sourceUrl', 'licenseUrl']) assert.equal(new URL(photo[key]).protocol, 'https:');
      assert.ok(photo.author && photo.attribution && photo.downloadedAt);
      assert.ok(photo.verification?.checkedAt || photo.accessDate, '核验日期');
      assert.ok(['product', 'equipment', 'facility', 'inspection'].includes(photo.category));
      const bytes = readFileSync(new URL(photo.file, root));
      assert.equal(bytes.readUInt16BE(0), 0xffd8, 'JPEG signature');
      assert.equal(bytes.length, photo.bytes);
      if (photo.sourceRevision) {
        assert.equal(photo.verification.sourcePageStatus, 200);
        assert.equal(photo.verification.licensePageStatus, 200);
        assert.ok(Number.isInteger(photo.sourceRevision) && photo.sourceRevision > 0, '精确来源修订');
        assert.match(photo.limitations, /非本厂实拍/);
        assert.ok(photo.modifications.length);
      }
    }
  });
}

test('paper packaging manifest excludes the disputed copyright and branded box subjects', () => {
  const manifest = JSON.parse(readFileSync(new URL('./fixtures/company-images/packaging/manifest.json', import.meta.url), 'utf8'));
  const rejected = ['Flachbettstanze.jpg', 'American boxes.jpg', 'American boxes palletised.jpg'];
  for (const photo of manifest.images) assert.ok(!rejected.includes(photo.sourceTitle), `rejected source remains admitted: ${photo.sourceTitle}`);
});
