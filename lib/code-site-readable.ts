import type { SiteCode } from './code-site.ts';
import type { CodeFactMember, CodeFactSeparator } from './code-site-fact-segments.ts';

// Read author text and its source positions together. The caller supplies the
// same complete three-width separator union used for semantic fact auditing.
export function readCodeReadable(code: SiteCode, pageId: string, localPaths: number[][], separatorPaths: CodeFactSeparator[]) {
  const fail = (): never => { throw new Error('三档数字检查的文字分隔或源码位置无法核实，本次未保存版本。'); };
  const separated = new Set<Element>();
  for (const { path, tag } of separatorPaths) {
    let node: Element | undefined = document.body;
    for (const index of path) node = node?.children[index];
    if (!node || node.tagName !== tag) fail();
    separated.add(node!);
  }
  const page = code.pages.find(page => page.id === pageId)!;
  const fields = [['header', code.header], [`pages/${pageId}/html`, page.html], ['footer', code.footer]];
  const roots: Node[] = [], positions = new Map<Node, { field: string; path: number[] }>();
  const boundaries = new Set<Node>();
  let elementIndex = 0;
  const locate = (source: Node, live: Node, field: string, path: number[]) => {
    if (source.nodeName !== live.nodeName || source.nodeType === Node.TEXT_NODE && source.nodeValue !== live.nodeValue) fail();
    positions.set(source, { field, path });
    if (source instanceof Element && live instanceof Element && separated.has(live)) boundaries.add(source);
    if (source instanceof Element && source.hasAttribute('data-system-icon')) return;
    if (source.childNodes.length !== live.childNodes.length) fail();
    [...source.childNodes].forEach((child, index) => locate(child, live.childNodes[index], field, [...path, index]));
  };
  for (const [field, html] of fields) {
    const body = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html').body;
    for (const [index, source] of [...body.childNodes].entries()) {
      const live = source instanceof Element ? document.body.children[elementIndex++] : source;
      if (!live) fail();
      locate(source, live, field, [index]); roots.push(source);
    }
  }
  const selected = localPaths.map(path => {
    let node = roots.flatMap(root => root instanceof Element ? [root.matches('main') ? root : root.querySelector('main')] : []).find(node => node !== null);
    for (const index of path) node = node?.children[index];
    if (!node) fail(); return node!;
  });
  const chunks: Array<{ text: string; member?: CodeFactMember }> = [];
  const push = (text: string, member?: CodeFactMember) => chunks.push({ text: text.replace(/[\u200b\u2060]/g, ''), member });
  const blocks = new Set('BODY HEADER FOOTER MAIN SECTION ARTICLE ASIDE NAV DIV P H1 H2 H3 H4 H5 H6 LI DT DD TR TH TD FIGURE FIGCAPTION BLOCKQUOTE ADDRESS'.split(' '));
  const read = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.nodeValue!, position = positions.get(node)!;
      for (const part of text.matchAll(/[^。！？；\n]+[。！？；]?|[。！？；\n]/g)) push(part[0], { ...position, kind: 'text', text, before: part[0], offset: part.index });
    } else if (node instanceof Element) {
      if (node.tagName === 'STYLE' || node.hasAttribute('data-system-icon')) return;
      if (node.tagName === 'BR') { push('\n'); return; }
      const boundary = blocks.has(node.tagName) || boundaries.has(node);
      if (boundary) push('\n');
      [...node.childNodes].forEach(read);
      if (boundary) push('\n');
    }
  };
  const readingRoots = selected.length ? selected : roots;
  let previousField: string | undefined;
  for (const root of readingRoots) {
    const field = positions.get(root)!.field;
    if (selected.length || field !== previousField) push('\n');
    read(root); previousField = field;
  }
  // Attributes are independent copy, never inserted between parts of an inline
  // number. Only author fields participate, excluding system credit markup.
  for (const root of readingRoots) if (root instanceof Element) for (const node of [root, ...root.querySelectorAll('*')]) {
    for (const name of ['alt', 'title', 'aria-label', 'data-label']) if (node.hasAttribute(name)) {
      push('\n'); push(node.getAttribute(name)!, { ...positions.get(node)!, kind: 'attribute', name, before: node.getAttribute(name)! });
    }
  }
  if (!selected.length) { push('\n'); push(page.title, { kind: 'title', pageId, text: page.title }); }
  let at = 0;
  const intervals = chunks.map(chunk => {
    const text = chunk.text.normalize('NFKC'), start = at; at += text.length;
    return { ...chunk, text, start, end: at };
  });
  const normalized = intervals.map(chunk => chunk.text).join('');
  const numbers = [...normalized.matchAll(/\d+(?:\.\d+)?/g)].map(match => ({ value: match[0], members: intervals
    .filter(chunk => chunk.start < match.index + match[0].length && chunk.end > match.index)
    .flatMap(chunk => chunk.member ? [chunk.member] : []) }));
  return { text: chunks.map(chunk => chunk.text).join(''), numbers };
}
