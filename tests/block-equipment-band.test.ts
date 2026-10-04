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
import { base, openBrowser, waitForPreviewBridge } from "./helpers/workspace-browser.ts";

// T-095: 设备「数量带」(equipment:band). The items with a count form a band (the count big, the name
// under it, the specification under that); the items without one go in a name list under a small
// "其他设备" title. The grouping follows the structured quantity only. A missing count is never an
// empty cell and never a placeholder number. The default layout's wording is unchanged.

const text = (node: Parameters<typeof visibleText>[0] | null | undefined) => (node ? visibleText(node).replace(/\s+/g, " ").trim() : "");
type Item = { id: string; name: { zh: string; en: string }; quantity: number | null; spec: { zh: string; en: string } | null };
const item = (id: string, zh: string, en: string, quantity: number | null = null, spec: [string, string] | null = null): Item => ({ id, name: { zh, en }, quantity, spec: spec ? { zh: spec[0], en: spec[1] } : null });
const MOLDING = [
  item("cnc", "高速 CNC 加工中心", "High-speed CNC machining center", 12),
  item("grinder", "精密平面磨床", "Precision surface grinder", 4),
  item("injection", "注塑机", "Injection molding machine", 42, ["90–800 t", "90–800 t"]),
  item("two-shot", "双色注塑机", "Two-shot injection molding machine", 3),
  item("cmm", "三坐标测量机", "Coordinate measuring machine"),
  item("colorimeter", "色差仪", "Colorimeter"),
  item("tensile", "拉力试验机", "Tensile tester"),
  item("humidity", "恒温恒湿箱", "Climate chamber"),
];

function withEquipment(items: Item[], variant: string | null = "band", templateId?: string): SiteDraft {
  const draft = withLayouts(packDraft("molding"), variant ? { equipment: variant } : {});
  draft.content.equipment = items as typeof draft.content.equipment;
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
  const entities = document.querySelectorAll('[data-sc-block="equipment"]');
  assert.equal(entities.length, 1);
  return { block: entities[0], report };
}

test("数量带 is in the catalog with a user-facing name, a grouping render mode and no extra materials", () => {
  const spec = blockCatalog.equipment.variants.band;
  assert.ok(spec, "equipment:band missing from the catalog");
  assert.equal(spec.label, "数量带");
  assert.deepEqual(spec.slots, []);
  assert.deepEqual(spec.markers, ["[data-sitecraft-equipment-grid]"]);
  assert.deepEqual(spec.render, { equipment: "grouped" });
  assert.equal(spec.requires, undefined);
  assert.ok(blockFragments.equipment.variants.band, "equipment:band has no markup");
  assert.equal(checkVariantRequirements(withEquipment(MOLDING), "equipment", "band").ok, true);
  assert.ok(getTemplateAdapter("screwfast")?.blocks?.variants.equipment.includes("band"));
});

test("数量带 keeps the anchor, the visibility node and one marker, and names its parts once", () => {
  const spec = blockCatalog.equipment.variants.band;
  const fragment = parseHtmlFragment(blockFragments.equipment.variants.band);
  assert.equal(fragment.children.length, 1);
  assert.equal(fragment.children[0].getAttribute("data-sc-block"), "equipment");
  assert.equal(fragment.children[0].getAttribute("data-sc-variant"), "band");
  assert.equal(fragment.querySelectorAll("#equipment").length, 1);
  assert.equal(fragment.querySelectorAll('[data-sitecraft-section="equipment"]').length, 1);
  for (const marker of spec.markers) assert.equal(fragment.querySelectorAll(marker).length, 1, `marker ${marker}`);
  for (const part of spec.parts) assert.equal(fragment.querySelectorAll(`[data-sc-part="${part}"]`).length, 1, `part ${part} is used once`);
});

test("数量带 groups by whether a count exists: counted items in the band, the rest under 其他设备, no placeholder", () => {
  const { block, report } = render(withEquipment(MOLDING));
  assert.equal(block.getAttribute("data-sc-variant"), "band");
  const counted = block.querySelectorAll(".sitecraft-equipment-counted .sitecraft-equipment-item");
  assert.deepEqual(counted.map((row) => text(row.querySelector("h3"))), ["高速 CNC 加工中心", "精密平面磨床", "注塑机", "双色注塑机"]);
  assert.deepEqual(counted.map((row) => text(row.querySelector(".sitecraft-equipment-quantity-number"))), ["12", "4", "42", "3"]);
  assert.deepEqual(counted.map((row) => text(row.querySelector(".sitecraft-equipment-quantity-unit"))), ["台", "台", "台", "台"]);
  assert.equal(text(counted[2].querySelector("[data-sitecraft-equipment-spec]")), "90–800 t");
  assert.equal(block.querySelector(".sitecraft-equipment-counted")?.getAttribute("data-sitecraft-entry-count"), "4");
  assert.equal(text(block.querySelector(".sitecraft-equipment-group-title")), "其他设备");
  const plain = block.querySelectorAll(".sitecraft-equipment-plain .sitecraft-equipment-item");
  assert.deepEqual(plain.map((row) => text(row.querySelector("h3"))), ["三坐标测量机", "色差仪", "拉力试验机", "恒温恒湿箱"]);
  for (const row of plain) {
    assert.equal(row.querySelectorAll(".sitecraft-equipment-quantity").length, 0, "no count node for an item without one");
    assert.equal(row.children.filter((child) => child.tagName.toLowerCase() === "span").length, 0, "no empty cell standing in for the count");
  }
  assert.doesNotMatch(text(block), /待补充|To be provided|—|\b0\b/);
  for (const row of MOLDING) {
    assert.equal(block.querySelectorAll(`[data-sitecraft-slot="equipment.items.${row.id}.name.zh"]`).length, 1, `${row.id} name has one node`);
    assert.ok(report.appliedSlots.includes(`equipment.items.${row.id}.name.zh`));
  }
  assert.equal(block.querySelectorAll('[data-sitecraft-slot="equipment.items.injection.quantity"]').length, 1);
});

test("数量带 with one group shows no title and no empty group, and a single counted item fills the band alone", () => {
  const none = render(withEquipment(MOLDING.slice(4))).block;
  assert.equal(none.querySelectorAll(".sitecraft-equipment-group-title").length, 0, "no title when nothing is counted");
  assert.equal(none.querySelectorAll(".sitecraft-equipment-counted").length, 0);
  assert.equal(none.querySelectorAll(".sitecraft-equipment-plain .sitecraft-equipment-item").length, 4);
  const all = render(withEquipment(MOLDING.slice(0, 4))).block;
  assert.equal(all.querySelectorAll(".sitecraft-equipment-group-title").length, 0);
  assert.equal(all.querySelectorAll(".sitecraft-equipment-plain").length, 0);
  const one = render(withEquipment([MOLDING[0]])).block;
  assert.equal(one.querySelector(".sitecraft-equipment-counted")?.getAttribute("data-sitecraft-entry-count"), "1");
  assert.equal(one.querySelectorAll(".sitecraft-equipment-item").length, 1);
});

test("数量带 follows the page language and leaves the default layout's wording as it was", () => {
  const english = render(withEquipment(MOLDING), "en").block;
  assert.equal(text(english.querySelector(".sitecraft-equipment-counted .sitecraft-equipment-quantity-unit")), "units");
  assert.equal(text(english.querySelector(".sitecraft-equipment-group-title")), "Other equipment");
  const rows = render(withEquipment(MOLDING, null)).block;
  assert.equal(rows.getAttribute("data-sc-variant"), "rows");
  assert.equal(rows.querySelector(".sitecraft-equipment-quantity")?.textContent, "数量：12 台", "the default layout reads exactly as before");
  assert.equal(rows.querySelectorAll(".sitecraft-equipment-group-title").length, 0, "the default layout is not grouped");
});

test("数量带 has no horizontal overflow with every mix of counted items at 1440, 768 and 375 on two looks", async () => {
  const browser = await openBrowser();
  const { targetId } = await browser.send("Target.createTarget", { url: "about:blank" }) as { targetId: string };
  const { sessionId } = await browser.send("Target.attachToTarget", { targetId, flatten: true }) as { sessionId: string };
  const long = (i: number, quantity: number | null) => item(`l${i}`, `高精度五轴联动数控加工中心（带自动换刀库与在线测头）${i}号线`, `Five-axis machining center line ${i}`, quantity, quantity === null ? null : [`工作台 800×600 mm，定位精度 ±0.005 mm 型号 XK-2026-10-0001/0002`, "Table 800×600 mm, model XK-2026-10-0001/0002"]);
  const mixes: Array<[string, Item[]]> = [
    ["real", MOLDING],
    ["one counted", [long(1, 12)]],
    ["none counted", [long(1, null), long(2, null), long(3, null)]],
    ["six counted", [1, 2, 3, 4, 5, 6].map((i) => long(i, i * 20))],
    ["two mixed", [long(1, 42), long(2, null)]],
    ["many", Array.from({ length: 24 }, (_, i) => long(i + 1, i % 2 ? null : i + 2))],
  ];
  try {
    await browser.send("Page.enable", {}, sessionId);
    await browser.send("Runtime.enable", {}, sessionId);
    for (const templateId of ["screwfast", "landwind"]) {
      await browser.send("Page.navigate", { url: `${base}/api/templates/${templateId}/preview?equipment-band=${Date.now()}` }, sessionId);
      await waitForPreviewBridge(browser, sessionId, 30000, "equipment band");
      for (const [label, items] of mixes) {
        const draft = withEquipment(items, "band", templateId);
        for (const width of [1440, 768, 375]) {
          await browser.send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width < 500 }, sessionId);
          await browser.eval(`window.__sitecraftApplyDeclared(${JSON.stringify(draft)}, "zh", [], "published", null, false)`, sessionId);
          const result = await browser.eval<{ variant: string; rows: number; pageWidth: number; viewport: number; outside: string[] }>(`(() => {
            const block = document.querySelector('[data-sc-block="equipment"]');
            const vw = window.innerWidth;
            const outside = [...block.querySelectorAll('*')].filter((el) => { const r = el.getBoundingClientRect(); return r.width > 1 && (r.right > vw + 1 || r.left < -1); }).map((el) => String(el.className || el.tagName));
            return { variant: block.getAttribute('data-sc-variant'), rows: block.querySelectorAll('.sitecraft-equipment-item').length, pageWidth: document.documentElement.scrollWidth, viewport: vw, outside };
          })()`, sessionId);
          const where = `${templateId} ${label} @${width}`;
          assert.equal(result.variant, "band", where);
          assert.equal(result.rows, items.length, where);
          assert.ok(result.pageWidth <= result.viewport + 1, `${where}: page scrolls sideways (${result.pageWidth} > ${result.viewport})`);
          assert.deepEqual(result.outside, [], `${where}: nodes outside the viewport`);
        }
      }
    }
  } finally {
    await browser.send("Target.closeTarget", { targetId }).catch(() => {});
    try { browser.ws.send(JSON.stringify({ id: browser.id++, method: "Browser.close" })); } catch {}
    browser.ws.close();
  }
});

test("数量带 rule tokens resolve to a real value on every block look", () => {
  const css = blockFragments.equipment.css;
  const top = /\.sitecraft-equipment-counted \.sitecraft-equipment-item \{[^}]*border-top: (var\(--site-index-top[^;]*\));/.exec(css)?.[1];
  const row = /\.sitecraft-equipment-plain \.sitecraft-equipment-item \{[^}]*border-bottom: (var\(--site-index-row[^;]*\));/.exec(css)?.[1];
  assert.ok(top && row, "the band CSS reads --site-index-top and --site-index-row");
  for (const look of blockLooks) {
    const palette = getTemplateAdapter(look.templateId)?.kit?.tokens;
    assert.ok(palette, `${look.id} has a palette`);
    const tokens = rootTokens(composeLookDocument(look, palette));
    assert.notEqual(resolveVars(top, tokens), null, `${look.id}: ${top} has no value`);
    assert.notEqual(resolveVars(row, tokens), null, `${look.id}: ${row} has no value`);
  }
});
