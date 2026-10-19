import type { SiteCode } from './code-site.ts';
import type { FragmentBody } from './code-site-repair.ts';

export type CodeLayoutRepair = {
  issue: string;
  elements: Array<{ field: string; path: number[]; before: string }>;
  declarations: Array<Extract<FragmentBody, { kind: 'css' }>>;
  reason?: string;
};
export type CodeLayoutScan = {
  horizontalScroll: boolean; overflowElements: Array<{ key: string }>;
  textOverlaps: Array<{ targets: string[] }>;
  textContrast: Array<{ key: string; text: string; status: string; ratio: number | null; threshold: number; role: string }>;
  measurement: { textContrastEntries: number };
};

// CSSOM iteration expands shorthands, including empty longhands for var().
// Read names from its serialized declaration list instead. Values stay opaque;
// punctuation inside strings, comments and functions cannot create properties.
export function codeCssDeclarationNames(text: string): string[] {
  const names: string[] = [];
  let start = 0, named = false, quote = '', depth = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quote) { if (char === '\\') i++; else if (char === quote) quote = ''; continue; }
    if (text.startsWith('/*', i)) { const end = text.indexOf('*/', i + 2); if (end < 0) throw new Error('CSS 声明注释未闭合'); i = end + 1; continue; }
    if (char === '"' || char === "'") quote = char;
    else if ('([{'.includes(char)) depth++;
    else if (')]}'.includes(char)) depth--;
    else if (!depth && char === ';') { start = i + 1; named = false; }
    else if (!depth && char === ':' && !named) { names.push(text.slice(start, i).trim()); named = true; }
  }
  return [...new Set(names)];
}

// Runs beside the scanner in the same rendered candidate and viewport. The
// diagnostic and its source locations are captured together, before DOM changes.
export function readCodeLayoutRepairs(code: SiteCode, pageId: string, width: number, scan: CodeLayoutScan, declarationNames: typeof codeCssDeclarationNames): CodeLayoutRepair[] {
  const records: CodeLayoutRepair[] = [];
  const contrast = scan.textContrast.map(item => ({ ...item, threshold: item.role === 'heading' ? item.threshold : 4.5 }))
    .filter(item => item.status !== 'measured' || item.ratio === null || item.ratio < item.threshold);
  if (scan.measurement.textContrastEntries && !scan.horizontalScroll && !scan.overflowElements.length && !scan.textOverlaps.length && !contrast.length) return records;
  const keyFor = (el: Element) => {
    const parts: string[] = [];
    for (let node: Element | null = el; node && node !== document.body; node = node.parentElement) parts.unshift(`${node.tagName}:${[...node.parentElement!.children].indexOf(node)}`);
    return parts.join('/');
  };
  const byKey = new Map([...document.body.querySelectorAll('*')].map(node => [keyFor(node), node]));
  const locations = new Map<Element, { field: string; path: number[]; source: Element }>();
  const sources = new Map<string, HTMLElement>();
  const page = code.pages.find(page => page.id === pageId)!;
  const liveRoots = [...document.body.children].filter(node => !node.classList.contains('sc-language-links'));
  let rootIndex = 0;
  const bind = (source: Node, live: Node, field: string, path: number[]) => {
    if (!(source instanceof Element) || !(live instanceof Element) || source.tagName !== live.tagName) return;
    locations.set(live, { field, path, source });
    if (source.hasAttribute('data-system-icon') || source.childNodes.length !== live.childNodes.length) return;
    [...source.childNodes].forEach((child, i) => bind(child, live.childNodes[i], field, [...path, i]));
  };
  for (const [field, html] of [['header', code.header], [`pages/${pageId}/html`, page.html], ['footer', code.footer]]) {
    const root = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html').body;
    sources.set(field, root);
    [...root.childNodes].forEach((source, index) => { if (source instanceof Element) bind(source, liveRoots[rootIndex++], field, [index]); });
  }
  const sheets: Array<{ field: string; stylePath?: number[]; sheet: CSSStyleSheet }> = [];
  const sheet = new CSSStyleSheet(); sheet.replaceSync(code.css); sheets.push({ field: 'css', sheet });
  for (const [field, root] of sources) {
    const visit = (node: Node, path: number[]) => {
      if (node instanceof HTMLStyleElement) { const sheet = new CSSStyleSheet(); sheet.replaceSync(node.textContent ?? ''); sheets.push({ field, stylePath: path, sheet }); }
      [...node.childNodes].forEach((child, index) => visit(child, [...path, index]));
    };
    [...root.childNodes].forEach((node, index) => visit(node, [index]));
  }
  const selectorFor = (text: string, parent: string) => parent ? (text.includes('&') ? text.replace(/&/g, `:is(${parent})`) : `:is(${parent}) ${text}`) : text;
  const selectors: string[] = [];
  const readSelectors = (rules: CSSRuleList, parent = '') => {
    for (const rule of rules) {
      if (rule instanceof CSSStyleRule) {
        const selector = selectorFor(rule.selectorText, parent); selectors.push(selector);
        readSelectors(rule.cssRules, selector);
      } else if ('cssRules' in rule) readSelectors((rule as CSSGroupingRule).cssRules, parent);
    }
  };
  for (const source of sheets) readSelectors(source.sheet.cssRules);
  const collect = (issue: string, keys: string[], contrast: boolean) => {
    const record: CodeLayoutRepair = { issue, elements: [], declarations: [] }; records.push(record);
    const targets = [...new Set(keys)].map(key => byKey.get(key));
    if (!targets.length || targets.some(node => !node || !locations.has(node))) { record.reason = '实际失败元素不属于可核实的站点代码节点'; return; }
    for (const target of targets as Element[]) {
      const location = locations.get(target)!;
      record.elements.push({ field: location.field, path: location.path, before: location.source.outerHTML });
      const inherited = new Set<string>();
      let backgroundFound = false;
      for (let node: Element | null = target; node; node = node.parentElement) {
        const levelProperties = new Set<string>();
        const relevant = (property: string) => contrast
          ? ((property === 'color' || property === '-webkit-text-fill-color') && !inherited.has(property)
            || /^background(?:-|$)/.test(property) && !backgroundFound || /^(opacity|filter|mix-blend-mode|background-blend-mode|background-clip|-webkit-background-clip)$/.test(property))
          : /^(?:(?:min-|max-)?(?:width|height)|display|position|(?:top|right|bottom|left)|inset(?:-|$)|transform(?:-|$)|translate|scale|rotate|flex(?:-|$)|grid(?:-|$)|margin(?:-|$)|padding(?:-|$)|border-.*-width|(?:row-|column-)?gap|line-height|font(?:-|$)|letter-spacing|white-space|overflow(?:-|$)|box-sizing|writing-mode|float|clear|vertical-align)/.test(property);
        const expanded = (style: CSSStyleDeclaration, property: string) => {
          const declaration = document.createElement('span').style;
          declaration.setProperty(property, style.getPropertyValue(property), style.getPropertyPriority(property));
          return [...declaration].filter(name => name === 'all' || relevant(name));
        };
        const inline = (node as HTMLElement).style;
        for (const property of declarationNames(inline.cssText)) {
          const properties = expanded(inline, property);
          if (!properties.length) continue;
          if (node !== target || target.childElementCount) {
            // Ask the existing rendered document, rather than reimplementing
            // specificity, layers or shorthand precedence. Removal alone cannot
            // distinguish an overridden declaration from a same-valued winner.
            const saved = node.getAttribute('style')!;
            let matches: Element[][];
            try { matches = selectors.map(selector => [...document.querySelectorAll(selector)]); }
            catch { record.reason = `相关 style 属性声明（${property}）位于只读容器或祖先，浏览器无法核实级联探测的选择器匹配，当前无法写回`; return; }
            let stableMatches = true;
            const animated = document.getAnimations().length > 0;
            const read = () => {
              stableMatches &&= selectors.every((selector, index) => {
                const current = [...document.querySelectorAll(selector)];
                return current.length === matches[index].length && current.every((element, i) => element === matches[index][i]);
              });
              const computed = getComputedStyle(node!); return properties.map(name => computed.getPropertyValue(name));
            };
            const before = read(), value = inline.getPropertyValue(property);
            let removed: string[], promoted: string[];
            try {
              inline.removeProperty(property); removed = read();
              node.setAttribute('style', saved);
              inline.setProperty(property, value, 'important'); promoted = read();
            } finally { node.setAttribute('style', saved); }
            const restored = read();
            const overridden = stableMatches && !animated && !document.getAnimations().length && before.every((value, index) => value && value === removed[index] && value === restored[index] && value !== promoted[index]);
            if (!overridden) {
              record.reason = `相关 style 属性声明（${property}）位于只读容器或祖先，${stableMatches ? '实际计算级联未能证明其已被覆盖' : '级联探测改变了作者选择器匹配，无法核实是否已被覆盖'}，当前无法写回`;
              return;
            }
            continue;
          }
          for (const name of properties) levelProperties.add(name);
        }
        for (const source of sheets) {
          const walk = (rules: CSSRuleList, path: number[] = [], parent = '', uncertain = false) => {
            [...rules].forEach((rule, index) => {
              const rulePath = [...path, index];
              if (rule instanceof CSSMediaRule && !matchMedia(rule.conditionText).matches || rule instanceof CSSSupportsRule && !CSS.supports(rule.conditionText)) return;
              const conditional = uncertain || rule instanceof CSSContainerRule;
              if (rule instanceof CSSStyleRule) {
                const selector = selectorFor(rule.selectorText, parent);
                let matches = false;
                try { matches = node!.matches(selector); } catch { record.reason = '相关 CSS 选择器无法核实实际匹配'; }
                if (matches) for (const property of declarationNames(rule.style.cssText)) if (expanded(rule.style, property).length) {
                  if (conditional) { record.reason = '相关 CSS 声明处于无法核实的容器条件中'; continue; }
                  for (const name of expanded(rule.style, property)) levelProperties.add(name);
                  const declaration = { kind: 'css' as const, field: source.field, ...(source.stylePath ? { stylePath: source.stylePath } : {}), rulePath, selector: rule.selectorText,
                    property, before: rule.style.getPropertyValue(property), priority: rule.style.getPropertyPriority(property), ruleText: rule.cssText, pseudo: '' };
                  if (!record.declarations.some(other => JSON.stringify(other) === JSON.stringify(declaration))) record.declarations.push(declaration);
                }
                walk(rule.cssRules, rulePath, selector, conditional);
              } else if ('cssRules' in rule) walk((rule as CSSGroupingRule).cssRules, rulePath, parent, conditional);
            });
          };
          walk(source.sheet.cssRules);
        }
        for (const property of levelProperties) if (property === 'color' || property === '-webkit-text-fill-color') inherited.add(property);
        const background = getComputedStyle(node).backgroundColor;
        if (!/^rgba\([^)]*,\s*0\s*\)$/.test(background) && background !== 'transparent') backgroundFound = true;
      }
    }
  };
  const prefix = `${pageId}/${width}`;
  if (!scan.measurement.textContrastEntries) collect(`${prefix} 无可测量正文`, [], false);
  if (scan.horizontalScroll || scan.overflowElements.length) collect(`${prefix} 横向溢出`, scan.overflowElements.map(item => item.key), false);
  if (scan.textOverlaps.length) collect(`${prefix} 文字重叠`, scan.textOverlaps.flatMap(item => item.targets), false);
  for (const item of contrast.slice(0, 8)) collect(`${prefix} 对比度不足或无法测量：${item.text}（${item.ratio?.toFixed(2) ?? '未知'}，需 ${item.threshold}）`, [item.key], true);
  return records;
}
