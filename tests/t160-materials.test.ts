import assert from 'node:assert/strict';
import test from 'node:test';
import { simulatedPacks, buildMaterialsChatMessage } from '../lib/simulated-packs.ts';

test('author instructions are separate from facts and survive the evaluation page override', () => {
  // These phrases and factual limits come from T-160/T-158's source review.
  const examples = [
    ['industrial', '不是第三个商品', '不提供现场安装'],
    ['export', '不把批次报告写成产品认证', '材料报告随订单约定提供'],
    ['packaging', '请把纸盒和内托分开介绍', '我们没有食品直接接触许可'],
    ['restaurant', '不写成固定季节菜单', '不保证每天相同品种'],
    ['restaurant', '不叠加自行推导的折扣', '不承接婚宴、包场、上门厨师或团体配餐'],
    ['education', '不推导免费材料包、赠课或限时优惠', '不按单次课拆售'],
    ['education', '不把所有课程写为零基础皆可', '水彩课要求能完成基础线稿'],
    ['design', '不写免费提案、固定低价或不限次修改', '不提供统一套餐价'],
    ['design', '不把设计文件检查写成印刷效果保证', '不包含印刷和发行'],
  ] as const;
  for (const [id, instruction, fact] of examples) {
    const pack = simulatedPacks[id];
    const facts = pack.body.split('\n').filter(line => !/^页面(?:要求)?：/.test(line)).join('\n');
    assert.ok(!facts.includes(instruction), `${id}: author instruction still in facts: ${instruction}`);
    assert.ok(facts.includes(fact), `${id}: removed a real limitation: ${fact}`);
    const requirements = pack.body.split('\n').filter(line => /^页面要求：/.test(line)).join('\n');
    assert.ok(requirements.includes(instruction), `${id}: instruction must remain in page requirements`);
    // eval-new-route removes the first page declaration, then supplies its own page list.
    assert.ok(pack.body.replace(/^页面(?:要求)?：.*$/m, '').includes(instruction));
    assert.ok(buildMaterialsChatMessage(pack).endsWith(pack.body), `${id}: source was truncated`);
  }
});
