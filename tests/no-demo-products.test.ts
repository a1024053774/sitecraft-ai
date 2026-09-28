import assert from "node:assert/strict";
import test from "node:test";
import { defaultDraft } from "../lib/site-document.ts";
import { applySiteOperations } from "../lib/site-operations.ts";
import { getTemplateAdapter } from "../lib/template-adapters/index.ts";
import { installPreviewBridge } from "../lib/template-adapters/preview-bridge.ts";
import { createNode } from "./fixtures/fake-dom.ts";

// T-035: a new draft carries no demo products, and the visitor page hides an empty product block
// (and the header link that points at it) instead of showing a "to be completed" shell.

function buildPage() {
  const html = createNode("html");
  const body = createNode("body");
  html.appendChild(body);
  const document = {
    documentElement: html,
    body,
    createElement: (tag: string) => createNode(tag),
    addEventListener() {},
    querySelectorAll: (selector: string) => html.querySelectorAll(selector),
    querySelector: (selector: string) => html.querySelector(selector),
  };
  const header = createNode("header");
  const navProducts = createNode("a");
  navProducts.setAttribute("href", "#products");
  navProducts.setAttribute("data-sitecraft-nav", "products");
  navProducts.textContent = "产品";
  header.appendChild(navProducts);
  // A hero button styled display:flex by the overlay; [hidden] alone would not hide it.
  const heroSecondary = createNode("a");
  heroSecondary.setAttribute("href", "#products");
  heroSecondary.textContent = "看产品系列";
  header.appendChild(heroSecondary);
  const products = createNode("section");
  products.setAttribute("id", "products");
  products.setAttribute("data-sitecraft-section", "products");
  const heading = createNode("h2");
  heading.textContent = "产品";
  const grid = createNode("div");
  grid.setAttribute("data-sitecraft-product-grid", "true");
  products.appendChild(heading);
  products.appendChild(grid);
  const contact = createNode("section");
  contact.setAttribute("id", "contact");
  contact.setAttribute("data-sitecraft-section", "contact");
  const form = createNode("form");
  contact.appendChild(form);
  body.appendChild(header);
  body.appendChild(products);
  body.appendChild(contact);
  return { document, products, navProducts, heroSecondary, contact };
}

function render(draft: typeof defaultDraft, templateId: string) {
  const adapter = getTemplateAdapter(templateId);
  assert.ok(adapter, templateId);
  const page = buildPage();
  const globalObject: Record<string, unknown> = { document: page.document, parent: { postMessage() {} }, addEventListener() {} };
  globalObject.window = globalObject;
  installPreviewBridge(globalObject, templateId, adapter).applyDeclaredContent(structuredClone(draft), "zh", [], "published");
  return page;
}

test("a new draft carries no demo products", () => {
  assert.deepEqual(defaultDraft.products, []);
  assert.equal(JSON.stringify(defaultDraft).includes("FM-24"), false);
});

for (const templateId of ["forge", "screwfast", "landwind", "tailwind-landing"]) {
  test(`${templateId}: visitor page hides the empty product block and its nav link`, () => {
    const page = render(defaultDraft, templateId);
    assert.equal(page.products.hidden, true, "empty product section is still shown");
    assert.equal(page.navProducts.hidden, true, "header still links to the hidden product section");
    assert.equal(page.heroSecondary.styleValues.display, "none", "a styled button to the hidden product section stays visible");
    assert.notEqual(page.contact.hidden, true, "inquiry section must stay visible");
  });
}

test("products from materials bring the product block back", () => {
  const withProduct = applySiteOperations(structuredClone(defaultDraft), [{
    op: "replace_products",
    products: [{
      sku: "RA-1",
      name: { zh: "直角减速机", en: "Right-angle gearbox" },
      summary: { zh: "按图加工的重载直角减速机。", en: "Heavy-duty right-angle gearbox machined to drawings." },
      category: { zh: "重载减速机", en: "Heavy-duty gearbox" },
      status: "published",
      imageColor: "#d7e7d1",
    }],
  }] as never, { templateIds: new Set(["forge", "screwfast", "landwind", "tailwind-landing"]), lastChange: "t035-products" }).draft;
  const page = render(withProduct, "screwfast");
  assert.notEqual(page.products.hidden, true);
  assert.notEqual(page.navProducts.hidden, true);
  assert.notEqual(page.heroSecondary.styleValues.display, "none");
});
