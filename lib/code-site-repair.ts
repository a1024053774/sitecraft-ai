import { z } from 'zod';
import { codeSiteSchema, type SiteCode } from './code-site.ts';
import { codeCheckBrowser } from './code-site-browser.ts';
import type { CodeFactRepair } from './code-site-fact-segments.ts';
import { codeCssDeclarationNames, type CodeLayoutRepair } from './code-site-layout-repair.ts';

export type FragmentBody = { field: string; before: string } & (
  { kind: 'text'; path: number[]; offset: number; text: string } |
  { kind: 'element'; path: number[] } | { kind: 'attribute'; path: number[]; name: string } |
  { kind: 'css'; stylePath?: number[]; rulePath: number[]; selector: string; property: string; priority: string; ruleText: string; pseudo: string } |
  { kind: 'style' | 'title' }
);
type Fragment = FragmentBody & { id: number };
type Replacement = { fragmentId: number; after: string };
const repairFragmentLimit = 80;
const replacementSchema = z.object({ replacements: z.array(z.object({
  fragmentId: z.number().int().nonnegative(), after: z.string().max(100020),
}).strict()).max(repairFragmentLimit) }).strict();
export class CodeRepairError extends Error {
  response: unknown;
  constructor(reason: string, response: unknown) { super(reason); this.response = response; }
}

// This function runs in an isolated, network-blocked Chrome document. Both
// selection and replacement use parsed nodes; model text never becomes HTML.
function repairDom(code: SiteCode, input: { issues?: string[]; cleaned?: string[]; factRepairs?: CodeFactRepair[]; layoutRepairs?: CodeLayoutRepair[]; fragments?: Fragment[]; replacements?: Replacement[] }, declarationNames: typeof codeCssDeclarationNames) {
  class BoundaryFailure extends Error {}
  const refuse = (reason: string): never => { throw new BoundaryFailure(`局部修正${reason}，本次未保存版本。`); };
  const parse = (html: string) => new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html').body;
  const fields = new Map<string, HTMLElement>([
    ['header', parse(code.header)], ['footer', parse(code.footer)],
    ...code.pages.map(p => [`pages/${p.id}/html`, parse(p.html)] as [string, HTMLElement]),
  ]);
  type Interval = { start: number; end: number };
  const attributeMasks = new Map<Node, Set<string>>(), cssNodes = new Set<Node>();
  const unselected = (text: string, intervals: Interval[]) => {
    const parts: string[] = []; let at = 0;
    for (const interval of intervals) { parts.push(text.slice(at, interval.start)); at = interval.end; }
    parts.push(text.slice(at)); return parts;
  };
  const snapshot = (node: Node, skip: Set<Node>, intervals = new Map<Node, Interval[]>()): unknown => skip.has(node) ? null : [node.nodeType, node.nodeName,
    intervals.has(node) ? unselected(node.nodeValue!, intervals.get(node)!) : node.nodeValue,
    node instanceof Element ? [node.namespaceURI, [...node.attributes].filter(a => !attributeMasks.get(node)?.has(a.name)).map(a => [a.name, a.value, a.namespaceURI]).sort((a, b) => a[0]!.localeCompare(b[0]!))] : [],
    cssNodes.has(node) ? [] : [...node.childNodes].map(n => snapshot(n, skip, intervals)).filter(n => n !== null)];
  const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  const normalize = (s: string) => s.replace(/\s|[。；，、：“”「」'".!?]/g, '');
  const styleDocument = document.implementation.createHTMLDocument('');
  const styleNode = styleDocument.createElement('style'); styleNode.textContent = code.css; styleDocument.head.appendChild(styleNode);
  const nodeAt = (field: string, path: number[]) => {
    let node: Node | undefined = fields.get(field);
    for (const index of path) node = node?.childNodes[index];
    return node;
  };
  const cssSources = new Map<string, { sheet: CSSStyleSheet; node: HTMLStyleElement; field: string }>();
  const cssSource = (field: string, stylePath?: number[]) => {
    const key = JSON.stringify([field, stylePath ?? null]);
    const existing = cssSources.get(key); if (existing) return existing;
    const node = field === 'css' ? styleNode : nodeAt(field, stylePath ?? []);
    if (!(node instanceof HTMLStyleElement)) refuse('CSS 出处的样式节点无法定位');
    const sheet = new CSSStyleSheet(); sheet.replaceSync(node!.textContent ?? '');
    const source = { sheet, node: node as HTMLStyleElement, field }; cssSources.set(key, source); return source;
  };
  const cssRule = (source: ReturnType<typeof cssSource>, path: number[]) => {
    let rules = source.sheet.cssRules, rule: CSSRule | undefined;
    for (const [i, index] of path.entries()) {
      rule = rules[index];
      if (i < path.length - 1) {
        if (!rule || !('cssRules' in rule)) refuse('CSS 出处的规则路径已经失效');
        rules = (rule as CSSGroupingRule).cssRules;
      }
    }
    if (!(rule instanceof CSSStyleRule)) refuse('CSS 出处不是可修正的样式声明');
    return rule as CSSStyleRule;
  };
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
      // Citation failures carry locations from this candidate's rendered audit.
      // Do not rediscover them by text length or select matching text elsewhere.
      const factRepairs = input.factRepairs ?? [];
      const remainingIssues = input.issues!.filter(issue => !factRepairs.some(repair => repair.issues.includes(issue)));
      const layoutIssues = remainingIssues.filter(issue => input.layoutRepairs?.some(repair => repair.issue === issue));
      const issues = remainingIssues.filter(issue => !layoutIssues.includes(issue)), issueText = issues.map(normalize).join('\n');
      // A viewport-scoped diagnostic without its structured scan record must
      // not fall through to prose matching and open unrelated same-text nodes.
      for (const issue of issues) if (code.pages.some(page => [375, 768, 1440].some(width => issue.startsWith(`${page.id}/${width} `)))) {
        refuse(`版面扫描拒因缺少本次扫描的定位依据：${issue}`);
      }
      const fragments: Fragment[] = [];
      const samePath = (a: number[] | undefined, b: number[] | undefined) => a === b || !!a && !!b && a.length === b.length && a.every((value, i) => value === b[i]);
      const add = (f: FragmentBody) => {
        const exists = fragments.some(other => {
          if (other.field !== f.field || other.kind !== f.kind) return false;
          if (f.kind === 'text') return other.kind === 'text' && samePath(other.path, f.path) && other.offset === f.offset && other.before.length === f.before.length;
          if (f.kind === 'attribute') return other.kind === 'attribute' && samePath(other.path, f.path) && other.name === f.name;
          if (f.kind === 'element') return other.kind === 'element' && samePath(other.path, f.path);
          if (f.kind === 'css') return other.kind === 'css' && samePath(other.stylePath, f.stylePath) && samePath(other.rulePath, f.rulePath) && other.property === f.property;
          return true;
        });
        if (!exists) fragments.push({ ...f, id: fragments.length });
      };
      const factMembers = factRepairs.flatMap(repair => repair.members);
      for (const member of factMembers) {
        if (member.context) continue;
        if (member.kind === 'unsupported') refuse(`无法定位出处拒因：${member.reason}`);
        else if (member.kind === 'title') {
          if (code.pages.find(page => page.id === member.pageId)?.title !== member.text) refuse('出处拒因的页面标题快照已经失效');
          add({ field: `pages/${member.pageId}/title`, kind: 'title', before: member.text });
        } else if (member.kind === 'css') {
          const rule = cssRule(cssSource(member.field, member.stylePath), member.rulePath);
          if (rule.selectorText !== member.selector || rule.cssText !== member.ruleText || rule.style.getPropertyValue(member.property) !== member.before) refuse('出处拒因的 CSS 声明快照已经失效');
          const { kind, position: _position, ...location } = member;
          add({ kind, ...location });
        } else {
          const node = nodeAt(member.field, member.path);
          if (member.kind === 'text') {
            if (!node || node.nodeType !== Node.TEXT_NODE || node.nodeValue !== member.text || node.nodeValue.slice(member.offset, member.offset + member.before.length) !== member.before) refuse('出处拒因的文本节点或字符区间快照已经失效');
            add({ field: member.field, kind: 'text', path: member.path, before: member.before, text: member.text, offset: member.offset });
          } else {
            if (!(node instanceof Element) || node.getAttribute(member.name) !== member.before) refuse('出处拒因的属性快照已经失效');
            add({ field: member.field, kind: 'attribute', path: member.path, name: member.name, before: member.before });
          }
        }
      }
      for (const issue of layoutIssues) {
        const repairs = input.layoutRepairs?.filter(repair => repair.issue === issue);
        if (!repairs?.length) refuse(`版面拒因缺少本次扫描的定位依据：${issue}`);
        for (const repair of repairs!) {
          if (repair.reason) refuse(`版面拒因无法定位：${repair.reason}`);
          for (const element of repair.elements) {
            const node = nodeAt(element.field, element.path);
            if (!(node instanceof Element) || node.outerHTML !== element.before) refuse('版面拒因的元素快照已经变化');
            // Containers remain read-only context. Their actual declarations
            // can change without opening the entire subtree for replacement.
            if (!(node as Element).childElementCount) add({ ...element, kind: 'element' });
          }
          for (const declaration of repair.declarations) {
            const rule = cssRule(cssSource(declaration.field, declaration.stylePath), declaration.rulePath);
            if (rule.selectorText !== declaration.selector || rule.cssText !== declaration.ruleText || rule.style.getPropertyValue(declaration.property) !== declaration.before || rule.style.getPropertyPriority(declaration.property) !== declaration.priority) refuse('版面拒因的 CSS 声明快照已经变化');
            add(declaration);
          }
        }
      }
      const mentionedNumber = (text: string) => {
        const numbers: string[] = text.normalize('NFKC').match(/\d+(?:\.\d+)?/g) ?? [];
        return issues.some(i => i.startsWith('资料没有的数字：') && numbers.includes(i.split('：')[1]));
      };
      for (const [field, root] of fields) {
        const pageId = field.split('/')[1];
        const walk = (node: Node, path: number[]) => {
          if (node instanceof Element) {
            const link = node.tagName === 'A' && issues.some(i => /空链接|链接目标|资源.*href/.test(i) && (!pageId || i.startsWith(pageId) || !/^[a-z][a-z0-9-]*[ /]/.test(i)));
            const auxiliary = ['alt', 'title', 'aria-label', 'data-label', 'data-image-id'].some(name => {
              const text = normalize(node.getAttribute(name) || ''); return text.length >= 4 && issueText.includes(text);
            });
            if (link || auxiliary) add({ field, kind: 'element', before: node.outerHTML, path });
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
      if (mentionedNumber(code.css)) add({ field: 'css', kind: 'style', before: styleNode.outerHTML });
      for (const p of code.pages) if ((normalize(p.title).length >= 4 && issueText.includes(normalize(p.title))) || mentionedNumber(p.title)) add({ field: `pages/${p.id}/title`, kind: 'title', before: p.title });
      const removed = issues.length > 0 && issues.every(i => input.cleaned!.includes(i) && /^(已去掉(?:禁止元素|资源或空链接|属性) |图片编号未授权：)/.test(i));
      if (!fragments.length && !removed) refuse(factRepairs.length ? '无法定位出处拒因：当前核对段没有可独立修正的位置成员' : '无法定位底线拒因对应的代码节点');
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
    const closedDeclarationValue = (value: string) => {
      if (/[;{}]/.test(value)) refuse('CSS 声明值含分号或花括号');
      if (value.includes('/*') || value.includes('*/')) refuse('CSS 声明值含注释符');
      if (value.includes('\\')) refuse('CSS 声明值含反斜杠转义');
      const stack: string[] = []; let quote = '';
      for (const char of value) {
        if (quote) { if (char === quote) quote = ''; continue; }
        if (char === '"' || char === "'") quote = char;
        else if (char === '(' || char === '[') stack.push(char);
        else if ((char === ')' || char === ']') && stack.pop() !== (char === ')' ? '(' : '[')) refuse('CSS 声明值的括号不成对');
      }
      if (quote) refuse('CSS 声明值的引号未闭合');
      if (stack.length) refuse('CSS 声明值的括号未闭合');
    };
    const changes = input.replacements!.map(p => {
      const f = input.fragments!.find(f => f.id === p.fragmentId)!;
      let node: Node | null = null, next: Element | null = null;
      let css: { source: ReturnType<typeof cssSource>; rule: CSSStyleRule } | undefined;
      if (f.kind === 'text' || f.kind === 'element' || f.kind === 'attribute') {
        node = fields.get(f.field)!;
        for (const index of f.path) node = node?.childNodes[index] || null;
        if (!node || (f.kind === 'text' ? node.nodeType !== Node.TEXT_NODE || node.nodeValue !== f.text || node.nodeValue.slice(f.offset, f.offset + f.before.length) !== f.before : !(node instanceof Element) || (f.kind === 'attribute' ? node.getAttribute(f.name) !== f.before : node.outerHTML !== f.before))) refuse('节点已经变化');
      } else if (f.kind === 'css') {
        const source = cssSource(f.field, f.stylePath), rule = cssRule(source, f.rulePath);
        if (rule.selectorText !== f.selector || rule.cssText !== f.ruleText || rule.style.getPropertyValue(f.property) !== f.before || rule.style.getPropertyPriority(f.property) !== f.priority) refuse('CSS 声明已经变化');
        closedDeclarationValue(p.after);
        if (!CSS.supports(f.property, p.after)) refuse('CSS 修正不是有效的单个声明值');
        css = { source, rule }; node = source.node;
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
      return { f, after: p.after, node, next, css };
    });
    for (let i = 0; i < changes.length; i++) for (const b of changes.slice(i + 1)) {
      const a = changes[i]; if (a.f.field !== b.f.field) continue;
      if (a.f.kind === 'css' && b.f.kind === 'css') {
        if (a.css?.rule === b.css?.rule && a.f.property === b.f.property) refuse('CSS 声明范围重叠');
      } else if (a.f.kind === 'attribute' && b.f.kind === 'attribute') {
        if (a.node === b.node && a.f.name === b.f.name) refuse('属性范围重叠');
      } else if (a.f.kind === 'text' && b.f.kind === 'text' && a.node === b.node) {
        if (Math.max(a.f.offset, b.f.offset) < Math.min(a.f.offset + a.f.before.length, b.f.offset + b.f.before.length)) refuse('节点范围重叠');
      } else if (a.f.kind === 'element' || b.f.kind === 'element' || a.f.kind === 'style' || b.f.kind === 'style') {
        if (a.node === b.node || a.node?.contains(b.node) || b.node?.contains(a.node)) refuse('节点范围重叠');
      }
    }
    const cssMasks = new Map<CSSStyleRule, Set<string>>();
    for (const c of changes) {
      if (c.f.kind === 'attribute') {
        const mask = attributeMasks.get(c.node!) ?? new Set<string>(); mask.add(c.f.name); attributeMasks.set(c.node!, mask);
      } else if (c.f.kind === 'css') {
        const mask = cssMasks.get(c.css!.rule) ?? new Set<string>(); mask.add(c.f.property); cssMasks.set(c.css!.rule, mask);
        if (c.f.field !== 'css') cssNodes.add(c.node!);
      }
    }
    const cssSnapshot = (rules: CSSRuleList): unknown => [...rules].map(rule => rule instanceof CSSStyleRule
      ? [rule.selectorText, declarationNames(rule.style.cssText).filter(name => !cssMasks.get(rule)?.has(name)).map(name => [name, rule.style.getPropertyValue(name), rule.style.getPropertyPriority(name)]), 'cssRules' in rule ? cssSnapshot(rule.cssRules) : []]
      : 'cssRules' in rule ? [rule.constructor.name, (rule as CSSConditionRule).conditionText ?? (rule as CSSLayerBlockRule).name, cssSnapshot((rule as CSSGroupingRule).cssRules)] : rule.cssText);
    const cssOutside = new Map([...cssSources.values()].map(source => [source, cssSnapshot(source.sheet.cssRules)]));
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
      else if (c.f.kind === 'attribute') { (c.node as Element).setAttribute(c.f.name, c.after); if ((c.node as Element).getAttribute(c.f.name) !== c.after) refuse('属性修正应用结果不一致'); }
      else if (c.f.kind === 'css') c.css!.rule.style.setProperty(c.f.property, c.after, c.f.priority);
      else if (c.f.kind === 'style') result.css = c.next!.textContent || '';
      else result.pages.find(p => `pages/${p.id}/title` === c.f.field)!.title = c.after;
    }
    for (const source of cssSources.values()) {
      if (!equal(cssOutside.get(source), cssSnapshot(source.sheet.cssRules))) refuse('改变了片段之外的 CSS 规则或声明');
      const serialized = [...source.sheet.cssRules].map(rule => rule.cssText).join('\n');
      if (source.field === 'css') result.css = serialized;
      else source.node.textContent = serialized;
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
    return await browser.evaluate<ReturnType<typeof repairDom>>(`(${repairDom.toString()})(${JSON.stringify(code)},${JSON.stringify(input)},(${codeCssDeclarationNames.toString()}))`);
  } finally { await browser.close(); }
}
export async function codeRepairFragments(code: SiteCode, issues: string[], cleaned: string[] = [], factRepairs: CodeFactRepair[] = [], layoutRepairs: CodeLayoutRepair[] = []): Promise<Fragment[]> {
  const result = await inDom(code, { issues, cleaned, factRepairs, layoutRepairs });
  if (result.error) throw new Error(result.error);
  if (result.fragments!.length > repairFragmentLimit) throw new Error(`局部修正需要 ${result.fragments!.length} 个片段，超过回复上限 ${repairFragmentLimit}，本次未发送模型请求、未保存版本。`);
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
