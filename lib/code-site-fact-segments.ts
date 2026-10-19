import type { SiteCode } from './code-site.ts';

export type CodeFactTarget = { pageId: string; root: 'main' | 'body'; path: number[]; text: string; readable?: string };
export type CodeFactSource =
  | { type: 'upload'; sourceId: string; name: string; text: string }
  | { type: 'materials'; messageIndex: number; text: string }
  | { type: 'message'; messageIndex: number; text: string };
export type CodeFactSourceRef =
  | { type: 'upload'; sourceId: string; name: string }
  | { type: 'materials'; messageIndex: number }
  | { type: 'message'; messageIndex: number };
export type CodeFactCitation = { category: '客户与合作方' | '资质认证' | '业绩与数量' | '价格与收费' | '时间与交期承诺' | '效果' | '评价'; claim: string; quote: string; source?: CodeFactSourceRef; targets?: CodeFactTarget[] };
export type CodeFactCssPosition = { pageId: string; width: number; path: number[]; pseudo: string };
export type CodeFactMember = { context?: true } & (
  | { kind: 'text'; field: string; path: number[]; text: string; before: string; offset: number }
  | { kind: 'attribute'; field: string; path: number[]; name: string; before: string }
  | { kind: 'title'; pageId: string; text: string }
  | { kind: 'css'; field: string; stylePath?: number[]; rulePath: number[]; selector: string; property: string; before: string; priority: string; ruleText: string; pseudo: string; position: CodeFactCssPosition }
  | { kind: 'unsupported'; reason: string });
export type CodeFactOwner = { pageId: string; path: number[] };
export type CodeFactSeparator = { path: number[]; tag: string };
export type CodeFactSegment = { text: string; group: string; context: { pageId: string; outline: string[]; headings: string[] }; targets?: CodeFactTarget[]; members?: CodeFactMember[]; owners?: CodeFactOwner[] };
export type CodeFactRepair = { issues: string[]; members: CodeFactMember[] };
export type CodeFactCssMember = Extract<CodeFactMember, { kind: 'css' }>;
export type CodeFactReview = {
  format: 4; materials: string; sourceMaterials: CodeFactSource[]; audited: number; reused: number;
  segments: Array<{ text: string; group: string; issues: string[]; noFacts: boolean; factCategories: CodeFactCitation['category'][]; citations: CodeFactCitation[]; factRepair?: CodeFactRepair }>;
};

export function normalizeFactQuote(text: string) { return text.normalize('NFKC').replace(/\s+/g, ' ').trim(); }
// readCodeFactSegments adds table/cell markers for semantic auditing. They are
// not claim text; retain TR boundaries so claims cannot join independent rows.
// Source quotes continue to use normalizeFactQuote without stripping markers.
export function normalizeFactClaimText(text: string) {
  return normalizeFactQuote(text.replace(/<\/?(?:TABLE|THEAD|TBODY|TFOOT|TH|TD)>/g, ' ').replace(/<\/?TR>/g, '\u0000'));
}
export function factSourceRef(source: CodeFactSource): CodeFactSourceRef {
  return source.type === 'upload'
    ? { type: 'upload', sourceId: source.sourceId, name: source.name }
    : { type: source.type, messageIndex: source.messageIndex };
}
export function factSourceKey(source: CodeFactSource) {
  return source.type === 'upload' ? `upload:${source.sourceId}` : `${source.type}:${source.messageIndex}`;
}
export function sameFactSources(left: CodeFactSource[] | undefined, right: CodeFactSource[] | undefined) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}
export function findFactSource(sources: CodeFactSource[] | undefined, quote: string) {
  const normalized = normalizeFactQuote(quote);
  if (!normalized) return undefined;
  // The latest user-provided source wins when the same sentence was repeated.
  return [...(sources ?? [])].reverse().find(source => normalizeFactQuote(source.text).includes(normalized));
}
export function bindCodeFactCitations(segment: CodeFactSegment, citations: CodeFactCitation[]) {
  return citations.map(citation => {
    const matches = (segment.targets ?? []).filter(target => normalizeFactClaimText(target.readable ?? target.text).includes(normalizeFactQuote(citation.claim)));
    // Keep the smallest matching element in each branch, including repeated
    // claims. Always bind again in this candidate: text reuse is not path reuse.
    const targets = matches.filter(target => !matches.some(child => child.pageId === target.pageId && child.root === target.root && child.path.length > target.path.length && target.path.every((index, i) => child.path[i] === index)))
      .map(({ readable: _readable, ...target }) => target);
    return { ...citation, targets };
  });
}

// Collect at all checked widths before reading any segments. Paths are relative
// to body in the same rendered page; the union is shared by every width.
export function readCodeFactSeparators(): CodeFactSeparator[] {
  const result: CodeFactSeparator[] = [];
  const walk = (parent: Element, path: number[]) => [...parent.children].forEach((node, index) => {
    const next = [...path, index];
    if (!['inline', 'contents', 'none'].includes(getComputedStyle(node).display)) result.push({ path: next, tag: node.tagName });
    walk(node, next);
  });
  walk(document.body, []);
  return result;
}

// Segment identity is readable text plus semantic conditions. CSS separators
// must come from the complete viewport union, never this viewport alone.
export function readCodeFactSegments(code: SiteCode, pageId: string, localPath: number[] | undefined, separatorPaths: CodeFactSeparator[]): CodeFactSegment[] {
  const separators = new Set(separatorPaths.map(({ path, tag }) => {
    let node: Element | undefined = document.body;
    for (const index of path) node = node?.children[index];
    if (!node || node.tagName !== tag) throw new Error('三档事实核对的文字分隔位置无法核实，本次未保存版本。');
    return node;
  }));
  const page = code.pages.find(page => page.id === pageId)!;
  const fragment = (html: string) => new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html').body;
  const parts = [fragment(code.header), fragment(page.html), fragment(code.footer)];
  const nodes = [...document.body.children];
  let offset = 0;
  const result: CodeFactSegment[] = [];
  const positions = new Map<Node, { field: string; path: number[] }>();
  const locate = (source: Node, live: Node, field: string, path: number[]) => {
    positions.set(source, { field, path }); positions.set(live, { field, path });
    if (source instanceof Element && source.hasAttribute('data-system-icon')) return;
    if (source.childNodes.length !== live.childNodes.length) return;
    [...source.childNodes].forEach((child, i) => locate(child, live.childNodes[i], field, [...path, i]));
  };
  const partRoots = parts.map((part, index) => [...part.childNodes].map((source, child) => {
    const field = index === 0 ? 'header' : index === 2 ? 'footer' : `pages/${pageId}/html`;
    const live = source instanceof Element ? nodes[offset++] : source;
    if (!live || live.nodeName !== source.nodeName) throw new Error('核对段无法定位页面内容，本次未保存版本。');
    locate(source, live, field, [child]); return live;
  }));
  const cssSources: Array<{ field: string; stylePath?: number[]; sheet: CSSStyleSheet }> = [];
  const cssSource = (field: string, text: string, stylePath?: number[]) => {
    const sheet = new CSSStyleSheet(); sheet.replaceSync(text); cssSources.push({ field, stylePath, sheet });
  };
  cssSource('css', code.css);
  parts.forEach((part, index) => {
    const field = index === 0 ? 'header' : index === 2 ? 'footer' : `pages/${pageId}/html`;
    for (const style of part.querySelectorAll('style')) cssSource(field, style.textContent ?? '', positions.get(style)?.path);
  });
  const member = (node: Node, extra: { kind: 'text'; text: string; before: string; offset: number } | { kind: 'attribute'; name: string; before: string }): CodeFactMember => {
    const position = positions.get(node);
    return position ? { ...position, ...extra } : { kind: 'unsupported', reason: '核对段节点没有可验证的作者代码路径' };
  };
  const textMembers = (node: Node) => {
    const text = node.textContent ?? '';
    // Establish character intervals while reading the member, independently
    // of model issues. Repairs can retain intervening and adjacent sentences.
    return [...text.matchAll(/[^。！？；\n]+[。！？；]?/g)].filter(part => part[0].trim())
      .map(part => member(node, { kind: 'text', text, before: part[0], offset: part.index! }));
  };
  const cssMembers = (el: Element, pseudo: string, property: string): CodeFactMember[] => {
    const matches: CodeFactMember[] = [];
    const path: number[] = [];
    for (let node = el; node.parentElement; node = node.parentElement) path.unshift([...node.parentElement.children].indexOf(node));
    const position = { pageId, width: innerWidth, path, pseudo };
    const selectors = (text: string) => {
      const parts: string[] = []; let start = 0, depth = 0, quote = '';
      for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (char === '\\') { i++; continue; }
        if (quote) { if (char === quote) quote = ''; continue; }
        if (char === '"' || char === "'") quote = char;
        else if (char === '(' || char === '[') depth++;
        else if (char === ')' || char === ']') depth--;
        else if (char === ',' && !depth) { parts.push(text.slice(start, i).trim()); start = i + 1; }
      }
      return [...parts, text.slice(start).trim()];
    };
    for (const source of cssSources) {
      const walk = (rules: CSSRuleList, path: number[], scopeProblem?: string) => [...rules].forEach((rule, i) => {
        const rulePath = [...path, i];
        if (rule instanceof CSSMediaRule && !matchMedia(rule.conditionText).matches) return;
        if (rule instanceof CSSSupportsRule && !CSS.supports(rule.conditionText)) return;
        if (rule instanceof CSSStyleRule && rule.style.getPropertyValue(property)) {
          const selector = rule.selectorText;
          let applies = false, selectorProblem = false;
          for (const branch of selectors(selector)) {
            if (pseudo ? !branch.endsWith(pseudo) : branch.includes('::')) continue;
            if (branch.includes('&')) { selectorProblem = true; continue; }
            try { applies ||= el.matches(pseudo ? branch.slice(0, -pseudo.length) : branch); }
            catch { selectorProblem = true; }
          }
          if (selectorProblem) matches.push({ kind: 'unsupported', reason: `${el.tagName.toLowerCase()}${pseudo} 的生成文案选择器无法可靠定位` });
          if (applies) matches.push(scopeProblem ? { kind: 'unsupported', reason: scopeProblem } : { kind: 'css', field: source.field, ...(source.stylePath ? { stylePath: source.stylePath } : {}), rulePath,
            selector, property, before: rule.style.getPropertyValue(property), priority: rule.style.getPropertyPriority(property), ruleText: rule.cssText, pseudo, position });
        }
        if ('cssRules' in rule) walk((rule as CSSGroupingRule).cssRules, rulePath, scopeProblem ??
          (rule instanceof CSSMediaRule || rule instanceof CSSSupportsRule || rule.constructor.name === 'CSSLayerBlockRule' ? undefined : `${rule.constructor.name} 的生成文案作用域无法可靠核实`));
      });
      walk(source.sheet.cssRules, []);
    }
    const unsupported = matches.find(member => member.kind === 'unsupported');
    if (unsupported) return [unsupported];
    if (matches.length !== 1) return [{ kind: 'unsupported', reason: `${el.tagName.toLowerCase()}${pseudo} 的 ${property} 生成文案${matches.length ? '匹配多条作者规则，无法唯一定位声明' : '没有可验证的作者声明位置'}` }];
    return matches;
  };
  const strings = (value: string) => [...value.matchAll(/"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'/g)]
    .map(match => (match[1] ?? match[2]).replace(/\\([0-9a-f]{1,6})\s?|\\(.)/gi, (_escape, hex, char) => hex ? String.fromCodePoint(parseInt(hex, 16)) : char)).join('');
  const heading = 'h1,h2,h3,h4,h5,h6';
  // Child headers, sidebars and lists can qualify a sibling table. Only
  // explicit content sections create a new scope; their parent prose follows.
  const containers = 'main,section,article';
  const atomic = 'table';
  const blocks = new Set('DIV P H1 H2 H3 H4 H5 H6 LI DT DD TR TH TD FIGCAPTION BR'.split(' '));
  const ownCache = new Map<Element, { text: string; members: CodeFactMember[] }>();
  const own = (el: Element, members?: CodeFactMember[]) => {
    const cached = ownCache.get(el); if (cached) { members?.push(...cached.members); return cached.text; }
    if (el.parentElement?.closest('[data-system-icon]')) return '';
    const positions: CodeFactMember[] = [];
    const attrs = ['alt', 'title', 'aria-label', 'data-label', 'colspan', 'rowspan', 'scope', 'headers'].flatMap(name => {
      if (!el.hasAttribute(name)) return [];
      positions.push(member(el, { kind: 'attribute', name, before: el.getAttribute(name)! }));
      return [`${name}=${el.getAttribute(name)}`];
    });
    for (const name of ['aria-labelledby', 'aria-describedby']) if (el.hasAttribute(name)) {
      attrs.push(`${name}=${el.getAttribute(name)!.split(/\s+/).map(id => {
        const label = document.getElementById(id);
        if (!label) { positions.push({ kind: 'unsupported', reason: `${name} 引用的节点 ${id} 不存在` }); return `未找到 ${id}`; }
        const walker = document.createTreeWalker(label, NodeFilter.SHOW_TEXT);
        for (let text = walker.nextNode(); text; text = walker.nextNode()) positions.push(...textMembers(text).map(member => ({ ...member, context: true as const })));
        return label.textContent ?? '';
      }).join('\n')}`);
    }
    const css: string[] = [];
    for (const pseudo of ['::before', '::after', '::marker']) {
      const text = strings(getComputedStyle(el, pseudo).content);
      if (text) { css.push(text); positions.push(...cssMembers(el, pseudo, 'content')); }
    }
    const style = getComputedStyle(el);
    if (style.display === 'list-item') {
      const text = strings(style.listStyleType);
      if (text) { css.push(text); positions.push(...cssMembers(el, '', 'list-style-type')); }
    }
    const text = [...attrs, ...css.map(value => `CSS=${value}`)].join('\n');
    ownCache.set(el, { text, members: positions }); members?.push(...positions); return text;
  };
  const read = (node: Node, skip?: (el: Element) => boolean, members?: CodeFactMember[]): string => {
    if (node instanceof Element && node.tagName === 'STYLE') return '';
    if (node.nodeType === Node.TEXT_NODE) {
      members?.push(...textMembers(node));
      return node.textContent ?? '';
    }
    if (!(node instanceof Element) || skip?.(node) || node.parentElement?.closest('[data-system-icon]')) return '';
    const auxiliary = own(node, members);
    const content = [...node.childNodes].map(child => read(child, skip, members)).join('');
    const text = `${auxiliary ? `\n[${auxiliary}]\n` : ''}${content}`;
    if (['TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'TH', 'TD'].includes(node.tagName)) return `\n<${node.tagName}>${text}</${node.tagName}>\n`;
    return blocks.has(node.tagName) || separators.has(node) ? `\n${text}\n` : text;
  };
  const documentMembers: CodeFactMember[] = [];
  const documentConditions = [own(document.documentElement, documentMembers), own(document.body, documentMembers)].filter(Boolean).join('\n');
  const targetCache = new Map<Element, CodeFactTarget>();
  const targets = (roots: Node[]) => roots.flatMap(root => root instanceof Element ? [root, ...root.querySelectorAll('*')] : []).map(el => {
    const cached = targetCache.get(el); if (cached) return cached;
    const main = document.querySelector('main'), root = main && main.contains(el) ? main : document.body;
    const path: number[] = []; let node = el;
    while (node !== root && node.parentElement) { path.unshift([...node.parentElement.children].indexOf(node)); node = node.parentElement; }
    const target: CodeFactTarget = { pageId, root: root === main ? 'main' : 'body', path, text: (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 1000), readable: read(el) };
    targetCache.set(el, target); return target;
  });
  if (localPath) {
    let node: Element | undefined = document.querySelector('main') ?? undefined;
    for (const index of localPath) node = node?.children[index];
    if (!node) throw new Error('核对段无法定位选中区块，本次未保存版本。');
    const members: CodeFactMember[] = [], text = read(node, undefined, members).trim();
    return [{ text, group: text, context: { pageId, outline: [], headings: [...node.querySelectorAll(heading)].map(el => read(el).trim()) }, targets: targets([node]), members, owners: [{ pageId, path: localPath }] }];
  }
  const readonly = (members: CodeFactMember[]) => members.map(member => ({ ...member, context: true as const }));
  if (documentConditions) result.push({ text: `页面 ${pageId}\n文档辅助文案：${documentConditions}`, group: `页面 ${pageId}\n文档辅助文案：${documentConditions}`,
    context: { pageId, outline: [], headings: [] }, members: documentMembers });
  for (const [index, part] of parts.entries()) {
    const roots = partRoots[index];
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
    const proseMembers = new Map<Element | null, CodeFactMember[]>();
    const prose = (group: Element | null) => {
      const members: CodeFactMember[] = [];
      const text = (group ? [group] : roots).map(node => read(node, el => el !== group && (el.matches(containers) || el.matches(atomic)), members)).join('').trim();
      proseMembers.set(group, members); return text;
    };
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
      const prefixMembers: CodeFactMember[] = readonly([...documentMembers, ...(group ? [null, ...ancestors].flatMap(parent => proseMembers.get(parent) ?? []) : [])]);
      const add = (body: string, members: CodeFactMember[], container = group) => { if (body.trim()) result.push({ text: `${prefix}\n${body}`, group: groupText(container), context: { pageId: index === 1 ? pageId : scope, outline, headings: nearby }, targets: targets(container ? [container] : roots), members: [...prefixMembers, ...members] }); };
      if (conditions) add(conditions, proseMembers.get(group) ?? []);
      for (const structure of elements.filter(el => el.matches(atomic) && owner(el) === group && !el.parentElement?.closest(atomic))) {
        if (structure.querySelector('[rowspan],[colspan]')) {
          const members: CodeFactMember[] = readonly(proseMembers.get(group) ?? []);
          add([conditions, read(structure, undefined, members).trim()].filter(Boolean).join('\n'), members, structure); continue;
        }
        // A simple table is read by row with all column headings/caption.
        // Spanned tables above stay whole rather than guessing associations.
        const headers = [...structure.querySelectorAll('caption,thead,tr')].filter(el => el.tagName !== 'TR' || (!el.closest('thead') && !el.querySelector('td')));
        const labelMembers: CodeFactMember[] = [];
        const labels = [read(structure, el => el !== structure && el.tagName === 'TR', labelMembers).trim(), ...new Set(headers.map(el => read(el, undefined, labelMembers).trim()))].filter(Boolean).join('\n');
        const rows = [...structure.querySelectorAll('tr')].filter(el => el.querySelector('td'));
        if (!rows.length) {
          const members: CodeFactMember[] = readonly(proseMembers.get(group) ?? []);
          add([conditions, read(structure, undefined, members).trim()].filter(Boolean).join('\n'), members, structure);
        } else for (const row of rows) {
          const common: CodeFactMember[] = [], tableConditions = own(structure, common);
          const members: CodeFactMember[] = readonly([...(proseMembers.get(group) ?? []), ...labelMembers, ...common]);
          add([conditions, tableConditions, labels, read(row, undefined, members).trim()].filter(Boolean).join('\n'), members, structure);
        }
      }
    }
    if (index === 1) result.push({ text: `${scope}\n页面标题：${page.title}`, group: `${scope}\n页面标题：${page.title}`, context: { pageId, outline, headings: [] }, members: [{ kind: 'title', pageId, text: page.title }] });
  }
  return result;
}

export function sameCodeFactCssDeclaration(a: CodeFactCssMember, b: CodeFactCssMember) {
  const samePath = (left: number[] | undefined, right: number[] | undefined) => left === right || !!left && !!right && left.length === right.length && left.every((value, i) => value === right[i]);
  return a.field === b.field && a.property === b.property && samePath(a.stylePath, b.stylePath) && samePath(a.rulePath, b.rulePath);
}

export function sameCodeFactMemberLocation(a: CodeFactMember, b: CodeFactMember): boolean {
  const path = (left: number[] | undefined, right: number[] | undefined) => left === right || !!left && !!right && left.length === right.length && left.every((value, i) => value === right[i]);
  if (a.kind === 'text') return b.kind === 'text' && a.field === b.field && path(a.path, b.path) && a.offset === b.offset && a.before.length === b.before.length;
  if (a.kind === 'attribute') return b.kind === 'attribute' && a.field === b.field && path(a.path, b.path) && a.name === b.name;
  if (a.kind === 'title') return b.kind === 'title' && a.pageId === b.pageId;
  if (a.kind === 'css') return b.kind === 'css' && sameCodeFactCssDeclaration(a, b) && a.position.pageId === b.position.pageId && a.position.width === b.position.width && a.position.pseudo === b.position.pseudo && path(a.position.path, b.position.path);
  return false;
}

// Runs in each rendered page/viewport, only when a rejected fact needs a CSS
// declaration repair. Perturb that exact declaration and restore it; selector
// matching alone cannot establish the cascade, inheritance or media effects.
export function readCodeFactCssEffects(code: SiteCode, pageId: string, declarations: CodeFactCssMember[], hasDynamicStates: (rules: CSSRule[]) => boolean) {
  const parts = [code.header, code.pages.find(page => page.id === pageId)!.html, code.footer];
  const fields = ['header', `pages/${pageId}/html`, 'footer'];
  const stylesheet = (member: CodeFactCssMember) => {
    if (member.field === 'css') return document.head.querySelector('style')?.sheet;
    let offset = 0;
    for (const [i, html] of parts.entries()) {
      const roots = [...new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html').body.childNodes];
      if (fields[i] === member.field && member.stylePath?.length) {
        const [rootIndex, ...rest] = member.stylePath;
        const root = roots[rootIndex];
        if (!(root instanceof Element)) return null;
        let node: Node | undefined = document.body.children[offset + roots.slice(0, rootIndex).filter(node => node instanceof Element).length];
        if (node?.nodeName !== root.nodeName) return null;
        for (const index of rest) node = node?.childNodes[index];
        return node instanceof HTMLStyleElement ? node.sheet : null;
      }
      offset += roots.filter(node => node instanceof Element).length;
    }
    return null;
  };
  const elements = [document.documentElement, ...document.documentElement.querySelectorAll('*')];
  return declarations.flatMap(member => {
    // A page-local style element is absent from other pages, not an unknown
    // source. Shared header/footer styles and code.css are present on each.
    if (member.field.startsWith('pages/') && member.field !== `pages/${pageId}/html`) return [];
    const sheet = stylesheet(member);
    let rules = sheet?.cssRules, rule: CSSRule | undefined;
    for (const [i, index] of member.rulePath.entries()) {
      rule = rules?.[index];
      if (i < member.rulePath.length - 1) rules = rule && 'cssRules' in rule ? (rule as CSSGroupingRule).cssRules : undefined;
    }
    if (!(rule instanceof CSSStyleRule) || rule.cssText !== member.ruleText || rule.style.getPropertyValue(member.property) !== member.before || rule.style.getPropertyPriority(member.property) !== member.priority)
      throw new Error('CSS 文案修正无法核实来源声明，本次未保存版本。');
    // Another declaration can hide this one in the default state and expose it
    // during interaction. Inspect every author sheet and inactive/nested rule;
    // current selector matches cannot prove that a shared declaration is local.
    // Conservatively retain all pseudo elements when applicability is unproven.
    const checkOverrides = (rules: CSSRuleList, inheritedInteraction = false, inheritedScope?: string) => {
      for (const other of rules) {
        const interactive = inheritedInteraction || hasDynamicStates([other]);
        const scope = inheritedScope ?? ('cssRules' in other && !(other instanceof CSSStyleRule || other instanceof CSSMediaRule || other instanceof CSSSupportsRule || other.constructor.name === 'CSSLayerBlockRule')
          ? other instanceof CSSContainerRule ? '@container' : other.constructor.name
          : 'conditionText' in other && String(other.conditionText).includes('--') ? '自定义属性条件' : undefined);
        if ('style' in other) {
          const style = (other as CSSStyleRule).style;
          if (style.getPropertyValue(member.property) || style.getPropertyValue('all')) {
            if (scope) throw new Error(`CSS 文案修正的同属性或 all 作者声明位于 ${scope} 作用域，无法静态核实影响，本次未保存版本。`);
            if (!(other instanceof CSSStyleRule)) throw new Error('CSS 文案修正存在无法核实作用域的同属性作者声明，无法静态完整核实影响，本次未保存版本。');
            if (interactive) throw new Error(`CSS 文案修正存在作者交互规则设置同一属性 ${member.property}（含 all 重置），无法静态完整核实伪元素及级联影响，本次未保存版本。`);
          }
        }
        if ('cssRules' in other) checkOverrides((other as CSSGroupingRule).cssRules, interactive, scope);
      }
    };
    for (const authorSheet of document.styleSheets) checkOverrides(authorSheet.cssRules);
    const slots = elements.flatMap(el => (member.property === 'list-style-type' ? getComputedStyle(el).display === 'list-item' ? [''] : [] : ['', '::before', '::after', '::marker']).map(pseudo => {
      const path: number[] = [];
      for (let node = el; node.parentElement; node = node.parentElement) path.unshift([...node.parentElement.children].indexOf(node));
      return { el, pseudo, position: { pageId, width: innerWidth, path, pseudo } };
    }));
    const read = () => slots.map(slot => getComputedStyle(slot.el, slot.pseudo || null).getPropertyValue(member.property));
    const before = read();
    let after: string[];
    try { rule.style.setProperty(member.property, '"\uE000修正范围"', member.priority); after = read(); }
    finally { rule.style.setProperty(member.property, member.before, member.priority); }
    if (read().some((value, i) => value !== before[i])) throw new Error('CSS 文案修正无法稳定核实渲染影响，本次未保存版本。');
    return [{ declaration: member, positions: slots.filter((_slot, i) => before[i] !== after[i]).map(slot => slot.position) }];
  });
}

export function pendingCodeFactSegments(segments: CodeFactSegment[], materials: string, reviews: CodeFactReview[], sourceMaterials?: CodeFactSource[]) {
  const eligible = reviews.filter(review => review.format === 4 && review.materials === materials && sameFactSources(review.sourceMaterials, sourceMaterials));
  const groups = new Map<string, CodeFactSegment[]>();
  for (const segment of segments) groups.set(segment.group, [...(groups.get(segment.group) ?? []), segment]);
  const accepted = new Map([...groups].flatMap(([group, members]) => {
    const review = eligible.find(review => {
      const before = review.segments.filter(segment => segment.group === group);
      // One complete successful review must cover the group. Mixing partial
      // passes across attempts can suppress a condition that another row needs.
      return before.length === members.length && before.every(segment => !segment.issues.length && typeof segment.noFacts === 'boolean' && Array.isArray(segment.factCategories) && Array.isArray(segment.citations))
        && members.every(segment => before.some(previous => previous.text === segment.text));
    });
    return review ? [[group, review] as const] : [];
  }));
  return { pending: segments.filter(segment => !accepted.has(segment.group)), reused: segments.filter(segment => accepted.has(segment.group)).map(segment => {
    const previous = accepted.get(segment.group)!.segments.find(item => item.group === segment.group && item.text === segment.text)!;
    return { ...segment, noFacts: previous.noFacts, factCategories: previous.factCategories, citations: previous.citations };
  }) };
}
