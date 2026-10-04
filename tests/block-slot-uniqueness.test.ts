import assert from "node:assert/strict";
import test from "node:test";
import { blockCatalog, blockIds } from "../lib/blocks/catalog.ts";
import { composedPageForTemplate } from "../lib/blocks/compose.ts";
import { blockLooks } from "../lib/blocks/looks/index.ts";
import { checkVariantRequirements } from "../lib/blocks/requirements.ts";
import type { SiteDraft } from "../lib/site-document.ts";
import { installPreviewBridge } from "../lib/template-adapters/preview-bridge.ts";
import { getTemplateAdapter } from "../lib/template-adapters/registry.ts";
import { parseHtmlDocument, visibleText } from "./fixtures/html-dom.ts";
import { packDraft, withLayouts } from "./fixtures/pack-drafts.ts";
import { closeBrowser, waitForPreviewBridge, waitForSettled, base, openBrowser } from "./helpers/workspace-browser.ts";

// T-076: every modify target lands on exactly one node. A target that is on several nodes cannot be
// selected or written without guessing which one, so no data-sitecraft-slot value may appear twice
// on a page, whatever look and whichever layout of a block is mounted (AGENTS.md: writes must hit
// the declared node once). The same check runs inside scripts/render-block.mjs for every candidate.
//
// The one allowance: a field the catalog declares as a slot of several blocks is shown once in each
// of them (the company name in the navigation and the footer; email and phone in the inquiry block
// and the footer), so such a target may be on one node per declaring block. Nothing else may repeat,
// and inside any one block entity nothing may repeat at all.

const text = (zh: string, en: string) => ({ zh, en });

function richDraft(pack: "industrial" | "molding", variants: Record<string, string>, templateId: string): SiteDraft {
  const draft = withLayouts(packDraft(pack), variants);
  draft.content.services = { ...draft.content.services, items: [
    { id: "rfq", title: text("提交图纸", "Send drawings"), body: text("附图纸与规格。", "Drawings and specs.") },
    { id: "mold", title: text("开模", "Mold making"), body: text("约 30 天。", "About 30 days.") },
    { id: "trial", title: text("试模", "Trial"), body: text("3 天内寄样。", "Samples in 3 days.") },
  ] } as typeof draft.content.services;
  draft.content.certifications = { title: text("认证", "Certifications"), intro: text("待补充", "To be provided"), items: [
    { id: "iso9001", title: text("ISO 9001", "ISO 9001"), body: text("质量管理体系", "Quality system"), status: "已有" },
    { id: "iatf", title: text("IATF 16949", "IATF 16949"), body: text("汽车行业", "Automotive"), status: "认证中" },
  ] } as typeof draft.content.certifications;
  draft.content.contact = { ...draft.content.contact, phone: "+86 21 5555 0100", address: text("上海市宝山区示例路 1 号", "1 Example Road, Baoshan, Shanghai") } as typeof draft.content.contact;
  draft.content.commercialTerms = [
    { id: "moq-1", kind: "moq", value: text("20 台", "20 units") },
    { id: "lead-1", kind: "lead_time", value: text("询盘后确认", "Confirmed after inquiry") },
  ];
  return { ...draft, templateId } as SiteDraft;
}

function slotsOnPage(templateId: string, draft: SiteDraft, locale: "zh" | "en") {
  const html = composedPageForTemplate(templateId);
  assert.ok(html, `${templateId} has a composed page`);
  const adapter = getTemplateAdapter(templateId);
  assert.ok(adapter?.blocks);
  const document = parseHtmlDocument(html);
  const globalObject: Record<string, unknown> = { document, parent: { postMessage() {} }, addEventListener() {} };
  globalObject.window = globalObject;
  installPreviewBridge(globalObject, templateId, adapter).applyDeclaredContent(draft, locale, [], "published");
  const all = document.querySelectorAll("[data-sitecraft-slot]").map((node) => node.getAttribute("data-sitecraft-slot") as string);
  // Inside one block entity no target may repeat, mirrored ones included.
  for (const entity of document.querySelectorAll("[data-sc-block]")) {
    const inside = entity.querySelectorAll("[data-sitecraft-slot]").map((node) => node.getAttribute("data-sitecraft-slot") as string);
    const repeated = [...new Set(inside.filter((value, index) => inside.indexOf(value) !== index))];
    assert.deepEqual(repeated, [], `${entity.getAttribute("data-sc-block")}:${entity.getAttribute("data-sc-variant")} repeats a target inside the block`);
  }
  return all;
}

/** Targets the catalog declares in more than one block, with how many blocks declare each. */
const declaredIn = (() => {
  const blocksByTarget = new Map<string, Set<string>>();
  for (const block of blockIds) {
    for (const variant of Object.values(blockCatalog[block].variants)) {
      for (const slot of variant.slots) blocksByTarget.set(slot.target, (blocksByTarget.get(slot.target) ?? new Set()).add(block));
    }
  }
  return new Map([...blocksByTarget].map(([target, blocks]) => [target, blocks.size] as const));
})();

/** Slot values that are on more nodes than the catalog allows for them. */
function duplicates(values: string[]) {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts].filter(([value, count]) => count > (declaredIn.get(value.replace(/\.(zh|en)$/, "")) ?? 1)).map(([value]) => value).sort();
}

test("no target is on two nodes, on all four looks, for every layout of every block, in both languages", () => {
  assert.equal(blockLooks.length, 4);
  let checked = 0;
  for (const look of blockLooks) {
    for (const block of blockIds) {
      for (const variant of Object.keys(blockCatalog[block].variants)) {
        // The materials a layout needs differ: the 2-product company fits 对比表, the 5-product one 分组 and 索引.
        const pack = (["molding", "industrial"] as const).find((candidate) => checkVariantRequirements(richDraft(candidate, {}, look.templateId), block, variant).ok);
        assert.ok(pack, `${block}:${variant} fits one of the sample companies`);
        for (const locale of ["zh", "en"] as const) {
          const draft = richDraft(pack, { [block]: variant }, look.templateId);
          const repeated = duplicates(slotsOnPage(look.templateId, draft, locale));
          assert.deepEqual(repeated, [], `${look.id} / ${block}:${variant} / ${locale}: targets on more than one node`);
          checked += 1;
        }
      }
    }
  }
  assert.ok(checked > 100, `many combinations were checked (${checked})`);
});

test("the comparison table puts a product's specs target on one node: its column header", () => {
  const draft = richDraft("industrial", { products: "compare" }, "screwfast");
  const slots = slotsOnPage("screwfast", draft, "zh");
  for (const product of draft.products) {
    assert.equal(slots.filter((slot) => slot === `products.${product.id}.specs`).length, 1, `products.${product.id}.specs`);
  }
});

test("the comparison table keeps the specs only one series has, in a last row, under the same column headers", () => {
  const draft = richDraft("industrial", { products: "compare" }, "screwfast");
  const html = composedPageForTemplate("screwfast");
  assert.ok(html);
  const adapter = getTemplateAdapter("screwfast");
  const document = parseHtmlDocument(html);
  const globalObject: Record<string, unknown> = { document, parent: { postMessage() {} }, addEventListener() {} };
  globalObject.window = globalObject;
  installPreviewBridge(globalObject, "screwfast", adapter!).applyDeclaredContent(draft, "zh", [], "published");
  const table = document.querySelectorAll("table.sitecraft-compare-table")[0];
  assert.ok(table);
  const headers = table.querySelectorAll("thead th[data-sitecraft-slot]");
  assert.equal(headers.length, draft.products.length);
  const ids = headers.map((node) => node.getAttribute("id"));
  assert.equal(new Set(ids).size, ids.length, "header ids are unique");
  const cells = table.querySelectorAll("tbody td");
  assert.ok(cells.length >= 8);
  for (const cell of cells) {
    assert.ok(ids.includes(cell.getAttribute("headers")), "every cell names its column header");
    assert.equal(cell.getAttribute("data-sitecraft-slot"), null, "cells carry no target of their own");
  }
  const extraRow = table.querySelector("tr.sitecraft-compare-extra-row");
  assert.ok(extraRow, "a last row for the specs only one series has");
  assert.equal(visibleText(extraRow.querySelector("th")!).trim(), "其他参数");
  const extras = extraRow.querySelectorAll("td").map((cell) => cell.querySelectorAll("dt").map((node) => visibleText(node).trim()));
  assert.deepEqual(extras, [["中心距"], ["机座号", "防护等级"]]);
  assert.equal(document.querySelectorAll(".sitecraft-compare-series-card .sitecraft-compare-extra").length, 0, "the cards no longer carry them");
});

test("a click on any comparison cell selects its product's specs target", async () => {
  const browser = await openBrowser();
  const { targetId } = await browser.send("Target.createTarget", { url: "about:blank" }) as { targetId: string };
  const { sessionId } = await browser.send("Target.attachToTarget", { targetId, flatten: true }) as { sessionId: string };
  try {
    await browser.send("Page.enable", {}, sessionId);
    await browser.send("Runtime.enable", {}, sessionId);
    await browser.send("Page.navigate", { url: `${base}/api/templates/screwfast/preview?slot-click=${Date.now()}` }, sessionId);
    await waitForPreviewBridge(browser, sessionId, 30000, 'block-slot-uniqueness.test');
    const draft = richDraft("industrial", { products: "compare" }, "screwfast");
    await browser.eval(`window.__sitecraftApplyDeclared(${JSON.stringify(draft)}, "zh", [], "workspace", null, false)`, sessionId);
    const expected = await browser.eval<string[]>(`(() => {
      document.documentElement.dataset.sitecraftVariant = "workspace";
      window.__picks = [];
      window.addEventListener("message", (event) => { if (event.data && event.data.type === "sitecraft:select") window.__picks.push(event.data.slot); });
      const wanted = [];
      const productIds = ${JSON.stringify(draft.products.map((product) => product.id))};
      document.querySelectorAll('table.sitecraft-compare-table tbody td').forEach((cell) => {
        const column = [...cell.parentElement.children].indexOf(cell) - 1;
        wanted.push("products." + productIds[column] + ".specs");
        (cell.querySelector('.sitecraft-compare-value, summary, dt') || cell).click();
      });
      return wanted;
    })()`, sessionId);
    await waitForSettled(browser, sessionId, "slot uniqueness");
    const picked = await browser.eval<string[]>("window.__picks", sessionId);
    assert.ok(expected.length >= 8, "the table has cells to click");
    assert.deepEqual(picked, expected, "each click selected the specs target of the cell's own product");
  } finally {
    await browser.send("Target.closeTarget", { targetId }).catch(() => {});
    await closeBrowser(browser);
  }
});
