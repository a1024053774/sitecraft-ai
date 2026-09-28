import assert from "node:assert/strict";
import test from "node:test";
import { defaultDraft } from "../lib/site-document.ts";
import { applySiteOperations } from "../lib/site-operations.ts";
import { getTemplateAdapter } from "../lib/template-adapters/index.ts";
import { installPreviewBridge } from "../lib/template-adapters/preview-bridge.ts";

// T-035: a new draft carries no demo products, and the visitor page hides an empty product block
// (and the header link that points at it) instead of showing a "to be completed" shell.

type FakeNode = {
  tagName: string;
  parentNode: FakeNode | null;
  childNodes: FakeNode[];
  attributes: Map<string, string>;
  hidden?: boolean;
  style: { setProperty: (n: string, v: string, p?: string) => void; removeProperty: (n: string) => void };
  styleValues: Record<string, string>;
  className: string;
  id: string;
  textContent: string;
  dataset: Record<string, string>;
  children: FakeNode[];
  parentElement: FakeNode | null;
  getAttribute: (name: string) => string | null;
  setAttribute: (name: string, value: string) => void;
  removeAttribute: (name: string) => void;
  hasAttribute: (name: string) => boolean;
  appendChild: (node: FakeNode) => FakeNode;
  removeChild: (node: FakeNode) => FakeNode;
  remove: () => void;
  closest: (selector: string) => FakeNode | null;
  matches: (selector: string) => boolean;
  querySelectorAll: (selector: string) => FakeNode[];
  querySelector: (selector: string) => FakeNode | null;
};

// Supports the selector shapes the bridge uses here: tag, #id, .class, [attr], [attr="v"], [attr^='v'], lists.
function matchSimple(node: FakeNode, simple: string): boolean {
  const re = /([a-zA-Z][\w-]*)|#([\w-]+)|\.([\w-]+)|\[([\w-]+)(?:([\^]?=)(?:"([^"]*)"|'([^']*)'|([^\]]*)))?\]/g;
  let m: RegExpExecArray | null;
  let consumed = 0;
  while ((m = re.exec(simple))) {
    consumed += m[0].length;
    if (m[1] && node.tagName !== m[1].toLowerCase()) return false;
    if (m[2] && node.id !== m[2]) return false;
    if (m[3] && !node.className.split(/\s+/).includes(m[3])) return false;
    if (m[4]) {
      const value = node.getAttribute(m[4]);
      if (value === null) return false;
      const expected = m[6] ?? m[7] ?? m[8];
      if (m[5] === "=" && value !== expected) return false;
      if (m[5] === "^=" && !value.startsWith(expected ?? "")) return false;
    }
  }
  return consumed === simple.replace(/\s+/g, "").length;
}

function matches(node: FakeNode, selector: string): boolean {
  return selector.split(",").some((part) => {
    const chain = part.trim().split(/\s+/);
    if (!matchSimple(node, chain[chain.length - 1])) return false;
    let cursor = node.parentNode;
    for (let i = chain.length - 2; i >= 0; i--) {
      while (cursor && !matchSimple(cursor, chain[i])) cursor = cursor.parentNode;
      if (!cursor) return false;
      cursor = cursor.parentNode;
    }
    return true;
  });
}

function createNode(tagName: string): FakeNode {
  const node = {
    tagName: tagName.toLowerCase(),
    parentNode: null,
    childNodes: [],
    attributes: new Map<string, string>(),
    styleValues: {},
    className: "",
    id: "",
    textContent: "",
    dataset: {},
  } as unknown as FakeNode;
  node.style = {
    setProperty: (n, v) => { node.styleValues[n] = v; },
    removeProperty: (n) => { delete node.styleValues[n]; },
  };
  Object.defineProperty(node, "children", { get: () => node.childNodes });
  Object.defineProperty(node, "parentElement", { get: () => node.parentNode });
  node.getAttribute = (name) => (name === "class" ? node.className || null : name === "id" ? node.id || null : node.attributes.get(name) ?? null);
  node.setAttribute = (name, value) => {
    if (name === "class") node.className = value;
    else if (name === "id") node.id = value;
    else node.attributes.set(name, String(value));
  };
  node.removeAttribute = (name) => { node.attributes.delete(name); };
  node.hasAttribute = (name) => node.getAttribute(name) !== null;
  node.appendChild = (child) => { child.parentNode = node; node.childNodes.push(child); return child; };
  node.removeChild = (child) => { node.childNodes = node.childNodes.filter((c) => c !== child); child.parentNode = null; return child; };
  node.remove = () => { node.parentNode?.removeChild(node); };
  node.matches = (selector) => matches(node, selector);
  node.closest = (selector) => {
    let cursor: FakeNode | null = node;
    while (cursor) { if (cursor.matches(selector)) return cursor; cursor = cursor.parentNode; }
    return null;
  };
  node.querySelectorAll = (selector) => {
    const out: FakeNode[] = [];
    const walk = (current: FakeNode) => { for (const child of current.childNodes) { if (child.matches(selector)) out.push(child); walk(child); } };
    walk(node);
    return out;
  };
  node.querySelector = (selector) => node.querySelectorAll(selector)[0] ?? null;
  return node;
}

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
