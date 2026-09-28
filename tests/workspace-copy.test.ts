import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { describePreviewGaps } from "../lib/workspace-copy.ts";
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
    workspace: await readFile(new URL("../app/workspace/page.tsx", import.meta.url), "utf8"),
    errors: await readFile(new URL("../lib/user-errors.ts", import.meta.url), "utf8"),
    pages: await readFile(new URL("../lib/template-pages.ts", import.meta.url), "utf8"),
  };
  const forbidden = [/commitOperations/, /独立 HTML/, /对应 HTML/, /HTML\/CSS/, /声明区块/, /声明图片槽/, /声明槽/, /src 槽/, /槽位/, /会报告 missing/, /可改已映射字段/, /回退命中/, /analyze 没有走/];
  for (const [name, source] of Object.entries(files)) {
    for (const pattern of forbidden) assert.doesNotMatch(source, pattern, `${name} still says ${pattern}`);
  }
});
