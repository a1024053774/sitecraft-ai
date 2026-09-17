import assert from "node:assert/strict";
import test from "node:test";
import { defaultDraft } from "../lib/site-document.ts";
import { applySiteOperations } from "../lib/site-operations.ts";
import {
  PREVIEW_BRIDGE_SOURCE,
  buildPreviewBridgeScript,
  installPreviewBridge,
  stripHtmlScripts,
} from "../lib/template-adapters/preview-bridge.ts";
import { getTemplateAdapter } from "../lib/template-adapters/index.ts";
import type { TemplateAdapter } from "../lib/template-adapters/types.ts";

type FakeNode = {
  nodeType: number;
  tagName: string;
  parentNode: FakeNode | null;
  childNodes: FakeNode[];
  attributes: Map<string, string>;
  _text: string;
  hidden?: boolean;
  style?: { setProperty: (name: string, value: string, priority?: string) => void };
  children: FakeNode[];
  parentElement: FakeNode | null;
  className: string;
  id: string;
  textContent: string;
  dataset: Record<string, string>;
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
    style: { setProperty() {} },
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
      hero: { title: { zh: "NEW_HERO_ZH", en: "NEW_HERO_EN" }, subtitle: { zh: "SUB_ZH", en: "SUB_EN" }, cta: { zh: "CTA_ZH", en: "CTA_EN" } },
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
  brand.className = "self-center text-xl font-semibold whitespace-nowrap dark:text-white";
  brand.textContent = "Landwind";
  const title = createNode("h1");
  title.className = "max-w-2xl mb-4 text-4xl font-extrabold leading-none tracking-tight md:text-5xl xl:text-6xl dark:text-white";
  title.textContent = "Building digital products & brands.";
  const subtitle = createNode("p");
  subtitle.className = "max-w-2xl mb-6 font-light text-gray-500 lg:mb-8 md:text-lg lg:text-xl dark:text-gray-400";
  subtitle.textContent = "This free and open-source landing page template was built using the utility classes from Tailwind CSS.";
  const cta = createNode("a");
  cta.className = "inline-flex items-center justify-center w-full px-5 py-3 text-sm font-medium text-center text-gray-900 border border-gray-200 rounded-lg sm:w-auto";
  cta.setAttribute("href", "https://github.com/themesberg/landwind");
  cta.textContent = "View on GitHub";
  const figma = createNode("a");
  figma.className = "inline-flex items-center justify-center w-full px-5 py-3 mb-2 mr-2 text-sm font-medium text-gray-900 bg-white border border-gray-200 rounded-lg sm:w-auto";
  figma.textContent = "Get Figma file";
  const undeclared = createNode("h2");
  undeclared.className = "mb-4 text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white";
  undeclared.textContent = "Work with tools you already use";
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
  logo.className = "font-bold";
  logo.textContent = "LOGO";
  const hero = createNode("h1");
  hero.setAttribute("data-testid", "hero-text");
  hero.textContent = "Main Keywords";
  const subtitle = createNode("h2");
  subtitle.setAttribute("data-testid", "intro-text");
  subtitle.textContent = "brief description of services";
  document.body.appendChild(logo);
  document.body.appendChild(hero);
  document.body.appendChild(subtitle);
  return { document, nodes: { logo, hero, subtitle } };
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
  assert.equal(nodes.undeclared.textContent, "Work with tools you already use");
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
  assert.equal(nodes.undeclared.textContent, "Work with tools you already use");
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
  assert.equal(forge.nodes.logo.textContent, "LOGO");
  assert.equal(forge.nodes.hero.getAttribute("data-testid"), "hero-text");
  assert.equal(landwind.nodes.brand.textContent, THEME_COMPARE_PACKS.A17.companyName);
  assert.equal(landwind.nodes.title.textContent, THEME_COMPARE_PACKS.A17.title);
  assert.equal(landwind.nodes.subtitle.textContent, THEME_COMPARE_PACKS.A17.subtitle);
  assert.equal(landwind.nodes.cta.textContent, THEME_COMPARE_PACKS.A17.cta);
  assert.equal(landwind.nodes.undeclared.textContent, "Work with tools you already use");
  assert.ok(landwind.nodes.title.className.includes("max-w-2xl"));
  assert.equal(forge.nodes.hero.textContent, landwind.nodes.title.textContent);
  assert.ok(forgeReport.appliedSlots.includes("hero.title.zh"));
  assert.ok(forgeReport.missingSlots.includes("companyName.zh"));
  assert.ok(forgeReport.missingSlots.includes("hero.cta.zh"));
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
  assert.equal(forge.nodes.logo.textContent, "LOGO");
  assert.equal(landwind.nodes.undeclared.textContent, "Work with tools you already use");
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
  faq.id = "FAQ";
  faq.textContent = "Frequently Asked Questions";
  const services = createNode("section");
  services.className = "mx-auto mt-60 flex max-w-[80%] border-y-8 border-blue-400";
  services.textContent = "Services";
  const why = createNode("section");
  const whyInner = createNode("div");
  whyInner.className = "flex h-full bg-black bg-opacity-30";
  whyInner.textContent = "Suggest Confidence In Your Company";
  why.appendChild(whyInner);
  forge.document.body.appendChild(faq);
  forge.document.body.appendChild(services);
  forge.document.body.appendChild(why);

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
  const trial = createNode("h2");
  trial.className = "mb-4 text-3xl font-extrabold leading-tight";
  trial.textContent = "Start your free trial today";
  inquiry.appendChild(trial);
  const pricing = createNode("h2");
  pricing.textContent = "Designed for business teams like yours";
  landwind.document.body.appendChild(solutions);
  landwind.document.body.appendChild(partners);
  landwind.document.body.appendChild(faqSection);
  landwind.document.body.appendChild(inquiry);
  landwind.document.body.appendChild(pricing);

  const screwfast = createDocument();
  const navContact = createNode("a");
  navContact.id = "contact";
  navContact.textContent = "Contact";
  const partnersSection = createNode("section");
  const partnerHeading = createNode("h2");
  partnerHeading.className = "text-2xl leading-tight font-bold";
  partnerHeading.textContent = "Trusted by Industry Leaders";
  partnersSection.appendChild(partnerHeading);
  const featuresSection = createNode("section");
  const featureImgSf = createNode("img");
  featureImgSf.setAttribute("alt", "ScrewFast products in floating boxes");
  featuresSection.appendChild(featureImgSf);
  const solutionsSection = createNode("section");
  const tab = createNode("button");
  tab.id = "tabs-with-card-item-1";
  tab.textContent = "Cutting-Edge Tools";
  solutionsSection.appendChild(tab);
  const processSection = createNode("section");
  const processHeading = createNode("h2");
  processHeading.className = "mb-2 text-3xl font-bold";
  processHeading.textContent = "Fast-Track Your Projects";
  processSection.appendChild(processHeading);
  const faqSf = createNode("section");
  const accordionSf = createNode("div");
  accordionSf.className = "hs-accordion-group divide-y";
  accordionSf.textContent = "Frequently asked questions";
  faqSf.appendChild(accordionSf);
  const cta = createNode("section");
  cta.className = "relative mx-auto pt-10 pb-24";
  cta.textContent = "Let's Build Together";
  screwfast.document.body.appendChild(navContact);
  screwfast.document.body.appendChild(partnersSection);
  screwfast.document.body.appendChild(featuresSection);
  screwfast.document.body.appendChild(solutionsSection);
  screwfast.document.body.appendChild(processSection);
  screwfast.document.body.appendChild(faqSf);
  screwfast.document.body.appendChild(cta);

  return {
    forge: { ...forge, faq, services, why, whyInner },
    landwind: { ...landwind, solutions, partners, faqSection, inquiry, pricing, trusted },
    screwfast: {
      document: screwfast.document,
      navContact,
      partnersSection,
      featuresSection,
      solutionsSection,
      processSection,
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
  assert.equal(fragments.forge.why.hidden, true);
  assert.equal(fragments.forge.nodes.logo.textContent, "LOGO");
  assert.equal(fragments.forge.nodes.logo.hidden, false);
  assert.ok(forgeReport.appliedSlots.includes("faq.visibility"));
  assert.ok(forgeReport.appliedSlots.includes("services.visibility"));
  assert.ok(forgeReport.appliedSlots.includes("features.visibility"));
  assert.ok(forgeReport.missingSlots.includes("industries.visibility"));
  assert.ok(forgeReport.missingSlots.includes("products.visibility"));
  assert.ok(forgeReport.missingSlots.includes("contact.visibility"));
  assert.deepEqual(forgeReport.fallbackMatched, []);

  const landwindReport = landwindApi.applyDeclaredContent(hidden, "zh", expected, "workspace");
  assert.equal(fragments.landwind.faqSection.hidden, true);
  assert.equal(fragments.landwind.solutions.hidden, true);
  assert.equal(fragments.landwind.partners.hidden, true);
  assert.equal(fragments.landwind.inquiry.hidden, true);
  assert.equal(fragments.landwind.pricing.hidden, false);
  assert.equal(fragments.landwind.pricing.textContent, "Designed for business teams like yours");
  assert.equal(fragments.landwind.nodes.undeclared.textContent, "Work with tools you already use");
  assert.ok(landwindReport.appliedSlots.includes("faq.visibility"));
  assert.ok(landwindReport.missingSlots.includes("features.visibility"));
  assert.ok(landwindReport.missingSlots.includes("industries.visibility"));
  assert.deepEqual(landwindReport.fallbackMatched, []);

  const screwfastReport = screwfastApi.applyDeclaredContent(hidden, "zh", expected, "workspace");
  assert.equal(fragments.screwfast.faqSf.hidden, true);
  assert.equal(fragments.screwfast.partnersSection.hidden, true);
  assert.equal(fragments.screwfast.featuresSection.hidden, true);
  assert.equal(fragments.screwfast.solutionsSection.hidden, true);
  assert.equal(fragments.screwfast.processSection.hidden, true);
  assert.equal(fragments.screwfast.cta.hidden, true);
  assert.equal(fragments.screwfast.navContact.hidden, false);
  assert.equal(fragments.screwfast.navContact.textContent, "Contact");
  assert.ok(screwfastReport.appliedSlots.includes("process.visibility"));
  assert.ok(screwfastReport.missingSlots.includes("services.visibility"));
  assert.ok(screwfastReport.missingSlots.includes("industries.visibility"));
  assert.ok(screwfastReport.missingSlots.includes("products.visibility"));

  const shown = applySiteOperations(hidden, [{ op: "set_section_visibility", section: "faq", visible: true }], options).draft;
  forgeApi.applyDeclaredContent(shown, "zh", ["faq.visibility"], "workspace");
  landwindApi.applyDeclaredContent(shown, "zh", ["faq.visibility"], "workspace");
  screwfastApi.applyDeclaredContent(shown, "zh", ["faq.visibility"], "workspace");
  assert.equal(fragments.forge.faq.hidden, false);
  assert.equal(fragments.landwind.faqSection.hidden, false);
  assert.equal(fragments.screwfast.faqSf.hidden, false);
  assert.equal(fragments.landwind.pricing.hidden, false);
  assert.equal(fragments.screwfast.navContact.hidden, false);
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
  return applySiteOperations(structuredClone(defaultDraft), [
    { op: "set_visual_brief", briefId },
    { op: "set_text", target: "companyName", value: pack.companyName },
    { op: "set_text", target: "hero.title", locale: "zh", value: pack.title },
    { op: "set_text", target: "hero.subtitle", locale: "zh", value: pack.subtitle },
    { op: "set_text", target: "hero.cta", locale: "zh", value: pack.cta },
  ], lookFirstScreenOptions).draft;
}

function createTailwindLandingFragment() {
  const { document } = createDocument();
  const hero = createNode("div");
  hero.className = "pt-24";
  const kicker = createNode("p");
  kicker.className = "uppercase tracking-loose w-full";
  kicker.textContent = "What business are you?";
  const title = createNode("h1");
  title.className = "my-4 text-5xl font-bold leading-tight";
  title.textContent = "Main Hero Message to sell yourself!";
  const subtitle = createNode("p");
  subtitle.className = "leading-normal text-2xl mb-8";
  subtitle.textContent = "Sub-hero message, not too long and not too short. Make it just right!";
  const cta = createNode("button");
  cta.className = "mx-auto lg:mx-0 hover:underline bg-white text-gray-800 font-bold rounded-full my-6 py-4 px-8 shadow-lg";
  cta.textContent = "Subscribe";
  hero.appendChild(kicker);
  hero.appendChild(title);
  hero.appendChild(subtitle);
  hero.appendChild(cta);
  const brand = createNode("a");
  brand.className = "toggleColour text-white no-underline hover:no-underline font-bold text-2xl";
  brand.textContent = "LANDING";
  const undeclared = createNode("h2");
  undeclared.className = "w-full my-2 text-5xl font-bold leading-tight text-center text-gray-800";
  undeclared.textContent = "Title";
  const footerCta = createNode("button");
  footerCta.className = "mx-auto lg:mx-0 hover:underline bg-white text-gray-800 font-bold rounded-full my-6 py-4 px-8 shadow-lg";
  footerCta.textContent = "Action!";
  const echo = createNode("h3");
  echo.className = "my-4 text-3xl leading-tight";
  echo.textContent = "Main Hero Message to sell yourself!";
  document.body.appendChild(brand);
  document.body.appendChild(hero);
  document.body.appendChild(undeclared);
  document.body.appendChild(echo);
  document.body.appendChild(footerCta);
  return { document, nodes: { brand, kicker, title, subtitle, cta, undeclared, echo, footerCta } };
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
    if ("kicker" in nodes) assert.equal(nodes.kicker.textContent, "What business are you?");
    if ("brand" in nodes) assert.equal(nodes.brand.textContent, "LANDING");
    if ("footerCta" in nodes) assert.equal(nodes.footerCta.textContent, "Action!");
    if ("echo" in nodes) assert.equal(nodes.echo.textContent, "Main Hero Message to sell yourself!");
    if ("discover" in nodes) assert.equal(nodes.discover.textContent, " Discover");
    if ("signup" in nodes) assert.equal(nodes.signup.textContent, " Sign up ");
    assert.equal(nodes.undeclared.textContent === LOOK_FIRST_SCREEN_PACKS.K07.title, false);
    assert.ok(firstReport.appliedSlots.includes("hero.title.zh"));
    assert.ok(firstReport.appliedSlots.includes("hero.subtitle.zh"));
    assert.ok(firstReport.appliedSlots.includes("hero.cta.zh"));
    assert.ok(firstReport.missingSlots.includes("companyName.zh"));
    assert.ok(firstReport.missingSlots.includes("contact.email.zh"));
    assert.deepEqual(firstReport.fallbackMatched, []);
    assert.deepEqual(firstReport.proposedAlternatives, [{ requested: "contact.email.zh", proposed: "hero.cta" }]);

    const secondReport = api.applyDeclaredContent(second, "zh", expected, "workspace");
    assert.equal(nodes.title.textContent, LOOK_FIRST_SCREEN_PACKS.M52.title);
    assert.equal(nodes.subtitle.textContent, LOOK_FIRST_SCREEN_PACKS.M52.subtitle);
    assert.equal(nodes.cta.textContent, LOOK_FIRST_SCREEN_PACKS.M52.cta);
    assert.equal(nodes.title.textContent === LOOK_FIRST_SCREEN_PACKS.K07.title, false);
    if ("kicker" in nodes) assert.equal(nodes.kicker.textContent, "What business are you?");
    if ("brand" in nodes) assert.equal(nodes.brand.textContent, "LANDING");
    if ("footerCta" in nodes) assert.equal(nodes.footerCta.textContent, "Action!");
    if ("discover" in nodes) assert.equal(nodes.discover.textContent, " Discover");
    if ("undeclared" in nodes) {
      assert.equal(nodes.undeclared.textContent.includes("K07"), false);
      assert.equal(nodes.undeclared.textContent.includes("M52"), false);
    }
    assert.ok(secondReport.appliedSlots.includes("hero.cta.zh"));
    assert.ok(secondReport.missingSlots.includes("companyName.zh"));
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
  assert.equal(nodes.undeclared.textContent, "Work with tools you already use");
  assert.equal(nodes.title.textContent, "NEW_HERO_ZH");
  assert.equal(pricing.hidden, false);
  assert.equal(pricing.textContent, "Designed for business teams like yours");
  assert.ok(report.missingSlots.includes("products.visibility"));
  assert.ok(report.missingSlots.includes("about.visibility"));
  assert.ok(report.missingSlots.includes("industries.visibility"));
  assert.equal(report.appliedSlots.includes("products.visibility"), false);
  assert.deepEqual(report.fallbackMatched, []);
});
