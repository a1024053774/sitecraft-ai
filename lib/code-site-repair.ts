import { z } from 'zod';
import { codeSiteSchema, type SiteCode } from './code-site.ts';
import { codeCheckBrowser } from './code-site-browser.ts';

type FragmentBody = { field: string; before: string } & (
  { kind: 'text'; path: number[]; offset: number; text: string } |
  { kind: 'element'; path: number[] } | { kind: 'style' | 'title' }
);
type Fragment = FragmentBody & { id: number };
type Replacement = { fragmentId: number; after: string };
const replacementSchema = z.object({ replacements: z.array(z.object({
  fragmentId: z.number().int().nonnegative(), after: z.string().max(100020),
}).strict()).max(80) }).strict();
export class CodeRepairError extends Error {
  response: unknown;
  constructor(reason: string, response: unknown) { super(reason); this.response = response; }
}

// This function runs in an isolated, network-blocked Chrome document. Both
// selection and replacement use parsed nodes; model text never becomes HTML.
function repairDom(code: SiteCode, input: { issues?: string[]; cleaned?: string[]; fragments?: Fragment[]; replacements?: Replacement[] }) {
  class BoundaryFailure extends Error {}
  const refuse = (reason: string): never => { throw new BoundaryFailure(`局部修正${reason}，本次未保存版本。`); };
  const parse = (html: string) => new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html').body;
  const fields = new Map<string, HTMLElement>([
    ['header', parse(code.header)], ['footer', parse(code.footer)],
    ...code.pages.map(p => [`pages/${p.id}/html`, parse(p.html)] as [string, HTMLElement]),
  ]);
  type Interval = { start: number; end: number };
  const unselected = (text: string, intervals: Interval[]) => {
    const parts: string[] = []; let at = 0;
    for (const interval of intervals) { parts.push(text.slice(at, interval.start)); at = interval.end; }
    parts.push(text.slice(at)); return parts;
  };
  const snapshot = (node: Node, skip: Set<Node>, intervals = new Map<Node, Interval[]>()): unknown => skip.has(node) ? null : [node.nodeType, node.nodeName,
    intervals.has(node) ? unselected(node.nodeValue!, intervals.get(node)!) : node.nodeValue,
    node instanceof Element ? [node.namespaceURI, [...node.attributes].map(a => [a.name, a.value, a.namespaceURI]).sort((a, b) => a[0]!.localeCompare(b[0]!))] : [],
    [...node.childNodes].map(n => snapshot(n, skip, intervals)).filter(n => n !== null)];
  const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  const normalize = (s: string) => s.replace(/\s|[。；，、：“”「」'".!?]/g, '');
  const styleDocument = document.implementation.createHTMLDocument('');
  const styleNode = styleDocument.createElement('style'); styleNode.textContent = code.css; styleDocument.head.appendChild(styleNode);
  // Build the expected complete document from nodes, independently of parsing
  // the serialized candidate. This catches cross-field parser reparenting too.
  const complete = (p: SiteCode['pages'][number], candidate: SiteCode) => {
    const expected = new DOMParser().parseFromString('<!doctype html><html><head><title></title><style></style></head><body></body></html>', 'text/html');
    expected.querySelector('title')!.textContent = p.title;
    expected.querySelector('style')!.textContent = candidate.css;
    for (const field of ['header', `pages/${p.id}/html`, 'footer']) for (const node of fields.get(field)!.childNodes) expected.body.appendChild(expected.importNode(node, true));
    const actual = new DOMParser().parseFromString(`<!doctype html><html><head>${expected.querySelector('title')!.outerHTML}${expected.querySelector('style')!.outerHTML}</head><body>${candidate.header}${p.html}${candidate.footer}</body></html>`, 'text/html');
    if (!equal(snapshot(expected, new Set()), snapshot(actual, new Set()))) refuse('重新解析整站后改变了节点、文本、属性或注释');
  };
  try {
    for (const p of code.pages) complete(p, code);
    if (!input.fragments) {
      const issues = input.issues!, issueText = issues.map(normalize).join('\n');
      const layoutIssues = issues.filter(i => /溢出|重叠|对比度|无可测量正文|CSS/.test(i));
      const fragments: Fragment[] = [];
      const add = (f: FragmentBody) => fragments.push({ ...f, id: fragments.length });
      const mentionedNumber = (text: string) => {
        const numbers: string[] = text.normalize('NFKC').match(/\d+(?:\.\d+)?/g) ?? [];
        return issues.some(i => i.startsWith('资料没有的数字：') && numbers.includes(i.split('：')[1]));
      };
      for (const [field, root] of fields) {
        const pageId = field.split('/')[1];
        const layout = layoutIssues.some(i => !pageId || i.startsWith(`${pageId}/`) || !/^[a-z][a-z0-9-]*\//.test(i));
        const walk = (node: Node, path: number[]) => {
          if (node instanceof Element) {
            const link = node.tagName === 'A' && issues.some(i => /空链接|链接目标|资源.*href/.test(i) && (!pageId || i.startsWith(pageId) || !/^[a-z][a-z0-9-]*[ /]/.test(i)));
            const auxiliary = ['alt', 'title', 'aria-label', 'data-label', 'data-image-id'].some(name => {
              const text = normalize(node.getAttribute(name) || ''); return text.length >= 4 && issueText.includes(text);
            });
            // Layout has the shared stylesheet plus leaf elements. Repeating
            // every ancestor's subtree would resend whole pages many times.
            if ((layout && !node.childElementCount) || link || auxiliary) add({ field, kind: 'element', before: node.outerHTML, path });
          } else if (node.nodeType === Node.TEXT_NODE) {
            const data = node.nodeValue!;
            for (const sentence of data.matchAll(/[^。！？；\n]+[。！？；]?/g)) {
              const text = normalize(sentence[0]), numbers: string[] = sentence[0].normalize('NFKC').match(/\d+(?:\.\d+)?/g) ?? [];
              if ((text.length >= 4 && issueText.includes(text)) || issues.some(i => i.startsWith('资料没有的数字：') && numbers.includes(i.split('：')[1]))) {
                add({ field, kind: 'text', before: sentence[0], path, offset: sentence.index!, text: data });
              }
            }
          }
          [...node.childNodes].forEach((child, i) => walk(child, [...path, i]));
        };
        [...root.childNodes].forEach((child, i) => walk(child, [i]));
      }
      if (layoutIssues.length || mentionedNumber(code.css)) add({ field: 'css', kind: 'style', before: styleNode.outerHTML });
      for (const p of code.pages) if ((normalize(p.title).length >= 4 && issueText.includes(normalize(p.title))) || mentionedNumber(p.title)) add({ field: `pages/${p.id}/title`, kind: 'title', before: p.title });
      const removed = issues.length > 0 && issues.every(i => input.cleaned!.includes(i) && /^(已去掉(?:禁止元素|资源或空链接|属性) |图片编号未授权：)/.test(i));
      if (!fragments.length && !removed) refuse('无法定位底线拒因对应的代码节点');
      return { fragments };
    }

    // HTML parsers repair missing end tags. Require explicit closure before
    // contextual parsing so that such repairs cannot expand a model's scope.
    const closedElement = (html: string) => {
      const stack: string[] = [], voids = new Set('area base br col embed hr img input link meta param source track wbr'.split(' '));
      let at = 0;
      while (at < html.length) {
        if (html[at] !== '<') { at++; continue; }
        if (html.startsWith('<!--', at)) { const end = html.indexOf('-->', at + 4); if (end < 0) refuse('包含未闭合注释'); at = end + 3; continue; }
        const tag = html.slice(at).match(/^<(\/?)([a-z][\w:-]*)\b/i);
        if (!tag) return refuse('包含无效 HTML 边界');
        let end = at + tag[0].length, quote = '';
        for (; end < html.length; end++) {
          const char = html[end]; if (quote) { if (char === quote) quote = ''; }
          else if (char === '"' || char === "'") quote = char; else if (char === '>') break;
        }
        if (end === html.length) refuse('包含未闭合标签或属性');
        const name = tag[2].toLowerCase();
        if (name === 'script') refuse('的元素包含脚本');
        if (tag[1]) { if (stack.pop() !== name || html.slice(at + tag[0].length, end).trim()) refuse('的标签越过了原节点边界'); }
        else if (!voids.has(name)) {
          if (/\/\s*$/.test(html.slice(at, end))) refuse('的非空元素缺少结束标签');
          stack.push(name);
          if (name === 'style') { const close = html.toLowerCase().indexOf('</style', end + 1); if (close < 0) refuse('包含未闭合 style'); at = close; continue; }
        }
        at = end + 1;
      }
      if (stack.length) refuse('包含未闭合标签');
    };
    const closedCss = (css: string) => {
      const stack: string[] = []; let quote = '';
      for (let i = 0; i < css.length; i++) {
        const c = css[i];
        if (quote) { if (c === '\\') i++; else if (c === quote) quote = ''; continue; }
        if (css.startsWith('/*', i)) { const end = css.indexOf('*/', i + 2); if (end < 0) refuse('的 CSS 注释未闭合'); i = end + 1; continue; }
        if (c === '"' || c === "'") quote = c;
        else if ('{(['.includes(c)) stack.push(c);
        else if ('})]'.includes(c) && stack.pop() !== ({ '}': '{', ')': '(', ']': '[' } as Record<string, string>)[c]) refuse('的 CSS 边界无效');
      }
      if (quote || stack.length) refuse('的 CSS 未闭合');
      const sheet = new CSSStyleSheet(); sheet.replaceSync(css);
      if (css.trim() && !sheet.cssRules.length) refuse('的 CSS 无法解析');
    };
    const changes = input.replacements!.map(p => {
      const f = input.fragments!.find(f => f.id === p.fragmentId)!;
      let node: Node | null = null, next: Element | null = null;
      if (f.kind === 'text' || f.kind === 'element') {
        node = fields.get(f.field)!;
        for (const index of f.path) node = node?.childNodes[index] || null;
        if (!node || (f.kind === 'text' ? node.nodeType !== Node.TEXT_NODE || node.nodeValue !== f.text || node.nodeValue.slice(f.offset, f.offset + f.before.length) !== f.before : !(node instanceof Element) || node.outerHTML !== f.before)) refuse('节点已经变化');
      } else if (f.kind === 'style') { if (f.before !== styleNode.outerHTML) refuse('样式节点已经变化'); node = styleNode; }
      else if (code.pages.find(page => `pages/${page.id}/title` === f.field)?.title !== f.before) refuse('标题已经变化');
      if (f.kind === 'element' || f.kind === 'style') {
        closedElement(p.after);
        const range = (node!.ownerDocument!).createRange(); range.selectNodeContents(node!.parentNode || node!);
        const replacement = range.createContextualFragment(p.after);
        if (replacement.childNodes.length !== 1 || !(replacement.firstChild instanceof Element)) return refuse('必须替换为同一层级的一个完整元素');
        next = replacement.firstChild;
        if (f.kind === 'style') { if (next.tagName !== 'STYLE' || next.attributes.length) refuse('必须保留一个无属性的 style 元素'); closedCss(next.textContent || ''); }
      }
      return { f, after: p.after, node, next };
    });
    for (let i = 0; i < changes.length; i++) for (const b of changes.slice(i + 1)) {
      const a = changes[i]; if (a.f.field !== b.f.field) continue;
      if (a.f.kind === 'text' && b.f.kind === 'text' && a.node === b.node) {
        if (Math.max(a.f.offset, b.f.offset) < Math.min(a.f.offset + a.f.before.length, b.f.offset + b.f.before.length)) refuse('节点范围重叠');
      } else if (a.node === b.node || a.node?.contains(b.node) || b.node?.contains(a.node)) refuse('节点范围重叠');
    }
    const textGroups = new Map<Text, Array<{ offset: number; before: string; after: string }>>();
    for (const c of changes) if (c.f.kind === 'text') {
      const node = c.node as Text, group = textGroups.get(node) || [];
      group.push({ offset: c.f.offset, before: c.f.before, after: c.after }); textGroups.set(node, group);
    }
    const beforeIntervals = new Map<Node, Interval[]>(), afterIntervals = new Map<Node, Interval[]>();
    const expectedLengths = new Map<Text, number>();
    for (const [node, group] of textGroups) {
      group.sort((a, b) => a.offset - b.offset);
      let end = 0, delta = 0;
      const before: Interval[] = [], after: Interval[] = [];
      for (const edit of group) {
        if (edit.offset < end) refuse('字符区间重叠');
        end = edit.offset + edit.before.length;
        before.push({ start: edit.offset, end });
        after.push({ start: edit.offset + delta, end: edit.offset + delta + edit.after.length });
        delta += edit.after.length - edit.before.length;
      }
      beforeIntervals.set(node, before); afterIntervals.set(node, after);
      expectedLengths.set(node, node.length + delta);
    }
    // Only whole-element replacements are excluded from the DOM comparison.
    // Text nodes stay in it, with every unselected character interval retained.
    const skip = new Set(changes.filter(c => c.f.kind === 'element').map(c => c.node!));
    const outside = new Map([...fields].map(([field, root]) => [field, snapshot(root, skip, beforeIntervals)]));
    const result = structuredClone(code);
    // Each node has its own ordered edits. Interleaving other nodes cannot
    // change the ordering or invalidate offsets within this original text.
    for (const [node, group] of textGroups) {
      for (const edit of [...group].reverse()) node.replaceData(edit.offset, edit.before.length, edit.after);
      if (node.length !== expectedLengths.get(node)) refuse('的文字区间长度不一致');
      const intervals = afterIntervals.get(node)!;
      if (group.some((edit, i) => node.data.slice(intervals[i].start, intervals[i].end) !== edit.after)) refuse('的文字区间应用结果不一致');
    }
    for (const c of changes) {
      if (c.f.kind === 'text') continue;
      if (c.f.kind === 'element') { (c.node as Element).replaceWith(c.next!); skip.add(c.next!); }
      else if (c.f.kind === 'style') result.css = c.next!.textContent || '';
      else result.pages.find(p => `pages/${p.id}/title` === c.f.field)!.title = c.after;
    }
    for (const [field, root] of fields) {
      if (!equal(outside.get(field), snapshot(root, skip, afterIntervals))) refuse('改变了片段之外的 DOM 或未选中的字符区间');
      root.normalize();
      if (changes.some(c => c.f.field === field)) {
        if (field === 'header' || field === 'footer') result[field] = root.innerHTML;
        else result.pages.find(p => `pages/${p.id}/html` === field)!.html = root.innerHTML;
      }
    }
    for (const p of result.pages) complete(p, result);
    return { code: result };
  } catch (error) {
    if (!(error instanceof BoundaryFailure)) throw error;
    return { error: error.message };
  }
}

async function inDom(code: SiteCode, input: Parameters<typeof repairDom>[1]) {
  const browser = await codeCheckBrowser();
  try {
    await browser.send('Network.enable'); await browser.send('Network.setBlockedURLs', { urls: ['*'] });
    return await browser.evaluate<ReturnType<typeof repairDom>>(`(${repairDom.toString()})(${JSON.stringify(code)},${JSON.stringify(input)})`);
  } finally { await browser.close(); }
}
export async function codeRepairFragments(code: SiteCode, issues: string[], cleaned: string[] = []): Promise<Fragment[]> {
  const result = await inDom(code, { issues, cleaned });
  if (result.error) throw new Error(result.error);
  return result.fragments!;
}
export async function applyCodeRepair(code: SiteCode, fragments: Fragment[], raw: unknown): Promise<SiteCode> {
  const parsed = replacementSchema.safeParse(raw);
  if (!parsed.success || (!parsed.data.replacements.length && fragments.length)) throw new CodeRepairError('模型未返回有效的局部修正，本次未保存版本。', raw);
  const ids = new Set<number>();
  for (const p of parsed.data.replacements) {
    if (!fragments.some(f => f.id === p.fragmentId) || ids.has(p.fragmentId)) throw new CodeRepairError('局部修正包含未知或重复节点，本次未保存版本。', raw);
    ids.add(p.fragmentId);
  }
  const result = await inDom(code, { fragments, replacements: parsed.data.replacements });
  if (result.error) throw new CodeRepairError(result.error, raw);
  const checked = codeSiteSchema.safeParse(result.code);
  if (!checked.success) throw new CodeRepairError('局部修正不符合站点代码格式，本次未保存版本。', raw);
  return checked.data;
}
