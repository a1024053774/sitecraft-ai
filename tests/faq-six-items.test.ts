import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { faqFragment } from "../lib/blocks/fragments/sections.ts";
import { defaultDraft, type SiteDraft } from "../lib/site-document.ts";
import { installPreviewBridge } from "../lib/template-adapters/preview-bridge.ts";
import { getTemplateAdapter } from "../lib/template-adapters/registry.ts";
import { ENTRY_SLOTS, expectedFacts } from "../scripts/published-facts.mjs";
import { HtmlDocument, parseHtmlDocument, parseHtmlFragment, visibleText } from "./fixtures/html-dom.ts";
import { servedHomeHtml, withoutTemplates } from "./fixtures/look-pages.ts";
import { packDraft } from "./fixtures/pack-drafts.ts";

// T-059: a draft carries six FAQ entries, and the molding materials have five questions, but the
// engineering page had three FAQ slots, so two answers never reached visitors. The block-library FAQ
// now has six entries (an empty entry is not shown, and a FAQ with no answers is hidden), and the
// model is told how many entries the current look shows.

const envKeys = ["DEEPSEEK_API_KEY", "DEEPSEEK_MODEL", "DEEPSEEK_BASE_URL", "DEEPSEEK_MAX_TOKENS", "AI_API_KEY", "AI_MODEL", "AI_BASE_URL"] as const;
const previousEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
const writeEnv = (key: string, value: string | undefined) => {
  const env = process.env as Record<string, string | undefined>;
  if (value === undefined) delete env[key];
  else env[key] = value;
};
writeEnv("DEEPSEEK_API_KEY", "sk-test-faq-six-not-real");
writeEnv("DEEPSEEK_MODEL", "test-faq-six-model");
writeEnv("DEEPSEEK_BASE_URL", "https://faq-six-stub.test.invalid");
for (const key of ["DEEPSEEK_MAX_TOKENS", "AI_API_KEY", "AI_MODEL", "AI_BASE_URL"]) writeEnv(key, undefined);
let lastBody = "";
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (!url.startsWith("https://faq-six-stub.test.invalid/")) throw new Error(`refusing unexpected fetch ${url}`);
  lastBody = typeof init?.body === "string" ? init.body : "";
  return new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ type: "answer", text: "ok" }) } }] }), { status: 200, headers: { "Content-Type": "application/json" } });
};
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (!specifier.startsWith("@/")) return nextResolve(specifier, context);
    const abs = path.join(process.cwd(), specifier.slice(2));
    let file = abs;
    if (existsSync(`${abs}.ts`)) file = `${abs}.ts`;
    else if (existsSync(path.join(abs, "index.ts"))) file = path.join(abs, "index.ts");
    return nextResolve(pathToFileURL(file).href, context);
  },
});
const { requestStructuredOperations } = await import("../lib/ai-provider.ts");
test.after(() => {
  globalThis.fetch = originalFetch;
  for (const key of envKeys) writeEnv(key, previousEnv[key]);
});

const text = (value: string) => ({ zh: value, en: value });
const GAP = { zh: "待补充", en: "To be provided" };
const MOLDING_QA: Array<[string, string]> = [
  ["没有图纸只有样品能开模吗？", "可以，先做 3D 扫描和逆向建模，图纸确认后再开模。"],
  ["开模周期多久？", "单腔模具约 25–35 天，多腔热流道和双色模具约 40–55 天，从图纸确认开始计。"],
  ["试模样品怎么提供？", "T1 试模后 3 天内寄出样品和全尺寸检测报告，每套模具含 3 次试模。"],
  ["模具归谁所有？", "模具费付清后模具归买方所有，可存放在本厂用于批量生产。"],
  ["出口订单用什么贸易条款？", "常用 FOB 宁波和 EXW，也可按订单约定 CIF。"],
];

function render(templateId: string, draft: SiteDraft, variant = "published") {
  const adapter = getTemplateAdapter(templateId);
  assert.ok(adapter, templateId);
  const document = parseHtmlDocument(servedHomeHtml(templateId));
  const globalObject: Record<string, unknown> = { document, parent: { postMessage() {} }, addEventListener() {} };
  globalObject.window = globalObject;
  const report = installPreviewBridge(globalObject, templateId, adapter).applyDeclaredContent({ ...draft, templateId }, "zh", [], variant);
  return { document, report };
}
const shownFaq = (document: HtmlDocument) => document.querySelectorAll(".sitecraft-faq-item")
  .filter((item) => !item.hidden && item.getAttribute("data-sitecraft-entry-hidden") !== "true")
  .map((item) => [visibleText(item.querySelector("summary")!).trim(), visibleText(item.querySelector(".sitecraft-faq-answer")!).trim()]);

test("the engineering FAQ has six entries, each declared once", () => {
  const fragment = parseHtmlFragment(faqFragment.variants.accordion);
  assert.equal(fragment.querySelectorAll(".sitecraft-faq-item").length, 6);
  const page = parseHtmlDocument(withoutTemplates(servedHomeHtml("screwfast")));
  const adapter = getTemplateAdapter("screwfast");
  assert.ok(adapter);
  for (let index = 0; index < 6; index += 1) {
    for (const part of ["title", "body"] as const) {
      assert.equal(page.querySelectorAll(`[data-sitecraft-benchmark="faq-item-${index}-${part}"]`).length, 1, `faq ${index} ${part} on the page`);
      assert.equal(adapter.slots.filter((slot) => slot.target === `faq.items.${index}.${part}`).length, 1, `faq ${index} ${part} declared`);
    }
  }
  assert.equal(adapter.slots.some((slot) => slot.target === "faq.items.6.title"), false);
});

test("five questions from the materials all reach the page; the sixth, empty entry does not", () => {
  const draft = packDraft("molding");
  draft.content.faq.items = [...MOLDING_QA.map(([q, a], index) => ({ id: `qa-${index}`, title: text(q), body: text(a) })), { id: "faq-6", title: GAP, body: GAP }];
  const { document } = render("screwfast", draft);
  assert.deepEqual(shownFaq(document), MOLDING_QA);
  assert.equal(document.querySelectorAll(".sitecraft-faq-item").length, 6);
});

test("five questions added after the six empty entries (add_card) show the same way", () => {
  const draft = packDraft("molding");
  draft.content.faq.items = [
    ...structuredClone(defaultDraft.content.faq.items),
    ...MOLDING_QA.map(([q, a], index) => ({ id: `qa-${index}`, title: text(q), body: text(a) })),
  ];
  const { document, report } = render("screwfast", draft);
  assert.deepEqual(shownFaq(document), MOLDING_QA);
  assert.ok(report.appliedSlots.includes("faq.items.10.title.zh"), "the fifth question keeps its own index");
});

test("materials without questions leave no FAQ shell", () => {
  for (const pack of ["industrial", "export"] as const) {
    const draft = packDraft(pack);
    draft.content.faq.items = structuredClone(defaultDraft.content.faq.items);
    const { document } = render("screwfast", draft);
    const section = document.querySelector('[data-sitecraft-section="faq"]');
    assert.ok(section, pack);
    assert.ok(section.hidden || section.getAttribute("data-sitecraft-section-hidden") === "true", `${pack}: the FAQ section is hidden`);
    assert.deepEqual(shownFaq(document), [], pack);
  }
});

test("check-published expects as many FAQ entries as the engineering page shows", () => {
  assert.equal(ENTRY_SLOTS.screwfast.faq, 6);
  const draft = packDraft("molding");
  draft.content.faq.items = MOLDING_QA.map(([q, a], index) => ({ id: `qa-${index}`, title: text(q), body: text(a) }));
  const facts = expectedFacts(draft);
  assert.equal(facts.filter((fact) => fact.kind === "FAQ question").length, 5);
  assert.equal(facts.filter((fact) => fact.kind === "FAQ answer").length, 5);
});

test("the model is told how many FAQ entries the current look shows", async () => {
  const slots: Record<string, number> = {};
  for (const templateId of ["screwfast", "forge", "landwind", "tailwind-landing"]) {
    const adapter = getTemplateAdapter(templateId);
    assert.ok(adapter, templateId);
    slots[templateId] = adapter.slots.filter((slot) => /^faq\.items\.\d+\.title$/.test(slot.target)).length;
    const draft = { ...structuredClone(defaultDraft), templateId };
    await requestStructuredOperations({ message: "看看现在的页面", draft, templateId });
    const system = String((JSON.parse(lastBody) as { messages: Array<{ role: string; content: string }> }).messages.find((item) => item.role === "system")?.content ?? "");
    assert.ok(system.includes(`常见问题：当前样子的访客页最多显示 ${slots[templateId]} 条`), `${templateId}: ${slots[templateId]} entries`);
  }
  assert.deepEqual(slots, { screwfast: 6, forge: 6, landwind: 6, "tailwind-landing": 3 });
});
