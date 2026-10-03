import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { applyEditProposal, disabledAlignment, publicAlignmentView } from "../lib/alignment.ts";
import { noChangeReply, operationSummary, summaryFromAppliedTargets } from "../lib/workspace-copy.ts";

const layoutOperation = { op: "set_block_variant", block: "hero", variant: "split" } as const;

test("T-070 layout summary names the applied layout and drops model-only image details", () => {
  const summary = summaryFromAppliedTargets({ appliedTargets: ["blockVariants.hero"] });
  assert.equal(summary, "已更新：首屏布局。");
  assert.doesNotMatch(summary, /图片位|右侧/);
});

test("T-070 drops synonymous model descriptions instead of guessing whether they are reasons", () => {
  const operationSummaryText = operationSummary([layoutOperation]);
  for (const modelSummary of [
    "为了在右边预留照片区域",
    "原因：右边预留照片区域",
    "为了提供一个可放照片的地方",
  ]) {
    assert.doesNotMatch(operationSummaryText, new RegExp(modelSummary));
  }
});

test("T-070 never echoes a model summary, including a legitimate-looking reason", () => {
  assert.equal(operationSummary([{ op: "set_text", target: "hero.title" }]), "将修改：首屏标题");
  assert.doesNotMatch(operationSummary([{ op: "set_text", target: "hero.title" }]), /为了图片授权合规/);
});

test("T-070 text summary names the applied text target", () => {
  assert.equal(summaryFromAppliedTargets({ appliedTargets: ["hero.title.zh", "hero.title.en"] }), "已更新：首屏标题。");
});

test("T-070 rejected changes keep the rejection reason and do not claim a page change", () => {
  const reason = "参数对比表需要至少 3 项共有参数，产品仍按产品卡片显示";
  assert.deepEqual(noChangeReply("已改成参数对比表", [reason]), { text: "", change: `${reason}。` });
});

test("T-070 undo summary names the inverse operation's applied target", () => {
  assert.equal(summaryFromAppliedTargets({ appliedTargets: ["blockVariants.products"], action: "undo" }), "已撤销：产品布局。");
});

test("T-070 does not append even an explicit model reason", () => {
  assert.equal(summaryFromAppliedTargets({ appliedTargets: ["hero.title.zh"] }), "已更新：首屏标题。");
});

test("T-070 confirmation card uses operation target labels instead of model prose", () => {
  const proposed = applyEditProposal({ ...disabledAlignment(), inflightRunId: "run-t070" }, {
    runId: "run-t070",
    summary: "左文右图，右边预留照片区域",
    operations: [layoutOperation],
    rejected: [],
    baseRevision: 1,
    model: "test",
    latencyMs: 1,
  });
  assert.equal("stale" in proposed, false);
  if ("stale" in proposed) throw new Error("expected proposal");
  const view = publicAlignmentView(proposed.snapshot);
  assert.match(String(view.summary), /^将修改：/);
  assert.doesNotMatch(String(view.summary), /左文右图|右边|照片/);
  assert.doesNotMatch(String(view.question), /左文右图|右边|照片/);
});

test("T-070 FS and Postgres committers share the same target-summary constructor and history reads it back", () => {
  const source = readFileSync(new URL("../lib/site-store.ts", import.meta.url), "utf8");
  const copySource = readFileSync(new URL("../lib/workspace-copy.ts", import.meta.url), "utf8");
  assert.equal((source.match(/summary: committedSummary\(args, result\.appliedTargets/g) ?? []).length, 2);
  assert.match(source, /history: record\.history\.slice\(-30\)\.reverse\(\)\.map\(\(\{ id, revision, summary,/);
  assert.doesNotMatch(copySource, /modelReason|modelSummary/);
  const summary = summaryFromAppliedTargets({ appliedTargets: ["hero.title.zh"] });
  assert.equal(summary, "已更新：首屏标题。");
});
