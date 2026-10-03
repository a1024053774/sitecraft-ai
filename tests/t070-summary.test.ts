import assert from "node:assert/strict";
import test from "node:test";
import { noChangeReply, summaryFromAppliedTargets } from "../lib/workspace-copy.ts";

test("T-070 layout summary names the applied layout and drops model-only image details", () => {
  const summary = summaryFromAppliedTargets({ appliedTargets: ["blockVariants.hero"], modelSummary: "首屏改成左文右图，右侧留出图片位" });
  assert.equal(summary, "已更新：首屏布局。");
  assert.doesNotMatch(summary, /图片位|右侧/);
});

test("T-070 text summary names the applied text target", () => {
  assert.equal(summaryFromAppliedTargets({ appliedTargets: ["hero.title.zh", "hero.title.en"], modelSummary: "把首屏标题改成更短的版本" }), "已更新：首屏标题。");
});

test("T-070 rejected changes keep the rejection reason and do not claim a page change", () => {
  const reason = "参数对比表需要至少 3 项共有参数，产品仍按产品卡片显示";
  assert.deepEqual(noChangeReply("已改成参数对比表", [reason]), { text: "", change: `${reason}。` });
});

test("T-070 undo summary names the inverse operation's applied target", () => {
  assert.equal(summaryFromAppliedTargets({ appliedTargets: ["blockVariants.products"], modelSummary: "产品区块调整", action: "undo" }), "已撤销：产品布局。");
});

test("T-070 keeps a model sentence only when it is an explicit reason", () => {
  assert.equal(summaryFromAppliedTargets({ appliedTargets: ["hero.title.zh"], modelSummary: "为了让采购更快找到规格" }), "已更新：首屏标题。原因：为了让采购更快找到规格。");
});
