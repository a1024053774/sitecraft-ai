import assert from "node:assert/strict";
import test from "node:test";
import { blockCatalog } from "../lib/blocks/catalog.ts";
import { composeLookDocument, composedPageForTemplate } from "../lib/blocks/compose.ts";
import { blockFragments } from "../lib/blocks/fragments/index.ts";
import { blockLooks } from "../lib/blocks/looks/index.ts";
import { checkVariantRequirements } from "../lib/blocks/requirements.ts";
import type { SiteDraft } from "../lib/site-document.ts";
import { installPreviewBridge } from "../lib/template-adapters/preview-bridge.ts";
import { getTemplateAdapter } from "../lib/template-adapters/registry.ts";
import { resolveVars, rootTokens } from "./fixtures/look-tokens.ts";
import { parseHtmlDocument, parseHtmlFragment, visibleText } from "./fixtures/html-dom.ts";
import { packDraft, withLayouts } from "./fixtures/pack-drafts.ts";
import { closeBrowser, waitForPreviewBridge, base, openBrowser } from "./helpers/workspace-browser.ts";

// T-080: 商业条款「左右条款」(commercialTerms:side). The block title in a left column, the terms
// stacked in the right one (name small above, value below, a hairline between). Same field and
// target as 条款行; no extra materials; one term is not shown as a placeholder.

const text = (node: Parameters<typeof visibleText>[0] | null | undefined) => (node ? visibleText(node).replace(/\s+/g, " ").trim() : "");
const term = (id: string, kind: string, zh: string, en: string) => ({ id, kind, value: { zh, en } });

function withTerms(terms: Array<ReturnType<typeof term>>, templateId?: string): SiteDraft {
  const draft = withLayouts(packDraft("molding"), { commercialTerms: "side" });
  draft.content.commercialTerms = terms as typeof draft.content.commercialTerms;
  return (templateId ? { ...draft, templateId } : draft) as SiteDraft;
}

function render(draft: unknown, locale: "zh" | "en" = "zh") {
  const html = composedPageForTemplate("screwfast");
  assert.ok(html);
  const adapter = getTemplateAdapter("screwfast");
  assert.ok(adapter?.blocks);
  const document = parseHtmlDocument(html);
  const globalObject: Record<string, unknown> = { document, parent: { postMessage() {} }, addEventListener() {} };
  globalObject.window = globalObject;
  const report = installPreviewBridge(globalObject, "screwfast", adapter).applyDeclaredContent(draft, locale, [], "published");
  const entities = document.querySelectorAll('[data-sc-block="commercialTerms"]');
  assert.equal(entities.length, 1);
  return { block: entities[0], report };
}

const FOUR = [
  term("moq", "moq", "注塑件 5000 件起；模具单套起接", "Moulded parts from 5,000 pcs; moulds from one set"),
  term("lead-time", "lead_time", "模具 25–55 天；批量注塑件在模具确认后 15–20 天", "Moulds 25–55 days; volume parts 15–20 days after approval"),
  term("capacity", "capacity", "模具年产约 180 套；注塑机 42 台", "About 180 moulds a year; 42 presses"),
  term("trade", "trade_terms", "常用 FOB 宁波和 EXW", "FOB Ningbo and EXW"),
];

test("左右条款 is in the catalog with a user-facing name, no slots of its own and no extra materials", () => {
  const spec = blockCatalog.commercialTerms.variants.side;
  assert.ok(spec, "commercialTerms:side missing from the catalog");
  assert.equal(spec.label, "左右条款");
  assert.deepEqual(spec.slots, []);
  assert.deepEqual(spec.markers, ["[data-sitecraft-commercial-terms-grid]"]);
  assert.deepEqual(spec.renderedParts, ["item"]);
  assert.equal(spec.requires, undefined);
  assert.ok(blockFragments.commercialTerms.variants.side, "commercialTerms:side has no markup");
  assert.equal(checkVariantRequirements(withTerms(FOUR), "commercialTerms", "side").ok, true);
  assert.ok(getTemplateAdapter("screwfast")?.blocks?.variants.commercialTerms.includes("side"));
});

test("左右条款 keeps the anchor, the visibility node and one marker, and names its parts once", () => {
  const spec = blockCatalog.commercialTerms.variants.side;
  const fragment = parseHtmlFragment(blockFragments.commercialTerms.variants.side);
  assert.equal(fragment.children.length, 1);
  assert.equal(fragment.children[0].getAttribute("data-sc-block"), "commercialTerms");
  assert.equal(fragment.children[0].getAttribute("data-sc-variant"), "side");
  assert.equal(fragment.querySelectorAll("#commercial-terms").length, 1);
  assert.equal(fragment.querySelectorAll('[data-sitecraft-section="commercialTerms"]').length, 1);
  for (const marker of spec.markers) assert.equal(fragment.querySelectorAll(marker).length, 1, `marker ${marker}`);
  for (const part of spec.parts) assert.equal(fragment.querySelectorAll(`[data-sc-part="${part}"]`).length, 1, `part ${part} is used once`);
});

test("左右条款 shows each term as a name over its value, with the value's own target and no gap", () => {
  const draft = withTerms(FOUR);
  const { block, report } = render(draft);
  assert.equal(block.getAttribute("data-sc-variant"), "side");
  assert.ok(block.querySelector(".sitecraft-terms-side-layout"), "the title and the list sit in a two-column layout");
  const rows = block.querySelectorAll(".sitecraft-terms-side .sitecraft-commercial-term");
  assert.deepEqual(rows.map((row) => text(row.querySelector("h3"))), ["起订量", "交期", "产能", "贸易条款"]);
  assert.deepEqual(rows.map((row) => text(row.querySelector("p"))), FOUR.map((item) => item.value.zh));
  for (const item of FOUR) {
    assert.equal(block.querySelectorAll(`[data-sitecraft-slot="commercialTerms.items.${item.id}.value.zh"]`).length, 1, `${item.id} has one node`);
    assert.ok(report.appliedSlots.includes(`commercialTerms.items.${item.id}.value.zh`));
  }
  assert.doesNotMatch(text(block), /待补充|To be provided/);
  const english = render(draft, "en").block;
  assert.deepEqual(english.querySelectorAll(".sitecraft-commercial-term h3").map((node) => text(node)), ["MOQ", "Lead time", "Capacity", "Trade terms"]);
  assert.equal(text(english.querySelector(".sitecraft-commercial-term p")), FOUR[0].value.en);
});

test("左右条款 with a single term shows that one term, not an empty table", () => {
  const { block } = render(withTerms([term("lead-time", "lead_time", "批量询盘后确认", "Confirmed after batch inquiry")]));
  const rows = block.querySelectorAll(".sitecraft-terms-side .sitecraft-commercial-term");
  assert.equal(rows.length, 1);
  assert.equal(text(rows[0].querySelector("h3")), "交期");
  assert.equal(text(rows[0].querySelector("p")), "批量询盘后确认");
  assert.equal(block.querySelectorAll(".sitecraft-commercial-term").length, 1);
});

test("左右条款 has no horizontal overflow with 1 to 6 terms at 1440, 768 and 375 on two looks", async () => {
  const browser = await openBrowser();
  const { targetId } = await browser.send("Target.createTarget", { url: "about:blank" }) as { targetId: string };
  const { sessionId } = await browser.send("Target.attachToTarget", { targetId, flatten: true }) as { sessionId: string };
  const kinds = ["moq", "lead_time", "capacity", "trade_terms", "payment", "packaging"];
  const long = (i: number) => term(`t${i}`, kinds[i], `第 ${i + 1} 条条款：批量阶段按 PO-2026-10-0001/0002/0003 分批交付，每批随货附首件检验报告与材料可追溯记录，出口订单另附装箱单与原产地证。`, `Term ${i + 1}: batches delivered per PO-2026-10-0001/0002/0003 with a first-article report and traceability records.`);
  try {
    await browser.send("Page.enable", {}, sessionId);
    await browser.send("Runtime.enable", {}, sessionId);
    for (const templateId of ["screwfast", "landwind"]) {
      await browser.send("Page.navigate", { url: `${base}/api/templates/${templateId}/preview?terms-side=${Date.now()}` }, sessionId);
      await waitForPreviewBridge(browser, sessionId, 30000, 'block-commercial-terms-side.test');
      for (const count of [1, 2, 3, 4, 5, 6]) {
        const draft = withTerms(Array.from({ length: count }, (_, i) => long(i)), templateId);
        for (const width of [1440, 768, 375]) {
          await browser.send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width < 500 }, sessionId);
          await browser.eval(`window.__sitecraftApplyDeclared(${JSON.stringify(draft)}, "zh", [], "published", null, false)`, sessionId);
          const result = await browser.eval<{ variant: string; rows: number; pageWidth: number; viewport: number; outside: string[]; titleLeft: number; listLeft: number }>(`(() => {
            const block = document.querySelector('[data-sc-block="commercialTerms"]');
            const vw = window.innerWidth;
            const outside = [...block.querySelectorAll('*')].filter((el) => { const r = el.getBoundingClientRect(); return r.width > 1 && (r.right > vw + 1 || r.left < -1); }).map((el) => String(el.className || el.tagName));
            const title = block.querySelector('.sitecraft-section-head').getBoundingClientRect();
            const list = block.querySelector('.sitecraft-terms-side').getBoundingClientRect();
            return { variant: block.getAttribute('data-sc-variant'), rows: block.querySelectorAll('.sitecraft-terms-side .sitecraft-commercial-term').length, pageWidth: document.documentElement.scrollWidth, viewport: vw, outside, titleLeft: title.right, listLeft: list.left };
          })()`, sessionId);
          const where = `${templateId} ${count} terms @${width}`;
          assert.equal(result.variant, "side", where);
          assert.equal(result.rows, count, where);
          assert.ok(result.pageWidth <= result.viewport + 1, `${where}: page scrolls sideways (${result.pageWidth} > ${result.viewport})`);
          assert.deepEqual(result.outside, [], `${where}: nodes outside the viewport`);
          if (width === 1440) assert.ok(result.listLeft >= result.titleLeft, `${where}: the title column sits left of the list column`);
        }
      }
    }
  } finally {
    await browser.send("Target.closeTarget", { targetId }).catch(() => {});
    await closeBrowser(browser);
  }
});

test("左右条款 rule tokens resolve to a real value on every block look", () => {
  const css = blockFragments.commercialTerms.css;
  const top = /\.sitecraft-terms-side \{[^}]*border-top: (var\(--site-index-top[^;]*\));/.exec(css)?.[1];
  const row = /\.sitecraft-terms-side \.sitecraft-commercial-term \{[^}]*border-bottom: (var\(--site-index-row[^;]*\));/.exec(css)?.[1];
  assert.ok(top && row, "the side CSS reads --site-index-top and --site-index-row");
  for (const look of blockLooks) {
    const palette = getTemplateAdapter(look.templateId)?.kit?.tokens;
    assert.ok(palette, `${look.id} has a palette`);
    const tokens = rootTokens(composeLookDocument(look, palette));
    assert.notEqual(resolveVars(top, tokens), null, `${look.id}: ${top} has no value`);
    assert.notEqual(resolveVars(row, tokens), null, `${look.id}: ${row} has no value`);
  }
});
