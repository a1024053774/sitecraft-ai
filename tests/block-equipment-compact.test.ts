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
import { base, openBrowser } from "./helpers/workspace-browser.ts";

// T-095: 设备「双栏清单」(equipment:compact). Name left, count right (small unit), specification under
// the name; an item without a count is just its name. Two columns filled ROW BY ROW (item 1 left,
// item 2 right, ...) so the order of the materials is the reading order and no grouping appears that
// the materials do not have (review round 1); up to three items are one full-width column; a phone
// is one column in the materials' order.

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

function withEquipment(items: Item[], templateId?: string): SiteDraft {
  const draft = withLayouts(packDraft("molding"), { equipment: "compact" });
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

test("双栏清单 is in the catalog with a user-facing name, no render parameters and no extra materials", () => {
  const spec = blockCatalog.equipment.variants.compact;
  assert.ok(spec, "equipment:compact missing from the catalog");
  assert.equal(spec.label, "双栏清单");
  assert.deepEqual(spec.slots, []);
  assert.deepEqual(spec.markers, ["[data-sitecraft-equipment-grid]"]);
  assert.equal(spec.render, undefined);
  assert.equal(spec.requires, undefined);
  assert.ok(blockFragments.equipment.variants.compact, "equipment:compact has no markup");
  assert.equal(checkVariantRequirements(withEquipment(MOLDING), "equipment", "compact").ok, true);
  assert.ok(getTemplateAdapter("screwfast")?.blocks?.variants.equipment.includes("compact"));
});

test("双栏清单 keeps the anchor, the visibility node and one marker, and names its parts once", () => {
  const spec = blockCatalog.equipment.variants.compact;
  const fragment = parseHtmlFragment(blockFragments.equipment.variants.compact);
  assert.equal(fragment.children.length, 1);
  assert.equal(fragment.children[0].getAttribute("data-sc-variant"), "compact");
  assert.equal(fragment.querySelectorAll("#equipment").length, 1);
  assert.equal(fragment.querySelectorAll('[data-sitecraft-section="equipment"]').length, 1);
  for (const marker of spec.markers) assert.equal(fragment.querySelectorAll(marker).length, 1, `marker ${marker}`);
  for (const part of spec.parts) assert.equal(fragment.querySelectorAll(`[data-sc-part="${part}"]`).length, 1, `part ${part} is used once`);
});

test("双栏清单 lists the items in the materials' order, ungrouped, with the count only where there is one", () => {
  const { block, report } = render(withEquipment(MOLDING));
  assert.equal(block.getAttribute("data-sc-variant"), "compact");
  const list = block.querySelector(".sitecraft-equipment-compact");
  assert.ok(list);
  assert.equal(list.getAttribute("data-sitecraft-entry-count"), "8", "the item count is written for the layout to read");
  const rows = list.querySelectorAll(".sitecraft-equipment-item");
  assert.deepEqual(rows.map((row) => text(row.querySelector("h3"))), MOLDING.map((row) => row.name.zh), "one flat list in the materials' order");
  assert.equal(block.querySelectorAll(".sitecraft-equipment-counted, .sitecraft-equipment-plain, .sitecraft-equipment-group-title").length, 0, "no grouping nodes");
  assert.deepEqual(rows.map((row) => row.querySelectorAll(".sitecraft-equipment-quantity-number").map((node) => text(node)).join("")), ["12", "4", "42", "3", "", "", "", ""]);
  assert.equal(text(rows[2].querySelector("[data-sitecraft-equipment-spec]")), "90–800 t");
  assert.doesNotMatch(text(block), /待补充|To be provided|—/);
  for (const row of MOLDING) {
    assert.equal(block.querySelectorAll(`[data-sitecraft-slot="equipment.items.${row.id}.name.zh"]`).length, 1);
    assert.ok(report.appliedSlots.includes(`equipment.items.${row.id}.name.zh`));
  }
});

test("双栏清单 writes the item count for 1 to 3 items too, and the English page says units", () => {
  for (const count of [1, 2, 3, 4]) {
    const { block } = render(withEquipment(MOLDING.slice(0, count)));
    assert.equal(block.querySelector(".sitecraft-equipment-compact")?.getAttribute("data-sitecraft-entry-count"), String(count));
  }
  const english = render(withEquipment(MOLDING), "en").block;
  assert.equal(text(english.querySelector(".sitecraft-equipment-quantity-unit")), "units");
});

test("双栏清单 is one full-width column up to 3 items, two columns filled row by row from 4, one column on a phone", async () => {
  const browser = await openBrowser();
  const { targetId } = await browser.send("Target.createTarget", { url: "about:blank" }) as { targetId: string };
  const { sessionId } = await browser.send("Target.attachToTarget", { targetId, flatten: true }) as { sessionId: string };
  const long = (i: number, quantity: number | null) => item(`l${i}`, `高精度五轴联动数控加工中心（带自动换刀库与在线测头）${i}号线`, `Five-axis machining center line ${i}`, quantity, quantity === null ? null : ["工作台 800×600 mm，定位精度 ±0.005 mm 型号 XK-2026-10-0001/0002", "Table 800×600 mm"]);
  const mixes: Array<[string, Item[]]> = [
    ["one", [long(1, 12)]], ["two mixed", [long(1, 42), long(2, null)]], ["three", [long(1, 42), long(2, 3), long(3, null)]],
    ["real eight", MOLDING], ["interleaved four", [long(1, null), long(2, 42), long(3, null), long(4, 3)]],
    ["many", Array.from({ length: 24 }, (_, i) => long(i + 1, i % 2 ? null : i + 2))],
  ];
  try {
    await browser.send("Page.enable", {}, sessionId);
    await browser.send("Runtime.enable", {}, sessionId);
    for (const templateId of ["screwfast", "landwind"]) {
      await browser.send("Page.navigate", { url: `${base}/api/templates/${templateId}/preview?equipment-compact=${Date.now()}` }, sessionId);
      for (let waited = 0; waited < 30000; waited += 100) {
        if (await browser.eval<boolean>("document.readyState === 'complete' && typeof window.__sitecraftApplyDeclared === 'function'", sessionId).catch(() => false)) break;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      for (const [label, items] of mixes) {
        const draft = withEquipment(items, templateId);
        for (const width of [1440, 768, 375]) {
          await browser.send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width < 500 }, sessionId);
          await browser.eval(`window.__sitecraftApplyDeclared(${JSON.stringify(draft)}, "zh", [], "published", null, false)`, sessionId);
          const result = await browser.eval<{ variant: string; rows: number; pageWidth: number; viewport: number; outside: string[]; lefts: number[]; tops: number[]; rights: number[] }>(`(() => {
            const block = document.querySelector('[data-sc-block="equipment"]');
            const vw = window.innerWidth;
            const outside = [...block.querySelectorAll('*')].filter((el) => { const r = el.getBoundingClientRect(); return r.width > 1 && (r.right > vw + 1 || r.left < -1); }).map((el) => String(el.className || el.tagName));
            const rows = [...block.querySelectorAll('.sitecraft-equipment-compact .sitecraft-equipment-item')];
            const rects = rows.map((row) => row.getBoundingClientRect());
            return { variant: block.getAttribute('data-sc-variant'), rows: rows.length, pageWidth: document.documentElement.scrollWidth, viewport: vw, outside, lefts: rects.map((r) => Math.round(r.left)), tops: rects.map((r) => Math.round(r.top)), rights: rects.map((r) => Math.round(r.right)) };
          })()`, sessionId);
          const where = `${templateId} ${label} @${width}`;
          assert.equal(result.variant, "compact", where);
          assert.equal(result.rows, items.length, where);
          assert.ok(result.pageWidth <= result.viewport + 1, `${where}: page scrolls sideways`);
          assert.deepEqual(result.outside, [], `${where}: nodes outside the viewport`);
          const columns = new Set(result.lefts).size;
          if (items.length <= 3 || width === 375) {
            assert.equal(columns, 1, `${where}: one column`);
            assert.deepEqual([...result.tops].sort((a, b) => a - b), result.tops, `${where}: top to bottom in the materials' order`);
          } else {
            assert.equal(columns, 2, `${where}: two columns`);
            // Row by row: item 2k+1 sits left, item 2k+2 right of it, on the same line.
            for (let i = 0; i + 1 < result.rows; i += 2) {
              assert.ok(result.lefts[i] < result.lefts[i + 1], `${where}: item ${i + 1} left of item ${i + 2}`);
              assert.equal(result.tops[i], result.tops[i + 1], `${where}: items ${i + 1} and ${i + 2} share a row`);
            }
          }
        }
      }
    }
  } finally {
    await browser.send("Target.closeTarget", { targetId }).catch(() => {});
    try { browser.ws.send(JSON.stringify({ id: browser.id++, method: "Browser.close" })); } catch {}
    browser.ws.close();
  }
});

test("双栏清单 rule tokens resolve to a real value on every block look", () => {
  const css = blockFragments.equipment.css;
  const top = /\.sitecraft-equipment-compact \{[^}]*border-top: (var\(--site-index-top[^;]*\));/.exec(css)?.[1];
  const row = /\.sitecraft-equipment-compact \.sitecraft-equipment-item \{[^}]*border-bottom: (var\(--site-index-row[^;]*\));/.exec(css)?.[1];
  assert.ok(top && row, "the compact CSS reads --site-index-top and --site-index-row");
  for (const look of blockLooks) {
    const palette = getTemplateAdapter(look.templateId)?.kit?.tokens;
    assert.ok(palette, `${look.id} has a palette`);
    const tokens = rootTokens(composeLookDocument(look, palette));
    assert.notEqual(resolveVars(top, tokens), null, `${look.id}: ${top} has no value`);
    assert.notEqual(resolveVars(row, tokens), null, `${look.id}: ${row} has no value`);
  }
});
