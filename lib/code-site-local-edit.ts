import { codeCheckBrowser } from './code-site-browser.ts';
import { applyCodeRepair } from './code-site-repair.ts';
import { renderSiteCode, type SiteCode } from './code-site.ts';
import type { AnnotationTarget } from './annotations.ts';

export function localScopeClass(target: AnnotationTarget) {
  return `sc-local-${target.versionId.replace(/[^a-zA-Z0-9-]/g, '-')}-${target.pageId}-${target.path.join('-')}`;
}

// Runs in Chrome: paths never depend on IDs, responsive geometry or text search.
export function localEditDom(code: SiteCode, target: AnnotationTarget, scope: string, candidate?: SiteCode) {
  const parse = (html: string) => new DOMParser().parseFromString(html, 'text/html');
  const page = code.pages.find(page => page.id === target.pageId);
  if (!page) throw new Error('锚点页面不存在，请重新点选。');
  const doc = parse(page.html), mains = doc.querySelectorAll('main');
  if (mains.length !== 1) throw new Error('页面无法唯一定位正文，请改整页。');
  let node: Element = mains[0];
  for (const index of target.path) {
    if (!node.children[index]) throw new Error('锚点已经失效，请重新点选。');
    node = node.children[index];
  }
  if (!/^(SECTION|ARTICLE|DIV|HEADER|ASIDE|FOOTER)$/.test(node.tagName) || node.closest('[data-system-inquiry],[data-system-icon],.sc-image-credits')) throw new Error('请选择正文区块，系统部件不能单独修改。');
  const text = (node.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 1000);
  if (text !== target.text) throw new Error('锚点文字已改变，请重新点选。');
  const path: number[] = []; let child: Node = node;
  while (child !== doc.body) {
    const parent = child.parentNode; if (!parent) throw new Error('锚点不在页面正文中。');
    path.unshift([...parent.childNodes].indexOf(child as ChildNode)); child = parent;
  }
  const before = node.outerHTML;
  const fragment = { id: 0, field: `pages/${target.pageId}/html`, kind: 'element' as const, path, before };
  const issues: string[] = [];
  const rules = (css: string) => { const sheet = new CSSStyleSheet(); sheet.replaceSync(css); return [...sheet.cssRules]; };
  if (!candidate) {
    // Match rules against the actual document, including inherited ancestor rules.
    let live: Element | undefined = document.querySelector('main') ?? undefined;
    for (const index of target.path) live = live?.children[index];
    if (!live) throw new Error('预览区块无法定位，请重新点选。');
    const related = (items: CSSRule[]): string => items.map(rule => {
      if (rule instanceof CSSStyleRule) {
        try {
          const selector = rule.selectorText.replace(/::[\w-]+(?:\([^)]*\))?/g, '').replace(/:(hover|active|focus|focus-visible|focus-within|visited)\b/g, '');
          const nodes = [...document.querySelectorAll(selector)];
          return nodes.some(el => live!.contains(el) || el.contains(live!)) ? rule.cssText : '';
        } catch { throw new Error('相关 CSS 无法定位，请改整页。'); }
      }
      if (rule instanceof CSSMediaRule || rule instanceof CSSSupportsRule || rule instanceof CSSContainerRule) {
        const inside = related([...rule.cssRules]);
        return inside ? `${rule.cssText.slice(0, rule.cssText.indexOf('{'))}{${inside}}` : '';
      }
      return '';
    }).filter(Boolean).join('\n');
    node.classList.add(scope);
    return { fragment, html: node.outerHTML, css: related(rules(code.css)), issues, selectors: [] as string[] };
  }
  if (code.header !== candidate.header || code.footer !== candidate.footer) issues.push('局部修改越界：公共页头或页脚改变');
  if (code.pages.length !== candidate.pages.length || code.pages.some((p, i) => candidate.pages[i]?.id !== p.id || candidate.pages[i]?.title !== p.title || (p.id !== target.pageId && candidate.pages[i]?.html !== p.html))) issues.push('局部修改越界：其他页面或页面标题改变');
  const nextPage = candidate.pages.find(p => p.id === target.pageId);
  const next = parse(nextPage?.html || '');
  let replacement: Element | undefined = next.querySelector('main') ?? undefined;
  for (const index of target.path) replacement = replacement?.children[index];
  if (!replacement || /^(MAIN|BODY|HTML)$/.test(replacement.tagName) || replacement.querySelector('main')) issues.push('局部修改必须返回一个区块，不能返回整页');
  else {
    const counters = (root: Element) => [root, ...root.querySelectorAll('[style]')].flatMap(el => {
      const style = (el as HTMLElement).style;
      return ['counter-reset', 'counter-set', 'counter-increment'].flatMap(name => style.getPropertyValue(name) ? [[name, style.getPropertyValue(name)]] : []);
    });
    if (JSON.stringify(counters(node)) !== JSON.stringify(counters(replacement))) issues.push('局部修改不能改变跨区块计数器');
    // isEqualNode checks node types, attributes, text and sibling positions;
    // comments replace only the selected subtree in two independent parses.
    node.replaceWith(doc.createComment('selected-block'));
    replacement.replaceWith(next.createComment('selected-block'));
    if (!doc.isEqualNode(next)) issues.push('局部修改越界：选中区块外的 DOM 改变');
  }
  const oldRules = rules(code.css), newRules = rules(candidate.css);
  if (newRules.length < oldRules.length || oldRules.some((rule, i) => rule.cssText !== newRules[i]?.cssText)) issues.push('局部修改越界：共享 CSS 被改写；请追加区块专属规则');
  const selectors: string[] = [];
  const inspect = (items: CSSRule[]) => { for (const rule of items) {
    if (rule instanceof CSSStyleRule) {
      // An anchored descendant-only selector also contains its interactive states.
      // Reject sibling escapes, nesting and relational selectors before matching.
      for (const selector of rule.selectorText.split(',')) {
        const value = selector.trim();
        if (!value.startsWith(`.${scope}`) || !/^[\s.#[:>]|^$/.test(value.slice(scope.length + 1)) || /[+~&]|:has\(/.test(value) || rule.cssRules.length) issues.push('局部修改越界：CSS 必须以区块专属类名为作用域，不能影响区块外');
        selectors.push(value.replace(/::[\w-]+(?:\([^)]*\))?/g, '').replace(/:(hover|active|focus|focus-visible|focus-within|visited)\b/g, ''));
      }
      for (const property of [...rule.style]) if (/^counter-(reset|set|increment)$/.test(property)) issues.push('局部修改不能改变跨区块计数器');
    } else if (rule instanceof CSSMediaRule || rule instanceof CSSSupportsRule || rule instanceof CSSContainerRule) inspect([...rule.cssRules]);
    else issues.push('局部修改 CSS 含无法限定范围的规则');
  } };
  inspect(newRules.slice(oldRules.length));
  return { fragment, html: before, css: '', issues, selectors };
}

// Invoked on every rendered page by the submission boundary. Media conditions
// are deliberately ignored: each selector is checked even when currently inactive.
export function checkLocalSelectors(target: AnnotationTarget, pageId: string, selectors: string[]) {
  let selected: Element | undefined = pageId === target.pageId ? document.querySelector('main') ?? undefined : undefined;
  for (const index of target.path) selected = selected?.children[index];
  const issues: string[] = [];
  for (const selector of selectors) {
    try {
      if ([...document.querySelectorAll(selector)].some(node => !selected?.contains(node))) issues.push(`局部修改越界：${selector} 命中区块外元素`);
    } catch { issues.push(`局部修改 CSS 选择器无法核对：${selector}`); }
  }
  return issues;
}

export async function localEditContext(code: SiteCode, target: AnnotationTarget) {
  const browser = await codeCheckBrowser();
  try {
    await browser.send('Network.enable'); await browser.send('Network.setBlockedURLs', { urls: ['*'] });
    const { frameTree } = await browser.send<{ frameTree: { frame: { id: string } } }>('Page.getFrameTree');
    await browser.send('Page.setDocumentContent', { frameId: frameTree.frame.id, html: renderSiteCode('local-context', code, target.pageId) });
    const scope = localScopeClass(target);
    return { ...await browser.evaluate<ReturnType<typeof localEditDom>>(`(${localEditDom.toString()})(${JSON.stringify(code)},${JSON.stringify(target)},${JSON.stringify(scope)})`), scope };
  } finally { await browser.close(); }
}
export async function applyLocalEdit(code: SiteCode, target: AnnotationTarget, html: string, css: string) {
  if (/<\/?(?:html|body|head|main)\b/i.test(html)) throw new Error('局部修改必须返回一个区块，不能返回整页。');
  const context = await localEditContext(code, target);
  const candidate = await applyCodeRepair(code, [context.fragment], { replacements: [{ fragmentId: 0, after: html.trim() }] });
  candidate.css = code.css + (css.trim() ? `\n${css}` : '');
  return candidate;
}
