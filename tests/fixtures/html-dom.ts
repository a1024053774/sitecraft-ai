// Test fixture: parses the pages SiteCraft writes itself (block library pages, overlays) into a
// small DOM so the real preview bridge can run against them in node tests. It covers the markup
// we write: elements, attributes, text, void elements, raw-text <style>/<script>/<title>/<textarea>
// and <template> content, which is kept out of the tree the same way a browser keeps it. It is not
// a general HTML parser and throws on selector syntax it does not support.

const VOID_TAGS = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);
const RAW_TEXT_TAGS = new Set(["script", "style", "title", "textarea"]);
const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: "\u00a0" };

function decodeEntities(value: string) {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, name: string) => {
    if (name[0] === "#") {
      const code = name[1] === "x" || name[1] === "X" ? Number.parseInt(name.slice(2), 16) : Number(name.slice(1));
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    return ENTITIES[name.toLowerCase()] ?? whole;
  });
}

function camelToDataAttr(prop: string) {
  return `data-${prop.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
}

export type HtmlNode = HtmlElement | HtmlText | HtmlFragment;

abstract class BaseNode {
  parentNode: HtmlParent | null = null;
  abstract readonly nodeType: number;
  abstract get textContent(): string;
  abstract set textContent(value: string);
  get parentElement(): HtmlElement | null {
    return this.parentNode instanceof HtmlElement ? this.parentNode : null;
  }
  remove() {
    this.parentNode?.removeChild(this as unknown as HtmlNode);
  }
}

export class HtmlText extends BaseNode {
  readonly nodeType = 3;
  nodeValue: string;
  constructor(value: string) {
    super();
    this.nodeValue = value;
  }
  get textContent() {
    return this.nodeValue;
  }
  set textContent(value: string) {
    this.nodeValue = String(value);
  }
  cloneNode(_deep = false) {
    return new HtmlText(this.nodeValue);
  }
}

abstract class HtmlParent extends BaseNode {
  childNodes: HtmlNode[] = [];
  get children(): HtmlElement[] {
    return this.childNodes.filter((node): node is HtmlElement => node instanceof HtmlElement);
  }
  get firstChild(): HtmlNode | null {
    return this.childNodes[0] ?? null;
  }
  get firstElementChild(): HtmlElement | null {
    return this.children[0] ?? null;
  }
  appendChild<T extends HtmlNode>(node: T): T {
    return this.insertBefore(node, null);
  }
  insertBefore<T extends HtmlNode>(node: T, reference: HtmlNode | null): T {
    const incoming = node instanceof HtmlFragment ? [...node.childNodes] : [node as HtmlNode];
    for (const item of incoming) item.parentNode?.removeChild(item);
    let index = reference ? this.childNodes.indexOf(reference) : this.childNodes.length;
    if (index < 0) throw new Error("insertBefore: reference node is not a child");
    for (const item of incoming) {
      item.parentNode = this;
      this.childNodes.splice(index, 0, item);
      index += 1;
    }
    return node;
  }
  removeChild<T extends HtmlNode>(node: T): T {
    const index = this.childNodes.indexOf(node);
    if (index < 0) throw new Error("removeChild: node is not a child");
    this.childNodes.splice(index, 1);
    node.parentNode = null;
    return node;
  }
  get textContent(): string {
    return this.childNodes.map((node) => node.textContent).join("");
  }
  set textContent(value: string) {
    for (const node of this.childNodes) node.parentNode = null;
    this.childNodes = [];
    const text = value == null ? "" : String(value);
    if (text) this.appendChild(new HtmlText(text));
  }
  querySelectorAll(selector: string): HtmlElement[] {
    const list = parseSelectorList(selector);
    const found: HtmlElement[] = [];
    const walk = (parent: HtmlParent) => {
      for (const child of parent.childNodes) {
        if (!(child instanceof HtmlElement)) continue;
        if (list.some((complex) => matchComplex(child, complex, complex.length - 1))) found.push(child);
        walk(child);
      }
    };
    walk(this);
    return found;
  }
  querySelector(selector: string): HtmlElement | null {
    return this.querySelectorAll(selector)[0] ?? null;
  }
}

export class HtmlFragment extends HtmlParent {
  readonly nodeType = 11;
  cloneNode(deep = false): HtmlFragment {
    const copy = new HtmlFragment();
    if (deep) for (const child of this.childNodes) copy.appendChild(child.cloneNode(true) as HtmlNode);
    return copy;
  }
}

export class HtmlElement extends HtmlParent {
  readonly nodeType = 1;
  readonly localName: string;
  attributes = new Map<string, string>();
  styleValues: Record<string, string> = {};
  /** Only <template> has content; its nodes are not children and queries never reach them. */
  readonly content: HtmlFragment | null;
  readonly style = {
    setProperty: (name: string, value: string) => {
      this.styleValues[name] = String(value);
    },
    removeProperty: (name: string) => {
      delete this.styleValues[name];
    },
    getPropertyValue: (name: string) => this.styleValues[name] ?? "",
  };

  constructor(localName: string) {
    super();
    this.localName = localName.toLowerCase();
    this.content = this.localName === "template" ? new HtmlFragment() : null;
  }

  get tagName() {
    return this.localName.toUpperCase();
  }
  getAttribute(name: string) {
    return this.attributes.has(name) ? this.attributes.get(name)! : null;
  }
  setAttribute(name: string, value: string) {
    this.attributes.set(name, String(value));
  }
  removeAttribute(name: string) {
    this.attributes.delete(name);
  }
  hasAttribute(name: string) {
    return this.attributes.has(name);
  }
  get id() {
    return this.getAttribute("id") ?? "";
  }
  set id(value: string) {
    this.setAttribute("id", value);
  }
  get className() {
    return this.getAttribute("class") ?? "";
  }
  set className(value: string) {
    this.setAttribute("class", value);
  }
  get classList() {
    const read = () => this.className.split(/\s+/).filter(Boolean);
    return {
      contains: (name: string) => read().includes(name),
      toggle: (name: string, force?: boolean) => {
        const present = read().includes(name);
        const next = force ?? !present;
        const names = read().filter((item) => item !== name);
        if (next) names.push(name);
        this.className = names.join(" ");
        return next;
      },
    };
  }
  get hidden() {
    return this.hasAttribute("hidden");
  }
  set hidden(value: boolean) {
    if (value) this.setAttribute("hidden", "");
    else this.removeAttribute("hidden");
  }
  get src() {
    return this.getAttribute("src") ?? "";
  }
  set src(value: string) {
    this.setAttribute("src", value);
  }
  get alt() {
    return this.getAttribute("alt") ?? "";
  }
  set alt(value: string) {
    this.setAttribute("alt", value);
  }
  get lang() {
    return this.getAttribute("lang") ?? "";
  }
  set lang(value: string) {
    this.setAttribute("lang", value);
  }
  get dataset(): Record<string, string | undefined> {
    return new Proxy({} as Record<string, string | undefined>, {
      get: (_target, prop) => (typeof prop === "string" ? this.getAttribute(camelToDataAttr(prop)) ?? undefined : undefined),
      set: (_target, prop, value) => {
        if (typeof prop === "string") this.setAttribute(camelToDataAttr(prop), String(value));
        return true;
      },
    });
  }
  matches(selector: string) {
    return parseSelectorList(selector).some((complex) => matchComplex(this, complex, complex.length - 1));
  }
  closest(selector: string): HtmlElement | null {
    const list = parseSelectorList(selector);
    for (let node: HtmlElement | null = this; node; node = node.parentElement) {
      const current = node;
      if (list.some((complex) => matchComplex(current, complex, complex.length - 1))) return current;
    }
    return null;
  }
  cloneNode(deep = false): HtmlElement {
    const copy = new HtmlElement(this.localName);
    for (const [name, value] of this.attributes) copy.attributes.set(name, value);
    copy.styleValues = { ...this.styleValues };
    if (deep) {
      for (const child of this.childNodes) copy.appendChild(child.cloneNode(true) as HtmlNode);
      if (this.content && copy.content) for (const child of this.content.childNodes) copy.content.appendChild(child.cloneNode(true) as HtmlNode);
    }
    return copy;
  }
}

export class HtmlDocument extends HtmlParent {
  readonly nodeType = 9;
  listeners: Array<{ type: string; fn: unknown }> = [];
  get documentElement(): HtmlElement {
    const root = this.firstElementChild;
    if (!root) throw new Error("document has no root element");
    return root;
  }
  get head(): HtmlElement | null {
    return this.documentElement.children.find((node) => node.localName === "head") ?? null;
  }
  get body(): HtmlElement {
    const body = this.documentElement.children.find((node) => node.localName === "body");
    if (!body) throw new Error("document has no body");
    return body;
  }
  get title() {
    return this.querySelector("title")?.textContent ?? "";
  }
  set title(value: string) {
    let node = this.querySelector("title");
    if (!node) {
      node = new HtmlElement("title");
      (this.head ?? this.documentElement).appendChild(node);
    }
    node.textContent = value;
  }
  createElement(tag: string) {
    return new HtmlElement(tag);
  }
  createTextNode(text: string) {
    return new HtmlText(text);
  }
  createDocumentFragment() {
    return new HtmlFragment();
  }
  getElementById(id: string) {
    return this.querySelectorAll("[id]").find((node) => node.id === id) ?? null;
  }
  addEventListener(type: string, fn: unknown) {
    this.listeners.push({ type, fn });
  }
}

type AttributeTest = { name: string; op: "" | "=" | "^=" | "*=" | "$="; value: string };
type Compound = { tag: string | null; id: string | null; classes: string[]; attrs: AttributeTest[] };
type ComplexPart = { compound: Compound; combinator: " " | ">" | null };
type Complex = ComplexPart[];

const selectorCache = new Map<string, Complex[]>();

function splitOutside(source: string, separator: string) {
  const parts: string[] = [];
  let current = "";
  let quote = "";
  let depth = 0;
  for (const char of source) {
    if (quote) {
      current += char;
      if (char === quote) quote = "";
      continue;
    }
    if (char === '"' || char === "'") quote = char;
    else if (char === "[" || char === "(") depth += 1;
    else if (char === "]" || char === ")") depth -= 1;
    else if (char === separator && depth === 0) {
      parts.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  parts.push(current);
  return parts;
}

function parseCompound(source: string): Compound {
  const compound: Compound = { tag: null, id: null, classes: [], attrs: [] };
  let index = 0;
  const tag = /^(\*|[a-zA-Z][\w-]*)/.exec(source);
  if (tag) {
    compound.tag = tag[1] === "*" ? null : tag[1].toLowerCase();
    index = tag[0].length;
  }
  while (index < source.length) {
    const char = source[index];
    if (char === "#" || char === ".") {
      const name = /^[\w-]+/.exec(source.slice(index + 1));
      if (!name) throw new Error(`html-dom: bad selector "${source}"`);
      if (char === "#") compound.id = name[0];
      else compound.classes.push(name[0]);
      index += 1 + name[0].length;
      continue;
    }
    if (char === "[") {
      let end = index + 1;
      let quote = "";
      for (; end < source.length; end += 1) {
        const inner = source[end];
        if (quote) {
          if (inner === quote) quote = "";
        } else if (inner === '"' || inner === "'") quote = inner;
        else if (inner === "]") break;
      }
      const body = source.slice(index + 1, end);
      const match = /^([\w:-]+)\s*(?:([\^*$]?=)\s*(?:"([^"]*)"|'([^']*)'|([^\]\s]+)))?$/.exec(body.trim());
      if (!match) throw new Error(`html-dom: bad attribute selector "[${body}]"`);
      compound.attrs.push({ name: match[1], op: (match[2] ?? "") as AttributeTest["op"], value: match[3] ?? match[4] ?? match[5] ?? "" });
      index = end + 1;
      continue;
    }
    throw new Error(`html-dom: unsupported selector syntax "${source.slice(index)}" in "${source}"`);
  }
  return compound;
}

function parseComplex(source: string): Complex {
  const spaced = source.trim().replace(/\s*>\s*/g, " > ");
  const tokens = splitOutside(spaced, " ").filter(Boolean);
  const parts: Complex = [];
  let combinator: " " | ">" | null = null;
  for (const token of tokens) {
    if (token === ">") {
      combinator = ">";
      continue;
    }
    parts.push({ compound: parseCompound(token), combinator: parts.length ? combinator ?? " " : null });
    combinator = null;
  }
  if (!parts.length) throw new Error(`html-dom: empty selector "${source}"`);
  return parts;
}

function parseSelectorList(selector: string): Complex[] {
  const cached = selectorCache.get(selector);
  if (cached) return cached;
  const list = splitOutside(selector, ",").map((part) => parseComplex(part));
  selectorCache.set(selector, list);
  return list;
}

function matchCompound(node: HtmlElement, compound: Compound) {
  if (compound.tag && node.localName !== compound.tag) return false;
  if (compound.id !== null && node.id !== compound.id) return false;
  if (compound.classes.length) {
    const present = new Set(node.className.split(/\s+/));
    if (!compound.classes.every((name) => present.has(name))) return false;
  }
  for (const test of compound.attrs) {
    const value = node.getAttribute(test.name);
    if (value === null) return false;
    if (test.op === "=" && value !== test.value) return false;
    if (test.op === "^=" && !value.startsWith(test.value)) return false;
    if (test.op === "*=" && !value.includes(test.value)) return false;
    if (test.op === "$=" && !value.endsWith(test.value)) return false;
  }
  return true;
}

function matchComplex(node: HtmlElement, complex: Complex, index: number): boolean {
  if (!matchCompound(node, complex[index].compound)) return false;
  if (index === 0) return true;
  if (complex[index].combinator === ">") {
    const parent = node.parentElement;
    return Boolean(parent && matchComplex(parent, complex, index - 1));
  }
  for (let parent = node.parentElement; parent; parent = parent.parentElement) {
    if (matchComplex(parent, complex, index - 1)) return true;
  }
  return false;
}

function parseAttributes(source: string, element: HtmlElement) {
  const pattern = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source))) {
    element.setAttribute(match[1].toLowerCase(), decodeEntities(match[2] ?? match[3] ?? match[4] ?? ""));
  }
}

/** Parses markup into nodes appended to `root`. */
function parseInto(html: string, root: HtmlParent) {
  const stack: Array<{ element: HtmlElement | null; into: HtmlParent }> = [{ element: null, into: root }];
  const current = () => stack[stack.length - 1].into;
  let index = 0;
  while (index < html.length) {
    const open = html.indexOf("<", index);
    const textEnd = open < 0 ? html.length : open;
    if (textEnd > index) current().appendChild(new HtmlText(decodeEntities(html.slice(index, textEnd))));
    if (open < 0) break;
    if (html.startsWith("<!--", open)) {
      const end = html.indexOf("-->", open + 4);
      index = end < 0 ? html.length : end + 3;
      continue;
    }
    if (html[open + 1] === "!" || html[open + 1] === "?") {
      const end = html.indexOf(">", open);
      index = end < 0 ? html.length : end + 1;
      continue;
    }
    if (html[open + 1] === "/") {
      const end = html.indexOf(">", open);
      const name = html.slice(open + 2, end).trim().toLowerCase();
      for (let depth = stack.length - 1; depth > 0; depth -= 1) {
        if (stack[depth].element?.localName === name) {
          stack.length = depth;
          break;
        }
      }
      index = end + 1;
      continue;
    }
    const tagMatch = /^<([a-zA-Z][\w-]*)([^>]*)>/.exec(html.slice(open));
    if (!tagMatch) {
      current().appendChild(new HtmlText("<"));
      index = open + 1;
      continue;
    }
    const element = new HtmlElement(tagMatch[1]);
    const rawAttributes = tagMatch[2].replace(/\/\s*$/, "");
    parseAttributes(rawAttributes, element);
    current().appendChild(element);
    index = open + tagMatch[0].length;
    const selfClosing = /\/\s*$/.test(tagMatch[2]);
    if (VOID_TAGS.has(element.localName) || selfClosing) continue;
    if (RAW_TEXT_TAGS.has(element.localName)) {
      const close = html.toLowerCase().indexOf(`</${element.localName}`, index);
      const end = close < 0 ? html.length : close;
      const text = html.slice(index, end);
      if (text) element.appendChild(new HtmlText(element.localName === "title" || element.localName === "textarea" ? decodeEntities(text) : text));
      const closeEnd = close < 0 ? html.length : html.indexOf(">", close) + 1;
      index = closeEnd;
      continue;
    }
    stack.push({ element, into: element.content ?? element });
  }
}

export function parseHtmlDocument(html: string): HtmlDocument {
  const document = new HtmlDocument();
  parseInto(html, document);
  if (!document.children.some((node) => node.localName === "html")) throw new Error("html-dom: page has no <html> root");
  return document;
}

export function parseHtmlFragment(html: string): HtmlFragment {
  const fragment = new HtmlFragment();
  parseInto(html, fragment);
  return fragment;
}

/** Text a visitor could see: skips hidden nodes, inline display:none, templates, styles and scripts.
 *  Zero-width spaces (line-break points the bridge adds to spec values) are not seen, so they are dropped. */
export function visibleText(node: HtmlNode): string {
  if (node instanceof HtmlText) return node.nodeValue.replace(/\u200b/g, "");
  if (node instanceof HtmlElement) {
    if (node.hidden || node.styleValues.display === "none") return "";
    if (["template", "style", "script", "head"].includes(node.localName)) return "";
  }
  return (node as HtmlParent).childNodes.map((child) => visibleText(child)).join(" ");
}

/** Deterministic markup for comparing trees: sorted attributes, whitespace-only text dropped. */
export function serializeNode(node: HtmlNode, options: { skip?: (element: HtmlElement) => boolean } = {}): string {
  if (node instanceof HtmlText) {
    const text = node.nodeValue.replace(/\s+/g, " ").trim();
    return text;
  }
  if (node instanceof HtmlElement) {
    if (options.skip?.(node)) return "";
    const attrs = [...node.attributes.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([name, value]) => (value === "" ? ` ${name}` : ` ${name}="${value}"`)).join("");
    const inner = node.childNodes.map((child) => serializeNode(child, options)).filter(Boolean).join("");
    return VOID_TAGS.has(node.localName) ? `<${node.localName}${attrs}>` : `<${node.localName}${attrs}>${inner}</${node.localName}>`;
  }
  return (node as HtmlParent).childNodes.map((child) => serializeNode(child, options)).filter(Boolean).join("");
}
