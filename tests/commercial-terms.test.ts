import assert from "node:assert/strict";
import test from "node:test";
import { defaultDraft, siteDraftSchema } from "../lib/site-document.ts";
import { applySiteOperations, validateAIOperations } from "../lib/site-operations.ts";
import { expectedFacts, missingFacts } from "../scripts/published-facts.mjs";
import { composedPageForTemplate } from "../lib/blocks/compose.ts";
import { getTemplateAdapter } from "../lib/template-adapters/registry.ts";
import { installPreviewBridge } from "../lib/template-adapters/preview-bridge.ts";
import { parseHtmlDocument, visibleText } from "./fixtures/html-dom.ts";
import { simulatedPacks } from "../lib/simulated-packs.ts";

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
    terms: [{ id: "trade-terms", kind: "trade_terms", value: localized("FOB 宁波、EXW、CIF", "FOB Ningbo, EXW, CIF") }],
  } as never], options.templateIds, withTerms([]));
  assert.equal(checked.operations.length, 1);
  assert.deepEqual((checked.operations[0] as never as { terms: Array<{ id: string }> }).terms.map((term) => term.id), ["trade-terms"]);
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
