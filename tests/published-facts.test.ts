import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { getTemplateAdapter } from "../lib/template-adapters/registry.ts";
import type { SiteDraft } from "../lib/site-document.ts";
import { ENTRY_SLOTS, expectedFacts, missingFacts, normalizeReadable } from "../scripts/published-facts.mjs";
import { packDraft } from "./fixtures/pack-drafts.ts";

// T-053 (Astra, review of 1c9d606): check-published only looked for catalog titles, so a renderer that
// dropped every product spec and the FAQ could still pass. It now takes the material facts from the
// draft, independently of the renderer, and looks for each one in the text a visitor can read (folded
// spec lists and answers opened): product names, descriptions and specs, as many FAQ entries and
// cooperation steps as the look has room for, every catalog entry (industries and capabilities with
// their bodies, certificates by name), and the contact email and phone.

const text = (value: string) => ({ zh: value, en: value });
const GAP = { zh: "待补充", en: "To be provided" };

function sampleDraft(): SiteDraft {
  const draft = packDraft("industrial");
  draft.products[0] = { ...draft.products[0], summary: text("按图加工的重载直角减速机，底脚或法兰安装。") };
  draft.products[1] = { ...draft.products[1], specs: [...(draft.products[1].specs ?? []), { name: text("润滑方式"), value: "待补充" }] };
  draft.products.push({ ...structuredClone(draft.products[1]), sku: "unnamed", name: GAP, summary: GAP, specs: [{ name: text("停产系列"), value: "F100" }] });
  // The FAQ entries with content sit after placeholders, the way add_card leaves them (T-053).
  draft.content.faq.items = [
    { id: "faq-1", title: GAP, body: GAP },
    { id: "moq", title: text("起订量多少？"), body: text("批量规格询盘 MOQ 20 台。") },
    { id: "faq-3", title: GAP, body: GAP },
    { id: "install", title: text("能否现场安装？"), body: GAP },
    { id: "drawing", title: text("要不要图纸？"), body: text("附图纸与规格要求。") },
    { id: "extra", title: text("第四条问答"), body: text("超出这个样子的问答条数，不显示。") },
  ];
  draft.content.services.items = [
    { id: "step-1", title: text("发送图纸"), body: text("附图纸与规格要求。") },
    { id: "step-2", title: GAP, body: GAP },
    { id: "step-3", title: GAP, body: GAP },
  ];
  draft.content.capabilities = { title: text("加工能力与主设备"), intro: GAP, items: [
    { id: "cap-1", title: text("滚齿与磨齿"), body: text("齿轮滚齿后磨齿，出厂前跑合。") },
    { id: "cap-2", title: text("箱体数控镗铣"), body: GAP },
  ] };
  draft.content.certifications = { title: text("认证状态"), intro: GAP, items: [
    { id: "iso", title: text("ISO 9001"), body: text("认证中"), status: "认证中" },
    { id: "ce", title: text("CE"), body: text("资料待补"), status: "待补充" },
  ] };
  return draft;
}

const has = (facts: Array<{ kind: string; text: string }>, kind: string, value: string) => facts.some((fact) => fact.kind === kind && fact.text === value);

test("the facts come from the draft: products and their specs, entries the look shows, catalogs and contact", () => {
  const facts = expectedFacts(sampleDraft());
  for (const [kind, value] of [
    ["product name", "直角减速机"], ["product name", "行星减速机"],
    ["product description", "按图加工的重载直角减速机，底脚或法兰安装。"],
    ["spec name", "速比范围"], ["spec value", "i=25–100"], ["spec value", "≤1500 r/min"], ["spec value", "底脚/法兰"], ["spec value", "IP65"],
    ["FAQ question", "起订量多少？"], ["FAQ answer", "批量规格询盘 MOQ 20 台。"], ["FAQ question", "能否现场安装？"], ["FAQ question", "要不要图纸？"],
    ["step title", "发送图纸"], ["step body", "附图纸与规格要求。"],
    ["industries entry", "矿山输送"], ["capabilities entry", "滚齿与磨齿"], ["capabilities body", "齿轮滚齿后磨齿，出厂前跑合。"], ["capabilities entry", "箱体数控镗铣"],
    ["certifications entry", "ISO 9001"],
    ["contact email", "inquiry@p3i-sim.test"],
  ]) assert.ok(has(facts, kind, value), `expected ${kind} "${value}"`);
  const texts = facts.map((fact) => fact.text);
  for (const absent of ["待补充", "To be provided", "润滑方式", "停产系列", "第四条问答", "超出这个样子的问答条数，不显示。", "认证中", "CE", "资料待补"]) {
    assert.ok(!texts.includes(absent), `not expected: ${absent}`);
  }
  assert.ok(!facts.some((fact) => fact.kind === "certifications body"), "certificates are badges: name and status");
});

test("sections the draft hides are not expected", () => {
  const draft = sampleDraft();
  draft.hiddenSections = ["faq", "services", "capabilities"];
  const kinds = new Set(expectedFacts(draft).map((fact) => fact.kind));
  for (const kind of ["FAQ question", "FAQ answer", "step title", "step body", "capabilities entry", "capabilities body"]) assert.ok(!kinds.has(kind), kind);
  assert.ok(kinds.has("spec value") && kinds.has("industries entry"));
  draft.hiddenSections = ["products"];
  assert.ok(!expectedFacts(draft).some((fact) => fact.kind.startsWith("product") || fact.kind.startsWith("spec")));
});

test("each look's FAQ and step entries match its adapter", () => {
  for (const id of ["screwfast", "forge", "landwind", "tailwind-landing"] as const) {
    const adapter = getTemplateAdapter(id);
    assert.ok(adapter, id);
    const entries = (group: string) => adapter.slots.filter((slot) => new RegExp(`^${group}\\.items\\.\\d+\\.title$`).test(slot.target)).length;
    assert.deepEqual(ENTRY_SLOTS[id], { faq: entries("faq"), services: entries("services") }, id);
  }
});

test("a page that dropped the specs and the FAQ but kept the catalog titles is caught", () => {
  const facts = expectedFacts(sampleDraft());
  const full = facts.map((fact) => fact.text).join(" ");
  assert.deepEqual(missingFacts(facts, full), []);
  const dropped = facts.filter((fact) => !fact.kind.startsWith("spec") && !fact.kind.startsWith("FAQ")).map((fact) => fact.text).join(" ");
  const missing = missingFacts(facts, dropped);
  assert.ok(missing.some((fact) => fact.kind === "spec value" && fact.text === "8500 N·m"));
  assert.ok(missing.some((fact) => fact.kind === "FAQ answer"));
  assert.ok(missing.every((fact) => fact.kind.startsWith("spec") || fact.kind.startsWith("FAQ")), JSON.stringify(missing.slice(0, 3)));
});

test("break marks and line breaks on the page do not hide a fact", () => {
  const facts = [{ kind: "spec value", text: "S136/H13/NAK80" }, { kind: "contact email", text: "rfq@p3t-sim.test" }, { kind: "spec value", text: "8500 N·m" }];
  const page = normalizeReadable("模具钢材 S136/\u200bH13/\u200bNAK80\n邮箱 rfq\u200b@\u200bp3t-\u2060sim.test 扭矩 8500\n N·m");
  assert.deepEqual(missingFacts(facts, page), []);
  assert.deepEqual(missingFacts([{ kind: "spec value", text: "S136/H13" }], "S136 H13"), [{ kind: "spec value", text: "S136/H13" }]);
});

test("check-published reads the page with folded text opened and fails on missing facts", () => {
  const check = readFileSync(new URL("../scripts/check-published.mjs", import.meta.url), "utf8");
  assert.match(check, /from "\.\/published-facts\.mjs"/);
  assert.match(check, /visitor-readable-text\.js/);
  assert.ok(check.includes("material facts missing from the page"));
  const scan = readFileSync(new URL("../scripts/visitor-readable-text.js", import.meta.url), "utf8");
  assert.match(scan, /details:not\(\[open\]\)/, "folded spec lists and answers are opened");
  assert.match(scan, /closest\("header"\)/, "the header menu stays closed");
  assert.match(scan, /createTreeWalker\(root, NodeFilter\.SHOW_TEXT\)/, "text nodes, so text-transform does not change the text");
  assert.doesNotMatch(scan, /innerText/);
});
