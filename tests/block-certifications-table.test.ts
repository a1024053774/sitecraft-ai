import assert from "node:assert/strict";
import test from "node:test";
import { blockCatalog } from "../lib/blocks/catalog.ts";
import { composeLookDocument, composedPageForTemplate } from "../lib/blocks/compose.ts";
import { blockFragments } from "../lib/blocks/fragments/index.ts";
import { blockLooks } from "../lib/blocks/looks/index.ts";
import { checkVariantRequirements } from "../lib/blocks/requirements.ts";
import { installPreviewBridge } from "../lib/template-adapters/preview-bridge.ts";
import { getTemplateAdapter } from "../lib/template-adapters/registry.ts";
import { resolveVars, rootTokens } from "./fixtures/look-tokens.ts";
import { parseHtmlDocument, parseHtmlFragment, visibleText } from "./fixtures/html-dom.ts";
import { packDraft, withLayouts } from "./fixtures/pack-drafts.ts";
import { closeBrowser, base, openBrowser } from "./helpers/workspace-browser.ts";

// T-074: 认证「证书状态表」(certifications:table). One ledger row per certificate (name | status |
// description); the status is the draft's own status field in its own column. Same fields and
// slots as the badge layout, no extra materials.

const text = (node: Parameters<typeof visibleText>[0] | null | undefined) => (node ? visibleText(node).replace(/\s+/g, " ").trim() : "");
type Cert = { id: string; title: { zh: string; en: string }; body: { zh: string; en: string }; status: string };
const cert = (id: string, title: string, body: string, status: string): Cert => ({ id, title: { zh: title, en: `${title} (en)` }, body: { zh: body, en: body ? `${body} (en)` : "" }, status });
const GAP = "待补充";

function withCerts(items: Cert[], templateId?: string) {
  const draft = withLayouts(packDraft("molding"), { certifications: "table" });
  draft.content.certifications = { ...draft.content.certifications, items } as typeof draft.content.certifications;
  return templateId ? { ...draft, templateId } : draft;
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
  const entities = document.querySelectorAll('[data-sc-block="certifications"]');
  assert.equal(entities.length, 1);
  return { section: entities[0], report };
}

test("证书状态表 is in the catalog with a user-facing name, the same slots as 认证徽章 and no extra materials", () => {
  const spec = blockCatalog.certifications.variants.table;
  assert.ok(spec, "certifications:table missing from the catalog");
  assert.equal(spec.label, "证书状态表");
  assert.deepEqual(spec.slots, blockCatalog.certifications.variants.badges.slots);
  assert.deepEqual(spec.markers, ['[data-sitecraft-catalog-grid="certifications"]']);
  assert.equal(spec.requires, undefined);
  assert.ok(blockFragments.certifications.variants.table, "certifications:table has no markup");
  assert.equal(checkVariantRequirements(packDraft("industrial"), "certifications", "table").ok, true);
  assert.ok(getTemplateAdapter("screwfast")?.blocks?.variants.certifications.includes("table"));
});

test("证书状态表 declares its slots and marker once each, keeps the anchor and visibility node", () => {
  const spec = blockCatalog.certifications.variants.table;
  const fragment = parseHtmlFragment(blockFragments.certifications.variants.table);
  assert.equal(fragment.children.length, 1);
  assert.equal(fragment.children[0].getAttribute("data-sc-block"), "certifications");
  assert.equal(fragment.children[0].getAttribute("data-sc-variant"), "table");
  for (const slot of spec.slots) assert.equal(fragment.querySelectorAll(slot.selector).length, 1, `slot ${slot.target} must hit exactly one node`);
  for (const marker of spec.markers) assert.equal(fragment.querySelectorAll(marker).length, 1, `marker ${marker}`);
  assert.equal(fragment.querySelectorAll("#certifications").length, 1);
  assert.equal(fragment.querySelectorAll('[data-sitecraft-section="certifications"]').length, 1);
  for (const part of spec.parts) assert.equal(fragment.querySelectorAll(`[data-sc-part="${part}"]`).length, 1, `part ${part} is used once`);
});

test("证书状态表 shows a row per certificate with its status in its own cell, and never a gap", () => {
  const items = [
    cert("iso9001", "ISO 9001", "质量管理体系", "已有"),
    cert("iso14001", "ISO 14001", GAP, "已有"),
    cert("iatf", "IATF 16949", "认证中", "认证中"),
    cert("fda", "FDA", GAP, GAP),
  ];
  const { section, report } = render(withCerts(items));
  assert.equal(section.getAttribute("data-sc-variant"), "table");
  const rows = section.querySelectorAll(".sitecraft-cert-table .sitecraft-catalog-card");
  assert.deepEqual(rows.map((row) => text(row.querySelector("h3"))), ["ISO 9001", "ISO 14001", "IATF 16949"], "a certificate whose status is 待补充 is not shown to visitors");
  assert.deepEqual(rows.map((row) => text(row.querySelector(".sitecraft-cert-status"))), ["已有", "已有", "认证中"]);
  assert.equal(text(rows[0].querySelectorAll("p").find((p) => !p.className.includes("sitecraft-cert-status"))), "质量管理体系");
  assert.equal(rows[1].querySelectorAll("p").filter((p) => !p.className.includes("sitecraft-cert-status")).length, 0, "a gap description is not shown");
  assert.equal(rows[2].querySelectorAll("p").filter((p) => !p.className.includes("sitecraft-cert-status")).length, 0, "a description that only repeats the status is dropped");
  assert.doesNotMatch(text(section), /待补充|To be provided/);
  assert.ok(report.appliedSlots.includes("certifications"));
  assert.ok(report.appliedSlots.includes("certifications.items.iso9001.status"));
});

test("证书状态表 follows the page language", () => {
  const { section } = render(withCerts([cert("iso9001", "ISO 9001", "质量管理体系", "已有"), cert("iatf", "IATF 16949", "汽车行业", "认证中")]), "en");
  const rows = section.querySelectorAll(".sitecraft-cert-table .sitecraft-catalog-card");
  assert.deepEqual(rows.map((row) => text(row.querySelector("h3"))), ["ISO 9001 (en)", "IATF 16949 (en)"]);
  assert.deepEqual(rows.map((row) => text(row.querySelector(".sitecraft-cert-status"))), ["Certified", "In progress"]);
  assert.doesNotMatch(text(rows[0]), /已有|认证中/);
});

test("证书状态表 has no horizontal overflow with 1 to 6 certificates at 1440, 768 and 375 on two looks", async () => {
  const browser = await openBrowser();
  const { targetId } = await browser.send("Target.createTarget", { url: "about:blank" }) as { targetId: string };
  const { sessionId } = await browser.send("Target.attachToTarget", { targetId, flatten: true }) as { sessionId: string };
  const statuses = ["已有", "认证中", "已有", "认证中", "已有", "认证中"];
  try {
    await browser.send("Page.enable", {}, sessionId);
    await browser.send("Runtime.enable", {}, sessionId);
    for (const templateId of ["screwfast", "landwind"]) {
      await browser.send("Page.navigate", { url: `${base}/api/templates/${templateId}/preview?cert-table=${Date.now()}` }, sessionId);
      for (let waited = 0; waited < 30000; waited += 100) {
        if (await browser.eval<boolean>("document.readyState === 'complete' && typeof window.__sitecraftApplyDeclared === 'function'", sessionId).catch(() => false)) break;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      for (const count of [1, 2, 3, 4, 5, 6]) {
        const items = Array.from({ length: count }, (_, i) => cert(`c${i}`, `ISO 9001:2015 质量管理体系认证（含设计开发与模具制造范围）${i + 1}`, "覆盖模具设计开发与精密注塑件制造，证书编号 CN-2026-QMS-000123/000124/000125，每年监督审核一次并随货附检测报告。", statuses[i]));
        const draft = withCerts(items, templateId);
        for (const width of [1440, 768, 375]) {
          await browser.send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width < 500 }, sessionId);
          await browser.eval(`window.__sitecraftApplyDeclared(${JSON.stringify(draft)}, "zh", [], "published", null, false)`, sessionId);
          const result = await browser.eval<{ variant: string; rows: number; pageWidth: number; viewport: number; outside: string[] }>(`(() => {
            const block = document.querySelector('[data-sc-block="certifications"]');
            const vw = window.innerWidth;
            const outside = [...block.querySelectorAll('*')].filter((el) => { const r = el.getBoundingClientRect(); return r.width > 1 && (r.right > vw + 1 || r.left < -1); }).map((el) => String(el.className || el.tagName));
            return { variant: block.getAttribute('data-sc-variant'), rows: block.querySelectorAll('.sitecraft-cert-table .sitecraft-catalog-card').length, pageWidth: document.documentElement.scrollWidth, viewport: vw, outside };
          })()`, sessionId);
          const where = `${templateId} ${count} certificates @${width}`;
          assert.equal(result.variant, "table", where);
          assert.equal(result.rows, count, where);
          assert.ok(result.pageWidth <= result.viewport + 1, `${where}: page scrolls sideways (${result.pageWidth} > ${result.viewport})`);
          assert.deepEqual(result.outside, [], `${where}: nodes outside the viewport`);
        }
      }
    }
  } finally {
    await browser.send("Target.closeTarget", { targetId }).catch(() => {});
    await closeBrowser(browser);
  }
});

test("证书状态表 rule tokens resolve to a real value on every block look", () => {
  const css = blockFragments.certifications.css;
  const top = /\.sitecraft-cert-table \{[^}]*border-top: (var\(--site-index-top[^;]*\));/.exec(css)?.[1];
  const row = /\.sitecraft-cert-table \.sitecraft-catalog-card \{[^}]*border-bottom: (var\(--site-index-row[^;]*\));/.exec(css)?.[1];
  assert.ok(top && row, "the certificate table CSS reads --site-index-top and --site-index-row");
  for (const look of blockLooks) {
    const palette = getTemplateAdapter(look.templateId)?.kit?.tokens;
    assert.ok(palette, `${look.id} has a palette`);
    const tokens = rootTokens(composeLookDocument(look, palette));
    assert.notEqual(resolveVars(top, tokens), null, `${look.id}: ${top} has no value`);
    assert.notEqual(resolveVars(row, tokens), null, `${look.id}: ${row} has no value`);
  }
});
