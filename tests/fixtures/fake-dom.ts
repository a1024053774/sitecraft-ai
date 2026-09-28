// Test fixture: a minimal DOM for running the preview bridge in node tests. Supports the selector
// shapes the bridge uses (tag, #id, .class, [attr], [attr="v"], [attr^='v'], descendant chains, lists).
export type FakeNode = {
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

export function createNode(tagName: string): FakeNode {
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


export function createDocument() {
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
  return { document, html, body };
}

export function visibleText(node: FakeNode): string {
  if (node.hidden || node.styleValues.display === "none") return "";
  if (!node.childNodes.length) return node.textContent ?? "";
  return node.childNodes.map((child) => visibleText(child)).join(" ");
}
