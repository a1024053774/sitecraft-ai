import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { alignmentFailureText, describePreviewGaps, noChangeReply } from "../lib/workspace-copy.ts";
import { stripMaterialsInstruction, wrapCompanyMaterials } from "../lib/simulated-packs.ts";
import { resolvePagePlan } from "../lib/template-pages.ts";

// T-038: workspace messages name page parts in Chinese; field paths and internal words
// (commitOperations, HTML, 槽位, 声明区块, missing) never reach the user.

const FIELD_PATH = /\b[a-z]+(?:\.[a-z0-9]+)+\b/i;

test("preview gaps are named by page part, not by field path", () => {
  const note = describePreviewGaps({
    revision: 3,
    missing: ["goal.zh", "about.title.zh", "about.body.zh", "contact.phone.zh", "features.items.0.title.zh", "navigation.about.zh", "content.industries", "content.capabilities", "content.certifications"],
    fallback: ["hero.subtitle.zh"],
    proposals: [{ requested: "contact.phone.zh", proposed: "hero.cta" }],
  });
  for (const part of [note.text, note.change]) {
    assert.doesNotMatch(part, FIELD_PATH, part);
    assert.doesNotMatch(part, /槽位|映射|回退|missing/i, part);
  }
  for (const label of ["经营目标", "关于我们标题", "关于我们说明", "询盘电话", "优势第1项标题", "导航", "应用行业", "加工能力", "认证"]) {
    assert.ok(note.change.includes(label), `${label} missing from ${note.change}`);
  }
  assert.doesNotMatch(note.change, /页面内容/);
  assert.match(note.change, /首屏按钮/);
});

test("the materials wrapper is not shown back to the user", () => {
  const body = "公司名：忻州重载减速机P3I\n产品：直角减速机、行星减速机";
  const sent = wrapCompanyMaterials(body);
  assert.notEqual(sent, body);
  assert.equal(stripMaterialsInstruction(sent), body);
  assert.equal(stripMaterialsInstruction("把首屏标题改短一点"), "把首屏标题改短一点");
});

test("an unsupported page is explained without template internals", () => {
  const plan = resolvePagePlan({ templateId: "screwfast", source: "user", requested: [{ role: "about", requested: "关于我们" }] });
  assert.ok(plan.unsupported.length >= 1, "screwfast has no 关于我们 page or section");
  for (const item of plan.unsupported) assert.doesNotMatch(item.reason, /HTML|声明|快照|槽/, item.reason);
});

test("model-written unsupported-page reasons reach the user in plain language", async () => {
  const { validateAIOperations } = await import("../lib/site-operations.ts");
  const result = validateAIOperations("请规划首页、产品、联系，另外还要独立认证页和资料下载页", [{
    op: "set_page_plan",
    source: "user",
    pages: [{ role: "home" }, { role: "products" }, { role: "contact" }],
    unsupported: [
      { requested: "独立认证页", reason: "当前模板快照没有独立的认证 HTML 页面，无法单独开通 URL；认证状态只能在首页的认证声明区块内呈现" },
      { requested: "资料下载页", reason: "访客可以在询盘里说明要哪份资料，我们再发给他。" },
    ],
  }] as never, new Set(["screwfast"]));
  const plan = result.operations[0] as { unsupported?: Array<{ requested: string; reason: string }> };
  const reasons = plan.unsupported ?? [];
  assert.equal(reasons.length, 2);
  for (const item of reasons) assert.doesNotMatch(item.reason, /HTML|快照|URL|声明|区块|字段|模板/, item.reason);
  assert.equal(reasons[1].reason, "访客可以在询盘里说明要哪份资料，我们再发给他。", "a plain reason is kept");
});

test("workspace, error and page-plan copy carries no internal words", async () => {
  const files = {
    workspace: await readFile(new URL("../app/(workspace)/workspace/page.tsx", import.meta.url), "utf8"),
    errors: await readFile(new URL("../lib/user-errors.ts", import.meta.url), "utf8"),
    pages: await readFile(new URL("../lib/template-pages.ts", import.meta.url), "utf8"),
  };
  const forbidden = [/commitOperations/, /独立 HTML/, /对应 HTML/, /HTML\/CSS/, /声明区块/, /声明图片槽/, /声明槽/, /src 槽/, /槽位/, /会报告 missing/, /可改已映射字段/, /回退命中/, /analyze 没有走/];
  for (const [name, source] of Object.entries(files)) {
    for (const pattern of forbidden) assert.doesNotMatch(source, pattern, `${name} still says ${pattern}`);
  }
});

// grok-b's T-038 review: the model's own summary said "当前模板没有独立的认证页和资料下载页，无法单独开通网址"
// and the upload hint said "校验 magic bytes".
test("operation target copy never includes model prose or internal words", async () => {
  const { operationSummary } = await import("../lib/workspace-copy.ts");
  const summary = operationSummary([
    { op: "set_page_plan" },
    { op: "set_text", target: "hero.title" },
  ]);
  assert.equal(summary, "将修改：页面规划、首屏标题");
  assert.doesNotMatch(summary, /HTML|网址|URL|快照|槽位|字段/);
});

test("the upload hint does not mention magic bytes", async () => {
  const source = await readFile(new URL("../app/(workspace)/workspace/page.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /magic bytes/i);
});

// T-053: when the system refused what the model asked for, the reply is only the reason
// ("未修改：……"); the "no applicable difference" sentence is for a turn that simply changed nothing.
const NO_DIFFERENCE = "模型没有生成可应用的内容差异，草稿和模板均未修改。";

test("a refused chat turn says only why nothing changed", () => {
  const layout = "参数对比表要 2–4 个产品共有至少 3 项都有数值的同名参数；现在只共有 2 项（额定压力、主体材质），产品仍按产品卡片显示。";
  assert.deepEqual(noChangeReply(layout, [layout]), { text: "", change: layout });
  assert.deepEqual(noChangeReply(`${layout}${layout}`, [layout, layout]), { text: "", change: layout });
  assert.deepEqual(
    noChangeReply("已把产品改成参数对比表", ["用户没有明确要求更换模板，已拒绝模板切换", layout]),
    { text: "", change: `用户没有明确要求更换模板，已拒绝模板切换；${layout}` },
  );
  assert.deepEqual(noChangeReply("标题已经是这句了", []), { text: NO_DIFFERENCE, change: "标题已经是这句了" });
  assert.deepEqual(noChangeReply(undefined, undefined), { text: NO_DIFFERENCE, change: "没有变化" });
  assert.deepEqual(noChangeReply("", ["", 3]), { text: NO_DIFFERENCE, change: "没有变化" });
});

test("the workspace answers a no-change turn with that reply and draws no empty bubble", async () => {
  const source = await readFile(new URL("../app/(workspace)/workspace/page.tsx", import.meta.url), "utf8");
  assert.match(source, /noChangeReply\(done\.summary, done\.rejected\)/);
  assert.ok(!source.includes(NO_DIFFERENCE), "the sentence is written in one place");
  assert.match(source, /\{message\.text \? <div className="message-bubble">\{message\.text\}<\/div> : null\}/);
});

// T-061: after a refresh, a guided run that failed says why, the way it said it at the time (cut off
// → cut off). Only the error catalog's wording is shown; anything else gets the general line.
const GENERAL_FAILURE = "需求对齐没有完成，草稿没有修改。请读取当前状态后重试。";

test("a restored failed alignment run says the real reason", () => {
  assert.equal(alignmentFailureText("这次生成被截断，没有改动草稿。"), "这次生成被截断，没有改动草稿。 可以直接重试；已保存的问题和答案仍可继续。");
  assert.equal(alignmentFailureText("模型服务暂时不可用，草稿没有因此改写。"), "模型服务暂时不可用，草稿没有因此改写。 稍后重试；已保存的问题和答案仍可继续。");
  for (const other of ["Error: /private/token=secret", "", undefined, 3]) assert.equal(alignmentFailureText(other), GENERAL_FAILURE);
});

test("the workspace restores a failed run with that reason, before the card it shows again", async () => {
  const source = await readFile(new URL("../app/(workspace)/workspace/page.tsx", import.meta.url), "utf8");
  const start = source.indexOf("function alignmentMessageText");
  const body = source.slice(start, source.indexOf("\n}\n", start));
  const failed = body.indexOf('if (view.lastResult?.status === "error") return alignmentFailureText(view.lastResult.summary);');
  assert.ok(failed > 0, "the failure branch uses the stored reason");
  assert.ok(failed < body.indexOf("if (view.awaitingConfirmation)") && failed < body.indexOf("if (view.waitingForUser)"), "it comes before the waiting branches, which a failed run's card would otherwise take");
  assert.ok(!source.includes(GENERAL_FAILURE), "the general line is written in one place");
});
