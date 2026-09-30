import assert from "node:assert/strict";
import test from "node:test";
import { defaultDraft, visualBriefCatalog } from "../lib/site-document.ts";
import { draftWithFixtureProducts } from "./fixtures/draft-with-products.ts";
import { applySiteOperations, type SiteOperation } from "../lib/site-operations.ts";
import { simulatedPacks } from "../lib/simulated-packs.ts";
import {
  PREVIEW_BRIDGE_SOURCE,
  buildPreviewBridgeScript,
  installPreviewBridge,
  stripHtmlScripts,
} from "../lib/template-adapters/preview-bridge.ts";
import { getTemplateAdapter } from "../lib/template-adapters/index.ts";
import { composeKitModules, selectedKitParts } from "../lib/template-adapters/kit.ts";
import { resolvePagePlan } from "../lib/template-pages.ts";
import type { TemplateAdapter } from "../lib/template-adapters/types.ts";

type FakeNode = {
  nodeType: number;
  tagName: string;
  parentNode: FakeNode | null;
  childNodes: FakeNode[];
  attributes: Map<string, string>;
  _text: string;
  hidden?: boolean;
  style?: {
    setProperty: (name: string, value: string, priority?: string) => void;
    removeProperty?: (name: string) => void;
  };
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

type FakeDocument = {
  documentElement: FakeNode;
  body: FakeNode;
  querySelectorAll: (selector: string) => FakeNode[];
  querySelector: (selector: string) => FakeNode | null;
  createElement: (tag: string) => FakeNode;
  addEventListener: (type: string, fn: (event: unknown) => void, capture?: boolean) => void;
  listeners: Array<{ type: string; fn: (event: unknown) => void }>;
};

const SENTINEL_ADAPTER: TemplateAdapter = {
  templateId: "sentinel-template",
  runtime: "static-html",
  slots: [
    { target: "hero.title", selector: "#sentinel-hero-title", attr: "text" },
    { target: "contact.email", selector: "[data-sentinel-email]", attr: "text" },
    { target: "features.items.1.title", selector: "#sentinel-feature-1-title", attr: "text" },
  ],
  alternatives: {
    "contact.title": "contact.email",
    "contact.body": "contact.email",
  },
};

const AMBIGUOUS_ADAPTER: TemplateAdapter = {
  templateId: "sentinel-template",
  runtime: "static-html",
  slots: [{ target: "hero.title", selector: "h1", attr: "text" }],
};

function camelToDataAttr(prop: string) {
  return `data-${prop.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
}

function createNode(tagName: string): FakeNode {
  const node: Partial<FakeNode> = {
    nodeType: 1,
    tagName: tagName.toUpperCase(),
    parentNode: null,
    childNodes: [],
    attributes: new Map<string, string>(),
    _text: "",
    hidden: false,
    styleValues: {},
    style: {
      setProperty(name: string, value: string) { node.styleValues![name] = value; },
      removeProperty(name: string) { delete node.styleValues![name]; },
    },
  };

  Object.defineProperties(node, {
    children: {
      get() {
        return node.childNodes!.filter((child) => child.nodeType === 1);
      },
    },
    parentElement: {
      get() {
        return node.parentNode?.nodeType === 1 ? node.parentNode : null;
      },
    },
    className: {
      get() {
        return node.attributes!.get("class") ?? "";
      },
      set(value: string) {
        node.attributes!.set("class", value);
      },
    },
    id: {
      get() {
        return node.attributes!.get("id") ?? "";
      },
      set(value: string) {
        node.attributes!.set("id", value);
      },
    },
    textContent: {
      get() {
        if (!node.childNodes!.length) return node._text ?? "";
        return node.childNodes!.map((child) => child.textContent).join("");
      },
      set(value: string) {
        node.childNodes = [];
        node._text = String(value);
      },
    },
    dataset: {
      get() {
        const attributes = node.attributes!;
        return new Proxy({} as Record<string, string>, {
          get(_target, prop) {
            if (typeof prop !== "string") return undefined;
            return attributes.get(camelToDataAttr(prop));
          },
          set(_target, prop, value) {
            if (typeof prop === "string") attributes.set(camelToDataAttr(prop), String(value));
            return true;
          },
        });
      },
    },
  });

  node.getAttribute = (name) => (node.attributes!.has(name) ? node.attributes!.get(name)! : null);
  node.setAttribute = (name, value) => {
    node.attributes!.set(name, String(value));
  };
  (node as FakeNode & { removeAttribute: (name: string) => void }).removeAttribute = (name) => {
    node.attributes!.delete(name);
  };
  node.appendChild = (child) => {
    child.parentNode = node as FakeNode;
    node.childNodes!.push(child);
    return child;
  };
  node.matches = (selector) => matchesSelector(node as FakeNode, selector);
  node.closest = (selector) => {
    let current: FakeNode | null = node as FakeNode;
    while (current) {
      if (current.matches(selector)) return current;
      current = current.parentElement;
    }
    return null;
  };
  node.querySelectorAll = (selector) => queryAll(node as FakeNode, selector);
  node.querySelector = (selector) => node.querySelectorAll!(selector)[0] ?? null;
  return node as FakeNode;
}

function splitSelectorList(selector: string) {
  const parts: string[] = [];
  let current = "";
  let quote = "";
  for (const char of selector) {
    if (quote) {
      current += char;
      if (char === quote) quote = "";
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      current += char;
      continue;
    }
    if (char === ",") {
      parts.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function parseSimple(simple: string) {
  const tokens: Array<{ type: string; value: string; flag?: string }> = [];
  const source = simple.trim();
  let index = 0;
  const tag = source.match(/^[a-zA-Z][\w-]*/);
  if (tag) {
    tokens.push({ type: "tag", value: tag[0].toUpperCase() });
    index = tag[0].length;
  } else if (source[0] !== "#" && source[0] !== "." && source[0] !== "[") {
    tokens.push({ type: "tag", value: "*" });
  }
  while (index < source.length) {
    if (source[index] === "#") {
      const match = source.slice(index + 1).match(/^[\w-]+/);
      tokens.push({ type: "id", value: match?.[0] ?? "" });
      index += 1 + (match?.[0].length ?? 0);
      continue;
    }
    if (source[index] === ".") {
      const match = source.slice(index + 1).match(/^[\w-]+/);
      tokens.push({ type: "class", value: match?.[0] ?? "" });
      index += 1 + (match?.[0].length ?? 0);
      continue;
    }
    if (source[index] === "[") {
      const end = source.indexOf("]", index);
      const body = source.slice(index + 1, end);
      const attrMatch = body.match(/^([\w:-]+)(?:(\^=|=)(?:"([^"]*)"|'([^']*)'|([^\]]+)))?$/);
      tokens.push({
        type: "attr",
        value: attrMatch?.[1] ?? body,
        flag: attrMatch?.[2],
      });
      if (attrMatch?.[2]) tokens[tokens.length - 1].value += `\0${attrMatch[3] ?? attrMatch[4] ?? attrMatch[5] ?? ""}`;
      index = end + 1;
      continue;
    }
    index += 1;
  }
  return tokens;
}

function matchSimple(node: FakeNode, simple: string) {
  if (simple === "*") return true;
  if (simple.startsWith(":")) return false;
  const tokens = parseSimple(simple);
  for (const token of tokens) {
    if (token.type === "tag" && token.value !== "*" && node.tagName !== token.value) return false;
    if (token.type === "id" && node.id !== token.value) return false;
    if (token.type === "class" && !node.className.split(/\s+/).includes(token.value)) return false;
    if (token.type === "attr") {
      const [name, expected] = token.value.split("\0");
      const actual = node.getAttribute(name);
      if (token.flag === "^=") {
        if (!actual || !actual.startsWith(expected ?? "")) return false;
      } else if (token.flag === "=") {
        if (actual !== expected) return false;
      } else if (actual == null) {
        return false;
      }
    }
  }
  return tokens.length > 0;
}

function parseChain(selector: string) {
  const chain: Array<{ combinator: "desc" | "child"; simple: string }> = [];
  const source = selector.trim().replace(/\s*>\s*/g, " > ");
  const parts: string[] = [];
  let current = "";
  let quote = "";
  for (const char of source) {
    if (quote) {
      current += char;
      if (char === quote) quote = "";
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      current += char;
      continue;
    }
    if (char === " ") {
      if (current) parts.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  if (current) parts.push(current);
  let combinator: "desc" | "child" = "desc";
  for (const part of parts) {
    if (part === ">") {
      combinator = "child";
      continue;
    }
    chain.push({ combinator, simple: part });
    combinator = "desc";
  }
  return chain;
}

function walk(node: FakeNode, visit: (current: FakeNode) => void) {
  visit(node);
  for (const child of node.childNodes) walk(child, visit);
}

function matchChain(node: FakeNode, chain: ReturnType<typeof parseChain>) {
  let current: FakeNode | null = node;
  for (let index = chain.length - 1; index >= 0; index -= 1) {
    if (!current || !matchSimple(current, chain[index].simple)) return false;
    if (index === 0) return true;
    if (chain[index].combinator === "child") {
      current = current.parentElement;
      continue;
    }
    let ancestor: FakeNode | null = current.parentElement;
    let found: FakeNode | null = null;
    while (ancestor) {
      if (matchSimple(ancestor, chain[index - 1].simple)) {
        found = ancestor;
        break;
      }
      ancestor = ancestor.parentElement;
    }
    current = found;
  }
  return true;
}

function matchesSelector(node: FakeNode, selector: string) {
  return splitSelectorList(selector).some((part) => matchChain(node, parseChain(part)));
}

function queryAll(root: FakeNode, selector: string) {
  const matched: FakeNode[] = [];
  walk(root, (node) => {
    if (node === root) return;
    if (matchesSelector(node, selector)) matched.push(node);
  });
  return matched;
}

function createDocument(): { document: FakeDocument; nodes: Record<string, FakeNode> } {
  const documentElement = createNode("html");
  const body = createNode("body");
  documentElement.appendChild(body);

  const hero = createNode("h1");
  hero.id = "sentinel-hero-title";
  hero.textContent = "OLD_HERO";
  const decoy = createNode("h1");
  decoy.id = "decoy-h1";
  decoy.textContent = "DECOY_H1_MUST_STAY";
  const email = createNode("a");
  email.setAttribute("data-sentinel-email", "true");
  email.setAttribute("href", "mailto:old@example.com");
  email.textContent = "old@example.com";
  const card = createNode("article");
  card.className = "card";
  const cardTitle = createNode("h3");
  cardTitle.textContent = "UNDECLARED_CARD_TITLE";
  const cardBody = createNode("p");
  cardBody.textContent = "UNDECLARED_CARD_BODY";
  card.appendChild(cardTitle);
  card.appendChild(cardBody);
  const feature = createNode("h3");
  feature.id = "sentinel-feature-1-title";
  feature.textContent = "OLD_FEATURE_1";
  const aboutDecoy = createNode("h2");
  aboutDecoy.id = "about-decoy";
  aboutDecoy.textContent = "ABOUT_DECOY_MUST_STAY";
  const productsLink = createNode("a");
  productsLink.setAttribute("href", "/products");
  productsLink.textContent = "Products";

  body.appendChild(hero);
  body.appendChild(decoy);
  body.appendChild(email);
  body.appendChild(card);
  body.appendChild(feature);
  body.appendChild(aboutDecoy);
  body.appendChild(productsLink);

  const listeners: FakeDocument["listeners"] = [];
  const document: FakeDocument = {
    documentElement,
    body,
    listeners,
    querySelectorAll: (selector) => queryAll(documentElement, selector),
    querySelector: (selector) => queryAll(documentElement, selector)[0] ?? null,
    createElement: (tag) => createNode(tag),
    addEventListener: (type, fn) => {
      listeners.push({ type, fn });
    },
  };
  return {
    document,
    nodes: { hero, decoy, email, cardTitle, cardBody, feature, aboutDecoy, productsLink },
  };
}

function sentinelDraft() {
  return {
    revision: 9,
    companyName: "Sentinel Co",
    content: {
      hero: { title: { zh: "NEW_HERO_ZH", en: "NEW_HERO_EN" }, subtitle: { zh: "SUB_ZH", en: "SUB_EN" }, cta: { zh: "CTA_ZH", en: "CTA_EN" }, image: undefined as { imageId: string; url: string; alt: { zh: string; en: string } } | undefined },
      about: { title: { zh: "ABOUT_ZH", en: "ABOUT_EN" }, body: { zh: "ABOUT_BODY", en: "ABOUT_BODY_EN" } },
      features: {
        title: { zh: "FEAT", en: "FEAT_EN" },
        intro: { zh: "INTRO", en: "INTRO_EN" },
        items: [
          { id: "zero", title: { zh: "ITEM0", en: "ITEM0_EN" }, body: { zh: "BODY0", en: "BODY0_EN" } },
          { id: "one", title: { zh: "ITEM1_ZH", en: "ITEM1_EN" }, body: { zh: "BODY1", en: "BODY1_EN" } },
        ],
      },
      services: { title: { zh: "SVC", en: "SVC_EN" }, intro: { zh: "", en: "" }, items: [] },
      products: { title: { zh: "PRODUCTS_TITLE", en: "PRODUCTS_EN" }, intro: { zh: "PRODUCTS_INTRO", en: "" } },
      contact: {
        title: { zh: "CONTACT_TITLE", en: "CONTACT_TITLE_EN" },
        body: { zh: "CONTACT_BODY", en: "" },
        email: "new@example.com",
        phone: "123",
        address: { zh: "ADDR", en: "ADDR_EN" },
      },
    },
    products: [{ sku: "SKU-1", name: { zh: "PNAME", en: "PNAME_EN" }, summary: { zh: "PSUM", en: "PSUM_EN" } }],
  };
}

function legacyHeuristicApply(document: FakeDocument, draft: ReturnType<typeof sentinelDraft>, locale: "zh" | "en") {
  const hero = document.querySelector("h1");
  if (hero) hero.textContent = draft.content.hero.title[locale];
  const cards = document.querySelectorAll(".card");
  cards.forEach((card, index) => {
    const title = card.querySelector("h3");
    const body = card.querySelector("p");
    const item = draft.content.features.items[index];
    if (title && item) title.textContent = item.title[locale];
    if (body && item) body.textContent = item.body[locale];
  });
  const section = document.createElement("section");
  section.setAttribute("data-sitecraft-generated-products", "true");
  const heading = document.createElement("h2");
  heading.textContent = draft.content.products.title[locale];
  section.appendChild(heading);
  document.body.appendChild(section);
  const about = document.querySelector("#about-decoy");
  if (about) about.textContent = draft.content.about.title[locale];
}

function installOn(document: FakeDocument, adapter: TemplateAdapter | null) {
  const messages: Array<Record<string, unknown>> = [];
  const globalObject: Record<string, unknown> = {
    document,
    parent: {
      postMessage(payload: Record<string, unknown>) {
        messages.push(payload);
      },
    },
    addEventListener() {},
  };
  globalObject.window = globalObject;
  const api = installPreviewBridge(globalObject, "sentinel-template", adapter);
  return { api, messages, globalObject };
}

test("generated bridge source stays callable JavaScript without per-template functions", () => {
  assert.match(PREVIEW_BRIDGE_SOURCE, /function sitecraftPreviewBridge/);
  assert.equal(PREVIEW_BRIDGE_SOURCE.includes("prepareFn"), false);
  assert.equal(PREVIEW_BRIDGE_SOURCE.includes("scopeBy"), false);
  assert.equal(PREVIEW_BRIDGE_SOURCE.includes("findHero"), false);
  assert.equal(PREVIEW_BRIDGE_SOURCE.includes("renderAdditionalProducts"), false);
  const script = buildPreviewBridgeScript("forge", SENTINEL_ADAPTER);
  assert.match(script, /<script nonce="sitecraft-template-bridge">/);
  assert.match(script, /sentinel-hero-title/);
});

test("legacy heuristics fail the sentinel contract that the generated bridge must pass", () => {
  const { document, nodes } = createDocument();
  legacyHeuristicApply(document, sentinelDraft(), "zh");
  assert.equal(nodes.hero.textContent, "NEW_HERO_ZH");
  assert.equal(nodes.cardTitle.textContent, "ITEM0");
  assert.equal(nodes.cardBody.textContent, "BODY0");
  assert.equal(nodes.aboutDecoy.textContent, "ABOUT_ZH");
  assert.equal(document.querySelectorAll("[data-sitecraft-generated-products]").length, 1);
});

test("declared-only generated bridge writes unique sentinels and reports exact misses", () => {
  const { document, nodes } = createDocument();
  const { api } = installOn(document, SENTINEL_ADAPTER);
  const report = api.applyDeclaredContent(sentinelDraft(), "zh", [
    "hero.title.zh",
    "hero.title.en",
    "contact.email.zh",
    "contact.title.zh",
    "about.title.zh",
    "features.items.1.title.zh",
    "features.items.10.title.zh",
    "products.SKU-1.name.zh",
  ], "workspace");

  assert.equal(nodes.hero.textContent, "NEW_HERO_ZH");
  assert.equal(nodes.decoy.textContent, "DECOY_H1_MUST_STAY");
  assert.equal(nodes.email.textContent, "new@example.com");
  assert.equal(nodes.email.getAttribute("href"), "mailto:new@example.com");
  assert.equal(nodes.feature.textContent, "ITEM1_ZH");
  assert.equal(nodes.cardTitle.textContent, "UNDECLARED_CARD_TITLE");
  assert.equal(nodes.cardBody.textContent, "UNDECLARED_CARD_BODY");
  assert.equal(nodes.aboutDecoy.textContent, "ABOUT_DECOY_MUST_STAY");
  assert.equal(document.querySelectorAll("[data-sitecraft-generated-products]").length, 0);
  assert.deepEqual(report.fallbackMatched, []);
  assert.ok(report.appliedSlots.includes("hero.title.zh"));
  assert.ok(report.appliedSlots.includes("contact.email.zh"));
  assert.ok(report.appliedSlots.includes("features.items.1.title.zh"));
  assert.ok(report.missingSlots.includes("hero.title.en"));
  assert.ok(report.missingSlots.includes("about.title.zh"));
  assert.ok(report.missingSlots.includes("features.items.10.title.zh"));
  assert.ok(report.missingSlots.includes("products.SKU-1.name.zh"));
  assert.ok(report.missingSlots.includes("contact.title.zh"));
  assert.deepEqual(report.proposedAlternatives, [{ requested: "contact.title.zh", proposed: "contact.email" }]);
  assert.equal(report.missingSlots.includes("features.items.1.title.zh"), false);
});

test("ambiguous declared selectors and missing adapters write nothing", () => {
  const { document, nodes } = createDocument();
  const found = document.querySelectorAll("h1");
  assert.equal(found.length, 2, `expected two h1 nodes, got ${found.length} tags=${found.map((node) => node.tagName + "#" + node.id).join(",")}`);
  const { api } = installOn(document, AMBIGUOUS_ADAPTER);
  const report = api.applyDeclaredContent(sentinelDraft(), "zh", ["hero.title.zh"], "workspace");
  assert.equal(nodes.hero.textContent, "OLD_HERO");
  assert.equal(nodes.decoy.textContent, "DECOY_H1_MUST_STAY");
  assert.deepEqual(report.appliedSlots, []);
  assert.deepEqual(report.missingSlots, ["hero.title.zh"]);
  assert.deepEqual(report.fallbackMatched, []);

  const blank = createDocument();
  const none = installOn(blank.document, null);
  const emptyReport = none.api.applyDeclaredContent(sentinelDraft(), "zh", ["hero.title.zh", "contact.email.zh"], "workspace");
  assert.equal(blank.nodes.hero.textContent, "OLD_HERO");
  assert.equal(blank.nodes.email.textContent, "old@example.com");
  assert.deepEqual(emptyReport.appliedSlots, []);
  assert.deepEqual(emptyReport.missingSlots, ["hero.title.zh", "contact.email.zh"]);
});

test("empty declared values clear old content and unmapped clicks keep navigation", () => {
  const { document, nodes } = createDocument();
  const { api, messages } = installOn(document, SENTINEL_ADAPTER);
  const draft = sentinelDraft();
  draft.content.hero.title.zh = "";
  const report = api.applyDeclaredContent(draft, "zh", ["hero.title.zh"], "workspace");
  assert.equal(nodes.hero.textContent, "");
  assert.equal(report.appliedSlots.includes("hero.title.zh"), true);
  assert.deepEqual(report.missingSlots, []);

  api.applyDeclaredContent(sentinelDraft(), "zh", ["hero.title.zh"], "workspace");
  const click = document.listeners.find((listener) => listener.type === "click");
  assert.ok(click);
  let preventUnmapped = false;
  click.fn({
    target: nodes.productsLink,
    preventDefault() {
      preventUnmapped = true;
    },
    stopPropagation() {},
  });
  assert.equal(preventUnmapped, false);
  assert.equal(messages.some((message) => message.type === "sitecraft:select"), false);

  let preventMapped = false;
  click.fn({
    target: nodes.hero,
    preventDefault() {
      preventMapped = true;
    },
    stopPropagation() {},
  });
  assert.equal(preventMapped, true);
  const select = messages.filter((message) => message.type === "sitecraft:select");
  assert.equal(select.length, 1);
  assert.equal(select[0]?.target, "heroTitle");
  assert.equal(select[0]?.slot, "hero.title.zh");

  const published = createDocument();
  installOn(published.document, SENTINEL_ADAPTER).api.applyDeclaredContent(sentinelDraft(), "zh", [], "published");
  const publishedClick = published.document.listeners.find((listener) => listener.type === "click");
  let preventPublished = false;
  publishedClick?.fn({
    target: published.nodes.hero,
    preventDefault() {
      preventPublished = true;
    },
    stopPropagation() {},
  });
  assert.equal(preventPublished, false);
  assert.equal(published.document.body.styleValues["padding-bottom"], undefined);
});

test("unsupported structural changes remain missing instead of disappearing from the report", () => {
  const { document } = createDocument();
  const { api } = installOn(document, SENTINEL_ADAPTER);
  const requested = ["services.visibility", "sections.order", "products", "draft", "features.items.10"];
  const report = api.applyDeclaredContent(sentinelDraft(), "zh", requested, "workspace");
  assert.deepEqual(report.missingSlots, requested);
  assert.deepEqual(report.fallbackMatched, []);
});

test("local snapshot script stripping removes upstream scripts only", () => {
  const html = `<html><body><h1>Hi</h1><script>window.overwrite = true;</script></body></html>`;
  const stripped = stripHtmlScripts(html);
  assert.equal(stripped.includes("<script>"), false);
  assert.match(stripped, /<h1>Hi<\/h1>/);
});

function createLandwindFragment() {
  const { document } = createDocument();
  const brand = createNode("span");
  brand.setAttribute("data-sitecraft-brand-name", "nav");
  brand.textContent = "企业目录";
  const title = createNode("h1");
  title.setAttribute("data-sitecraft-benchmark", "hero-title");
  title.textContent = "把目录、规格与询盘放在同一条路径";
  const subtitle = createNode("p");
  subtitle.setAttribute("data-sitecraft-benchmark", "hero-subtitle");
  subtitle.textContent = "围绕产品类别、规格和批量需求，把一次询盘说清楚。";
  const cta = createNode("a");
  cta.setAttribute("data-sitecraft-benchmark", "hero-cta");
  cta.setAttribute("href", "#contact");
  cta.textContent = "获取产品目录";
  const figma = createNode("a");
  figma.className = "inline-flex items-center justify-center w-full px-5 py-3 mb-2 mr-2 text-sm font-medium text-gray-900 bg-white border border-gray-200 rounded-lg sm:w-auto";
  figma.textContent = "Get Figma file";
  figma.setAttribute("data-sitecraft-demo", "figma");
  const undeclared = createNode("h2");
  undeclared.textContent = "未选用的标题";
  document.body.appendChild(brand);
  document.body.appendChild(title);
  document.body.appendChild(subtitle);
  document.body.appendChild(cta);
  document.body.appendChild(figma);
  document.body.appendChild(undeclared);
  return { document, nodes: { brand, title, subtitle, cta, figma, undeclared } };
}

const THEME_COMPARE_PACKS = {
  A17: {
    companyName: "汉川精密阀业A17",
    title: "定制阀组出口，按图加工 A17",
    subtitle: "不提供现场安装；仅接受批量规格询盘 A17。",
    cta: "获取阀组规格表 A17",
  },
  B84: {
    companyName: "北湾流体接头B84",
    title: "不锈钢快换接头目录 B84",
    subtitle: "面向OEM装配线的接头规格与交期说明 B84。",
    cta: "索取接头样品册 B84",
  },
} as const;

const themeCompareOptions = { templateIds: new Set(["forge", "landwind"]), lastChange: "theme-compare" };

function landwindSample(id: "A17" | "B84") {
  const sample = THEME_COMPARE_PACKS[id];
  const draft = sentinelDraft();
  draft.revision = id === "A17" ? 11 : 12;
  draft.companyName = sample.companyName;
  draft.content.hero.title.zh = sample.title;
  draft.content.hero.subtitle.zh = sample.subtitle;
  draft.content.hero.cta.zh = sample.cta;
  return { draft, sample };
}

function createForgeFragment() {
  const { document } = createDocument();
  const logo = createNode("h1");
  logo.setAttribute("data-sitecraft-brand-name", "nav");
  logo.textContent = "明亮产品";
  const hero = createNode("h1");
  hero.setAttribute("data-sitecraft-benchmark", "hero-title");
  hero.textContent = "先看清产品，再决定下一步";
  const subtitle = createNode("h2");
  subtitle.setAttribute("data-sitecraft-benchmark", "hero-subtitle");
  subtitle.textContent = "把已确认的产品能力、适用范围和询盘入口放在一页里。";
  const cta = createNode("a");
  cta.setAttribute("data-sitecraft-benchmark", "hero-cta");
  cta.textContent = "查看产品能力";
  document.body.appendChild(logo);
  document.body.appendChild(hero);
  document.body.appendChild(subtitle);
  document.body.appendChild(cta);
  return { document, nodes: { logo, hero, subtitle, cta } };
}

function authoredCompareDraft(id: "A17" | "B84") {
  const pack = THEME_COMPARE_PACKS[id];
  return applySiteOperations(structuredClone(defaultDraft), [
    { op: "set_text", target: "companyName", value: pack.companyName },
    { op: "set_text", target: "hero.title", locale: "zh", value: pack.title },
    { op: "set_text", target: "hero.subtitle", locale: "zh", value: pack.subtitle },
    { op: "set_text", target: "hero.cta", locale: "zh", value: pack.cta },
  ], themeCompareOptions).draft;
}

test("hero lines read industry and navigation follows the draft language", () => {
  const adapter = getTemplateAdapter("screwfast");
  assert.ok(adapter);
  const { document } = createDocument();
  const eyebrow = createNode("p");
  eyebrow.setAttribute("data-sitecraft-optional", "industry");
  eyebrow.hidden = true;
  const nav = createNode("a");
  nav.setAttribute("data-sitecraft-nav", "services");
  nav.textContent = "服务";
  const label = createNode("span");
  label.setAttribute("data-sitecraft-ui", "faq");
  label.textContent = "常见问题";
  document.body.appendChild(eyebrow);
  document.body.appendChild(nav);
  document.body.appendChild(label);
  const { api } = installOn(document, adapter);
  const draft = structuredClone(defaultDraft);
  draft.industry = "";
  draft.navigation.services = { zh: "加工方式", en: "Process" };
  draft.visualBrief = structuredClone(visualBriefCatalog.find((item) => item.id === "engineering-industrial")!);
  api.applyDeclaredContent(draft, "zh", [], "workspace");
  assert.equal(eyebrow.hidden, true);
  assert.equal(eyebrow.textContent, "");
  assert.equal(nav.textContent, "加工方式");
  assert.equal(label.textContent, "常见问题");
  api.applyDeclaredContent(draft, "en", [], "workspace");
  assert.equal(nav.textContent, "Process");
  assert.equal(label.textContent, "Questions");
  draft.industry = "减速机";
  api.applyDeclaredContent(draft, "zh", [], "workspace");
  assert.equal(eyebrow.hidden, false);
  assert.equal(eyebrow.textContent, "减速机");
});

test("hiding a section also hides its navigation link and renumbers the visible sections", () => {
  const adapter = getTemplateAdapter("screwfast");
  assert.ok(adapter);
  const { document } = createDocument();
  const navServices = createNode("a");
  navServices.setAttribute("href", "#process");
  navServices.setAttribute("data-sitecraft-nav", "services");
  navServices.textContent = "加工方式";
  const navProducts = createNode("a");
  navProducts.setAttribute("href", "#products");
  navProducts.setAttribute("data-sitecraft-nav", "products");
  const navFaq = createNode("a");
  navFaq.setAttribute("href", "#faq");
  document.body.appendChild(navProducts);
  document.body.appendChild(navServices);
  document.body.appendChild(navFaq);
  const sections = [
    ["products", "products", "01"],
    ["services", "process", "02"],
    ["contact", "inquiry", "03"],
    ["faq", "faq", "04"],
  ] as const;
  const indexes = [];
  for (const [key, id, number] of sections) {
    const section = createNode("section");
    section.id = id;
    section.setAttribute("data-sitecraft-section", key);
    const index = createNode("span");
    index.setAttribute("data-sitecraft-section-index", "");
    index.textContent = number;
    section.appendChild(index);
    document.body.appendChild(section);
    indexes.push(index);
  }
  const { api } = installOn(document, adapter);
  const draft = structuredClone(defaultDraft);
  draft.hiddenSections = ["services"];
  draft.templateId = "screwfast";
  api.applyDeclaredContent(draft, "zh", [], "workspace");
  assert.equal(navServices.hidden, true);
  assert.equal(navProducts.hidden, false);
  assert.equal(navFaq.hidden, false);
  assert.deepEqual(indexes.map((node) => node.textContent), ["01", "02", "02", "03"]);
});

test("a FAQ entry with no title and no body is hidden, and a sentence gap stays visible", () => {
  const adapter = getTemplateAdapter("screwfast");
  assert.ok(adapter);
  const { document } = createDocument();
  const section = createNode("section");
  section.id = "faq";
  section.setAttribute("data-sitecraft-section", "faq");
  const intro = createNode("p");
  intro.setAttribute("data-sitecraft-benchmark", "faq-intro");
  const real = createNode("article");
  const realTitle = createNode("h3");
  realTitle.setAttribute("data-sitecraft-benchmark", "faq-item-0-title");
  const realBody = createNode("p");
  realBody.setAttribute("data-sitecraft-benchmark", "faq-item-0-body");
  real.appendChild(realTitle);
  real.appendChild(realBody);
  const empty = createNode("article");
  const emptyTitle = createNode("h3");
  emptyTitle.setAttribute("data-sitecraft-benchmark", "faq-item-1-title");
  const emptyBody = createNode("p");
  emptyBody.setAttribute("data-sitecraft-benchmark", "faq-item-1-body");
  empty.appendChild(emptyTitle);
  empty.appendChild(emptyBody);
  section.appendChild(intro);
  section.appendChild(real);
  section.appendChild(empty);
  const nav = createNode("a");
  nav.setAttribute("href", "#faq");
  nav.textContent = "常见问题";
  document.body.appendChild(nav);
  document.body.appendChild(section);
  const { api } = installOn(document, adapter);
  const draft = applySiteOperations(structuredClone(defaultDraft), [
    { op: "set_text", target: "faq.intro", locale: "zh", value: "交期和认证只写资料里已经有的。" },
    { op: "update_card", section: "faq", index: 0, locale: "zh", title: "交期如何确认？", body: "批量规格询盘的交期待补充。" },
    { op: "update_card", section: "faq", index: 1, locale: "zh", title: "待补充", body: "待补充" },
  ], { templateIds: new Set(["screwfast"]), lastChange: "faq-gap" }).draft;
  api.applyDeclaredContent(draft, "zh", [], "workspace");
  assert.equal(intro.hidden, false);
  assert.equal(intro.textContent, "交期和认证只写资料里已经有的。");
  assert.equal(real.hidden, false);
  assert.equal(realBody.textContent, "批量规格询盘的交期待补充。");
  assert.equal(empty.hidden, true);
  assert.equal(nav.hidden, false);
  assert.equal(section.hidden, false);
});

test("filling FAQ gaps on the same preview document restores entries and the section", () => {
  const adapter = getTemplateAdapter("screwfast");
  assert.ok(adapter);
  const { document } = createDocument();
  const section = createNode("section");
  section.id = "faq";
  section.setAttribute("data-sitecraft-section", "faq");
  const entries = [0, 1, 2].map((index) => {
    const article = createNode("article");
    const title = createNode("h3");
    title.setAttribute("data-sitecraft-benchmark", `faq-item-${index}-title`);
    const body = createNode("p");
    body.setAttribute("data-sitecraft-benchmark", `faq-item-${index}-body`);
    article.appendChild(title);
    article.appendChild(body);
    section.appendChild(article);
    return { article, title, body };
  });
  const nav = createNode("a");
  nav.setAttribute("href", "#faq");
  nav.setAttribute("data-sitecraft-ui", "faq");
  nav.textContent = "常见问题";
  document.body.appendChild(nav);
  document.body.appendChild(section);
  const { api } = installOn(document, adapter);

  const gapDraft = structuredClone(defaultDraft);
  gapDraft.content.faq = {
    title: { zh: "常见问题", en: "FAQ" },
    intro: { zh: "待补充", en: "To be provided" },
    items: [
      { id: "faq-gap-0", title: { zh: "待补充", en: "To be provided" }, body: { zh: "待补充", en: "To be provided" } },
      { id: "faq-gap-1", title: { zh: "待补充", en: "To be provided" }, body: { zh: "待补充", en: "To be provided" } },
      { id: "faq-gap-2", title: { zh: "待补充", en: "To be provided" }, body: { zh: "待补充", en: "To be provided" } },
    ],
  };
  api.applyDeclaredContent(gapDraft, "zh", [], "workspace");
  for (const entry of entries) assert.equal(entry.article.hidden, true);
  assert.equal(section.hidden, true);
  assert.equal(nav.hidden, true);

  const filledDraft = structuredClone(gapDraft);
  filledDraft.content.faq = {
    title: { zh: "常见问题", en: "FAQ" },
    intro: { zh: "交期和认证以资料为准。", en: "Lead time follows materials." },
    items: [
      { id: "faq-fill-0", title: { zh: "交期如何确认？", en: "Lead time?" }, body: { zh: "批量询盘后确认。", en: "Confirm after RFQ." } },
      { id: "faq-fill-1", title: { zh: "MOQ 是多少？", en: "MOQ?" }, body: { zh: "MOQ 20台。", en: "MOQ 20 units." } },
      { id: "faq-fill-2", title: { zh: "是否安装？", en: "Install?" }, body: { zh: "不提供现场安装。", en: "No on-site install." } },
    ],
  };
  api.applyDeclaredContent(filledDraft, "zh", [], "workspace");
  for (const entry of entries) {
    assert.equal(entry.article.hidden, false, "filled FAQ entries must become visible again on the same document");
    assert.notEqual(entry.article.styleValues.display, "none");
  }
  assert.equal(section.hidden, false, "FAQ section must reopen after gaps are filled");
  assert.notEqual(section.styleValues.display, "none");
  assert.equal(nav.hidden, false);
  assert.equal(entries[0].title.textContent, "交期如何确认？");
  assert.equal(entries[0].body.textContent, "批量询盘后确认。");
});

test("landwind first-screen slots follow two independent samples and leave undeclared headings", () => {
  const adapter = getTemplateAdapter("landwind");
  assert.ok(adapter, "landwind adapter is required before quality comparison");
  const { document, nodes } = createLandwindFragment();
  const { api } = installOn(document, adapter);
  const first = landwindSample("A17");
  const second = landwindSample("B84");
  const expected = ["companyName.zh", "hero.title.zh", "hero.subtitle.zh", "hero.cta.zh", "contact.email.zh"];

  const firstReport = api.applyDeclaredContent(first.draft, "zh", expected, "workspace");
  assert.equal(nodes.brand.textContent, first.sample.companyName);
  assert.equal(nodes.title.textContent, first.sample.title);
  assert.equal(nodes.subtitle.textContent, first.sample.subtitle);
  assert.equal(nodes.cta.textContent, first.sample.cta);
  assert.equal(nodes.figma.textContent, "Get Figma file");
  assert.equal(nodes.figma.hidden, true);
  assert.equal(visibleText(nodes.figma), "");
  assert.equal(nodes.undeclared.textContent, "未选用的标题");
  assert.equal(nodes.title.textContent.includes("Building digital"), false);
  assert.ok(firstReport.appliedSlots.includes("hero.title.zh"));
  assert.ok(firstReport.missingSlots.includes("contact.email.zh"));
  assert.deepEqual(firstReport.fallbackMatched, []);
  assert.deepEqual(firstReport.proposedAlternatives, [{ requested: "contact.email.zh", proposed: "hero.cta" }]);

  const secondReport = api.applyDeclaredContent(second.draft, "zh", expected, "workspace");
  assert.equal(nodes.brand.textContent, second.sample.companyName);
  assert.equal(nodes.title.textContent, second.sample.title);
  assert.equal(nodes.subtitle.textContent, second.sample.subtitle);
  assert.equal(nodes.cta.textContent, second.sample.cta);
  assert.equal(nodes.undeclared.textContent, "未选用的标题");
  assert.equal(nodes.title.textContent === first.sample.title, false);
  assert.ok(secondReport.appliedSlots.includes("hero.title.zh"));
  assert.ok(secondReport.missingSlots.includes("contact.email.zh"));
});

test("the same authored pack lands on forge and landwind with different chrome", () => {
  const forgeAdapter = getTemplateAdapter("forge");
  const landwindAdapter = getTemplateAdapter("landwind");
  assert.ok(forgeAdapter && landwindAdapter, "both templates must stay declared before quality comparison");
  const expected = ["companyName.zh", "hero.title.zh", "hero.subtitle.zh", "hero.cta.zh", "contact.email.zh"];
  const forge = createForgeFragment();
  const landwind = createLandwindFragment();
  const forgeApi = installPreviewBridge({ document: forge.document, parent: { postMessage() {} }, addEventListener() {} }, "forge", forgeAdapter);
  const landwindApi = installPreviewBridge({ document: landwind.document, parent: { postMessage() {} }, addEventListener() {} }, "landwind", landwindAdapter);

  const packA = authoredCompareDraft("A17");
  const packB = authoredCompareDraft("B84");
  const landwindA = applySiteOperations(packA, [{ op: "set_visual_brief", briefId: "export-catalog" }], themeCompareOptions);
  const landwindB = applySiteOperations(packB, [{ op: "set_visual_brief", briefId: "export-catalog" }], themeCompareOptions);
  assert.equal(packA.templateId, "forge");
  assert.equal(landwindA.draft.templateId, "landwind");
  assert.equal(landwindA.draft.content.hero.title.zh, packA.content.hero.title.zh);

  const forgeReport = forgeApi.applyDeclaredContent(packA, "zh", expected, "workspace");
  const landwindReport = landwindApi.applyDeclaredContent(landwindA.draft, "zh", expected, "workspace");
  assert.equal(forge.nodes.hero.textContent, THEME_COMPARE_PACKS.A17.title);
  assert.equal(forge.nodes.subtitle.textContent, THEME_COMPARE_PACKS.A17.subtitle);
  assert.equal(forge.nodes.logo.textContent, THEME_COMPARE_PACKS.A17.companyName);
  assert.equal(forge.nodes.hero.getAttribute("data-sitecraft-benchmark"), "hero-title");
  assert.equal(landwind.nodes.brand.textContent, THEME_COMPARE_PACKS.A17.companyName);
  assert.equal(landwind.nodes.title.textContent, THEME_COMPARE_PACKS.A17.title);
  assert.equal(landwind.nodes.subtitle.textContent, THEME_COMPARE_PACKS.A17.subtitle);
  assert.equal(landwind.nodes.cta.textContent, THEME_COMPARE_PACKS.A17.cta);
  assert.equal(landwind.nodes.undeclared.textContent, "未选用的标题");
  assert.equal(forge.nodes.hero.textContent, landwind.nodes.title.textContent);
  assert.ok(forgeReport.appliedSlots.includes("hero.title.zh"));
  assert.ok(forgeReport.appliedSlots.includes("companyName.zh"));
  assert.ok(forgeReport.appliedSlots.includes("hero.cta.zh"));
  assert.ok(landwindReport.appliedSlots.includes("companyName.zh"));
  assert.ok(landwindReport.appliedSlots.includes("hero.cta.zh"));
  assert.ok(forgeReport.missingSlots.includes("contact.email.zh"));
  assert.ok(landwindReport.missingSlots.includes("contact.email.zh"));
  assert.deepEqual(landwindReport.proposedAlternatives, [{ requested: "contact.email.zh", proposed: "hero.cta" }]);
  assert.deepEqual(forgeReport.fallbackMatched, []);
  assert.deepEqual(landwindReport.fallbackMatched, []);

  forgeApi.applyDeclaredContent(packB, "zh", expected, "workspace");
  landwindApi.applyDeclaredContent(landwindB.draft, "zh", expected, "workspace");
  assert.equal(forge.nodes.hero.textContent, THEME_COMPARE_PACKS.B84.title);
  assert.equal(landwind.nodes.title.textContent, THEME_COMPARE_PACKS.B84.title);
  assert.equal(forge.nodes.hero.textContent === THEME_COMPARE_PACKS.A17.title, false);
  assert.equal(landwind.nodes.brand.textContent, THEME_COMPARE_PACKS.B84.companyName);
  assert.equal(forge.nodes.logo.textContent, THEME_COMPARE_PACKS.B84.companyName);
  assert.equal(landwind.nodes.undeclared.textContent, "未选用的标题");
});

function visibilityDraft(hiddenSections: string[] = []) {
  const draft = sentinelDraft() as ReturnType<typeof sentinelDraft> & { hiddenSections: string[]; templateId: string };
  draft.hiddenSections = hiddenSections;
  draft.templateId = "forge";
  return draft;
}

function createFamilyFragments() {
  const forge = createForgeFragment();
  const faq = createNode("div");
  faq.setAttribute("data-sitecraft-section", "faq");
  faq.textContent = "Frequently Asked Questions";
  const services = createNode("section");
  services.setAttribute("data-sitecraft-section", "services");
  services.textContent = "Services";
  const why = createNode("section");
  why.setAttribute("data-sitecraft-section", "products");
  const whyInner = createNode("div");
  whyInner.textContent = "Products";
  why.appendChild(whyInner);
  forge.document.body.appendChild(faq);
  forge.document.body.appendChild(services);
  forge.document.body.appendChild(why);
  const forgeContact = createNode("section");
  forgeContact.setAttribute("data-sitecraft-section", "contact");
  forge.document.body.appendChild(forgeContact);

  const landwind = createLandwindFragment();
  const solutions = createNode("section");
  const tools = createNode("h2");
  tools.textContent = "Work with tools you already use";
  const featureImg = createNode("img");
  featureImg.setAttribute("alt", "dashboard feature image");
  solutions.appendChild(tools);
  solutions.appendChild(featureImg);
  const partners = createNode("section");
  const trusted = createNode("h2");
  trusted.className = "mt-3 mb-4 text-3xl font-extrabold";
  trusted.textContent = "Trusted by over 600 million users and 10,000 teams";
  partners.appendChild(trusted);
  const faqSection = createNode("section");
  const accordion = createNode("div");
  accordion.id = "accordion-flush";
  accordion.textContent = "Frequently asked questions";
  faqSection.appendChild(accordion);
  const inquiry = createNode("section");
  inquiry.setAttribute("data-sitecraft-section", "contact");
  const trial = createNode("h2");
  trial.className = "mb-4 text-3xl font-extrabold leading-tight";
  trial.textContent = "Start your free trial today";
  inquiry.appendChild(trial);
  const pricing = createNode("h2");
  pricing.textContent = "Designed for business teams like yours";
  pricing.setAttribute("data-sitecraft-demo", "pricing");
  landwind.document.body.appendChild(solutions);
  landwind.document.body.appendChild(partners);
  landwind.document.body.appendChild(faqSection);
  landwind.document.body.appendChild(inquiry);
  landwind.document.body.appendChild(pricing);
  const landwindProducts = createNode("section");
  landwindProducts.setAttribute("data-sitecraft-section", "products");
  const landwindServices = createNode("section");
  landwindServices.setAttribute("data-sitecraft-section", "services");
  const landwindFaq = createNode("section");
  landwindFaq.setAttribute("data-sitecraft-section", "faq");
  landwind.document.body.appendChild(landwindProducts);
  landwind.document.body.appendChild(landwindServices);
  landwind.document.body.appendChild(landwindFaq);

  const screwfast = createDocument();
  const productsSection = createNode("section");
  productsSection.setAttribute("data-sitecraft-section", "products");
  productsSection.textContent = "Products";
  const servicesSection = createNode("section");
  servicesSection.setAttribute("data-sitecraft-section", "services");
  servicesSection.textContent = "Services";
  const faqSf = createNode("section");
  faqSf.setAttribute("data-sitecraft-section", "faq");
  faqSf.textContent = "Frequently asked questions";
  const cta = createNode("section");
  cta.setAttribute("data-sitecraft-section", "contact");
  cta.textContent = "Let's Build Together";
  screwfast.document.body.appendChild(productsSection);
  screwfast.document.body.appendChild(servicesSection);
  screwfast.document.body.appendChild(faqSf);
  screwfast.document.body.appendChild(cta);

  return {
    forge: { ...forge, faq, services, why, whyInner, forgeContact },
    landwind: { ...landwind, solutions, partners, faqSection, inquiry, pricing, trusted, landwindProducts, landwindServices, landwindFaq },
    screwfast: {
      document: screwfast.document,
      productsSection,
      servicesSection,
      faqSf,
      cta,
    },
  };
}

test("declared family modules hide and show after set_section_visibility and undeclared chrome stays", () => {
  const forgeAdapter = getTemplateAdapter("forge");
  const landwindAdapter = getTemplateAdapter("landwind");
  const screwfastAdapter = getTemplateAdapter("screwfast");
  assert.ok(forgeAdapter && landwindAdapter && screwfastAdapter);
  const fragments = createFamilyFragments();
  const options = { templateIds: new Set(["forge", "screwfast", "landwind"]), lastChange: "family-modules" };
  const hidden = applySiteOperations(structuredClone(defaultDraft), [
    { op: "set_section_visibility", section: "faq", visible: false },
    { op: "set_section_visibility", section: "services", visible: false },
    { op: "set_section_visibility", section: "features", visible: false },
    { op: "set_section_visibility", section: "partners", visible: false },
    { op: "set_section_visibility", section: "solutions", visible: false },
    { op: "set_section_visibility", section: "contact", visible: false },
    { op: "set_section_visibility", section: "process", visible: false },
    { op: "set_section_visibility", section: "industries", visible: false },
  ], options).draft;

  const forgeApi = installOn(fragments.forge.document, forgeAdapter).api;
  const landwindApi = installOn(fragments.landwind.document, landwindAdapter).api;
  const screwfastApi = installOn(fragments.screwfast.document, screwfastAdapter).api;
  const expected = [
    "faq.visibility",
    "services.visibility",
    "features.visibility",
    "partners.visibility",
    "solutions.visibility",
    "contact.visibility",
    "process.visibility",
    "industries.visibility",
    "products.visibility",
  ];

  const forgeReport = forgeApi.applyDeclaredContent(hidden, "zh", expected, "workspace");
  assert.equal(fragments.forge.faq.hidden, true);
  assert.equal(fragments.forge.services.hidden, true);
  assert.equal(fragments.forge.why.hidden, false);
  assert.equal(fragments.forge.nodes.logo.textContent, "未命名企业");
  assert.equal(fragments.forge.nodes.logo.hidden, false);
  assert.ok(forgeReport.appliedSlots.includes("faq.visibility"));
  assert.ok(forgeReport.appliedSlots.includes("services.visibility"));
  assert.ok(forgeReport.appliedSlots.includes("products.visibility"));
  assert.ok(forgeReport.missingSlots.includes("industries.visibility"));
  assert.equal(forgeReport.missingSlots.includes("features.visibility"), true);
  assert.equal(forgeReport.missingSlots.includes("contact.visibility"), false);
  assert.deepEqual(forgeReport.fallbackMatched, []);

  const landwindReport = landwindApi.applyDeclaredContent(hidden, "zh", expected, "workspace");
  assert.equal(fragments.landwind.faqSection.hidden, false);
  assert.equal(fragments.landwind.landwindFaq.hidden, true);
  assert.equal(fragments.landwind.solutions.hidden, false);
  assert.equal(fragments.landwind.partners.hidden, false);
  assert.equal(fragments.landwind.inquiry.hidden, true);
  assert.equal(fragments.landwind.landwindProducts.hidden, false);
  assert.equal(fragments.landwind.landwindServices.hidden, true);
  assert.equal(fragments.landwind.landwindFaq.hidden, true);
  assert.equal(fragments.landwind.pricing.hidden, true);
  assert.equal(fragments.landwind.pricing.textContent, "Designed for business teams like yours");
  assert.equal(fragments.landwind.nodes.undeclared.textContent, "未选用的标题");
  assert.ok(landwindReport.appliedSlots.includes("faq.visibility"));
  assert.ok(landwindReport.missingSlots.includes("features.visibility"));
  assert.ok(landwindReport.missingSlots.includes("industries.visibility"));
  assert.deepEqual(landwindReport.fallbackMatched, []);

  const screwfastReport = screwfastApi.applyDeclaredContent(hidden, "zh", expected, "workspace");
  assert.equal(fragments.screwfast.faqSf.hidden, true);
  assert.equal(fragments.screwfast.productsSection.hidden, false);
  assert.equal(fragments.screwfast.servicesSection.hidden, true);
  assert.equal(fragments.screwfast.cta.hidden, true);
  assert.ok(screwfastReport.appliedSlots.includes("services.visibility"));
  assert.ok(screwfastReport.appliedSlots.includes("products.visibility"));
  assert.ok(screwfastReport.appliedSlots.includes("contact.visibility"));
  assert.ok(screwfastReport.missingSlots.includes("industries.visibility"));

  const shown = applySiteOperations(hidden, [
    { op: "set_section_visibility", section: "faq", visible: true },
    { op: "update_card", section: "faq", index: 0, locale: "zh", title: "交期如何确认？", body: "批量询盘后确认。" },
  ], options).draft;
  forgeApi.applyDeclaredContent(shown, "zh", ["faq.visibility"], "workspace");
  landwindApi.applyDeclaredContent(shown, "zh", ["faq.visibility"], "workspace");
  screwfastApi.applyDeclaredContent(shown, "zh", ["faq.visibility"], "workspace");
  assert.equal(fragments.forge.faq.hidden, false);
  assert.equal(fragments.landwind.faqSection.hidden, false);
  assert.equal(fragments.screwfast.faqSf.hidden, false);
  assert.equal(fragments.landwind.pricing.hidden, true);
});

const LOOK_FIRST_SCREEN_PACKS = {
  K07: {
    companyName: "澄海传动件K07",
    title: "精密齿轮出口目录 K07",
    subtitle: "面向减速机装配的模数与交期说明 K07。",
    cta: "索取齿轮模数表 K07",
  },
  M52: {
    companyName: "甬江密封件M52",
    title: "丁腈密封圈批量供货 M52",
    subtitle: "不提供现场检修；仅接受规格询盘 M52。",
    cta: "获取密封圈规格 M52",
  },
} as const;

const lookFirstScreenOptions = {
  templateIds: new Set(["forge", "tailwind-landing", "fresh"]),
  lastChange: "first-screen-looks",
};

function authoredLookDraft(id: "K07" | "M52", briefId: "technical-product" | "editorial-service") {
  const pack = LOOK_FIRST_SCREEN_PACKS[id];
  const seed = structuredClone(defaultDraft);
  if (briefId === "editorial-service") {
    seed.templateId = "fresh";
    seed.visualBrief = {
      ...seed.visualBrief,
      id: "editorial-service",
      label: "深色产品",
      summary: "历史草稿样子",
      templateId: "fresh",
    };
  }
  const operations: SiteOperation[] = [
    ...(briefId === "technical-product" ? [{ op: "set_visual_brief", briefId } as const] : []),
    { op: "set_text", target: "companyName", value: pack.companyName },
    { op: "set_text", target: "hero.title", locale: "zh", value: pack.title },
    { op: "set_text", target: "hero.subtitle", locale: "zh", value: pack.subtitle },
    { op: "set_text", target: "hero.cta", locale: "zh", value: pack.cta },
  ];
  return applySiteOperations(seed, operations, lookFirstScreenOptions).draft;
}

function createTailwindLandingFragment() {
  const { document } = createDocument();
  const hero = createNode("div");
  const title = createNode("h1");
  title.setAttribute("data-sitecraft-benchmark", "hero-title");
  title.textContent = "用最短路径，把产品和询盘说清楚";
  const subtitle = createNode("p");
  subtitle.setAttribute("data-sitecraft-benchmark", "hero-subtitle");
  subtitle.textContent = "灰底、产品、下一步。先让访客判断是否值得继续。";
  const cta = createNode("button");
  cta.setAttribute("data-sitecraft-benchmark", "hero-cta");
  cta.textContent = "快速了解产品";
  hero.appendChild(title);
  hero.appendChild(subtitle);
  hero.appendChild(cta);
  const brand = createNode("a");
  brand.setAttribute("data-sitecraft-brand-name", "nav");
  brand.textContent = "短路径产品";
  const undeclared = createNode("h2");
  undeclared.className = "w-full my-2 text-5xl font-bold leading-tight text-center text-gray-800";
  undeclared.textContent = "Title";
  const footerCta = createNode("button");
  footerCta.textContent = "未选用按钮";
  const echo = createNode("h3");
  echo.className = "my-4 text-3xl leading-tight";
  echo.textContent = "未选用文案";
  document.body.appendChild(brand);
  document.body.appendChild(hero);
  document.body.appendChild(undeclared);
  document.body.appendChild(echo);
  document.body.appendChild(footerCta);
  return { document, nodes: { brand, title, subtitle, cta, undeclared, echo, footerCta } };
}

function createFreshFragment() {
  const { document } = createDocument();
  const title = createNode("h1");
  title.className = "title is-1 is-bold is-spaced";
  title.textContent = "Manage and deploy your apps seamlessly.";
  const subtitle = createNode("h2");
  subtitle.className = "subtitle is-5 is-muted";
  subtitle.textContent = "Lorem ipsum sit dolor amet is a dummy text used by typography industry";
  const cta = createNode("a");
  cta.className = "button cta primary-btn raised mr-2";
  cta.textContent = " Get Started ";
  const discover = createNode("a");
  discover.className = "button cta";
  discover.textContent = " Discover";
  const signup = createNode("span");
  signup.className = "button signup-button secondary-btn raised";
  signup.textContent = " Sign up ";
  const undeclared = createNode("h2");
  undeclared.className = "title is-2";
  undeclared.textContent = "Great Power Comes";
  document.body.appendChild(title);
  document.body.appendChild(subtitle);
  document.body.appendChild(cta);
  document.body.appendChild(discover);
  document.body.appendChild(signup);
  document.body.appendChild(undeclared);
  return { document, nodes: { title, subtitle, cta, discover, signup, undeclared } };
}

test("tailwind-landing and fresh first-screen slots follow two independent packs and leave undeclared chrome", () => {
  const expected = ["companyName.zh", "hero.title.zh", "hero.subtitle.zh", "hero.cta.zh", "contact.email.zh"];
  const cases = [
    { templateId: "tailwind-landing", briefId: "technical-product" as const, create: createTailwindLandingFragment },
    { templateId: "fresh", briefId: "editorial-service" as const, create: createFreshFragment },
  ];
  for (const item of cases) {
    const adapter = getTemplateAdapter(item.templateId);
    assert.ok(adapter, `${item.templateId} adapter is required before quality comparison`);
    const { document, nodes } = item.create();
    const { api } = installOn(document, adapter);
    const first = authoredLookDraft("K07", item.briefId);
    const second = authoredLookDraft("M52", item.briefId);
    assert.equal(first.templateId, item.templateId);
    assert.equal(first.companyName, LOOK_FIRST_SCREEN_PACKS.K07.companyName);
    assert.equal(first.content.hero.title.zh, LOOK_FIRST_SCREEN_PACKS.K07.title);

    const firstReport = api.applyDeclaredContent(first, "zh", expected, "workspace");
    assert.equal(nodes.title.textContent, LOOK_FIRST_SCREEN_PACKS.K07.title);
    assert.equal(nodes.subtitle.textContent, LOOK_FIRST_SCREEN_PACKS.K07.subtitle);
    assert.equal(nodes.cta.textContent, LOOK_FIRST_SCREEN_PACKS.K07.cta);
    if ("brand" in nodes) assert.equal(nodes.brand.textContent, LOOK_FIRST_SCREEN_PACKS.K07.companyName);
    if ("footerCta" in nodes) assert.equal(nodes.footerCta.textContent, "未选用按钮");
    if ("signup" in nodes) assert.equal(nodes.signup.textContent, " Sign up ");
    assert.equal(nodes.undeclared.textContent === LOOK_FIRST_SCREEN_PACKS.K07.title, false);
    assert.ok(firstReport.appliedSlots.includes("hero.title.zh"));
    assert.ok(firstReport.appliedSlots.includes("hero.subtitle.zh"));
    assert.ok(firstReport.appliedSlots.includes("hero.cta.zh"));
    if (item.templateId === "tailwind-landing") assert.ok(firstReport.appliedSlots.includes("companyName.zh"));
    else assert.ok(firstReport.missingSlots.includes("companyName.zh"));
    assert.ok(firstReport.missingSlots.includes("contact.email.zh"));
    assert.deepEqual(firstReport.fallbackMatched, []);
    assert.deepEqual(firstReport.proposedAlternatives, [{ requested: "contact.email.zh", proposed: "hero.cta" }]);

    const secondReport = api.applyDeclaredContent(second, "zh", expected, "workspace");
    assert.equal(nodes.title.textContent, LOOK_FIRST_SCREEN_PACKS.M52.title);
    assert.equal(nodes.subtitle.textContent, LOOK_FIRST_SCREEN_PACKS.M52.subtitle);
    assert.equal(nodes.cta.textContent, LOOK_FIRST_SCREEN_PACKS.M52.cta);
    assert.equal(nodes.title.textContent === LOOK_FIRST_SCREEN_PACKS.K07.title, false);
    if ("brand" in nodes) assert.equal(nodes.brand.textContent, LOOK_FIRST_SCREEN_PACKS.M52.companyName);
    if ("footerCta" in nodes) assert.equal(nodes.footerCta.textContent, "未选用按钮");
    if ("undeclared" in nodes) {
      assert.equal(nodes.undeclared.textContent.includes("K07"), false);
      assert.equal(nodes.undeclared.textContent.includes("M52"), false);
    }
    assert.ok(secondReport.appliedSlots.includes("hero.cta.zh"));
    if (item.templateId === "tailwind-landing") assert.ok(secondReport.appliedSlots.includes("companyName.zh"));
    else assert.ok(secondReport.missingSlots.includes("companyName.zh"));
    assert.ok(secondReport.missingSlots.includes("contact.email.zh"));
    assert.deepEqual(secondReport.fallbackMatched, []);
  }
});

test("undeclared hide requests do not rewrite snapshot chrome", () => {
  const landwindAdapter = getTemplateAdapter("landwind");
  assert.ok(landwindAdapter);
  const { document, nodes } = createLandwindFragment();
  const pricing = createNode("h2");
  pricing.textContent = "Designed for business teams like yours";
  document.body.appendChild(pricing);
  const draft = visibilityDraft(["products", "about", "industries"]);
  const report = installOn(document, landwindAdapter).api.applyDeclaredContent(draft, "zh", [
    "products.visibility",
    "about.visibility",
    "industries.visibility",
    "hero.title.zh",
  ], "workspace");
  assert.equal(nodes.undeclared.textContent, "未选用的标题");
  assert.equal(nodes.title.textContent, "NEW_HERO_ZH");
  assert.equal(pricing.hidden, false);
  assert.equal(pricing.textContent, "Designed for business teams like yours");
  assert.ok(report.missingSlots.includes("demoChrome.pricing"));
  assert.ok(report.missingSlots.includes("products.visibility"));
  assert.ok(report.missingSlots.includes("about.visibility"));
  assert.ok(report.missingSlots.includes("industries.visibility"));
  assert.equal(report.appliedSlots.includes("products.visibility"), false);
  assert.deepEqual(report.fallbackMatched, []);
});

test("in-template page switching marks the active page and hides other planned sections on the same document", () => {
  const landwindAdapter = getTemplateAdapter("landwind");
  assert.ok(landwindAdapter);
  const fragments = createFamilyFragments();
  const draft = structuredClone(defaultDraft);
  draft.templateId = "landwind";
  draft.pagePlan = resolvePagePlan({
    templateId: "landwind",
    source: "user",
    requested: [
      { id: "home", role: "home" },
      { id: "products", role: "products" },
      { id: "contact", role: "contact" },
    ],
  });
  const api = installOn(fragments.landwind.document, landwindAdapter).api;
  api.applyDeclaredContent(draft, "zh", [], "workspace", {
    id: "home",
    role: "home",
    placement: "section",
    section: "hero",
  });
  assert.equal(fragments.landwind.document.documentElement.dataset.sitecraftActivePage, "home");
  assert.equal(fragments.landwind.document.documentElement.dataset.sitecraftPagePlacement, "section");
  assert.equal(fragments.landwind.inquiry.hidden, false);

  api.applyDeclaredContent(draft, "zh", [], "workspace", {
    id: "products",
    role: "products",
    placement: "section",
    section: "products",
  });
  assert.equal(fragments.landwind.document.documentElement.dataset.sitecraftActivePage, "products");
  assert.equal(fragments.landwind.inquiry.hidden, true);
  assert.equal(fragments.landwind.inquiry.getAttribute("data-sitecraft-page-hidden"), "true");
});

test("unique src slots write owned URLs and leave undeclared imgs unchanged", () => {
  const documentElement = createNode("html");
  const body = createNode("body");
  documentElement.appendChild(body);
  const hero = createNode("img");
  hero.setAttribute("alt", "hero image");
  hero.setAttribute("src", "./images/hero.png");
  const logo = createNode("img");
  logo.setAttribute("alt", "Landwind Logo");
  logo.setAttribute("src", "./images/logo.svg");
  const decoy = createNode("img");
  decoy.setAttribute("alt", "dashboard feature image");
  decoy.setAttribute("src", "./images/feature-1.png");
  body.appendChild(hero);
  body.appendChild(logo);
  body.appendChild(decoy);
  const listeners: FakeDocument["listeners"] = [];
  const document: FakeDocument = {
    documentElement,
    body,
    listeners,
    querySelectorAll: (selector) => queryAll(documentElement, selector),
    querySelector: (selector) => queryAll(documentElement, selector)[0] ?? null,
    createElement: (tag) => createNode(tag),
    addEventListener: (type, fn) => {
      listeners.push({ type, fn });
    },
  };
  const adapter: TemplateAdapter = {
    templateId: "landwind-image",
    runtime: "static-html",
    slots: [{ target: "hero.image", selector: 'img[alt="hero image"]', attr: "src" }],
  };
  const { api } = installOn(document, adapter);
  const draft = sentinelDraft();
  draft.content.hero.image = {
    imageId: "img_testownedimage0001",
    url: "/api/sites/p3img-a/images/img_testownedimage0001",
    alt: { zh: "待补充", en: "To be completed" },
  };
  const report = api.applyDeclaredContent(draft, "zh", ["hero.image", "products.FM-2401.image"], "workspace");
  assert.equal(hero.getAttribute("src"), "/api/sites/p3img-a/images/img_testownedimage0001");
  assert.equal(logo.getAttribute("src"), "./images/logo.svg");
  assert.equal(decoy.getAttribute("src"), "./images/feature-1.png");
  assert.ok(report.appliedSlots.includes("hero.image"));
  assert.ok(report.missingSlots.includes("products.FM-2401.image"));
  assert.deepEqual(report.fallbackMatched, []);

  delete draft.content.hero.image;
  const cleared = api.applyDeclaredContent(draft, "zh", ["hero.image"], "workspace");
  assert.equal(hero.getAttribute("src"), "./images/hero.png");
  assert.equal(logo.getAttribute("src"), "./images/logo.svg");
  assert.equal(cleared.appliedSlots.includes("hero.image"), false);
});

test("forge and landwind FAQ slots write unique nodes and leave undeclared chrome", () => {
  const cases = [
    {
      id: "forge" as const,
      chrome: { tag: "a", text: "Get A Free Estimate" },
    },
    {
      id: "landwind" as const,
      chrome: { tag: "a", text: "Get Figma file" },
    },
  ];
  for (const item of cases) {
    const { document } = createDocument();
    const title = createNode("h2");
    title.setAttribute("data-sitecraft-faq", "title");
    title.textContent = "OLD_FAQ_TITLE";
    const intro = createNode("p");
    intro.setAttribute("data-sitecraft-faq", "intro");
    intro.textContent = "OLD_FAQ_INTRO";
    const question = createNode("span");
    question.setAttribute("data-sitecraft-faq", "q1");
    question.textContent = "OLD_FAQ_Q1";
    const answer = createNode("p");
    answer.setAttribute("data-sitecraft-faq", "a1");
    answer.textContent = "OLD_FAQ_A1";
    const chrome = createNode(item.chrome.tag);
    chrome.textContent = item.chrome.text;
    if (item.id === "landwind") chrome.setAttribute("data-sitecraft-demo", "figma");
    document.body.appendChild(title);
    document.body.appendChild(intro);
    document.body.appendChild(question);
    document.body.appendChild(answer);
    document.body.appendChild(chrome);

    const adapter = getTemplateAdapter(item.id);
    assert.ok(adapter);
    const { api } = installOn(document, adapter);
    const draft = applySiteOperations(structuredClone(defaultDraft), [
      { op: "set_text", target: "faq.title", locale: "zh", value: "P3I-FAQ-TITLE 交期与认证" },
      { op: "set_text", target: "faq.intro", locale: "zh", value: "P3I-FAQ-INTRO 只答资料里有的内容" },
      {
        op: "update_card",
        section: "faq",
        index: 0,
        locale: "zh",
        title: "P3I-FAQ-Q1 交期如何确认？",
        body: "P3I-FAQ-A1 待补充",
      },
    ], { templateIds: new Set(["forge", "screwfast", "landwind"]), lastChange: "faq-slot" }).draft;
    const report = api.applyDeclaredContent(draft, "zh", ["faq.title.zh", "faq.intro.zh", "faq.items.0.title.zh", "faq.items.0.body.zh"], "workspace");
    assert.equal(title.textContent, "P3I-FAQ-TITLE 交期与认证");
    assert.equal(intro.textContent, "P3I-FAQ-INTRO 只答资料里有的内容");
    assert.equal(question.textContent, "P3I-FAQ-Q1 交期如何确认？");
    assert.equal(answer.textContent, "P3I-FAQ-A1 待补充");
    assert.equal(chrome.textContent, item.chrome.text);
    assert.equal(chrome.hidden, item.id === "landwind");
    assert.ok(report.appliedSlots.includes("faq.title.zh"));
    assert.ok(report.appliedSlots.includes("faq.items.0.body.zh"));
    assert.deepEqual(report.fallbackMatched, []);
  }
});

test("screwfast FAQ slots write unique accordion text and leave sales chrome", () => {
  const { document } = createDocument();
  const question = createNode("span");
  question.setAttribute("data-sitecraft-benchmark", "faq-item-0-title");
  question.textContent = "OLD_FAQ_Q1";
  const answer = createNode("p");
  answer.setAttribute("data-sitecraft-benchmark", "faq-item-0-body");
  answer.textContent = "OLD_FAQ_A1";
  const sales = createNode("a");
  sales.textContent = "Contact Sales Team";
  document.body.appendChild(question);
  document.body.appendChild(answer);
  document.body.appendChild(sales);

  const adapter = getTemplateAdapter("screwfast");
  assert.ok(adapter);
  const { api } = installOn(document, adapter);
  const draft = applySiteOperations(structuredClone(defaultDraft), [{
    op: "update_card",
    section: "faq",
    index: 0,
    locale: "zh",
    title: "P3I-FAQ-Q1 交期如何确认？",
    body: "P3I-FAQ-A1 待补充",
  }], { templateIds: new Set(["forge", "screwfast"]), lastChange: "faq-slot" }).draft;
  const report = api.applyDeclaredContent(draft, "zh", ["faq.items.0.title.zh", "faq.items.0.body.zh"], "workspace");
  assert.equal(question.textContent, "P3I-FAQ-Q1 交期如何确认？");
  assert.equal(answer.textContent, "P3I-FAQ-A1 待补充");
  assert.equal(sales.textContent, "Contact Sales Team");
  assert.ok(report.appliedSlots.includes("faq.items.0.title.zh"));
  assert.ok(report.appliedSlots.includes("faq.items.0.body.zh"));
  assert.deepEqual(report.fallbackMatched, []);
});

test("screwfast product grid shows draft image credit under the photo", () => {
  const { document } = createDocument();
  const grid = createNode("div");
  grid.setAttribute("data-sitecraft-product-grid", "true");
  document.body.appendChild(grid);
  const adapter = getTemplateAdapter("screwfast");
  assert.ok(adapter);
  const draft = packDraft("industrial") as ReturnType<typeof packDraft> & { products: Array<Record<string, unknown>> };
  draft.products = draft.products.slice(0, 1);
  draft.products[0].name = { zh: "直角减速机", en: "Right-angle gearbox" };
  draft.products[0].image = {
    imageId: "img_1234567890abcdef12345678",
    url: "/api/sites/test/images/img_1234567890abcdef12345678",
    alt: { zh: "直角减速机产品图", en: "Right-angle gearbox product photo" },
    credit: { zh: "图片：Whoisjohngalt / CC BY-SA 4.0", en: "Photo: Whoisjohngalt / CC BY-SA 4.0" },
  };
  installOn(document, adapter).api.applyDeclaredContent(draft, "zh", ["products"], "published");
  assert.equal(visibleText(grid).includes("图片：Whoisjohngalt / CC BY-SA 4.0"), true);
  assert.equal(visibleText(grid).includes("Whoisjohngalt"), true);
});

test("screwfast benchmark renders only authored product categories into the product grid", () => {
  const { document } = createDocument();
  const grid = createNode("div");
  grid.setAttribute("data-sitecraft-product-grid", "true");
  document.body.appendChild(grid);
  const adapter = getTemplateAdapter("screwfast");
  assert.ok(adapter);
  const draft = packDraft("industrial") as ReturnType<typeof packDraft> & { products: Array<Record<string, unknown>> };
  draft.products = draft.products.slice(0, 2);
  draft.products[0].name = { zh: "直角减速机", en: "Right-angle gearbox" };
  draft.products[1].name = { zh: "行星减速机", en: "Planetary gearbox" };
  draft.products[0].image = {
    imageId: "img_1234567890abcdef12345678",
    url: "/api/sites/test/images/img_1234567890abcdef12345678",
    alt: { zh: "直角减速机产品图", en: "Right-angle gearbox product photo" },
  };
  const report = installOn(document, adapter).api.applyDeclaredContent(draft, "zh", [
    "products",
    "products.FM-2401.name.zh",
    "products.FM-2401.summary.zh",
    "products.FM-2402.name.zh",
    "products.FM-2402.summary.zh",
  ], "workspace");
  assert.equal(grid.children.length, 2);
  // A real photo sits in the card's media block; a product without one gets no stand-in picture.
  const photo = grid.children[0].querySelector("img");
  assert.equal(photo?.getAttribute("src"), "/api/sites/test/images/img_1234567890abcdef12345678");
  assert.equal(grid.children[1].querySelector("img"), null);
  assert.equal(grid.children[1].getAttribute("data-sitecraft-product-photo"), "false");
  assert.equal(visibleText(grid.children[1]).includes("示意"), false);
  assert.equal(visibleText(grid).includes("直角减速机"), true);
  assert.equal(visibleText(grid).includes("行星减速机"), true);
  assert.ok(report.appliedSlots.includes("products.FM-2401.name.zh"));
  assert.ok(report.appliedSlots.includes("products.FM-2402.name.zh"));
  assert.ok(report.appliedSlots.includes("products"));
});

test("screwfast product categories localize on the English preview", () => {
  const { document } = createDocument();
  const grid = createNode("div");
  grid.setAttribute("data-sitecraft-product-grid", "true");
  document.body.appendChild(grid);
  const adapter = getTemplateAdapter("screwfast");
  assert.ok(adapter);
  const draft = packDraft("industrial") as ReturnType<typeof packDraft> & { products: Array<Record<string, unknown>> };
  draft.products = draft.products.slice(0, 1);
  draft.products[0].name = { zh: "卡套接头", en: "Ferrule fittings" };
  draft.products[0].category = { zh: "流体连接件", en: "Fluid connectors" };
  installOn(document, adapter).api.applyDeclaredContent(draft, "en", ["products"], "published");
  assert.equal(visibleText(grid).includes("Fluid connectors"), true);
  assert.equal(visibleText(grid).includes("流体连接件"), false);
});

test("inquiry form submit posts payload to parent and does not keep web3forms action", () => {
  const { document } = createDocument();
  const form = createNode("form");
  form.setAttribute("data-sitecraft-inquiry", "true");
  form.setAttribute("action", "#");
  const name = createNode("input");
  name.setAttribute("name", "name");
  name.setAttribute("value", "Ada Buyer");
  const email = createNode("input");
  email.setAttribute("name", "email");
  email.setAttribute("value", "ada@inquiry.test");
  const company = createNode("input");
  company.setAttribute("name", "company");
  company.setAttribute("value", "North Pier");
  const message = createNode("textarea");
  message.setAttribute("name", "message");
  message.textContent = "Need a quote for PN-90.";
  const honeypot = createNode("input");
  honeypot.setAttribute("name", "honeypot");
  honeypot.setAttribute("value", "");
  form.appendChild(name);
  form.appendChild(email);
  form.appendChild(company);
  form.appendChild(message);
  form.appendChild(honeypot);
  document.body.appendChild(form);

  const { messages } = installOn(document, getTemplateAdapter("landwind") ?? null);
  const submit = document.listeners.find((listener) => listener.type === "submit");
  assert.ok(submit);
  let prevented = false;
  submit.fn({
    target: form,
    preventDefault() {
      prevented = true;
    },
    stopPropagation() {},
  });
  assert.equal(prevented, true);
  const inquiry = messages.find((item) => item.type === "sitecraft:inquiry") as {
    payload?: { name?: string; email?: string; company?: string; message?: string; honeypot?: string };
  } | undefined;
  assert.ok(inquiry);
  assert.equal(inquiry.payload?.name, "Ada Buyer");
  assert.equal(inquiry.payload?.email, "ada@inquiry.test");
  assert.equal(inquiry.payload?.company, "North Pier");
  assert.equal(inquiry.payload?.message, "Need a quote for PN-90.");
  assert.equal(inquiry.payload?.honeypot, "");
});

function visibleText(node: FakeNode): string {
  if (node.hidden) return "";
  if (!node.childNodes.length) return node.textContent ?? "";
  return node.childNodes.map((child) => visibleText(child)).join(" ");
}

function packDraft(id: "industrial" | "export") {
  const pack = simulatedPacks[id];
  const briefId = id === "industrial" ? "engineering-industrial" : "export-catalog";
  return applySiteOperations(structuredClone(draftWithFixtureProducts), [
    { op: "set_visual_brief", briefId },
    { op: "set_text", target: "companyName", value: pack.companyName },
    { op: "set_text", target: "hero.title", locale: "zh", value: pack.heroTitle },
    { op: "set_text", target: "hero.subtitle", locale: "zh", value: pack.heroSubtitle },
    { op: "set_text", target: "hero.cta", locale: "zh", value: pack.heroCta },
    { op: "set_text", target: "contact.email", value: pack.email },
  ], { templateIds: new Set(visualBriefCatalog.map((item) => item.templateId)), lastChange: "demo-chrome" }).draft;
}

test("landwind + export pack hides SaaS demo chrome on the full page, including below the fold", () => {
  const adapter = getTemplateAdapter("landwind");
  assert.ok(adapter);
  const { document, nodes } = createLandwindFragment();
  const logoWall = createNode("section");
  logoWall.setAttribute("data-sitecraft-demo", "logo-wall");
  const airbnb = createNode("svg");
  airbnb.setAttribute("aria-label", "Airbnb");
  airbnb.textContent = "Airbnb";
  const googleLogo = createNode("svg");
  googleLogo.setAttribute("aria-label", "Google");
  googleLogo.textContent = "Google";
  logoWall.appendChild(airbnb);
  logoWall.appendChild(googleLogo);
  const pricing = createNode("section");
  pricing.setAttribute("data-sitecraft-demo", "pricing");
  const price29 = createNode("span");
  price29.textContent = "$29";
  const price99 = createNode("span");
  price99.textContent = "$99";
  const price499 = createNode("span");
  price499.textContent = "$499";
  pricing.appendChild(price29);
  pricing.appendChild(price99);
  pricing.appendChild(price499);
  const testimonial = createNode("section");
  testimonial.setAttribute("data-sitecraft-demo", "testimonial");
  testimonial.textContent = "CEO at Google";
  nodes.figma.setAttribute("data-sitecraft-demo", "figma");
  const footerBrand = createNode("span");
  footerBrand.setAttribute("data-sitecraft-brand", "footer");
  footerBrand.textContent = "Landwind";
  const footerCopyright = createNode("span");
  footerCopyright.setAttribute("data-sitecraft-demo", "footer-copyright");
  footerCopyright.textContent = "© 2021-2022 Landwind™. All Rights Reserved.";
  document.body.appendChild(logoWall);
  document.body.appendChild(pricing);
  document.body.appendChild(testimonial);
  document.body.appendChild(footerBrand);
  document.body.appendChild(footerCopyright);

  const draft = packDraft("export");
  const report = installOn(document, adapter).api.applyDeclaredContent(draft, "zh", [
    "companyName.zh",
    "hero.title.zh",
    "demoChrome.pricing",
    "demoChrome.logo-wall",
    "demoChrome.figma",
    "demoChrome.testimonial",
    "demoChrome.footer-copyright",
  ], "workspace");
  const page = visibleText(document.body);
  assert.equal(nodes.brand.textContent, simulatedPacks.export.companyName);
  assert.equal(footerBrand.textContent, simulatedPacks.export.companyName);
  assert.equal(page.includes(simulatedPacks.export.companyName), true);
  for (const token of ["$29", "$99", "$499", "Get Figma", "Airbnb", "Google", "CEO at Google", "Landwind™"]) {
    assert.equal(page.includes(token), false, `landwind still shows ${token}`);
  }
  assert.equal(logoWall.hidden, true);
  assert.equal(pricing.hidden, true);
  assert.equal(nodes.figma.hidden, true);
  assert.equal(testimonial.hidden, true);
  assert.equal(footerCopyright.hidden, true);
  assert.ok(report.appliedSlots.includes("companyName.zh"));
  assert.ok(report.appliedSlots.includes("demoChrome.pricing"));
  assert.ok(report.appliedSlots.includes("demoChrome.logo-wall"));
  assert.deepEqual(report.fallbackMatched, []);
});

// 工程工业 now comes from the block library: its page carries no ScrewFast wordmark, reviews or
// pricing at all (tests/block-compose.test.ts), so there is no demo chrome left to hide here.
test("screwfast + industrial pack replaces the placeholder brand in the header and footer", () => {
  const adapter = getTemplateAdapter("screwfast");
  assert.ok(adapter);
  assert.equal(adapter.demoChrome, undefined);
  const { document } = createDocument();
  const brand = createNode("span");
  brand.setAttribute("data-sitecraft-brand", "nav");
  brand.textContent = "企业名称";
  const footerBrand = createNode("span");
  footerBrand.setAttribute("data-sitecraft-brand", "footer");
  footerBrand.textContent = "企业名称";
  document.body.appendChild(brand);
  document.body.appendChild(footerBrand);

  const draft = packDraft("industrial");
  const report = installOn(document, adapter).api.applyDeclaredContent(draft, "zh", ["companyName.zh"], "workspace");
  const page = visibleText(document.body);
  assert.equal(brand.textContent, simulatedPacks.industrial.companyName);
  assert.equal(footerBrand.textContent, simulatedPacks.industrial.companyName);
  assert.equal(page.includes("企业名称"), false);
  assert.ok(report.appliedSlots.includes("companyName.zh"));
  assert.deepEqual(report.missingSlots, []);
  assert.deepEqual(report.fallbackMatched, []);
});

test("demo chrome unique miss is reported as missing and does not hide a similar heading", () => {
  const { document } = createDocument();
  const decoy = createNode("h2");
  decoy.textContent = "Simple, Transparent Pricing";
  document.body.appendChild(decoy);
  const adapter: TemplateAdapter = {
    templateId: "sentinel-template",
    runtime: "static-html",
    slots: [],
    demoChrome: [{ key: "pricing", selector: '[data-sitecraft-demo="pricing"]' }],
  };
  const report = installOn(document, adapter).api.applyDeclaredContent(sentinelDraft(), "zh", ["demoChrome.pricing"], "workspace");
  assert.equal(decoy.hidden, false);
  assert.equal(decoy.textContent, "Simple, Transparent Pricing");
  assert.ok(report.missingSlots.includes("demoChrome.pricing"));
  assert.equal(report.appliedSlots.includes("demoChrome.pricing"), false);
  assert.deepEqual(report.fallbackMatched, []);
});

test("engineering-industrial kit applies its family tokens and selects no demo module", () => {
  const adapter = getTemplateAdapter("screwfast");
  assert.ok(adapter?.kit);
  const parts = selectedKitParts(adapter.kit, []);
  const composed = composeKitModules({ host: adapter.kit, parts });
  assert.equal(composed.ok, true);
  assert.equal(adapter.kit.modules.some((module) => module.kind === "demo"), false);
  assert.ok(parts.some((part) => part.key === "faq"));

  const { document } = createDocument();
  const brand = createNode("span");
  brand.setAttribute("data-sitecraft-brand", "nav");
  brand.textContent = "企业名称";
  const footerBrand = createNode("span");
  footerBrand.setAttribute("data-sitecraft-brand", "footer");
  footerBrand.textContent = "企业名称";
  const faq = createNode("section");
  faq.setAttribute("data-sitecraft-section", "faq");
  const question = createNode("summary");
  question.setAttribute("data-sitecraft-benchmark", "faq-item-0-title");
  faq.appendChild(question);
  document.body.appendChild(brand);
  document.body.appendChild(footerBrand);
  document.body.appendChild(faq);

  const draft = applySiteOperations(packDraft("industrial"), [
    { op: "update_card", section: "faq", index: 0, title: { zh: "交期如何确认？", en: "How is lead time confirmed?" }, body: { zh: "按批量确认。", en: "Per batch." } },
  ], { templateIds: new Set(visualBriefCatalog.map((item) => item.templateId)), lastChange: "kit-faq" }).draft;
  assert.equal(draft.visualBrief.id, "engineering-industrial");
  assert.equal(draft.templateId, "screwfast");
  const report = installOn(document, adapter).api.applyDeclaredContent(draft, "zh", [
    "companyName.zh",
    "kit.faq",
    "kit.family.engineering-industrial",
  ], "workspace");
  assert.equal(document.documentElement.dataset.sitecraftFamily, "engineering-industrial");
  assert.equal(document.documentElement.dataset.sitecraftTokenAccent, adapter.kit.tokens.accent);
  assert.equal(document.documentElement.styleValues["--site-bg"], adapter.kit.tokens.background);
  assert.equal(document.documentElement.styleValues["--site-ink"], adapter.kit.tokens.text);
  assert.equal(document.documentElement.styleValues["--site-accent"], adapter.kit.tokens.accent);
  assert.equal(document.documentElement.styleValues["--site-line"], adapter.kit.tokens.border);
  assert.equal(document.documentElement.styleValues["--site-font"], adapter.kit.tokens.font);
  assert.equal(document.documentElement.styleValues["--site-radius"], adapter.kit.tokens.radius);
  assert.equal(brand.textContent, simulatedPacks.industrial.companyName);
  assert.equal(question.textContent, "交期如何确认？");
  assert.equal(faq.hidden, false);
  assert.ok(report.appliedSlots.includes("kit.faq"));
  assert.ok(report.appliedSlots.includes("kit.family.engineering-industrial"));
  assert.equal(report.missingSlots.includes("kit.family.mismatch"), false);
  assert.deepEqual(report.fallbackMatched, []);
});

test("engineering-industrial bridge applies the named slate palette without changing family", () => {
  const adapter = getTemplateAdapter("screwfast");
  assert.ok(adapter?.kit?.palettes?.["engineering-porcelain"]);
  const { document } = createDocument();
  const draft = applySiteOperations(packDraft("industrial"), [{ op: "set_palette", paletteId: "engineering-porcelain" }], {
    templateIds: new Set(visualBriefCatalog.map((item) => item.templateId)),
    lastChange: "palette-compare",
  }).draft;
  const report = installOn(document, adapter).api.applyDeclaredContent(draft, "zh", ["kit.family.engineering-industrial"], "workspace");
  const palette = adapter.kit.palettes["engineering-porcelain"];
  assert.equal(draft.paletteId, "engineering-porcelain");
  assert.equal(document.documentElement.dataset.sitecraftFamily, "engineering-industrial");
  assert.equal(document.documentElement.dataset.sitecraftPalette, "engineering-porcelain");
  assert.equal(document.documentElement.styleValues["--site-bg"], palette.background);
  assert.equal(document.documentElement.styleValues["--site-accent"], palette.accent);
  assert.equal(document.documentElement.styleValues["--site-accent-strong"], palette.accentStrong);
  assert.equal(document.documentElement.styleValues["--site-line"], palette.border);
  assert.ok(report.appliedSlots.includes("kit.family.engineering-industrial"));
});

test("look/family mismatch is reported and landwind pricing is still omitted", () => {
  const adapter = getTemplateAdapter("landwind");
  assert.ok(adapter?.kit);
  const { document, nodes } = createLandwindFragment();
  const pricing = createNode("section");
  pricing.setAttribute("data-sitecraft-demo", "pricing");
  pricing.textContent = "$499";
  document.body.appendChild(pricing);
  const draft = packDraft("industrial");
  assert.equal(draft.visualBrief.id, "engineering-industrial");
  const report = installOn(document, adapter).api.applyDeclaredContent(draft, "zh", ["kit.family.mismatch"], "workspace");
  assert.ok(report.missingSlots.includes("kit.family.mismatch"));
  assert.equal(pricing.hidden, true);
  assert.equal(visibleText(document.body).includes("$499"), false);
  assert.equal(nodes.brand.textContent, simulatedPacks.industrial.companyName);
});
