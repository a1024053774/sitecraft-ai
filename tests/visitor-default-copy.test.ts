import assert from "node:assert/strict";
import test from "node:test";
import { defaultDraft } from "../lib/site-document.ts";
import { applySiteOperations } from "../lib/site-operations.ts";
import { DEFAULT_DRAFT_SENTINEL } from "../lib/draft-sentinel.ts";
import { getTemplateAdapter } from "../lib/template-adapters/index.ts";
import {
  installPreviewBridge,
} from "../lib/template-adapters/preview-bridge.ts";

// Minimal DOM helpers mirrored from template-preview-bridge.test.ts (keep local so
// this acceptance file stays self-contained and can prove RED in isolation).

type FakeNode = {
  nodeType: number;
  tagName: string;
  parentNode: FakeNode | null;
  childNodes: FakeNode[];
  attributes: Map<string, string>;
  _text: string;
  hidden?: boolean;
  style?: { setProperty: (n: string, v: string, p?: string) => void; removeProperty?: (n: string) => void };
  children: FakeNode[];
  parentElement: FakeNode | null;
  className: string;
  id: string;
  textContent: string;
  dataset: Record<string, string>;
  styleValues: Record<string, string>;
  getAttribute: (name: string) => string | null;
  setAttribute: (name: string, value: string) => void;
  appendChild: (node: FakeNode) => FakeNode;
  closest: (selector: string) => FakeNode | null;
  matches: (selector: string) => boolean;
  querySelectorAll: (selector: string) => FakeNode[];
  querySelector: (selector: string) => FakeNode | null;
};

function createNode(tagName: string): FakeNode {
  const node: Partial<FakeNode> = {
    nodeType: 1,
    tagName: tagName.toUpperCase(),
    parentNode: null,
    childNodes: [],
    attributes: new Map(),
    _text: "",
    hidden: false,
    children: [],
    parentElement: null,
    className: "",
    id: "",
    dataset: {},
    styleValues: {},
    getAttribute(name) {
      if (name === "class") return this.className || null;
      if (name === "id") return this.id || null;
      return this.attributes?.get(name) ?? null;
    },
    setAttribute(name, value) {
      if (name === "class") this.className = value;
      else if (name === "id") this.id = value;
      else this.attributes?.set(name, value);
      if (name.startsWith("data-")) {
        const key = name.slice(5).replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
        this.dataset![key] = value;
      }
    },
    appendChild(child) {
      child.parentNode = this as FakeNode;
      child.parentElement = this as FakeNode;
      this.childNodes!.push(child);
      this.children!.push(child);
      return child;
    },
    closest(selector) {
      let current: FakeNode | null = this as FakeNode;
      while (current) {
        if (current.matches(selector)) return current;
        current = current.parentElement;
      }
      return null;
    },
    matches(selector) {
      const attr = /^\[([^=\]]+)(?:=\"([^\"]*)\")?\]$/.exec(selector);
      if (attr) {
        const getter = this.getAttribute?.bind(this);
        const value = getter ? getter(attr[1]) : null;
        return attr[2] === undefined ? value != null : value === attr[2];
      }
      if (selector.startsWith("#")) return this.id === selector.slice(1);
      return this.tagName === selector.toUpperCase();
    },
    querySelectorAll(selector) {
      const out: FakeNode[] = [];
      const walk = (n: FakeNode) => {
        if (n.matches(selector)) out.push(n);
        for (const child of n.childNodes) walk(child);
      };
      walk(this as FakeNode);
      return out;
    },
    querySelector(selector) {
      const list = this.querySelectorAll?.(selector) ?? [];
      return list[0] ?? null;
    },
  };
  Object.defineProperty(node, "textContent", {
    get() { return this._text ?? ""; },
    set(value: string) { this._text = String(value ?? ""); },
  });
  node.style = {
    setProperty(name, value) { node.styleValues![name] = value; },
    removeProperty(name) { delete node.styleValues![name]; },
  };
  return node as FakeNode;
}

function createDocument() {
  const body = createNode("body");
  const documentElement = createNode("html");
  const document = {
    documentElement,
    body,
    listeners: [] as Array<{ type: string; fn: (event: unknown) => void }>,
    createElement(tag: string) { return createNode(tag); },
    addEventListener(type: string, fn: (event: unknown) => void) {
      this.listeners.push({ type, fn });
    },
    querySelectorAll(selector: string) {
      return body.querySelectorAll(selector).concat(documentElement.querySelectorAll(selector));
    },
    querySelector(selector: string) {
      return this.querySelectorAll(selector)[0] ?? null;
    },
  };
  return { document, body };
}

function visibleText(node: FakeNode): string {
  if (node.hidden) return "";
  if (!node.childNodes.length) return node.textContent ?? "";
  return node.childNodes.map((child) => visibleText(child)).join(" ");
}

function installOn(document: ReturnType<typeof createDocument>["document"], adapter: NonNullable<ReturnType<typeof getTemplateAdapter>>) {
  const globalObject: Record<string, unknown> = {
    document,
    parent: { postMessage() {} },
    addEventListener() {},
  };
  globalObject.window = globalObject;
  const api = installPreviewBridge(globalObject, adapter.templateId, adapter);
  return { api };
}

/**
 * Acceptance (item 3): render an ungenerated default draft on the visitor page;
 * default-draft generics and overlay meta-instructions must not appear.
 *
 * RED command (recorded before the fix; fails on 046972c behavior):
 *   node --test --experimental-strip-types --test-name-pattern='ungenerated default draft' tests/visitor-default-copy.test.ts
 * Assertion that fails before the fix: page.includes("需求与评估") === true
 * (applyDeclaredContent writes defaultDraft services onto published slots).
 */
test("ungenerated default draft hides default and meta copy on the visitor page", () => {
  assert.equal(DEFAULT_DRAFT_SENTINEL.content.services.items[0].title.zh, "需求与评估");
  const adapter = getTemplateAdapter("screwfast");
  assert.ok(adapter);
  const { document, body } = createDocument();

  const services = createNode("section");
  services.setAttribute("data-sitecraft-section", "services");
  for (const index of [0, 1, 2]) {
    const card = createNode("article");
    const h = createNode("h3");
    h.setAttribute("data-sitecraft-benchmark", `services-item-${index}-title`);
    h.textContent = "overlay-service-title";
    const p = createNode("p");
    p.setAttribute("data-sitecraft-benchmark", `services-item-${index}-body`);
    p.textContent = "overlay-service-body";
    card.appendChild(h);
    card.appendChild(p);
    services.appendChild(card);
  }

  const contact = createNode("section");
  contact.setAttribute("data-sitecraft-section", "contact");
  const contactTitle = createNode("h2");
  contactTitle.setAttribute("data-sitecraft-benchmark", "contact-title");
  contactTitle.textContent = "overlay-contact-title";
  const contactBody = createNode("p");
  contactBody.setAttribute("data-sitecraft-benchmark", "contact-body");
  contactBody.textContent = "overlay-contact-body";
  contact.appendChild(contactTitle);
  contact.appendChild(contactBody);

  const industries = createNode("section");
  industries.setAttribute("data-sitecraft-section", "industries");
  const industriesIntro = createNode("p");
  industriesIntro.setAttribute("data-sitecraft-benchmark", "industries-intro");
  industriesIntro.textContent = "资料确认的工况入口，未写明的行业不展示。";
  const industriesGrid = createNode("div");
  industriesGrid.setAttribute("data-sitecraft-catalog-grid", "industries");
  industries.appendChild(industriesIntro);
  industries.appendChild(industriesGrid);

  const capabilities = createNode("section");
  capabilities.setAttribute("data-sitecraft-section", "capabilities");
  const capabilitiesIntro = createNode("p");
  capabilitiesIntro.setAttribute("data-sitecraft-benchmark", "capabilities-intro");
  capabilitiesIntro.textContent = "只列资料给出的工序或设备，不补假产能。";
  const capabilitiesGrid = createNode("div");
  capabilitiesGrid.setAttribute("data-sitecraft-catalog-grid", "capabilities");
  capabilities.appendChild(capabilitiesIntro);
  capabilities.appendChild(capabilitiesGrid);

  const certifications = createNode("section");
  certifications.setAttribute("data-sitecraft-section", "certifications");
  const certificationsIntro = createNode("p");
  certificationsIntro.setAttribute("data-sitecraft-benchmark", "certifications-intro");
  certificationsIntro.textContent = "仅列资料中的认证。";
  const certificationsGrid = createNode("div");
  certificationsGrid.setAttribute("data-sitecraft-catalog-grid", "certifications");
  certifications.appendChild(certificationsIntro);
  certifications.appendChild(certificationsGrid);

  const products = createNode("section");
  products.setAttribute("data-sitecraft-section", "products");
  const productsIntro = createNode("p");
  productsIntro.setAttribute("data-sitecraft-benchmark", "products-intro");
  productsIntro.textContent = "overlay-products-intro";
  const productGrid = createNode("div");
  productGrid.setAttribute("data-sitecraft-product-grid", "true");
  products.appendChild(productsIntro);
  products.appendChild(productGrid);

  body.appendChild(services);
  body.appendChild(contact);
  body.appendChild(industries);
  body.appendChild(capabilities);
  body.appendChild(certifications);
  body.appendChild(products);

  installOn(document, adapter).api.applyDeclaredContent(structuredClone(defaultDraft), "zh", [], "published");

  const page = visibleText(body);
  for (const phrase of [
    "需求与评估",
    "方案与实施",
    "交付与支持",
    "说说你的下一件事。",
    "留下项目需求，我们会尽快与你联系。",
    "资料确认的工况入口",
    "只列资料给出的工序",
    "仅列资料中的认证",
    "以下参数为模拟设定",
  ]) {
    assert.equal(page.includes(phrase), false, `visitor page still shows «${phrase}»`);
  }
});

test("published visitor strips pack simulation labels from product intro", () => {
  const adapter = getTemplateAdapter("screwfast");
  assert.ok(adapter);
  const { document, body } = createDocument();
  const productsIntro = createNode("p");
  productsIntro.setAttribute("data-sitecraft-benchmark", "products-intro");
  body.appendChild(productsIntro);
  const draft = applySiteOperations(structuredClone(defaultDraft), [{
    op: "set_text",
    target: "products.intro",
    locale: "zh",
    value: "直角减速机与行星减速机；按图加工。以下参数为模拟设定。",
  }], { templateIds: new Set(["forge", "screwfast"]), lastChange: "sim-label" }).draft;

  installOn(document, adapter).api.applyDeclaredContent(draft, "zh", [], "published");
  assert.equal(productsIntro.textContent.includes("以下参数为模拟设定"), false);
  assert.equal(productsIntro.textContent.includes("直角减速机"), true);

  installOn(document, adapter).api.applyDeclaredContent(draft, "zh", [], "workspace");
  assert.equal(productsIntro.textContent.includes("以下参数为模拟设定"), true);
});

test("screwfast hero uses first product photo or industry schematic from adapter data", () => {
  const adapter = getTemplateAdapter("screwfast");
  assert.ok(adapter?.kit?.heroSchematics);
  const { document, body } = createDocument();
  const diagram = createNode("div");
  diagram.className = "sitecraft-diagram";
  diagram.setAttribute("data-sitecraft-hero-visual", "");
  const image = createNode("img");
  image.setAttribute("data-sitecraft-benchmark", "hero-image");
  image.hidden = true;
  diagram.appendChild(image);
  body.appendChild(diagram);

  const withPhoto = structuredClone(defaultDraft);
  withPhoto.industry = "外贸 B2B / 不锈钢流体接头目录";
  withPhoto.products[0].image = {
    imageId: "img_1234567890abcdef12345678",
    url: "/api/sites/test/images/img_1234567890abcdef12345678",
    alt: { zh: "接头", en: "Fitting" },
  };
  installOn(document, adapter).api.applyDeclaredContent(withPhoto, "zh", [], "published");
  assert.equal(image.getAttribute("src"), "/api/sites/test/images/img_1234567890abcdef12345678");
  assert.equal(image.hidden, false);
  assert.equal(diagram.getAttribute("data-sitecraft-hero-mode"), "photo");

  const noPhoto = structuredClone(defaultDraft);
  noPhoto.industry = "外贸 B2B / 不锈钢流体接头目录";
  noPhoto.products = noPhoto.products.map((product) => {
    const next = { ...product };
    delete next.image;
    return next;
  });
  installOn(document, adapter).api.applyDeclaredContent(noPhoto, "zh", [], "published");
  assert.equal(diagram.getAttribute("data-sitecraft-hero-schematic"), "fitting");
  assert.equal(diagram.getAttribute("data-sitecraft-hero-mode"), "schematic");
});

test("visitor page shows only 已有 and 认证中 certifications", () => {
  const adapter = getTemplateAdapter("screwfast");
  assert.ok(adapter);
  const { document, body } = createDocument();
  const section = createNode("section");
  section.setAttribute("data-sitecraft-section", "certifications");
  const grid = createNode("div");
  grid.setAttribute("data-sitecraft-catalog-grid", "certifications");
  section.appendChild(grid);
  body.appendChild(section);
  const draft = structuredClone(defaultDraft);
  draft.content.certifications = {
    title: { zh: "认证状态", en: "Certifications" },
    intro: { zh: "当前认证进展如下。", en: "Current certification status." },
    items: [
      { id: "cert-iso", title: { zh: "ISO 9001", en: "ISO 9001" }, body: { zh: "质量管理体系。", en: "QMS." }, status: "认证中" },
      { id: "cert-ce", title: { zh: "CE", en: "CE" }, body: { zh: "资料未提供。", en: "Not provided." }, status: "待补充" },
      { id: "cert-ok", title: { zh: "材料报告", en: "Material report" }, body: { zh: "可追溯。", en: "Traceable." }, status: "已有" },
    ],
  };
  installOn(document, adapter).api.applyDeclaredContent(draft, "zh", [], "published");
  const text = visibleText(body);
  assert.equal(text.includes("ISO 9001"), true);
  assert.equal(text.includes("材料报告"), true);
  assert.equal(text.includes("CE"), false);
  assert.equal(text.includes("认证中"), true);
  assert.equal(text.includes("已有"), true);
  assert.equal(section.hidden, false);

  draft.content.certifications.items = draft.content.certifications.items.map((item) => ({ ...item, status: "待补充" }));
  installOn(document, adapter).api.applyDeclaredContent(draft, "zh", [], "published");
  assert.equal(section.hidden, true);
});
