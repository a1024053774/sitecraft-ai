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

// T-080: 商业条款「条款带」(commercialTerms:strip). One cell per term in a band (name small above,
// value large below), hairlines between the cells and above/below the band; the columns follow the
// term count. Same field and per-term targets as 条款行, no extra materials. One term fills the band
// as a single emphasised line. On a phone every cell is the same: one hairline above, no side lines,
// no boxes (review round 1: even cells had a box, odd cells only a line, like alternating cards).

const text = (node: Parameters<typeof visibleText>[0] | null | undefined) => (node ? visibleText(node).replace(/\s+/g, " ").trim() : "");
const term = (id: string, kind: string, zh: string, en: string) => ({ id, kind, value: { zh, en } });
const KINDS = ["moq", "lead_time", "capacity", "trade_terms", "payment", "packaging"];
const terms = (count: number) => Array.from({ length: count }, (_, i) => term(`t${i}`, KINDS[i], `第 ${i + 1} 条条款：批量阶段按 PO-2026-10-0001/0002/0003 分批交付，每批随货附首件检验报告。`, `Term ${i + 1}: batches per PO-2026-10-0001/0002/0003 with a first-article report.`));

function withTerms(items: Array<ReturnType<typeof term>>, templateId?: string): SiteDraft {
  const draft = withLayouts(packDraft("molding"), { commercialTerms: "strip" });
  draft.content.commercialTerms = items as typeof draft.content.commercialTerms;
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

test("条款带 is in the catalog with a user-facing name, no slots of its own and no extra materials", () => {
  const spec = blockCatalog.commercialTerms.variants.strip;
  assert.ok(spec, "commercialTerms:strip missing from the catalog");
  assert.equal(spec.label, "条款带");
  assert.deepEqual(spec.slots, []);
  assert.deepEqual(spec.markers, ["[data-sitecraft-commercial-terms-grid]"]);
  assert.deepEqual(spec.renderedParts, ["item"]);
  assert.equal(spec.requires, undefined);
  assert.ok(blockFragments.commercialTerms.variants.strip, "commercialTerms:strip has no markup");
  assert.equal(checkVariantRequirements(withTerms(terms(1)), "commercialTerms", "strip").ok, true);
  assert.ok(getTemplateAdapter("screwfast")?.blocks?.variants.commercialTerms.includes("strip"));
});

test("条款带 keeps the anchor, the visibility node and one marker, and names its parts once", () => {
  const spec = blockCatalog.commercialTerms.variants.strip;
  const fragment = parseHtmlFragment(blockFragments.commercialTerms.variants.strip);
  assert.equal(fragment.children.length, 1);
  assert.equal(fragment.children[0].getAttribute("data-sc-block"), "commercialTerms");
  assert.equal(fragment.children[0].getAttribute("data-sc-variant"), "strip");
  assert.equal(fragment.querySelectorAll("#commercial-terms").length, 1);
  assert.equal(fragment.querySelectorAll('[data-sitecraft-section="commercialTerms"]').length, 1);
  for (const marker of spec.markers) assert.equal(fragment.querySelectorAll(marker).length, 1, `marker ${marker}`);
  for (const part of spec.parts) assert.equal(fragment.querySelectorAll(`[data-sc-part="${part}"]`).length, 1, `part ${part} is used once`);
});

test("条款带 shows one cell per term with the value's own target, writes the term count, and shows no gap", () => {
  for (const count of [1, 2, 3, 4, 5, 6]) {
    const items = terms(count);
    const { block, report } = render(withTerms(items));
    assert.equal(block.getAttribute("data-sc-variant"), "strip");
    const grid = block.querySelector(".sitecraft-terms-strip");
    assert.ok(grid, `${count} terms: the band`);
    assert.equal(grid.getAttribute("data-sitecraft-entry-count"), String(count), "the columns follow how many terms there are");
    const cells = grid.querySelectorAll(".sitecraft-commercial-term");
    assert.equal(cells.length, count);
    assert.deepEqual(cells.map((cell) => text(cell.querySelector("h3"))), ["起订量", "交期", "产能", "贸易条款", "付款方式", "包装"].slice(0, count));
    for (const item of items) {
      assert.equal(block.querySelectorAll(`[data-sitecraft-slot="commercialTerms.items.${item.id}.value.zh"]`).length, 1, `${item.id} has one node`);
      assert.ok(report.appliedSlots.includes(`commercialTerms.items.${item.id}.value.zh`));
    }
    assert.doesNotMatch(text(block), /待补充|To be provided/);
  }
  const english = render(withTerms(terms(2)), "en").block;
  assert.deepEqual(english.querySelectorAll(".sitecraft-commercial-term h3").map((node) => text(node)), ["MOQ", "Lead time"]);
});

test("条款带 with a single term fills the band with that one term", () => {
  const { block } = render(withTerms([term("lead-time", "lead_time", "批量询盘后确认", "Confirmed after batch inquiry")]));
  const cells = block.querySelectorAll(".sitecraft-terms-strip .sitecraft-commercial-term");
  assert.equal(cells.length, 1);
  assert.equal(text(cells[0].querySelector("h3")), "交期");
  assert.equal(text(cells[0].querySelector("p")), "批量询盘后确认");
});

test("条款带 has no horizontal overflow, the right columns, and the same cell on a phone, for 1 to 6 terms on two looks", async () => {
  const browser = await openBrowser();
  const { targetId } = await browser.send("Target.createTarget", { url: "about:blank" }) as { targetId: string };
  const { sessionId } = await browser.send("Target.attachToTarget", { targetId, flatten: true }) as { sessionId: string };
  try {
    await browser.send("Page.enable", {}, sessionId);
    await browser.send("Runtime.enable", {}, sessionId);
    for (const templateId of ["screwfast", "landwind"]) {
      await browser.send("Page.navigate", { url: `${base}/api/templates/${templateId}/preview?terms-strip=${Date.now()}` }, sessionId);
      await waitForPreviewBridge(browser, sessionId, 30000, 'block-commercial-terms-strip.test');
      for (const count of [1, 2, 3, 4, 5, 6]) {
        const draft = withTerms(terms(count), templateId);
        for (const width of [1440, 768, 375]) {
          await browser.send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width < 500 }, sessionId);
          await browser.eval(`window.__sitecraftApplyDeclared(${JSON.stringify(draft)}, "zh", [], "published", null, false)`, sessionId);
          const result = await browser.eval<{ variant: string; cells: number; pageWidth: number; viewport: number; outside: string[]; columns: number; styles: Array<{ left: number; right: number; bottom: number; top: number; padLeft: number; padTop: number; padBottom: number; radius: number; shadow: string }> }>(`(() => {
            const block = document.querySelector('[data-sc-block="commercialTerms"]');
            const vw = window.innerWidth;
            const outside = [...block.querySelectorAll('*')].filter((el) => { const r = el.getBoundingClientRect(); return r.width > 1 && (r.right > vw + 1 || r.left < -1); }).map((el) => String(el.className || el.tagName));
            const cells = [...block.querySelectorAll('.sitecraft-terms-strip .sitecraft-commercial-term')];
            const lefts = new Set(cells.map((cell) => Math.round(cell.getBoundingClientRect().left)));
            const styles = cells.map((cell) => { const s = getComputedStyle(cell); return { left: parseFloat(s.borderLeftWidth), right: parseFloat(s.borderRightWidth), bottom: parseFloat(s.borderBottomWidth), top: parseFloat(s.borderTopWidth), padLeft: parseFloat(s.paddingLeft), padTop: parseFloat(s.paddingTop), padBottom: parseFloat(s.paddingBottom), radius: parseFloat(s.borderTopLeftRadius), shadow: s.boxShadow }; });
            return { variant: block.getAttribute('data-sc-variant'), cells: cells.length, pageWidth: document.documentElement.scrollWidth, viewport: vw, outside, columns: lefts.size, styles };
          })()`, sessionId);
          const where = `${templateId} ${count} terms @${width}`;
          assert.equal(result.variant, "strip", where);
          assert.equal(result.cells, count, where);
          assert.ok(result.pageWidth <= result.viewport + 1, `${where}: page scrolls sideways (${result.pageWidth} > ${result.viewport})`);
          assert.deepEqual(result.outside, [], `${where}: nodes outside the viewport`);
          for (const style of result.styles) {
            assert.equal(style.right, 0, `${where}: no right border`);
            assert.equal(style.radius, 0, `${where}: no rounded cells`);
            assert.equal(style.shadow, "none", `${where}: no shadow`);
          }
          if (width === 375) {
            // One column; every cell has the same padding and no side line, and every cell but the
            // first has the same hairline above: no alternating boxes.
            assert.equal(result.columns, 1, `${where}: one column`);
            assert.equal(new Set(result.styles.map((style) => `${style.padLeft}/${style.padTop}/${style.padBottom}`)).size, count === 1 ? 1 : 1, `${where}: the same padding in every cell`);
            for (const [index, style] of result.styles.entries()) {
              assert.equal(style.left, 0, `${where}: cell ${index + 1} has no left line`);
              assert.equal(style.bottom, 0, `${where}: cell ${index + 1} has no bottom line`);
            }
            const tops = result.styles.slice(1).map((style) => style.top);
            assert.ok(tops.every((top) => top > 0 && top === tops[0]), `${where}: the same hairline above every cell after the first`);
          }
          if (width === 1440 && count >= 2 && count <= 4) assert.equal(result.columns, count, `${where}: one column per term`);
        }
      }
    }
  } finally {
    await browser.send("Target.closeTarget", { targetId }).catch(() => {});
    await closeBrowser(browser);
  }
});

test("条款带 rule tokens resolve to a real value on every block look", () => {
  const css = blockFragments.commercialTerms.css;
  const top = /\.sitecraft-terms-strip \{[^}]*border-top: (var\(--site-index-top[^;]*\));/.exec(css)?.[1];
  const row = /\.sitecraft-terms-strip \{[^}]*border-bottom: (var\(--site-index-row[^;]*\));/.exec(css)?.[1];
  assert.ok(top && row, "the strip CSS reads --site-index-top and --site-index-row");
  for (const look of blockLooks) {
    const palette = getTemplateAdapter(look.templateId)?.kit?.tokens;
    assert.ok(palette, `${look.id} has a palette`);
    const tokens = rootTokens(composeLookDocument(look, palette));
    assert.notEqual(resolveVars(top, tokens), null, `${look.id}: ${top} has no value`);
    assert.notEqual(resolveVars(row, tokens), null, `${look.id}: ${row} has no value`);
  }
});
