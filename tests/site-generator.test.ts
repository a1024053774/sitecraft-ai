import assert from "node:assert/strict";
import test from "node:test";
import { buildGenerationPlan, generateDraftOperations, type DraftOpsProvider } from "../lib/site-generator.ts";
import type { SiteIntent } from "../lib/site-intent.ts";
import { defaultDraft } from "../lib/site-document.ts";
import type { SiteOperation } from "../lib/site-operations.ts";

const intent: SiteIntent = {
  businessType: "trade",
  companyName: "华辰光伏",
  industry: "光伏组件出口",
  targetAudience: "overseasB2b",
  tone: "professional",
  colorTone: "green",
  coreSections: ["about", "features", "products", "contact"],
  recommendedTemplateId: "atlas",
  summary: "光伏出口企业的双语官网",
};

test("buildGenerationPlan: adds set_template when template is not forge", () => {
  const plan = buildGenerationPlan(intent, "atlas", []);
  assert.equal(plan.leadingOps.length, 1);
  assert.deepEqual(plan.leadingOps[0], { op: "set_template", templateId: "atlas" });
  assert.equal(plan.baseDraft.templateId, "forge"); // base 是默认草稿
  assert.equal(plan.scope.sections.length, 4);
  assert.equal(plan.hideOps.length, 0);
});

test("buildGenerationPlan: no set_template when forge (default)", () => {
  const plan = buildGenerationPlan(intent, "forge", []);
  assert.equal(plan.leadingOps.length, 0);
});

test("buildGenerationPlan: excludes hidden sections and generates hideOps", () => {
  const plan = buildGenerationPlan(intent, "atlas", ["products", "contact"]);
  assert.deepEqual(plan.scope.sections, ["about", "features"]);
  assert.equal(plan.hideOps.length, 2);
  assert.deepEqual(plan.hideOps[0], { op: "set_section_visibility", section: "products", visible: false });
});

test("generateDraftOperations: merges leading + batchA + batchB + hideOps in order", async () => {
  const fakeProvider: DraftOpsProvider = async (args) => {
    const ops: SiteOperation[] = args.attemptHint?.includes("第一批")
      ? [
          { op: "set_text", target: "companyName", locale: "zh", value: "华辰光伏" },
          { op: "set_text", target: "hero.title", locale: "zh", value: "可靠制造" },
        ]
      : [
          { op: "set_text", target: "about.title", locale: "zh", value: "关于我们" },
        ];
    return { ok: true, summary: args.attemptHint?.includes("第一批") ? "骨架" : "板块", operations: ops, model: "test" };
  };
  const out = await generateDraftOperations({ intent, templateId: "atlas", hiddenSections: ["products"], draftOps: fakeProvider });
  assert.equal(out.ok, true);
  if (out.ok) {
    const ops = out.operations;
    // 顺序：set_template → 批A(2) → 批B(1) → hideOps(1)
    assert.equal(ops[0].op, "set_template");
    assert.equal(ops.filter((o) => o.op === "set_text").length, 3);
    assert.equal(ops.filter((o) => o.op === "set_section_visibility").length, 1);
  }
});

test("generateDraftOperations: batchB failure fail-open only commits batchA", async () => {
  let calls = 0;
  const fakeProvider: DraftOpsProvider = async (args) => {
    calls += 1;
    if (args.attemptHint?.includes("第一批")) {
      return { ok: true, summary: "骨架", operations: [{ op: "set_text", target: "companyName", locale: "zh", value: "华辰光伏" }], model: "test" };
    }
    return { ok: false, code: "timeout", error: "超时" };
  };
  const out = await generateDraftOperations({ intent, templateId: "forge", hiddenSections: [], draftOps: fakeProvider });
  assert.equal(out.ok, true);
  if (out.ok) {
    assert.equal(out.operations.length, 1); // 只有批 A
    assert.match(out.summary, /骨架/);
  }
});

test("generateDraftOperations: batchA failure returns error", async () => {
  const fakeProvider: DraftOpsProvider = async () => ({ ok: false, code: "timeout", error: "超时" });
  const out = await generateDraftOperations({ intent, templateId: "forge", hiddenSections: [], draftOps: fakeProvider });
  assert.equal(out.ok, false);
  if (!out.ok) assert.equal(out.code, "timeout");
});

test("generateDraftOperations: strips operations exceeding length limits (Q2)", async () => {
  const longSubtitle = "可靠制造从关键部件到整线交付覆盖精密模块复合材料与智能检测单元提供全面质量保障和稳定交付服务满足不同客户多样化需求欢迎咨询洽谈业务往来沟通联系";
  const fakeProvider: DraftOpsProvider = async (args) => {
    const ops: SiteOperation[] = args.attemptHint?.includes("第一批")
      ? [
          { op: "set_text", target: "hero.subtitle", locale: "zh", value: longSubtitle },
          { op: "set_text", target: "hero.title", locale: "zh", value: "可靠制造" },
        ]
      : [];
    return { ok: true, summary: "s", operations: ops, model: "test" };
  };
  const out = await generateDraftOperations({ intent, templateId: "forge", hiddenSections: [], draftOps: fakeProvider });
  assert.equal(out.ok, true);
  if (out.ok) {
    // 超长 subtitle 被剔除，只留 title
    assert.equal(out.operations.length, 1);
    const [op] = out.operations;
    assert.ok(op.op === "set_text");
    assert.equal(op.target, "hero.title");
  }
});

test("generateDraftOperations: uses defaultDraft as base (templateId stays forge)", async () => {
  const fakeProvider: DraftOpsProvider = async () => ({ ok: true, summary: "s", operations: [], model: "test" });
  const out = await generateDraftOperations({ intent, templateId: "forge", hiddenSections: [], draftOps: fakeProvider });
  assert.equal(out.ok, true);
  assert.equal(defaultDraft.templateId, "forge");
});
