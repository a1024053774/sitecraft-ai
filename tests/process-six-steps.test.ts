import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { servicesFragment } from "../lib/blocks/fragments/sections.ts";
import { defaultDraft, type SiteDraft } from "../lib/site-document.ts";
import { validateAIOperations } from "../lib/site-operations.ts";
import { installPreviewBridge } from "../lib/template-adapters/preview-bridge.ts";
import { getTemplateAdapter } from "../lib/template-adapters/registry.ts";
import { ENTRY_SLOTS, expectedFacts } from "../scripts/published-facts.mjs";
import { parseHtmlDocument, parseHtmlFragment, visibleText } from "./fixtures/html-dom.ts";
import { servedHomeHtml, withoutTemplates } from "./fixtures/look-pages.ts";
import { packDraft } from "./fixtures/pack-drafts.ts";

// T-059 (owner, 2026-09-30): the molding materials list five quality-control steps and the model wrote
// all five as cooperation steps, but the engineering page had three step slots. The steps block now
// has six (empty entries are not shown), check-published expects what the page shows, the model is
// told how many steps the look shows and writes at most six.

const envKeys = ["DEEPSEEK_API_KEY", "DEEPSEEK_MODEL", "DEEPSEEK_BASE_URL", "DEEPSEEK_MAX_TOKENS", "AI_API_KEY", "AI_MODEL", "AI_BASE_URL"] as const;
const previousEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
const writeEnv = (key: string, value: string | undefined) => {
  const env = process.env as Record<string, string | undefined>;
  if (value === undefined) delete env[key];
  else env[key] = value;
};
writeEnv("DEEPSEEK_API_KEY", "sk-test-process-six-not-real");
writeEnv("DEEPSEEK_MODEL", "test-process-six-model");
writeEnv("DEEPSEEK_BASE_URL", "https://process-six-stub.test.invalid");
for (const key of ["DEEPSEEK_MAX_TOKENS", "AI_API_KEY", "AI_MODEL", "AI_BASE_URL"]) writeEnv(key, undefined);
let lastBody = "";
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (!url.startsWith("https://process-six-stub.test.invalid/")) throw new Error(`refusing unexpected fetch ${url}`);
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
const STEPS = ["来料检验", "试模后首件全尺寸检测", "过程巡检", "外观与功能全检", "出货抽检"];
const steps = (count = STEPS.length) => STEPS.slice(0, count).map((title, index) => ({ id: `step-${index + 1}`, title: text(title), body: text(`${title}的做法。`) }));

function shownSteps(draft: SiteDraft) {
  const adapter = getTemplateAdapter("screwfast");
  assert.ok(adapter);
  const document = parseHtmlDocument(servedHomeHtml("screwfast"));
  const globalObject: Record<string, unknown> = { document, parent: { postMessage() {} }, addEventListener() {} };
  globalObject.window = globalObject;
  installPreviewBridge(globalObject, "screwfast", adapter).applyDeclaredContent({ ...draft, templateId: "screwfast" }, "zh", [], "published");
  return document.querySelectorAll(".sitecraft-process-card").filter((card) => !card.hidden).map((card) => visibleText(card.querySelector("h3")!).trim());
}

test("the engineering steps block has six entries, each declared once", () => {
  assert.equal(parseHtmlFragment(servicesFragment.variants.steps).querySelectorAll(".sitecraft-process-card").length, 6);
  const page = parseHtmlDocument(withoutTemplates(servedHomeHtml("screwfast")));
  const adapter = getTemplateAdapter("screwfast");
  assert.ok(adapter);
  for (let index = 0; index < 6; index += 1) {
    for (const part of ["title", "body"] as const) {
      assert.equal(page.querySelectorAll(`[data-sitecraft-benchmark="services-item-${index}-${part}"]`).length, 1, `step ${index} ${part}`);
      assert.equal(adapter.slots.filter((slot) => slot.target === `services.items.${index}.${part}`).length, 1, `step ${index} ${part} declared`);
    }
  }
});

test("five steps all reach the page; an empty sixth entry does not", () => {
  const draft = packDraft("molding");
  draft.content.services.items = [...steps(), { id: "step-6", title: GAP, body: GAP }];
  assert.deepEqual(shownSteps(draft), STEPS);
  const three = packDraft("industrial");
  three.content.services.items = steps(3);
  assert.deepEqual(shownSteps(three), STEPS.slice(0, 3), "three steps render as before");
});

test("check-published expects the steps the engineering page shows", () => {
  assert.equal(ENTRY_SLOTS.screwfast.services, 6);
  const draft = packDraft("molding");
  draft.content.services.items = steps();
  assert.equal(expectedFacts(draft).filter((fact) => fact.kind === "step title").length, 5);
});

test("the model is told how many steps the look shows, and writes at most six", async () => {
  await requestStructuredOperations({ message: "看看现在的页面", draft: { ...structuredClone(defaultDraft), templateId: "screwfast" }, templateId: "screwfast" });
  const system = String((JSON.parse(lastBody) as { messages: Array<{ role: string; content: string }> }).messages.find((item) => item.role === "system")?.content ?? "");
  assert.ok(system.includes("合作方式：当前样子的访客页最多显示 6 步"), "the steps line");
  const eight = [...steps(), ...steps(3).map((item) => ({ ...item, id: `${item.id}-b` }))];
  const clipped = validateAIOperations("资料", [{ op: "replace_cards", section: "services", items: eight } as never], new Set(["screwfast"]));
  assert.equal((clipped.operations[0] as unknown as { items: unknown[] }).items.length, 6);
  assert.ok(clipped.rejected.includes("合作方式最多写 6 步，其余 2 步没有写入"), JSON.stringify(clipped.rejected));
});
