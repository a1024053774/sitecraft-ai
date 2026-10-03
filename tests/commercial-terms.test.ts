import assert from "node:assert/strict";
import test from "node:test";
import { defaultDraft, siteDraftSchema } from "../lib/site-document.ts";
import { applySiteOperations, validateAIOperations } from "../lib/site-operations.ts";
import { expectedFacts, missingFacts } from "../scripts/published-facts.mjs";
import { composedPageForTemplate } from "../lib/blocks/compose.ts";
import { getTemplateAdapter } from "../lib/template-adapters/registry.ts";
import { installPreviewBridge } from "../lib/template-adapters/preview-bridge.ts";
import { parseHtmlDocument, visibleText } from "./fixtures/html-dom.ts";
import { simulatedPacks, wrapCompanyMaterials } from "../lib/simulated-packs.ts";

const options = { templateIds: new Set(["forge", "screwfast", "landwind", "tailwind-landing"]), lastChange: "commercial terms" };
const localized = (zh: string, en: string) => ({ zh, en });
const moq = { id: "moq-1", kind: "moq", value: localized("20 台", "20 units") };
const leadTime = { id: "lead-1", kind: "lead_time", value: localized("询盘后确认，没有具体天数", "Confirmed after inquiry; no fixed number of days") };

function withTerms(terms: unknown[]) {
  return {
    ...structuredClone(defaultDraft),
    content: { ...structuredClone(defaultDraft.content), commercialTerms: terms },
  } as never;
}

test("commercial terms schema rejects a kind outside the fixed dictionary", () => {
  const candidate = withTerms([{ id: "x", kind: "discount", value: localized("9%", "9%") }]);
  const parsed = siteDraftSchema.safeParse(candidate);
  assert.equal(parsed.success, false, "unknown commercial term kinds must not be silently stripped");
});

test("commercial term operations replace, update and remove by stable id and undo exactly", () => {
  const before = structuredClone(defaultDraft) as never;
  const replaced = applySiteOperations(before, [{ op: "replace_commercial_terms", terms: [moq, leadTime] } as never], options);
  assert.deepEqual((replaced.draft as never as { content: { commercialTerms: unknown[] } }).content.commercialTerms, [moq, leadTime]);

  const updated = applySiteOperations(replaced.draft, [{ op: "update_commercial_term", termId: "moq-1", value: localized("30 台", "30 units") } as never], options);
  assert.equal((updated.draft as never as { content: { commercialTerms: typeof moq[] } }).content.commercialTerms[0].value.zh, "30 台");

  const removed = applySiteOperations(updated.draft, [{ op: "remove_commercial_term", termId: "lead-1" } as never], options);
  assert.deepEqual((removed.draft as never as { content: { commercialTerms: unknown[] } }).content.commercialTerms.map((item) => (item as { id: string }).id), ["moq-1"]);
  const restored = applySiteOperations(removed.draft, removed.inverseOperations, options);
  assert.deepEqual((restored.draft as never as { content: { commercialTerms: unknown[] } }).content.commercialTerms, (updated.draft as never as { content: { commercialTerms: unknown[] } }).content.commercialTerms);
});

test("updating a commercial term cannot duplicate an existing kind", () => {
  const before = applySiteOperations(structuredClone(defaultDraft) as never, [{ op: "replace_commercial_terms", terms: [moq, leadTime] } as never], options).draft;
  const conflict = { op: "update_commercial_term", termId: "lead-1", kind: "moq", value: leadTime.value } as never;
  assert.throws(() => applySiteOperations(before, [conflict], options), /unique|kind/i);
  const checked = validateAIOperations("资料：MOQ 20 台；交期：询盘后确认，没有具体天数。把交期种类改成起订量。", [conflict], options.templateIds, before);
  assert.deepEqual(checked.operations, []);
  assert.match(checked.rejected.join(" "), /种类|重复|kind|unique/i);
});

test("commercial term grounding rejects a material-invented number in either language", () => {
  const checked = validateAIOperations("公司资料：MOQ：20 台。", [{
    op: "replace_commercial_terms",
    terms: [{ id: "moq-1", kind: "moq", value: localized("20 台", "20 units and 999 cartons") }],
  } as never], options.templateIds, withTerms([]));
  assert.deepEqual(checked.operations, []);
  assert.match(checked.rejected.join(" "), /资料|数字|商业条款/);
});

test("commercial term values reject a gap marker in either language", () => {
  const candidate = withTerms([{ id: "moq-1", kind: "moq", value: localized("20 台", "To be provided") }]);
  assert.equal(siteDraftSchema.safeParse(candidate).success, false);
  const checked = validateAIOperations("公司资料：MOQ：20 台。", [{
    op: "replace_commercial_terms",
    terms: [{ id: "moq-1", kind: "moq", value: localized("20 台", "To be provided") }],
  } as never], options.templateIds, withTerms([]));
  assert.deepEqual(checked.operations, []);
});

test("trade terms survive a faithful wording change when the material facts are all present", () => {
  const checked = validateAIOperations(simulatedPacks.molding.body, [{
    op: "replace_commercial_terms",
    terms: [{ id: "trade-terms", kind: "trade_terms", value: localized("常用 FOB 宁波和 EXW，也可按订单约定 CIF", "FOB Ningbo and EXW are common; CIF by agreement") }],
  } as never], options.templateIds, withTerms([]));
  assert.equal(checked.operations.length, 1);
  assert.deepEqual((checked.operations[0] as never as { terms: Array<{ id: string }> }).terms.map((term) => term.id), ["trade-terms"]);
});

test("the four commercial terms in the molding materials remain grounded", () => {
  const terms = [
    { id: "moq", kind: "moq", value: localized("注塑件 5000 件起；模具单套起接", "Molded parts from 5,000 pcs; molds from one set") },
    { id: "lead", kind: "lead_time", value: localized("模具 25–55 天；批量注塑件在模具确认后 15–20 天", "Molds 25–55 days; volume molded parts 15–20 days after mold approval") },
    { id: "capacity", kind: "capacity", value: localized("模具年产约 180 套；注塑机 42 台（90–800 t），月注塑能力约 600 万件", "About 180 molds per year; 42 injection machines (90–800 t), about 6 million parts per month") },
    { id: "trade", kind: "trade_terms", value: localized("常用 FOB 宁波和 EXW，也可按订单约定 CIF", "FOB Ningbo and EXW are common; CIF by agreement") },
  ];
  const checked = validateAIOperations(simulatedPacks.molding.body, [{ op: "replace_commercial_terms", terms } as never], options.templateIds, withTerms([]));
  assert.equal(checked.operations.length, 1);
  assert.deepEqual((checked.operations[0] as never as { terms: Array<{ kind: string }> }).terms.map((term) => term.kind), ["moq", "lead_time", "capacity", "trade_terms"]);
});

test("commercial terms reject cross-fact FOB and MOQ number splicing", () => {
  const checked = validateAIOperations(simulatedPacks.molding.body, [{
    op: "replace_commercial_terms",
    terms: [{ id: "bad-fob", kind: "trade_terms", value: localized("FOB 5000", "FOB 5,000") }],
  } as never], options.templateIds, withTerms([]));
  assert.deepEqual(checked.operations, []);
});

test("commercial terms reject a trade term paired with a company-name place", () => {
  const checked = validateAIOperations(simulatedPacks.molding.body, [{
    op: "replace_commercial_terms",
    terms: [{ id: "bad-place", kind: "trade_terms", value: localized("FOB 宁海", "FOB Ninghai") }],
  } as never], options.templateIds, withTerms([]));
  assert.deepEqual(checked.operations, []);
});

test("commercial terms reject a trade term paired with capacity numbers", () => {
  const checked = validateAIOperations(simulatedPacks.molding.body, [{
    op: "replace_commercial_terms",
    terms: [{ id: "bad-capacity", kind: "trade_terms", value: localized("EXW 180 套", "EXW 180 sets") }],
  } as never], options.templateIds, withTerms([]));
  assert.deepEqual(checked.operations, []);
});

test("commercial terms reject a trade term paired with monthly capacity", () => {
  const checked = validateAIOperations(simulatedPacks.molding.body, [{
    op: "replace_commercial_terms",
    terms: [{ id: "bad-monthly", kind: "trade_terms", value: localized("CIF 600 万件", "CIF 6 million parts") }],
  } as never], options.templateIds, withTerms([]));
  assert.deepEqual(checked.operations, []);
});

test("commercial terms ignore wrapper instructions when checking a payment fact", () => {
  const checked = validateAIOperations(wrapCompanyMaterials(simulatedPacks.molding.body), [{
    op: "replace_commercial_terms",
    terms: [{ id: "instruction-payment", kind: "payment", value: localized("付款方式：EXW", "Payment: EXW") }],
  } as never], options.templateIds, withTerms([]));
  assert.deepEqual(checked.operations, []);
});

test("commercial terms reject English-only trade and payment additions", () => {
  const trade = validateAIOperations(simulatedPacks.molding.body, [{
    op: "replace_commercial_terms",
    terms: [{ id: "trade-en-extra", kind: "trade_terms", value: localized("常用 FOB 宁波和 EXW，也可按订单约定 CIF", "FOB Ningbo, EXW, DAP and payment T/T") }],
  } as never], options.templateIds, withTerms([]));
  assert.deepEqual(trade.operations, []);
});

test("an exact trade sentence cannot be stored as payment", () => {
  const checked = validateAIOperations(simulatedPacks.molding.body, [{
    op: "replace_commercial_terms",
    terms: [{ id: "payment-trade", kind: "payment", value: localized("常用 FOB 宁波和 EXW，也可按订单约定 CIF", "FOB Ningbo and EXW are common; CIF by agreement") }],
  } as never], options.templateIds, withTerms([]));
  assert.deepEqual(checked.operations, []);
});

test("a capacity value cannot combine the machine range with the monthly output range", () => {
  const checked = validateAIOperations(simulatedPacks.molding.body, [{
    op: "replace_commercial_terms",
    terms: [{ id: "capacity-mixed", kind: "capacity", value: localized("注塑机 42 台（90–800 t），月注塑能力约 90–800 万件", "42 injection machines (90–800 t), about 90–800 million parts per month") }],
  } as never], options.templateIds, withTerms([]));
  assert.deepEqual(checked.operations, []);
});

test("commercial terms reject a truncated negative lead-time clause", () => {
  const checked = validateAIOperations(simulatedPacks.export.body, [{
    op: "replace_commercial_terms",
    terms: [{ id: "truncated-lead", kind: "lead_time", value: localized("具体天数", "specific days") }],
  } as never], options.templateIds, withTerms([]));
  assert.deepEqual(checked.operations, []);
});

test("commercial terms reject a translated unit that is absent from the Chinese value", () => {
  const checked = validateAIOperations(simulatedPacks.molding.body, [{
    op: "replace_commercial_terms",
    terms: [{ id: "wrong-unit", kind: "moq", value: localized("注塑件 5000 件起；模具单套起接", "Molded parts from 5,000 kg; molds from one set") }],
  } as never], options.templateIds, withTerms([]));
  assert.deepEqual(checked.operations, []);
});

test("commercial terms reject weeks when the Chinese lead time says days", () => {
  const checked = validateAIOperations(simulatedPacks.molding.body, [{
    op: "replace_commercial_terms",
    terms: [{ id: "wrong-week", kind: "lead_time", value: localized("模具 25–55 天；批量注塑件在模具确认后 15–20 天", "Molds 25–55 weeks; volume molded parts 15–20 weeks after mold approval") }],
  } as never], options.templateIds, withTerms([]));
  assert.deepEqual(checked.operations, []);
});

test("commercial term codes are compared case-insensitively", () => {
  const checked = validateAIOperations(simulatedPacks.molding.body, [{
    op: "replace_commercial_terms",
    terms: [{ id: "lower-dap", kind: "trade_terms", value: localized("常用 FOB 宁波和 EXW，也可按订单约定 CIF", "FOB Ningbo, EXW, dap") }],
  } as never], options.templateIds, withTerms([]));
  assert.deepEqual(checked.operations, []);
});

test("kind context cannot leak from a later sentence on the same source line", () => {
  const checked = validateAIOperations("产能：100 套。付款方式：T/T", [{
    op: "replace_commercial_terms",
    terms: [{ id: "borrowed-context", kind: "payment", value: localized("100 套", "100 sets") }],
  } as never], options.templateIds, withTerms([]));
  assert.deepEqual(checked.operations, []);
});

test("commercial term codes reject an ungrounded uppercase CNY code", () => {
  const checked = validateAIOperations(simulatedPacks.molding.body, [{
    op: "replace_commercial_terms",
    terms: [{ id: "cny-code", kind: "trade_terms", value: localized("常用 FOB 宁波和 EXW，也可按订单约定 CIF", "FOB Ningbo, EXW, CNY") }],
  } as never], options.templateIds, withTerms([]));
  assert.deepEqual(checked.operations, []);
});

test("commercial term codes reject an ungrounded lowercase rmb code", () => {
  const checked = validateAIOperations(simulatedPacks.molding.body, [{
    op: "replace_commercial_terms",
    terms: [{ id: "rmb-code", kind: "trade_terms", value: localized("常用 FOB 宁波和 EXW，也可按订单约定 CIF", "FOB Ningbo, EXW, rmb") }],
  } as never], options.templateIds, withTerms([]));
  assert.deepEqual(checked.operations, []);
});

test("commercial term validation drops empty and material-invented numeric values", () => {
  const message = "公司资料：MOQ：20 台。交期：询盘后确认，没有具体天数。";
  const checked = validateAIOperations(message, [
    { op: "replace_commercial_terms", terms: [
      moq,
      { ...leadTime, value: localized("询盘后确认，没有具体天数", "Confirmed after inquiry; no fixed number of days") },
      { id: "bad", kind: "capacity", value: localized("999 台", "999 units") },
      { id: "empty", kind: "payment", value: localized(" ", " ") },
    ] } as never,
  ], options.templateIds, withTerms([]));
  assert.deepEqual(checked.operations[0] && (checked.operations[0] as never as { terms: unknown[] }).terms.map((term) => (term as { id: string }).id), ["moq-1", "lead-1"]);
  assert.match(checked.rejected.join(" "), /资料|空|数字/);
});

test("published facts include every commercial term value and report a missing value", () => {
  const draft = withTerms([moq, leadTime]);
  const facts = expectedFacts(draft, "zh");
  assert.deepEqual(facts.filter((fact: { kind: string }) => fact.kind === "commercial term value").map((fact: { text: string }) => fact.text), ["20 台", "询盘后确认，没有具体天数"]);
  assert.deepEqual(missingFacts(facts, "20 台"), [{ kind: "commercial term value", text: "询盘后确认，没有具体天数" }]);
});

test("commercial terms block is hidden without entries and renders one value slot per entry", () => {
  const html = composedPageForTemplate("forge");
  assert.ok(html);
  const adapter = getTemplateAdapter("forge");
  assert.ok(adapter);
  const emptyDocument = parseHtmlDocument(html);
  const globalObject: Record<string, unknown> = { document: emptyDocument, parent: { postMessage() {} }, addEventListener() {} };
  globalObject.window = globalObject;
  installPreviewBridge(globalObject, "forge", adapter!).applyDeclaredContent(defaultDraft, "zh", [], "published");
  const emptySection = emptyDocument.querySelector('[data-sitecraft-section="commercialTerms"]');
  assert.ok(emptySection);
  assert.equal(emptySection.getAttribute("data-sitecraft-section-hidden"), "true");

  const document = parseHtmlDocument(html);
  const secondGlobal: Record<string, unknown> = { document, parent: { postMessage() {} }, addEventListener() {} };
  secondGlobal.window = secondGlobal;
  installPreviewBridge(secondGlobal, "forge", adapter!).applyDeclaredContent(withTerms([moq, leadTime]), "zh", [], "published");
  const section = document.querySelector('[data-sitecraft-section="commercialTerms"]');
  assert.ok(section);
  assert.equal(section.getAttribute("data-sitecraft-section-hidden"), null);
  assert.equal(document.querySelectorAll('[data-sitecraft-slot="commercialTerms.items.moq-1.value.zh"]').length, 1);
  assert.equal(document.querySelectorAll('[data-sitecraft-slot="commercialTerms.items.lead-1.value.zh"]').length, 1);
  assert.match(visibleText(section), /20 台/);
});
