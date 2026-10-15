import type { SiteCode } from './code-site.ts';

export type CodeFactSegment = { text: string; group: string; context: { pageId: string; outline: string[]; headings: string[] } };
export type CodeFactReview = {
  format: 2; materials: string; sourceMaterials: string; audited: number; reused: number;
  segments: Array<{ text: string; group: string; issues: string[] }>;
};

// Runs in the rendered candidate at each checked width. Segment identity is
// readable text plus its semantic conditions, never DOM offsets or a digest.
export function readCodeFactSegments(code: SiteCode, pageId: string): CodeFactSegment[] {
  const page = code.pages.find(page => page.id === pageId)!;
  const fragment = (html: string) => new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html').body;
  const parts = [fragment(code.header), fragment(page.html), fragment(code.footer)];
  const nodes = [...document.body.children];
  let offset = 0;
  const result: CodeFactSegment[] = [];
  const strings = (value: string) => [...value.matchAll(/"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'/g)]
    .map(match => (match[1] ?? match[2]).replace(/\\([0-9a-f]{1,6})\s?|\\(.)/gi, (_escape, hex, char) => hex ? String.fromCodePoint(parseInt(hex, 16)) : char)).join('');
  const heading = 'h1,h2,h3,h4,h5,h6';
  // Child headers, sidebars and lists can qualify a sibling table. Only
  // explicit content sections create a new scope; their parent prose follows.
  const containers = 'main,section,article';
  const atomic = 'table';
  const blocks = new Set('DIV P H1 H2 H3 H4 H5 H6 LI DT DD TR TH TD FIGCAPTION BR'.split(' '));
  const own = (el: Element) => {
    if (el.parentElement?.closest('[data-system-icon]')) return '';
    const attrs = ['alt', 'title', 'aria-label', 'data-label', 'colspan', 'rowspan', 'scope', 'headers'].flatMap(name => el.hasAttribute(name) ? [`${name}=${el.getAttribute(name)}`] : []);
    for (const name of ['aria-labelledby', 'aria-describedby']) if (el.hasAttribute(name)) {
      attrs.push(`${name}=${el.getAttribute(name)!.split(/\s+/).map(id => document.getElementById(id)?.textContent ?? `未找到 ${id}`).join('\n')}`);
    }
    // Read resolved strings, including attr()/var()/media-dependent values.
    const css = ['::before', '::after', '::marker'].map(pseudo => strings(getComputedStyle(el, pseudo).content));
    const style = getComputedStyle(el);
    if (style.display === 'list-item') css.push(strings(style.listStyleType));
    return [...attrs, ...css.filter(Boolean).map(value => `CSS=${value}`)].join('\n');
  };
  const read = (node: Node, skip?: (el: Element) => boolean): string => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
    if (!(node instanceof Element) || skip?.(node) || node.parentElement?.closest('[data-system-icon]')) return '';
    const auxiliary = own(node);
    const content = [...node.childNodes].map(child => read(child, skip)).join('');
    const text = `${auxiliary ? `\n[${auxiliary}]\n` : ''}${content}`;
    if (['TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'TH', 'TD'].includes(node.tagName)) return `\n<${node.tagName}>${text}</${node.tagName}>\n`;
    return blocks.has(node.tagName) ? `\n${text}\n` : text;
  };
  const documentConditions = [own(document.documentElement), own(document.body)].filter(Boolean).join('\n');
  for (const [index, part] of parts.entries()) {
    // Body-context parsing preserves leading text. Adjacent text nodes may
    // merge across fragments in the live DOM, so match elements in order and
    // read text nodes from their cleaned source fragment, never count whitespace.
    const roots = [...part.childNodes].map(node => {
      if (!(node instanceof Element)) return node;
      const live = nodes[offset++];
      if (!live || live.nodeName !== node.nodeName) throw new Error('核对段无法定位页面内容，本次未保存版本。');
      return live;
    });
    const elements = roots.flatMap(node => node instanceof Element ? [node, ...node.querySelectorAll('*')] : []);
    const scope = index === 0 ? '公共页头' : index === 2 ? '公共页脚' : `页面 ${pageId}：${page.title}`;
    const outline = elements.filter(el => el.matches(heading)).map(el => read(el).trim());
    // Parent section prose is a condition for its children, including prose
    // placed after a table. Lists and definition lists stay whole: splitting
    // them could detach a later exception or a dt from its dd.
    const groups: Array<Element | null> = [null, ...elements.filter(el => el.matches(containers) && !el.closest(atomic))];
    const owner = (el: Element) => {
      const parent = el.parentElement?.closest(containers);
      return parent && elements.includes(parent) ? parent : null;
    };
    const prose = (group: Element | null) => (group ? [group] : roots).map(node => read(node, el => el !== group && (el.matches(containers) || el.matches(atomic)))).join('').trim();
    const groupText = (node: Element | null) => {
      // Nested sections inside a list/dl or headed section share the outer
      // group's ordered content. Deleting a sibling must change every receipt.
      let whole = node;
      for (let parent = node?.parentElement; parent && elements.includes(parent); parent = parent.parentElement) {
        if (parent.matches('section,article,ul,ol,dl,table')) whole = parent;
      }
      const parents: Element[] = [];
      for (let parent = whole ? owner(whole) : null; parent; parent = owner(parent)) parents.unshift(parent);
      const body = (whole ? [whole] : roots).map(root => read(root,
        el => (whole === null || whole.tagName === 'MAIN') && el !== whole && el.matches(containers))).join('').trim();
      return [scope, documentConditions, ...(whole ? [prose(null), ...parents.map(prose)] : []), body].filter(Boolean).join('\n');
    };
    for (const group of groups) {
      const ancestors: Element[] = [];
      for (let p = group ? owner(group) : null; p; p = owner(p)) ancestors.unshift(p);
      const prefix = [scope, documentConditions, ...(group ? [prose(null), ...ancestors.map(prose)] : [])].filter(Boolean).join('\n');
      const conditions = prose(group);
      const nearby = (group ? [group, ...group.querySelectorAll(heading)] : elements.filter(el => el.matches(heading)))
        .filter(el => el.matches(heading)).map(el => read(el).trim());
      const add = (body: string, container = group) => { if (body.trim()) result.push({ text: `${prefix}\n${body}`, group: groupText(container), context: { pageId: index === 1 ? pageId : scope, outline, headings: nearby } }); };
      if (conditions) add(conditions);
      for (const structure of elements.filter(el => el.matches(atomic) && owner(el) === group && !el.parentElement?.closest(atomic))) {
        if (structure.querySelector('[rowspan],[colspan]')) {
          add([conditions, read(structure).trim()].filter(Boolean).join('\n'), structure); continue;
        }
        // A simple table is read by row with all column headings/caption.
        // Spanned tables above stay whole rather than guessing associations.
        const headers = [...structure.querySelectorAll('caption,thead,tr')].filter(el => el.tagName !== 'TR' || (!el.closest('thead') && !el.querySelector('td')));
        const labels = [read(structure, el => el !== structure && el.tagName === 'TR').trim(), ...new Set(headers.map(el => read(el).trim()))].filter(Boolean).join('\n');
        const rows = [...structure.querySelectorAll('tr')].filter(el => el.querySelector('td'));
        if (!rows.length) add([conditions, read(structure).trim()].filter(Boolean).join('\n'), structure);
        else for (const row of rows) add([conditions, own(structure), labels, read(row).trim()].filter(Boolean).join('\n'), structure);
      }
    }
    if (index === 1) result.push({ text: `${scope}\n页面标题：${page.title}`, group: `${scope}\n页面标题：${page.title}`, context: { pageId, outline, headings: [] } });
  }
  return result;
}

export function pendingCodeFactSegments(segments: CodeFactSegment[], materials: string, reviews: CodeFactReview[], sourceMaterials = materials) {
  const eligible = reviews.filter(review => review.format === 2 && review.materials === materials && review.sourceMaterials === sourceMaterials);
  const groups = new Map<string, CodeFactSegment[]>();
  for (const segment of segments) groups.set(segment.group, [...(groups.get(segment.group) ?? []), segment]);
  const accepted = new Set([...groups].filter(([group, members]) => eligible.some(review => {
    const before = review.segments.filter(segment => segment.group === group);
    // One complete successful review must cover the group. Mixing partial
    // passes across attempts can suppress a condition that another row needs.
    return before.length === members.length && before.every(segment => !segment.issues.length)
      && members.every(segment => before.some(previous => previous.text === segment.text));
  })).map(([group]) => group));
  return { pending: segments.filter(segment => !accepted.has(segment.group)), reused: segments.filter(segment => accepted.has(segment.group)) };
}
