import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import { registerHooks } from "node:module";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { defaultDraft, type SiteDraft } from "../lib/site-document.ts";
import { applySiteOperations, siteOperationSchema, validateAIOperations, type SiteOperation } from "../lib/site-operations.ts";
import { installPreviewBridge } from "../lib/template-adapters/preview-bridge.ts";
import { getTemplateAdapter } from "../lib/template-adapters/registry.ts";
import { changeTargetLabels, plainSummary } from "../lib/workspace-copy.ts";
import { parseHtmlDocument, visibleText } from "./fixtures/html-dom.ts";
import { servedHomeHtml } from "./fixtures/look-pages.ts";
import { packDraft } from "./fixtures/pack-drafts.ts";

// T-059: every FAQ entry used to cost the model one operation (add_card / update_card), and a
// whole-site generation from the molding materials always used all 24, so two of its five questions
// never got written. replace_cards writes a whole card group (FAQ, cooperation steps, strengths) in one
// operation, like set_catalog_section does for catalogs: the full item list, and an inverse that puts
// the previous list back. update_card stays for "only change item 2". The model may write at most six
// FAQ entries, as many as a draft carries and the engineering page shows.

const envKeys = ["DEEPSEEK_API_KEY", "DEEPSEEK_MODEL", "DEEPSEEK_BASE_URL", "DEEPSEEK_MAX_TOKENS", "AI_API_KEY", "AI_MODEL", "AI_BASE_URL", "SITE_STORE"] as const;
const previousEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
const writeEnv = (key: string, value: string | undefined) => {
  const env = process.env as Record<string, string | undefined>;
  if (value === undefined) delete env[key];
  else env[key] = value;
};
writeEnv("DEEPSEEK_API_KEY", "sk-test-replace-cards-not-real");
writeEnv("DEEPSEEK_MODEL", "test-replace-cards-model");
writeEnv("DEEPSEEK_BASE_URL", "https://replace-cards-stub.test.invalid");
for (const key of ["DEEPSEEK_MAX_TOKENS", "AI_API_KEY", "AI_MODEL", "AI_BASE_URL", "SITE_STORE"]) writeEnv(key, undefined);
let lastBody = "";
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (!url.startsWith("https://replace-cards-stub.test.invalid/")) throw new Error(`refusing unexpected fetch ${url}`);
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
const { commitOperations, getSite, moveHistory } = await import("../lib/site-store.ts");
const sites = new Set<string>();
test.after(async () => {
  globalThis.fetch = originalFetch;
  for (const key of envKeys) writeEnv(key, previousEnv[key]);
  await Promise.all([...sites].map((siteId) => rm(path.join(process.cwd(), ".sitecraft-data", "sites", `${siteId}.json`), { force: true })));
});

const options = { templateIds: new Set(["forge", "screwfast", "landwind", "tailwind-landing"]), lastChange: "replace-cards" };
const bi = (zh: string, en: string) => ({ zh, en });
const GAP = { zh: "待补充", en: "To be provided" };
const QA: Array<[string, string, string, string]> = [
  ["没有图纸只有样品能开模吗？", "可以，先做 3D 扫描和逆向建模，图纸确认后再开模。", "Can you build a mold from a sample?", "Yes. We 3D-scan it, model it and start once the drawing is confirmed."],
  ["开模周期多久？", "单腔模具约 25–35 天。", "How long does tooling take?", "About 25–35 days for a single cavity."],
  ["试模样品怎么提供？", "T1 试模后 3 天内寄出样品。", "How are trial samples sent?", "Within 3 days of the T1 trial."],
  ["模具归谁所有？", "模具费付清后归买方所有。", "Who owns the mold?", "The buyer, once the tooling is paid."],
  ["出口用什么贸易条款？", "常用 FOB 宁波和 EXW。", "Which trade terms?", "Usually FOB Ningbo or EXW."],
];
const items = (count = QA.length) => QA.slice(0, count).map(([qz, az, qe, ae], index) => ({ id: `qa-${index + 1}`, title: bi(qz, qe), body: bi(az, ae) }));
const replaceFaq = (list = items()) => ({ op: "replace_cards", section: "faq", items: list }) as unknown as SiteOperation;

function shownFaq(draft: SiteDraft, locale = "zh") {
  const adapter = getTemplateAdapter("screwfast");
  assert.ok(adapter);
  const document = parseHtmlDocument(servedHomeHtml("screwfast"));
  const globalObject: Record<string, unknown> = { document, parent: { postMessage() {} }, addEventListener() {} };
  globalObject.window = globalObject;
  installPreviewBridge(globalObject, "screwfast", adapter).applyDeclaredContent({ ...draft, templateId: "screwfast" }, locale, [], "published");
  return document.querySelectorAll(".sitecraft-faq-item").filter((item) => !item.hidden).map((item) => visibleText(item.querySelector("summary")!).trim());
}

test("one replace_cards writes the whole FAQ, in both languages, and the page shows all five", () => {
  const before = packDraft("molding");
  const result = applySiteOperations(before, [replaceFaq()], options);
  assert.deepEqual(result.draft.content.faq.items, items());
  assert.ok(result.appliedTargets.includes("faq.items.4.title.zh") && result.appliedTargets.includes("faq.items.4.body.en"));
  assert.equal(result.draft.englishReady, true, "English entries make the English page ready");
  assert.deepEqual(shownFaq(result.draft), QA.map((item) => item[0]));
  assert.deepEqual(shownFaq(result.draft, "en"), QA.map((item) => item[2]));
  assert.deepEqual(changeTargetLabels(["faq.items.0.title.zh"]), ["常见问题第1项标题"]);
  assert.equal(plainSummary("用 replace_cards 写入常见问题", [replaceFaq()]), "已更新：常见问题");
});

test("undo puts the previous list back exactly, the English flag too", () => {
  const before = { ...packDraft("molding"), englishReady: false };
  const applied = applySiteOperations(before, [replaceFaq()], options);
  assert.equal(applied.inverseOperations.length, 1);
  const undone = applySiteOperations(applied.draft, applied.inverseOperations, options);
  assert.deepEqual(undone.draft.content.faq.items, before.content.faq.items);
  assert.equal(undone.draft.englishReady, false);
  const unchanged = applySiteOperations(applied.draft, [replaceFaq()], options);
  assert.equal(unchanged.changed, false, "the same list again is no change");
});

test("undo and redo through the saved history", async () => {
  const siteId = `t059cards-${crypto.randomUUID()}`;
  sites.add(siteId);
  const initial = await getSite(siteId);
  await commitOperations({ siteId, baseRevision: initial.draft.revision, source: "manual", summary: "注塑资料", operations: [{ op: "replace_draft", draft: { ...packDraft("molding"), revision: initial.draft.revision } }] });
  const seeded = await getSite(siteId);
  const committed = await commitOperations({ siteId, baseRevision: seeded.draft.revision, source: "ai", summary: "写入常见问题", operations: [replaceFaq()] });
  assert.equal(committed.status, "applied");
  assert.equal((await getSite(siteId)).draft.content.faq.items.length, 5);
  assert.equal((await moveHistory(siteId, "undo")).status, "applied");
  assert.deepEqual((await getSite(siteId)).draft.content.faq.items, seeded.draft.content.faq.items);
  assert.equal((await moveHistory(siteId, "redo")).status, "applied");
  assert.deepEqual((await getSite(siteId)).draft.content.faq.items, items());
});

test("the operation takes the draft's own limit: twelve entries, unique ids, only card groups", () => {
  const long = Array.from({ length: 12 }, (_, index) => ({ id: `old-${index}`, title: bi(`问${index}`, `Q${index}`), body: bi(`答${index}`, `A${index}`) }));
  assert.equal(siteOperationSchema.safeParse({ op: "replace_cards", section: "faq", items: long }).success, true, "an old ten-entry FAQ can still be put back by undo");
  assert.equal(siteOperationSchema.safeParse({ op: "replace_cards", section: "faq", items: [...long, { id: "x", title: bi("问", "Q"), body: bi("答", "A") }] }).success, false);
  assert.equal(siteOperationSchema.safeParse({ op: "replace_cards", section: "faq", items: [items()[0], items()[0]] }).success, false, "ids are unique");
  assert.equal(siteOperationSchema.safeParse({ op: "replace_cards", section: "industries", items: items() }).success, false);
  for (const section of ["services", "features"]) {
    assert.equal(siteOperationSchema.safeParse({ op: "replace_cards", section, items: items(3) }).success, true, section);
  }
});

test("from the model: at most six FAQ entries, no empty entries, no accidental wipe", () => {
  const eight = [...items(), ...items(3).map((item) => ({ ...item, id: `${item.id}-more` }))];
  const clipped = validateAIOperations("资料", [{ op: "replace_cards", section: "faq", items: eight } as never], options.templateIds);
  const written = clipped.operations[0] as unknown as { items: unknown[] };
  assert.equal(written.items.length, 6);
  assert.ok(clipped.rejected.includes("常见问题最多写 6 条，其余 2 条没有写入"), JSON.stringify(clipped.rejected));
  const withGaps = validateAIOperations("资料", [{ op: "replace_cards", section: "faq", items: [...items(2), { id: "gap", title: GAP, body: GAP }] } as never], options.templateIds);
  assert.equal((withGaps.operations[0] as unknown as { items: unknown[] }).items.length, 2, "an entry with neither a question nor an answer is dropped");
  const allGaps = validateAIOperations("资料", [{ op: "replace_cards", section: "faq", items: [{ id: "gap", title: GAP, body: GAP }] } as never], options.templateIds);
  assert.deepEqual(allGaps.operations, [], "a list with nothing to show does not wipe the FAQ");
  assert.ok(allGaps.rejected.includes("标题和正文都缺的条目不会写入"));
  const steps = validateAIOperations("资料", [{ op: "replace_cards", section: "services", items: [...items(), ...items(2).map((item) => ({ ...item, id: `${item.id}-b` }))] } as never], options.templateIds);
  assert.equal((steps.operations[0] as unknown as { items: unknown[] }).items.length, 6, "steps are limited to six too (T-059)");
});

test("the model is told to write a whole card group in one replace_cards, and update_card for one entry", async () => {
  await requestStructuredOperations({ message: "看看现在的页面", draft: structuredClone(defaultDraft), templateId: "screwfast" });
  const system = String((JSON.parse(lastBody) as { messages: Array<{ role: string; content: string }> }).messages.find((item) => item.role === "system")?.content ?? "");
  assert.match(system, /replace_cards: \{"op":"replace_cards","section":"features\|services\|faq","items":\[/);
  assert.match(system, /按资料生成或重做整站时，每一组用一条 replace_cards 写完全部条目，不要逐条 add_card \/ update_card/);
  assert.match(system, /只改其中某一条时用 update_card/);
  assert.match(system, /常见问题：当前样子的访客页最多显示 6 条/);
  assert.match(system, /优先使用 replace_products、replace_cards、set_catalog_section/);
});
