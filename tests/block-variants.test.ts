import assert from "node:assert/strict";
import test from "node:test";
import { applyAlignmentAction, applyEditProposal, disabledAlignment, normalizeAlignmentSnapshot } from "../lib/alignment.ts";
import { defaultDraft, normalizeDraft, type SiteDraft } from "../lib/site-document.ts";
import { aiChangeSchema, aiOperationSchema, applySiteOperations, siteOperationSchema, validateAIOperations, type AIOperation, type SiteOperation } from "../lib/site-operations.ts";
import { simulatedPacks } from "../lib/simulated-packs.ts";
import { changeTargetLabel, plainSummary } from "../lib/workspace-copy.ts";
import { packDraft } from "./fixtures/pack-drafts.ts";

// T-053 step 3: the layout a block shows is stored in the draft (blockVariants), changed only by
// set_block_variant through commitOperations, checked against the materials after the whole batch
// (so it works in either order and on undo), and put back to the default in the same batch when a
// later change leaves its materials short.

const options = { templateIds: new Set(["forge", "screwfast", "landwind", "tailwind-landing"]), lastChange: "block-variants" };
const apply = (draft: SiteDraft, operations: SiteOperation[]) => applySiteOperations(draft, operations, options);
type SetLayout = Extract<AIOperation, { op: "set_block_variant" }>;
const setLayout = (block: string, variant: string | null) => ({ op: "set_block_variant", block, variant }) as SetLayout;

test("set_block_variant is an operation of both schemas; blocks outside the library are refused", () => {
  assert.equal(siteOperationSchema.safeParse(setLayout("products", "compare")).success, true);
  assert.equal(siteOperationSchema.safeParse(setLayout("products", null)).success, true);
  assert.equal(aiOperationSchema.safeParse(setLayout("hero", "statement")).success, true);
  assert.equal(siteOperationSchema.safeParse(setLayout("banner", "wide")).success, false);
  assert.equal(siteOperationSchema.safeParse({ op: "set_block_variant", block: "products" }).success, false);
});

test("drafts carry blockVariants; old drafts read as defaults and unknown entries are dropped", () => {
  assert.deepEqual(defaultDraft.blockVariants, {});
  const legacy = structuredClone(defaultDraft) as Record<string, unknown>;
  delete legacy.blockVariants;
  legacy.revision = 12;
  const restored = normalizeDraft(legacy);
  assert.deepEqual(restored.blockVariants, {});
  assert.equal(restored.revision, 12);
  const messy = { ...structuredClone(packDraft("industrial")), revision: 9, blockVariants: { products: "compare", hero: "poster", banner: "wide", contact: 3 } };
  const cleaned = normalizeDraft(messy);
  assert.deepEqual(cleaned.blockVariants, { products: "compare" }, "unknown blocks, unknown layouts and non-strings are dropped");
  assert.equal(cleaned.revision, 9);
  assert.equal(cleaned.companyName, simulatedPacks.industrial.companyName, "the rest of the draft is kept");
});

test("setting a layout records it, reports the change and undoes back to the default", () => {
  const draft = packDraft("industrial");
  const result = apply(draft, [setLayout("products", "compare")]);
  assert.equal(result.changed, true);
  assert.deepEqual(result.draft.blockVariants, { products: "compare" });
  assert.deepEqual(result.appliedTargets, ["blockVariants.products"]);
  assert.deepEqual(result.inverseOperations, [setLayout("products", null)]);
  assert.equal(result.draft.revision, draft.revision + 1);
  const undone = apply(result.draft, result.inverseOperations);
  assert.deepEqual(undone.draft.blockVariants, {});
  const redone = apply(undone.draft, [setLayout("products", "compare")]);
  assert.deepEqual(redone.draft.blockVariants, { products: "compare" });
  assert.equal(apply(result.draft, [setLayout("products", "compare")]).changed, false, "the same layout again changes nothing");
  assert.equal(apply(draft, [setLayout("products", "cards")]).changed, false, "the default layout is not stored");
  const toCards = apply(result.draft, [setLayout("products", "cards")]);
  assert.deepEqual(toCards.draft.blockVariants, {}, "choosing the default layout clears the choice");
  assert.deepEqual(toCards.inverseOperations, [setLayout("products", "compare")]);
});

test("a layout whose materials are short is refused with a reason in page terms", () => {
  assert.throws(() => apply(packDraft("export"), [setLayout("products", "compare")]), (error: Error) => {
    assert.match(error.message, /参数对比表要 2–4 个产品共有至少 3 项都有数值的同名参数；现在只共有 2 项（额定压力、主体材质）/);
    assert.doesNotMatch(error.message, /区块|变体|blockVariants|compare|operation/);
    return true;
  });
  assert.throws(() => apply(packDraft("industrial"), [setLayout("contact", "band")]), /联系条要邮箱、电话、地址至少 2 项；现在只有邮箱/);
  assert.throws(() => apply(packDraft("industrial"), [setLayout("products", "poster")]), /产品没有这种布局/);
  assert.throws(() => apply(structuredClone(defaultDraft), [setLayout("products", "compare")]), /当前样子还不能单独换首屏、产品或询盘的布局/);
});

test("materials and layout in one batch are checked after the whole batch, in either order", () => {
  const empty = applySiteOperations(structuredClone(defaultDraft), [{ op: "set_visual_brief", briefId: "engineering-industrial" }], options).draft;
  const products = packDraft("industrial").products;
  const first = apply(empty, [setLayout("products", "compare"), { op: "replace_products", products }]);
  assert.deepEqual(first.draft.blockVariants, { products: "compare" });
  const second = apply(empty, [{ op: "replace_products", products }, setLayout("products", "compare")]);
  assert.deepEqual(second.draft.blockVariants, { products: "compare" });
  // Undo applies the inverse in reverse order: layout first, products after. It still succeeds.
  const undone = apply(second.draft, second.inverseOperations);
  assert.deepEqual(undone.draft.blockVariants, {});
  assert.deepEqual(undone.draft.products, []);
  const redone = apply(undone.draft, [{ op: "replace_products", products }, setLayout("products", "compare")]);
  assert.deepEqual(redone.draft.blockVariants, { products: "compare" });
  // A look switch in the same batch counts: the layout is checked on the look the batch ends on.
  const fromForge = apply(structuredClone(defaultDraft), [setLayout("products", "compare"), { op: "set_visual_brief", briefId: "engineering-industrial" }, { op: "replace_products", products }]);
  assert.deepEqual(fromForge.draft.blockVariants, { products: "compare" });
});

test("a later change that leaves a chosen layout short puts it back to the default in the same batch, and undo restores both", () => {
  const compared = apply(packDraft("industrial"), [setLayout("products", "compare")]).draft;
  const fewer = structuredClone(compared.products);
  fewer[1].specs = fewer[1].specs!.slice(0, 2);
  const result = apply(compared, [{ op: "replace_products", products: fewer }]);
  assert.deepEqual(result.draft.blockVariants, {}, "the table would have fewer than 3 rows");
  assert.ok(result.appliedTargets.includes("blockVariants.products"), "the change marker shows the product layout");
  assert.equal(result.notices.length, 1);
  assert.match(result.notices[0], /参数对比表要.*现在只共有 2 项（速比范围、额定输出扭矩），产品改回产品卡片。/);
  const undone = apply(result.draft, result.inverseOperations);
  assert.deepEqual(undone.draft.blockVariants, { products: "compare" });
  assert.deepEqual(undone.draft.products, compared.products);
  const redone = apply(undone.draft, [{ op: "replace_products", products: fewer }]);
  assert.deepEqual(redone.draft.blockVariants, {});
  // Changing the contact lines works the same way.
  const banded = apply(packDraft("industrial"), [
    { op: "set_text", target: "contact.phone", value: "0571-1234567" },
    { op: "set_text", target: "contact.address", value: { zh: "浙江省杭州市工业园区 8 号", en: "No. 8, Industrial Park, Hangzhou, Zhejiang" } },
    setLayout("contact", "band"),
  ]).draft;
  const emailOnly = apply(banded, [{ op: "set_text", target: "contact.phone", value: "待补充" }, { op: "set_text", target: "contact.address", value: { zh: "待补充", en: "To be provided" } }]);
  assert.deepEqual(emailOnly.draft.blockVariants, {});
  assert.match(emailOnly.notices[0], /联系条要邮箱、电话、地址至少 2 项；现在只有邮箱，询盘改回左右布局。/);
});

test("layouts stay in the draft on a look that is not on the block library, and are checked again when the look comes back", () => {
  const compared = apply(packDraft("industrial"), [setLayout("products", "compare")]).draft;
  const onForge = apply(compared, [{ op: "set_visual_brief", briefId: "industrial" }]);
  assert.deepEqual(onForge.draft.blockVariants, { products: "compare" });
  assert.deepEqual(onForge.notices, []);
  const fewer = structuredClone(onForge.draft.products);
  fewer[1].specs = fewer[1].specs!.slice(0, 2);
  const edited = apply(onForge.draft, [{ op: "replace_products", products: fewer }]);
  assert.deepEqual(edited.draft.blockVariants, { products: "compare" }, "no check while the look cannot show it");
  const back = apply(edited.draft, [{ op: "set_visual_brief", briefId: "engineering-industrial" }]);
  assert.deepEqual(back.draft.blockVariants, {});
  assert.equal(back.notices.length, 1);
});

test("the model's layout requests are checked against the draft after its other changes; refusals and resets are explained", () => {
  const exportDraft = packDraft("export");
  const refused = validateAIOperations("产品改成参数对比表", [setLayout("products", "compare")], options.templateIds, exportDraft);
  assert.deepEqual(refused.operations, []);
  assert.equal(refused.notes.length, 1);
  assert.match(refused.notes[0], /只共有 2 项（额定压力、主体材质），产品仍按产品卡片显示。/);
  assert.ok(refused.rejected.includes(refused.notes[0]));

  const accepted = validateAIOperations("产品改成参数对比表", [setLayout("products", "compare")], options.templateIds, packDraft("industrial"));
  assert.deepEqual(accepted.operations, [setLayout("products", "compare")]);
  assert.deepEqual(accepted.notes, []);

  // Materials that arrive in the same answer count, whatever the order.
  const empty = applySiteOperations(structuredClone(defaultDraft), [{ op: "set_visual_brief", briefId: "engineering-industrial" }], options).draft;
  const products = packDraft("industrial").products;
  const materials = simulatedPacks.industrial.body;
  const together = validateAIOperations(materials, [setLayout("products", "compare"), { op: "replace_products", products }], options.templateIds, empty);
  assert.deepEqual(together.operations.map((operation) => operation.op), ["set_block_variant", "replace_products"]);

  const onForge = validateAIOperations("首屏换成大标题", [setLayout("hero", "statement")], options.templateIds, structuredClone(defaultDraft));
  assert.deepEqual(onForge.operations, []);
  assert.deepEqual(onForge.notes, ["当前样子还不能单独换首屏、产品或询盘的布局。"]);

  const unknown = validateAIOperations("换布局", [setLayout("products", "poster")], options.templateIds, packDraft("industrial"));
  assert.deepEqual(unknown.operations, []);
  assert.match(unknown.notes[0], /产品没有这种布局/);

  // A change that leaves the chosen layout short: accepted, and the reset is announced.
  const compared = apply(packDraft("industrial"), [setLayout("products", "compare")]).draft;
  const fewer = structuredClone(compared.products);
  fewer[1].specs = fewer[1].specs!.slice(0, 2);
  const reset = validateAIOperations(materials, [{ op: "replace_products", products: fewer }], options.templateIds, compared);
  assert.equal(reset.operations.length, 1);
  assert.match(reset.notes[0], /产品改回产品卡片。/);
  assert.equal(reset.rejected.some((item) => item.includes("产品改回产品卡片")), false, "a reset is not a refusal");

  // Without a draft (older callers) the request passes through to the commit check.
  assert.deepEqual(validateAIOperations("x", [setLayout("products", "compare")], options.templateIds).operations, [setLayout("products", "compare")]);
});

test("the model may send 24 operations at once; guided proposals keep up to 27", () => {
  const op = { op: "set_text", target: "hero.title", locale: "zh", value: "标题" };
  assert.equal(aiChangeSchema.safeParse({ summary: "s", operations: Array.from({ length: 24 }, () => op) }).success, true);
  assert.equal(aiChangeSchema.safeParse({ summary: "s", operations: Array.from({ length: 25 }, () => op) }).success, false);

  const started = applyAlignmentAction(disabledAlignment(), {
    action: "start",
    pendingRequest: { message: "ALIGN_UNIT_LIMIT_7301 generate", baseRevision: 1, selectedTarget: null },
  });
  assert.ok(started.ok && started.snapshot.currentQuestion);
  if (!started.ok || !started.snapshot.currentQuestion) throw new Error("expected a question");
  const chosen = applyAlignmentAction(started.snapshot, {
    action: "select",
    questionId: started.snapshot.currentQuestion.questionId,
    questionRevision: started.snapshot.currentQuestion.questionRevision,
    optionId: "engineering-industrial",
  });
  assert.ok(chosen.ok && chosen.runId);
  if (!chosen.ok || !chosen.runId) throw new Error("expected a run");
  const proposal = applyEditProposal(chosen.snapshot, {
    runId: chosen.runId,
    summary: "ALIGN_UNIT_LIMIT_SUMMARY_7301",
    operations: Array.from({ length: 27 }, (_, index) => ({ op: "set_text", target: "hero.title", locale: "zh", value: `T${index}` }) as SiteOperation),
    // Refusals are not shown one by one; the saved proposal keeps the first 20, each clipped.
    rejected: Array.from({ length: 30 }, (_, index) => `${"很长的说明".repeat(60)}${index}`),
    baseRevision: 1,
    model: "test",
    latencyMs: 1,
  });
  assert.equal("stale" in proposal, false);
  if ("stale" in proposal) throw new Error("expected a proposal");
  const saved = normalizeAlignmentSnapshot(JSON.parse(JSON.stringify(proposal.snapshot)));
  assert.equal(saved.proposedChange?.operations.length, 27);
  assert.equal(saved.proposedChange?.rejected.length, 20);
  assert.ok(saved.proposedChange?.rejected.every((item) => item.length <= 200));
});

test("the workspace names layout changes in page terms", () => {
  assert.equal(changeTargetLabel("blockVariants.hero"), "首屏布局");
  assert.equal(changeTargetLabel("blockVariants.products"), "产品布局");
  assert.equal(changeTargetLabel("blockVariants.contact"), "询盘布局");
  // A model summary that talks about variants is replaced by the page parts that changed.
  assert.equal(plainSummary("把产品变体改成 compare", [setLayout("products", "compare")]), "已更新：产品布局");
});
