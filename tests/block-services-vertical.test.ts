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
import { parseHtmlDocument, parseHtmlFragment, visibleText, type HtmlElement } from "./fixtures/html-dom.ts";
import { packDraft, withLayouts } from "./fixtures/pack-drafts.ts";
import { base, openBrowser } from "./helpers/workspace-browser.ts";

// T-074: 合作方式「纵向流程」(services:vertical). One full-width row per step: number | title |
// description, read top to bottom. It reads the same fields as 编号步骤 and needs nothing extra.

const text = (node: Parameters<typeof visibleText>[0] | null | undefined) => (node ? visibleText(node).replace(/\s+/g, " ").trim() : "");
const GAP = { zh: "待补充", en: "To be provided" };
const step = (index: number, body: { zh: string; en: string } = { zh: `第 ${index + 1} 步说明，约 ${10 + index} 天。`, en: `Step ${index + 1} note, about ${10 + index} days.` }) => ({
  id: `step-${index}`,
  title: { zh: `步骤${index + 1}`, en: `Step ${index + 1}` },
  body,
});

function withServices(count: number, templateId?: string, bodies: Array<{ zh: string; en: string } | undefined> = []) {
  const draft = withLayouts(packDraft("molding"), { services: "vertical" });
  draft.content.services = { ...draft.content.services, items: Array.from({ length: count }, (_, index) => step(index, bodies[index])) } as typeof draft.content.services;
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
  const api = installPreviewBridge(globalObject, "screwfast", adapter);
  const report = api.applyDeclaredContent(draft, locale, [], "published");
  const entities = document.querySelectorAll('[data-sc-block="services"]');
  assert.equal(entities.length, 1);
  return { services: entities[0], report };
}

const hidden = (node: HtmlElement) => node.hidden === true || /display:\s*none/.test(node.getAttribute("style") ?? "");

test("纵向流程 is in the catalog with a user-facing name, the same slots as 编号步骤 and no extra materials", () => {
  const spec = blockCatalog.services.variants.vertical;
  assert.ok(spec, "services:vertical missing from the catalog");
  assert.equal(spec.label, "纵向流程");
  assert.deepEqual(spec.slots, blockCatalog.services.variants.steps.slots);
  assert.equal(spec.requires, undefined);
  assert.ok(blockFragments.services.variants.vertical, "services:vertical has no markup");
  assert.equal(checkVariantRequirements(packDraft("industrial"), "services", "vertical").ok, true);
  assert.ok(getTemplateAdapter("screwfast")?.blocks?.variants.services.includes("vertical"));
});

test("纵向流程 declares its slots once each, keeps the anchor and visibility node, and names its parts", () => {
  const spec = blockCatalog.services.variants.vertical;
  const fragment = parseHtmlFragment(blockFragments.services.variants.vertical);
  assert.equal(fragment.children.length, 1);
  assert.equal(fragment.children[0].getAttribute("data-sc-block"), "services");
  assert.equal(fragment.children[0].getAttribute("data-sc-variant"), "vertical");
  for (const slot of spec.slots) assert.equal(fragment.querySelectorAll(slot.selector).length, 1, `slot ${slot.target} (${slot.selector}) must hit exactly one node`);
  assert.equal(fragment.querySelectorAll("#process").length, 1);
  assert.equal(fragment.querySelectorAll('[data-sitecraft-section="services"]').length, 1);
  for (const part of ["head", "title", "steps"]) assert.equal(fragment.querySelectorAll(`[data-sc-part="${part}"]`).length, 1, `part ${part}`);
  assert.equal(fragment.querySelectorAll('[data-sc-part="item"]').length, 6, "six step rows");
});

test("纵向流程 shows each step as a row with its title and description in material order", () => {
  const { services, report } = render(withServices(4));
  assert.equal(services.getAttribute("data-sc-variant"), "vertical");
  const rows = services.querySelectorAll(".sitecraft-process-vertical .sitecraft-process-card").filter((row) => !hidden(row));
  assert.deepEqual(rows.map((row) => text(row.querySelector("h3"))), ["步骤1", "步骤2", "步骤3", "步骤4"]);
  assert.deepEqual(rows.map((row) => text(row.querySelector("p"))), ["第 1 步说明，约 10 天。", "第 2 步说明，约 11 天。", "第 3 步说明，约 12 天。", "第 4 步说明，约 13 天。"]);
  assert.ok(report.appliedSlots.includes("services.title.zh"));
});

test("纵向流程 shows only the title of a step whose description is a gap, and drops a step that is blank in both", () => {
  const bodies = [undefined, GAP, undefined, GAP];
  const draft = withServices(4, undefined, bodies);
  draft.content.services.items[3].title = { zh: "待补充", en: "To be provided" };
  const { services } = render(draft);
  const rows = services.querySelectorAll(".sitecraft-process-vertical .sitecraft-process-card");
  assert.equal(hidden(rows[3]), true, "a step blank in title and description is not shown");
  const second = rows[1];
  assert.equal(hidden(second), false);
  assert.equal(text(second.querySelector("h3")), "步骤2");
  assert.equal(hidden(second.querySelector("p")!), true, "the gap description is hidden");
  assert.doesNotMatch(text(services), /待补充|To be provided/);
});

test("纵向流程 has no horizontal overflow with 1 to 6 steps at 1440, 768 and 375 on two looks", async () => {
  const browser = await openBrowser();
  const { targetId } = await browser.send("Target.createTarget", { url: "about:blank" }) as { targetId: string };
  const { sessionId } = await browser.send("Target.attachToTarget", { targetId, flatten: true }) as { sessionId: string };
  const long = { zh: "需求确认后 3 个工作日内回复报价与交期，批量阶段按 PO-2026-10-0001/0002/0003 分批交付，每批附 FAIR 首件检验报告与材料可追溯记录。", en: "Quote within 3 working days; batches by PO-2026-10-0001/0002/0003, each with a FAIR report." };
  try {
    await browser.send("Page.enable", {}, sessionId);
    await browser.send("Runtime.enable", {}, sessionId);
    for (const templateId of ["screwfast", "landwind"]) {
      await browser.send("Page.navigate", { url: `${base}/api/templates/${templateId}/preview?services-vertical=${Date.now()}` }, sessionId);
      for (let waited = 0; waited < 30000; waited += 100) {
        if (await browser.eval<boolean>("document.readyState === 'complete' && typeof window.__sitecraftApplyDeclared === 'function'", sessionId).catch(() => false)) break;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      for (const count of [1, 2, 3, 4, 5, 6]) {
        const draft = withServices(count, templateId, Array.from({ length: count }, () => long));
        for (const width of [1440, 768, 375]) {
          await browser.send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width < 500 }, sessionId);
          await browser.eval(`window.__sitecraftApplyDeclared(${JSON.stringify(draft)}, "zh", [], "published", null, false)`, sessionId);
          const result = await browser.eval<{ variant: string; rows: number; pageWidth: number; viewport: number; outside: string[] }>(`(() => {
            const block = document.querySelector('[data-sc-block="services"]');
            const vw = window.innerWidth;
            const rows = [...block.querySelectorAll('.sitecraft-process-card')].filter((row) => row.getBoundingClientRect().height > 0).length;
            const outside = [...block.querySelectorAll('*')].filter((el) => { const r = el.getBoundingClientRect(); return r.width > 1 && (r.right > vw + 1 || r.left < -1); }).map((el) => String(el.className || el.tagName));
            return { variant: block.getAttribute('data-sc-variant'), rows, pageWidth: document.documentElement.scrollWidth, viewport: vw, outside };
          })()`, sessionId);
          const where = `${templateId} ${count} steps @${width}`;
          assert.equal(result.variant, "vertical", where);
          assert.equal(result.rows, count, where);
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

test("纵向流程 rule tokens resolve to a real value on every block look", () => {
  const css = blockFragments.services.css;
  const top = /\.sitecraft-process\.sitecraft-process-vertical\[data-sc-part\] \{[^}]*border-top: (var\(--site-index-top[^;]*\));/.exec(css)?.[1];
  const row = /\.sitecraft-process-vertical \.sitecraft-process-card \{[^}]*border-bottom: (var\(--site-index-row[^;]*\));/.exec(css)?.[1];
  assert.ok(top && row, "the vertical process CSS reads --site-index-top and --site-index-row");
  assert.ok(blockLooks.length >= 4);
  for (const look of blockLooks) {
    const palette = getTemplateAdapter(look.templateId)?.kit?.tokens;
    assert.ok(palette, `${look.id} has a palette`);
    const tokens = rootTokens(composeLookDocument(look, palette));
    assert.notEqual(resolveVars(top, tokens), null, `${look.id}: ${top} has no value`);
    assert.notEqual(resolveVars(row, tokens), null, `${look.id}: ${row} has no value`);
  }
});
