import assert from 'node:assert/strict';
import test from 'node:test';
import { simulatedPacks, buildMaterialsChatMessage } from '../lib/simulated-packs.ts';

// T-190 replaces the former page-prohibition inventory with company material.
// Keep necessary scope attached to the relevant item, even when the evaluator
// supplies a different page list. Expectations retain the source business rules.
const examples = [
  ['industrial', '经营安排：', /不提供现场安装；不接零售散单/],
  ['export', '订单笔记·饮料设备：', /该案例接头不用于直接接触食品的流路/],
  ['export', 'MOQ：', /起订量与交期分别记录/],
  ['molding', '透明光学注塑件应用与选型：', /≥90%.*PMMA 2 mm 厚试样/],
  ['packaging', '折叠彩盒规格参数：', /四色胶印.*已有独立内袋/],
  ['packaging', '瓦楞运输盒规格参数：', /单色\/双色水性印刷/],
  ['restaurant', '番茄炖牛腩：', /这一份菜建议两人分食/],
  ['restaurant', '时蔬豆腐煲：', /午市和晚市供应.*米饭单点.*人数待补充/],
  ['education', '水彩材料入门：', /已经能完成基础线稿.*画笔、颜料与调色盒自备/],
  ['design', '服务·包装平面设计：', /刀线与文案确认后.*3–4 周.*结构工程/],
] as const;

test('necessary operating and item conditions survive the evaluation page-list override', () => {
  for (const [id, prefix, condition] of examples) {
    const pack = simulatedPacks[id];
    const line = pack.body.split('\n').find(line => line.startsWith(prefix));
    assert.ok(line, `${id}: ${prefix}`);
    assert.match(line, condition);
    assert.ok(pack.body.replace(/^页面(?:要求)?：.*$/m, '').includes(line));
    assert.ok(buildMaterialsChatMessage(pack).endsWith(pack.body));
  }
  for (const pack of Object.values(simulatedPacks)) {
    const requirements = pack.body.split('\n').filter(line => /^页面(?:要求)?：/.test(line));
    assert.ok(requirements.length === 1);
    assert.ok(requirements[0].length < 100, '页面声明只保留栏目安排，不堆积禁令');
  }
});
