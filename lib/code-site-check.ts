import { readCodeFactSegments, readCodeFactSeparators, readCodeFactCssEffects, sameCodeFactCssDeclaration, sameCodeFactMemberLocation, pendingCodeFactSegments, bindCodeFactCitations, findFactSource, factSourceRef, normalizeFactQuote, type CodeFactReview, type CodeFactSegment, type CodeFactCitation, type CodeFactSource, type CodeFactCssMember, type CodeFactSeparator } from './code-site-fact-segments.ts';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { codeCheckBrowser } from './code-site-browser.ts';
import { stopCodeCheckMotion } from './code-site-check-motion.ts';
import { codeSiteSchema, renderSiteCode, type SiteCode, type CodeCheck, type CodeQualityFeedback, type CodeQualityKind } from './code-site.ts';
import { auditCodeFacts } from './code-site-model.ts';
import type { SiteImageRecord } from './site-images.ts';
import { systemIconIds } from './code-site-icons.ts';
import { englishFidelity } from './code-site-english.ts';
import { localEditDom, localScopeClass, checkLocalSelectors, outsideCssApplications, prepareOutsideCssApplications, authorStylesHaveDynamicStates, type DynamicStateProbe } from './code-site-local-edit.ts';
import { recordCheckDiagnostic } from './code-check-diagnostics.ts';
import { localDynamicPageBudgetMs, localDynamicViewportBudgetMs } from './code-site-check-budget.ts';
import type { AnnotationTarget } from './annotations.ts';
import { systemBackdrops } from './code-site-backdrops.ts';
import type { CodeStyleId } from './code-site-styles.ts';
import { readCodeLayoutRepairs, codeCssDeclarationNames, type CodeLayoutRepair, type CodeLayoutScan } from './code-site-layout-repair.ts';

// Runs in an empty browser document. DOMParser keeps candidate markup inert until cleaning finishes.
function cleanCandidate(code: SiteCode, permitted: string[], iconIds: string[], backdropIds: string[], backdropUrls: string[], selectedTargets: AnnotationTarget[] = []) {
  const issues: string[] = [], cleaned: string[] = [];
  const allowed = new Set('header footer main section article aside nav div span p h1 h2 h3 h4 h5 h6 ul ol li dl dt dd table thead tbody tfoot tr th td caption colgroup col figure figcaption img a button strong em b i small br hr details summary address blockquote time'.split(' '));
  const safeCss = (style: CSSStyleDeclaration) => {
    for (const name of [...style]) {
      const value = style.getPropertyValue(name);
      const urls = [...value.matchAll(/url\(\s*["']?([^"')\s]+)["']?\s*\)/gi)].map(match => match[1]);
      const hasUrl = /url\s*\(/i.test(value);
      const registeredBackground = /^(background|background-image)$/.test(name) && urls.length > 0
        && urls.length === (value.match(/url\s*\(/gi)?.length || 0) && urls.every(url => backdropUrls.includes(url));
      if ((hasUrl && !registeredBackground) || /image-set\s*\(|cross-fade\s*\(|expression\s*\(|\\|[<>]/i.test(value) || /^(behavior|-moz-binding)$/i.test(name)) {
        issues.push(`CSS ${name} 含资源、动态内容或不安全语法`); style.removeProperty(name);
      }
    }
    return style.cssText;
  };
  const cleanCss = (css: string) => {
    if (/[<\\]/.test(css) || /@import|@font-face/i.test(css)) issues.push('CSS 含外部资源、反斜杠或 HTML 起始符号');
    const sheet = new CSSStyleSheet(); sheet.replaceSync(css.replace(/[<\\]/g, ''));
    const walk = (rules: CSSRuleList): string => [...rules].map(rule => {
      if (rule instanceof CSSStyleRule) return `${rule.selectorText}{${safeCss(rule.style)}${walk(rule.cssRules)}}`;
      if (rule instanceof CSSNestedDeclarations) return safeCss(rule.style);
      if (rule instanceof CSSMediaRule) return `@media ${rule.conditionText}{${walk(rule.cssRules)}}`;
      if (rule instanceof CSSSupportsRule) return `@supports ${rule.conditionText}{${walk(rule.cssRules)}}`;
      if (rule instanceof CSSContainerRule) return `@container ${rule.conditionText}{${walk(rule.cssRules)}}`;
      issues.push('CSS 使用未支持的资源规则'); return '';
    }).join('\n');
    return walk(sheet.cssRules);
  };
  const cleanHtml = (html: string) => {
    const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
    for (const node of [...doc.querySelectorAll('*')]) {
      if (['HTML', 'HEAD', 'BODY'].includes(node.tagName)) continue;
      if (!node.isConnected) continue;
      if (!allowed.has(node.tagName.toLowerCase())) { issues.push(`已去掉禁止元素 ${node.tagName.toLowerCase()}`); node.remove(); continue; }
      if (node.hasAttribute('data-system-backdrop')) {
        const id = node.getAttribute('data-system-backdrop')!;
        if (!backdropIds.includes(id)) issues.push(`系统底图编号无效：${id}`);
        if (node.closest('img,figure,figcaption,[role="img"],[data-image-id]')) issues.push('系统底图只能用作容器背景，不能当产品、设备或现场图');
      }
      for (const attr of [...node.attributes]) {
        const name = attr.name, value = attr.value;
        if (name === 'style') { const el = node as HTMLElement; node.setAttribute('style', safeCss(el.style)); continue; }
        if (['href', 'src', 'srcset'].includes(name)) {
          if (name === 'href' && (/^\/[a-z][a-z0-9-]*(?:#[a-zA-Z0-9_-]+)?$/.test(value) || /^#[a-zA-Z0-9_-]+$/.test(value) || /^(mailto|tel):[^\s<>]+$/.test(value))) continue;
          issues.push(`已去掉资源或空链接 ${name}=${value.slice(0,100)}`); node.removeAttribute(name); continue;
        }
        if (/^(class|id|alt|title|role|lang|width|height|colspan|rowspan|scope|headers|open|datetime|disabled)$/.test(name) || /^aria-[a-z-]+$/.test(name) || /^data-[a-z-]+$/.test(name)) continue;
        issues.push(`已去掉属性 ${name}`); node.removeAttribute(name);
      }
      if (node.tagName === 'IMG') {
        const id = node.getAttribute('data-image-id');
        if (!id || !permitted.includes(id)) { issues.push(`图片编号未授权：${id || '未提供编号'}`); node.remove(); }
        else if (!node.getAttribute('alt')?.trim()) issues.push(`图片 ${id} 缺少说明`);
      }
      if (node.hasAttribute('data-system-icon')) {
        if (node.tagName !== 'SPAN' || !iconIds.includes(node.getAttribute('data-system-icon')!)) issues.push('系统图标编号无效');
        else node.replaceChildren();
      }
    }
    return doc.body.innerHTML;
  };
  const safe = { ...code, css: cleanCss(code.css), header: cleanHtml(code.header), footer: cleanHtml(code.footer), pages: code.pages.map(p => ({ ...p, html: cleanHtml(p.html) })) };
  if (issues.length) cleaned.push(...new Set(issues));
  // Resolve targets against each complete page, including cross-page anchors.
  const documents = new Map(safe.pages.map(p => [p.id, new DOMParser().parseFromString(safe.header + p.html + safe.footer, 'text/html')]));
  for (const [id, doc] of documents) {
    if (!doc.querySelector('main') || !doc.querySelector('h1')) issues.push(`${id} 缺少 main 或 h1`);
    for (const link of doc.querySelectorAll('a')) {
      const href = link.getAttribute('href');
      if (!href) { issues.push(`${id} 存在空链接`); continue; }
      if (/^(mailto|tel):/.test(href)) continue;
      const [target, anchor] = href.split('#');
      const targetDoc = target ? documents.get(target.slice(1)) : doc;
      if (!targetDoc || (anchor && !targetDoc.getElementById(anchor))) issues.push(`${id} 链接目标不存在：${href}`);
    }
  }
  let contacts = [...documents.values()].flatMap(doc => [...doc.querySelectorAll('a[href]')].map(a => a.getAttribute('href')!).filter(href => /^(mailto|tel):/.test(href)));
  // Auxiliary copy and handwritten numbers share the same factual boundary.
  const readableFragment = (html: string) => {
    const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
    const auxiliary = [...doc.querySelectorAll('[data-label],[alt],[title],[aria-label]')].flatMap(node => ['data-label', 'alt', 'title', 'aria-label'].map(name => node.getAttribute(name) || '')).join(' ');
    // textContent concatenates independent cells and blocks (NAK80 + 1 becomes
    // NAK801). Keep inline text continuous, but separate semantic text containers.
    const boundaries = new Set('BODY HEADER FOOTER MAIN SECTION ARTICLE ASIDE NAV DIV P H1 H2 H3 H4 H5 H6 LI DT DD TR TH TD FIGURE FIGCAPTION BLOCKQUOTE ADDRESS'.split(' '));
    const read = (node: Node): string => {
      if (node.nodeType === Node.TEXT_NODE) return node.textContent || '';
      if (!(node instanceof Element)) return '';
      if (node.tagName === 'BR') return '\n';
      const text = [...node.childNodes].map(read).join('');
      return boundaries.has(node.tagName) ? `\n${text}\n` : text;
    };
    return `${read(doc.body).replace(/[\u200b\u2060]/g, '')}\n辅助文案：${auxiliary}`;
  };
  // Shared fragments are identical on every page. Audit them once, while
  // keeping each page's own copy and auxiliary attributes in its own context.
  let text = `公共页头：\n${readableFragment(safe.header)}\n${safe.pages.map(p => `页面标题：${p.title}\n页面正文：\n${readableFragment(p.html)}`).join('\n')}\n公共页脚：\n${readableFragment(safe.footer)}`;
  if (selectedTargets.length) {
    const nodes = selectedTargets.map(target => {
      const doc = documents.get(target.pageId);
      let node: Element | undefined = doc?.querySelector('main') ?? undefined;
      for (const index of target.path) node = node?.children[index];
      if (!node) issues.push('局部修改的区块无法定位');
      return node;
    }).filter((node): node is Element => !!node);
    text = nodes.map(node => readableFragment(node.outerHTML)).join('\n');
    contacts = nodes.flatMap(node => [...node.querySelectorAll('a[href]')].map(a => a.getAttribute('href')!).filter(href => /^(mailto|tel):/.test(href)));
  }
  return { code: safe, issues: [...new Set(issues)], cleaned, text, contacts };
}
// Browser computed values have already resolved variables, shorthand and nesting.
function readGeneratedText(targetPath?: number[]) {
  const texts: Array<{ key: string; text: string }> = [];
  const strings = (value: string) => [...value.matchAll(/"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'/g)]
    .map(match => (match[1] ?? match[2]).replace(/\\([0-9a-f]{1,6})\s?|\\(.)/gi, (_escape, hex, char) => hex ? String.fromCodePoint(parseInt(hex, 16)) : char)).join('');
  let selected: Element | undefined = document.querySelector('main') ?? undefined;
  if (targetPath) for (const index of targetPath) selected = selected?.children[index];
  for (const [index, el] of [...document.querySelectorAll('*')].entries()) {
    if (targetPath && !selected?.contains(el)) continue;
    const style = getComputedStyle(el);
    if (style.display === 'list-item') {
      const text = strings(style.listStyleType); if (text) texts.push({ key: `${index}:list-style`, text });
    }
    for (const pseudo of ['::before', '::after', '::marker']) {
      const text = strings(getComputedStyle(el, pseudo).content); if (text) texts.push({ key: `${index}:${pseudo}`, text });
    }
  }
  return texts;
}
// Decode only registered local WebPs. Their full RGB bounds conservatively
// cover every crop/repeat/position; CSS opacity and overlay colors compose in
// the same contrast scanner. Never trust palette metadata as the pixel oracle.
async function prepareSystemBackdrops(allowedUrls: string[]) {
  const colors: Record<string, number[][]> = {}, issues: string[] = [], used = new Set<string>();
  for (const node of document.querySelectorAll('*')) for (const pseudo of [null, '::before', '::after']) {
    const style = getComputedStyle(node, pseudo);
    for (const match of style.backgroundImage.matchAll(/url\("([^"]+)"\)/g)) {
      const url = new URL(match[1], location.href);
      if (url.origin !== location.origin || !allowedUrls.includes(url.pathname) || url.search || url.hash) {
        issues.push('背景图片不是已登记的系统底图'); continue;
      }
      if (pseudo) issues.push('系统底图放在容器背景，伪元素背景无法核对实际叠底');
      if (node.closest('img,figure,figcaption,[role="img"],[data-image-id]')) issues.push('系统底图只能用作容器背景，不能当产品、设备或现场图');
      used.add(url.href);
    }
  }
  for (const url of used) {
    const image = new Image(); image.src = url;
    try { await image.decode(); }
    catch { issues.push(`系统底图无法显示：${new URL(url).pathname}`); continue; }
    const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('系统底图像素无法解码，本次未保存版本。');
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const low = [255, 255, 255, 1], high = [0, 0, 0, 1];
    for (let index = 0; index < pixels.length; index += 4) {
      if (pixels[index + 3] !== 255) throw new Error('系统底图必须是已核对的不透明 WebP，本次未保存版本。');
      for (let channel = 0; channel < 3; channel++) {
        low[channel] = Math.min(low[channel], pixels[index + channel]);
        high[channel] = Math.max(high[channel], pixels[index + channel]);
      }
    }
    colors[url] = [low, high];
  }
  return { colors, issues: [...new Set(issues)] };
}
// Browser-only diagnostics. None of these findings enter checks.issues or repair decisions.
function readCodeQuality(pageId: string, width: number, productIds: string[], incomingAnchors: string[], stopMotion: () => void): CodeQualityFeedback {
  const feedback: CodeQualityFeedback = { truncatedText: 0, ungatedHover: 0, smallTargets: 0, coveredAnchors: 0, croppedProductImages: 0, narrowColumns: 0, details: [] };
  const targetFor = (el: Element): string => {
    if (el === document.documentElement) return 'html';
    if (el === document.body) return 'body';
    if (el.id) return `#${CSS.escape(el.id)}`;
    const parts: string[] = [];
    for (let node: Element | null = el; node && node !== document.body; node = node.parentElement) {
      parts.unshift(`${node.tagName.toLowerCase()}:nth-of-type(${[...node.parentElement!.children].filter(n => n.tagName === node!.tagName).indexOf(node) + 1})`);
    }
    return `body > ${parts.join(' > ')}`;
  };
  const visible = (el: Element) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
  };
  const add = (kind: CodeQualityKind, el: Element, detail: string) => {
    feedback[kind] = feedback[kind]! + 1;
    feedback.details.push({ kind, target: targetFor(el), text: (el.textContent || el.getAttribute('alt') || '').trim().slice(0, 100), detail });
  };
  // Keep caption prose and descriptive dd text; only cells and field labels are exempt.
  // Measure the nearest independent text container so adjacent grid/flex columns never merge.
  const proseBlock = (el: Element): Element => {
    for (let block: Element | null = el; block; block = block.parentElement) {
      const display = getComputedStyle(block).display;
      if (display === 'contents') continue;
      const parentDisplay = block.parentElement ? getComputedStyle(block.parentElement).display : '';
      if (/^(block|flow-root|list-item|inline-block|inline-flex|inline-grid|flex|grid|table-caption)$/.test(display)
        || /^(inline-)?(flex|grid)$/.test(parentDisplay)) return block;
    }
    return document.body;
  };
  const textRange = document.createRange();
  const textVisible = (node: Text | HTMLBRElement) => {
    const el = node.parentElement!;
    if (getComputedStyle(el).visibility !== 'visible') return false;
    for (let ancestor: Element | null = el; ancestor; ancestor = ancestor.parentElement) {
      const style = getComputedStyle(ancestor);
      if (style.display === 'none' || style.contentVisibility === 'hidden' || Number(style.opacity) === 0) return false;
      if (ancestor instanceof HTMLDetailsElement && !ancestor.open && !ancestor.querySelector(':scope > summary')?.contains(el)) return false;
    }
    // display:contents has no box; only the text Range establishes painted geometry.
    textRange.selectNode(node);
    return [...textRange.getClientRects()].some(r => r.height > 0 && (r.width > 0 || node instanceof HTMLBRElement));
  };
  // Only a complete monetary value is exempt, regardless of a price/fee marker.
  // Labels, conditions and mixed price/prose paragraphs stay in the prose measurement.
  const amount = '(?:[0-9][0-9,.]*|[零〇一二两三四五六七八九十百千万亿壹贰叁肆伍陆柒捌玖拾佰仟萬億]+)';
  const currency = '(?:\\p{Sc}|[A-Z]{3}|人民币|元|圆|圓)';
  const priceValue = new RegExp(`^(?:${currency}\\s*${amount}(?:\\s*${currency})?|${amount}\\s*${currency})(?:整|正)?$`, 'u');
  const prose = new Map<Element, Array<Text | HTMLBRElement>>();
  const proseWalker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  while (proseWalker.nextNode()) {
    const node = proseWalker.currentNode;
    if (!(node instanceof Text) && !(node instanceof HTMLBRElement)) continue;
    const el = node.parentElement!;
    if (!textVisible(node)) continue;
    if (el.closest('h1,h2,h3,h4,h5,h6,td,th,dt,nav,button,input,select,textarea,label,summary,[role=button],[role=navigation],[role=cell],[role=columnheader],[role=rowheader],[data-spec],[data-model],[data-sku],[data-parameter],a[href^="mailto:"],a[href^="tel:"],[data-sitecraft-image-credits],[data-sitecraft-hero-credit],.sitecraft-product-image-credit,.sc-image-credits')) continue;
    const slot = el.closest('[data-sitecraft-slot]')?.getAttribute('data-sitecraft-slot') || '';
    if (/(?:spec|sku|model|email|phone|quantity|status)/i.test(slot)) continue;
    const block = proseBlock(el);
    if (block.matches('a')) continue;
    prose.set(block, [...(prose.get(block) || []), node]);
  }
  for (const [block, nodes] of prose) {
    const text = nodes.map(node => node instanceof Text ? node.data : '\n').join('');
    if (priceValue.test(text.trim().normalize('NFKC'))) continue;
    const han = text.match(/\p{Script=Han}/gu)?.length || 0;
    const words = text.match(/[A-Za-z]+(?:['’][A-Za-z]+)*/g)?.length || 0;
    if ((han || words) < 8) continue;
    // Han establishes prose eligibility; numbers/punctuation still occupy its lines.
    // Match the existing Chinese line-length character unit to avoid sparse Han in time/price text.
    const count = han ? Array.from(text.replace(/\s/g, '')).length : words;
    // A multicolumn owner can be this paragraph or an ancestor. Resolve its used
    // column stride before merging line boxes; equal y coordinates do not imply one line.
    let columns: { left: number; stride: number } | undefined;
    for (let owner: Element | null = block; owner; owner = owner.parentElement) {
      const style = getComputedStyle(owner);
      if (style.columnSpan === 'all') break;
      const specifiedCount = parseInt(style.columnCount, 10), specifiedWidth = parseFloat(style.columnWidth);
      if (!(specifiedCount > 1 || specifiedWidth > 0)) continue;
      const gap = style.columnGap === 'normal' ? parseFloat(style.fontSize) : parseFloat(style.columnGap);
      const width = owner.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      const fitting = specifiedWidth > 0 ? Math.max(1, Math.floor((width + gap) / (specifiedWidth + gap))) : specifiedCount;
      const count = specifiedCount > 0 ? Math.min(specifiedCount, fitting) : fitting;
      if (count > 1) columns = { left: owner.getBoundingClientRect().left + owner.clientLeft + parseFloat(style.paddingLeft), stride: (width + gap) / count };
      break;
    }
    const lines: Array<{ top: number; bottom: number; column: number }> = [];
    for (const node of nodes.filter((node): node is Text => node instanceof Text)) for (let index = 0; index < node.data.length;) {
      const char = String.fromCodePoint(node.data.codePointAt(index)!);
      const end = index + char.length;
      if (char.trim()) {
        textRange.setStart(node, index); textRange.setEnd(node, end);
        for (const rect of textRange.getClientRects()) {
          if (rect.width <= 0 || rect.height <= 0) continue;
          // Inline emphasis can change glyph height without creating another line.
          const column = columns ? Math.floor(((rect.left + rect.right) / 2 - columns.left) / columns.stride) : 0;
          const line = lines.find(line => line.column === column && Math.min(line.bottom, rect.bottom) - Math.max(line.top, rect.top)
            > Math.min(line.bottom - line.top, rect.height) / 2);
          if (!line) lines.push({ top: rect.top, bottom: rect.bottom, column });
        }
      }
      index = end;
    }
    const average = count / lines.length, minimum = han ? 6 : 3;
    if (lines.length >= 3 && average < minimum) add('narrowColumns', block,
      `过窄文字列：${count} ${han ? '字' : '词'} / ${lines.length} 行，平均 ${average.toFixed(2)} ${han ? '字' : '词'}/行（少于 ${minimum}）；请给正文留足列宽或在窄屏改为单列。`);
  }
  // The remaining completeness checks deliberately expand hidden disclosure content.
  // Narrow-column feedback above observes only the original visible page.
  for (const detail of document.querySelectorAll('details')) detail.open = true;
  for (const node of document.querySelectorAll('[aria-hidden="true"]')) node.removeAttribute('aria-hidden');
  stopMotion();
  // A Range exposes text lost behind a clipping ancestor, including hidden clamp lines.
  // Restrict to explicit specification semantics; ordinary summaries have no completeness contract.
  const specNodes = [...document.querySelectorAll('td,th,dt,dd,[data-sitecraft-slot],[data-spec],[data-model],[data-sku],[data-parameter]')]
    .filter(el => /^(TD|TH|DT|DD)$/.test(el.tagName) || el.matches('[data-spec],[data-model],[data-sku],[data-parameter]') || /spec|sku|model|parameter/.test(el.getAttribute('data-sitecraft-slot') || ''));
  const truncated = new Set<Element>();
  for (const el of specNodes) {
    if (!visible(el)) continue;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), range = document.createRange();
    let lost = false;
    while (!lost && walker.nextNode()) {
      const node = walker.currentNode, parent = node.parentElement!;
      if (!visible(parent)) continue;
      const clips: Array<{ rect: DOMRect; x: boolean; y: boolean }> = [];
      for (let ancestor: Element | null = parent; ancestor && ancestor !== document.documentElement; ancestor = ancestor.parentElement) {
        const s = getComputedStyle(ancestor), r = ancestor.getBoundingClientRect();
        const x = /hidden|clip/.test(s.overflowX), y = /hidden|clip/.test(s.overflowY);
        if (x || y) clips.push({ rect: new DOMRect(r.left + ancestor.clientLeft, r.top + ancestor.clientTop, ancestor.clientWidth, ancestor.clientHeight), x, y });
      }
      if (!clips.length) continue;
      const text = node.textContent || '';
      for (let i = 0; i < text.length && !lost; i++) {
        if (!text[i].trim()) continue;
        range.setStart(node, i); range.setEnd(node, i + 1);
        for (const r of range.getClientRects()) if (r.width > 0 && r.height > 0 && clips.some(c =>
          (c.x && (r.left < c.rect.left - 2 || r.right > c.rect.right + 2)) || (c.y && (r.top < c.rect.top - 2 || r.bottom > c.rect.bottom + 2)))) { lost = true; break; }
      }
    }
    if (lost && ![...truncated].some(node => node.contains(el))) { truncated.add(el); add('truncatedText', el, '规格文字超出 hidden/clip 裁剪区；请完整显示型号与参数。'); }
  }
  // Read CSSOM, including nested rules. A capability gate must exclude every coarse/no-hover branch.
  // Only positive conjunctions establish the gate; ambiguous OR/not expressions remain feedback.
  const hoverTargets = new Map<Element, string[]>();
  // Hover is an ancestor chain, not a single boolean shared by a selector.
  // Query an inert clone with one chain marked at a time. The browser handles
  // :not/:is/:has semantics, including mixed ancestor/descendant states.
  const hoverDocument = document.cloneNode(true) as Document;
  const sourceNodes = [...document.querySelectorAll('*')], hoverNodes = [...hoverDocument.querySelectorAll('*')];
  const sourceFor = new Map(hoverNodes.map((node, index) => [node, sourceNodes[index]]));
  const hoverAttribute = 'data-sc-quality-hover';
  for (const node of hoverNodes) node.removeAttribute(hoverAttribute);
  const hoverOwners = hoverNodes.filter(node => visible(sourceFor.get(node)!));
  // CSS selector lists can contain commas inside :is(), attributes and strings.
  const selectorBranches = (selector: string) => {
    const branches: string[] = [];
    let start = 0, depth = 0, quote = '';
    for (let i = 0; i < selector.length; i++) {
      const c = selector[i];
      if (c === '\\') { i++; continue; }
      if (quote) { if (c === quote) quote = ''; continue; }
      if (c === '"' || c === "'") quote = c;
      else if (c === '(' || c === '[') depth++;
      else if (c === ')' || c === ']') depth--;
      else if (c === ',' && depth === 0) { branches.push(selector.slice(start, i)); start = i + 1; }
    }
    return [...branches, selector.slice(start)];
  };
  const collectHover = (selector: string, hoverGate: boolean, pointerGate: boolean) => {
    if ((hoverGate && pointerGate) || !/:hover\b/.test(selector)) return;
    for (const branch of selectorBranches(selector)) {
      if (!/:hover\b/.test(branch)) continue;
      const targets = new Set<Element>();
      const passive = branch.replace(/:hover\b/g, `[${hoverAttribute}]`).replace(/::[\w-]+(?:\([^)]*\))?/g, '');
      for (const owner of hoverOwners) {
        const chain: Element[] = [];
        for (let node: Element | null = owner; node; node = node.parentElement) { node.setAttribute(hoverAttribute, ''); chain.push(node); }
        for (const clone of hoverDocument.querySelectorAll(passive)) {
          const el = sourceFor.get(clone)!;
          if (visible(el)) targets.add(el);
        }
        for (const node of chain) node.removeAttribute(hoverAttribute);
      }
      for (const el of targets) hoverTargets.set(el, [...(hoverTargets.get(el) || []), branch.trim()]);
    }
  };
  const walkRules = (rules: CSSRuleList, parent = '', hoverGate = false, pointerGate = false) => {
    for (const rule of rules) {
      if (rule instanceof CSSMediaRule) {
        const condition = rule.conditionText;
        const conjunctive = !/\bnot\b|\bor\b|,/i.test(condition);
        walkRules(rule.cssRules, parent, hoverGate || (conjunctive && /\(\s*hover\s*:\s*hover\s*\)/i.test(condition)), pointerGate || (conjunctive && /\(\s*pointer\s*:\s*fine\s*\)/i.test(condition)));
      } else if (rule instanceof CSSStyleRule) {
        const current = parent ? (rule.selectorText.includes('&') ? rule.selectorText.replaceAll('&', `:is(${parent})`) : `:is(${parent}) :is(${rule.selectorText})`) : rule.selectorText;
        if (rule.style.length) collectHover(current, hoverGate, pointerGate);
        walkRules(rule.cssRules, current, hoverGate, pointerGate);
      } else if (rule instanceof CSSNestedDeclarations && rule.style.length) collectHover(parent, hoverGate, pointerGate);
      else if (rule instanceof CSSSupportsRule) {
        if (CSS.supports(rule.conditionText)) walkRules(rule.cssRules, parent, hoverGate, pointerGate);
      } else if (rule instanceof CSSContainerRule) walkRules(rule.cssRules, parent, hoverGate, pointerGate);
    }
  };
  for (const sheet of document.styleSheets) walkRules(sheet.cssRules);
  for (const [el, selectors] of hoverTargets) add('ungatedHover', el, `悬停规则缺少 hover:hover 与 pointer:fine 联合门控：${[...new Set(selectors)].join('、')}`);

  const initialX = scrollX, initialY = scrollY;
  try {
    if (width === 375) for (const el of document.querySelectorAll('a[href],summary,button,input:not([type=hidden]),textarea,select,[role=button]')) {
      if (!visible(el) || el.matches(':disabled')) continue;
      // Inline links in a prose sentence are exempt, not solitary calls to action in a p.
      const prose = el.closest('p,li,dd,figcaption');
      if (el.tagName === 'A' && getComputedStyle(el).display === 'inline' && prose && !el.closest('nav') && (prose.textContent || '').replace(el.textContent || '', '').trim()) continue;
      el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
      const r = el.getBoundingClientRect();
      const hit = (x: number, y: number) => { const node = document.elementFromPoint(x, y); return node === el || (!!node && el.contains(node)); };
      // Probe actual hit areas rather than the element box: this includes ::before/::after,
      // excludes clipped expansion and rejects a neighbour owning part of the candidate square.
      let usable = false;
      for (const dx of [0, -11, 11, -22, 22]) {
        for (const dy of [0, -11, 11, -22, 22]) {
          const cx = r.left + r.width / 2 + dx, cy = r.top + r.height / 2 + dy;
          if (cx - 22 < 0 || cx + 22 > innerWidth || cy - 22 < 0 || cy + 22 > innerHeight) continue;
          let complete = true;
          for (let x = -21.9; x <= 22 && complete; x += 5.475) for (let y = -21.9; y <= 22; y += 5.475) if (!hit(cx + x, cy + y)) { complete = false; break; }
          if (complete) { usable = true; break; }
        }
        if (usable) break;
      }
      if (!usable) add('smallTargets', el, `未找到可独立命中的 44×44 点击区（元素框 ${r.width.toFixed(1)}×${r.height.toFixed(1)}）；含伪元素与相邻目标命中抽样。`);
    }
    for (const image of document.querySelectorAll<HTMLImageElement>('img[data-image-id]')) {
      if (!visible(image) || !productIds.includes(image.dataset.imageId || '') || getComputedStyle(image).objectFit !== 'cover' || !image.naturalWidth || !image.naturalHeight) continue;
      const style = getComputedStyle(image);
      const w = image.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight), h = image.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
      const scale = Math.max(w / image.naturalWidth, h / image.naturalHeight);
      if (w > 0 && h > 0 && (image.naturalWidth * scale > w + 1 || image.naturalHeight * scale > h + 1)) add('croppedProductImages', image, '已登记 product 图片的 cover 实际裁切原图；是否丢失主体须人工核对，DOM 不能判定主体边界。');
    }
    const anchors = new Set(incomingAnchors);
    for (const link of document.querySelectorAll<HTMLAnchorElement>('a[href]')) {
      const url = new URL(link.href);
      if (url.hash && (!url.searchParams.get('page') || url.searchParams.get('page') === pageId)) anchors.add(decodeURIComponent(url.hash.slice(1)));
    }
    const headers = [...document.querySelectorAll('header,[role=banner]')].filter(el => !el.closest('main') && /fixed|sticky/.test(getComputedStyle(el).position));
    for (const id of anchors) {
      const target = document.getElementById(id);
      if (!target || !visible(target)) continue;
      target.scrollIntoView({ block: 'start', inline: 'nearest', behavior: 'instant' });
      const title = target.matches('h1,h2,h3,h4,h5,h6') ? target : target.querySelector('h1,h2,h3,h4,h5,h6') || target;
      const r = title.getBoundingClientRect();
      const blocked = headers.some(header => {
        if (header.contains(target) || !visible(header)) return false;
        const h = header.getBoundingClientRect();
        if (h.bottom <= r.top + 2 || h.top >= r.bottom - 2 || h.right <= r.left || h.left >= r.right) return false;
        const x = Math.max(h.left, r.left) + Math.min(h.right - Math.max(h.left, r.left), r.right - Math.max(h.left, r.left)) / 2;
        const y = Math.max(0, h.top, r.top) + 2;
        const hit = document.elementFromPoint(x, y);
        return !!hit && header.contains(hit);
      });
      if (blocked) add('coveredAnchors', title, `锚点 #${id} 滚动后标题被 fixed/sticky 页头遮挡；按实际页头留 scroll-margin 或 scroll-padding。`);
    }
  } finally { scrollTo({ left: initialX, top: initialY, behavior: 'instant' }); }
  return feedback;
}
type LayoutReport = CodeLayoutScan & { bodyLineLength: Array<{ tooLong: boolean; text: string }> };
export async function checkSiteCode(args: { siteId: string; code: SiteCode; materials: string; images: SiteImageRecord[]; legacyImport?: true; translationSource?: SiteCode; companyName?: string; localEdit?: { source: SiteCode; target?: AnnotationTarget; targets?: AnnotationTarget[]; citations?: CodeCheck['factCitations'] }; pageEdit?: { source: SiteCode; pageId: string }; restoredFactReview?: CodeCheck['factReviewFrom']; factReviews?: CodeFactReview[]; factSourceMaterials?: CodeFactSource[]; style?: CodeStyleId; timings?: Array<{ pageId: string; width: number; durationMs: number }>; dynamicStateBudgetMs?: number }) {
  const code = codeSiteSchema.parse(args.code);
  const localTargets = args.localEdit ? (args.localEdit.targets ?? (args.localEdit.target ? [args.localEdit.target] : [])) : [];
  const browser = await codeCheckBrowser();
  let dynamicBrowser: Awaited<ReturnType<typeof codeCheckBrowser>> | undefined;
  const checks: CodeCheck = { passed: false, issues: [], cleaned: [], checkedAt: new Date().toISOString(), viewports: [] };
  if (args.legacyImport) checks.factReview = 'legacy-unreviewed';
  if (args.restoredFactReview) checks.factReviewFrom = args.restoredFactReview;
  try {
    const base = process.env.SITECRAFT_BASE || `http://127.0.0.1:${process.env.PORT || '3000'}`;
    // setDocumentContent retains the document MIME type: a JSON health document
    // renders candidate HTML as plain text. Use static HTML without site-list reads or app scripts.
    await browser.send('Network.enable');
    await browser.send('Network.setBlockedURLs', { urls: ['*/_next/*'] });
    await browser.send('Page.navigate', { url: `${base}/code-check.html` });
    await browser.evaluate(`new Promise((resolve,reject)=>{const end=Date.now()+10000;const poll=()=>location.origin===${JSON.stringify(new URL(base).origin)}&&document.readyState==='complete'?resolve(true):Date.now()>end?reject(new Error('检查站点地址不可用')):setTimeout(poll,50);poll()})`);
    const validSource = await browser.evaluate<boolean>(`document.contentType === 'text/html' && performance.getEntriesByType('navigation')[0]?.responseStatus === 200 && !!document.querySelector('meta[name="sitecraft-code-check"][content="v1"]') && !document.querySelector('script')`);
    if (!validSource) throw new Error('提交检查静态页缺失或无效（/code-check.html），本次未保存版本。');
    await browser.send('Network.setBlockedURLs', { urls: ['*'] });
    const { frameTree } = await browser.send<{ frameTree: { frame: { id: string } } }>('Page.getFrameTree');
    const permitted = args.images.filter(i => i.usageScope !== 'docs-only').map(i => i.imageId);
    const backdropIds = Object.keys(systemBackdrops), backdropUrls = Object.values(systemBackdrops).flatMap(entry => Object.values(entry.urls));
    const clean = await browser.evaluate<ReturnType<typeof cleanCandidate>>(`(${cleanCandidate.toString()})(${JSON.stringify(code)},${JSON.stringify(permitted)},${JSON.stringify(systemIconIds)},${JSON.stringify(backdropIds)},${JSON.stringify(backdropUrls)},${JSON.stringify(localTargets)})`);
    checks.issues.push(...clean.issues); checks.cleaned = clean.cleaned;
    let localSelectors: string[] = [];
    if (args.localEdit && localTargets.length) {
      // Check both raw and cleaned candidates: sanitizing an escape must not make
      // it look as though the model respected the requested scope.
      for (const candidate of [code, clean.code]) {
        for (const target of localTargets) {
          const range = await browser.evaluate<ReturnType<typeof localEditDom>>(`(${localEditDom.toString()})(${JSON.stringify(args.localEdit.source)},${JSON.stringify(target)},${JSON.stringify(localScopeClass(target))},${JSON.stringify(candidate)},${JSON.stringify(localTargets)},${JSON.stringify(localTargets.map(localScopeClass))})`);
          checks.issues.push(...range.issues); localSelectors.push(...range.selectors);
        }
      }
    }
    const edit: { source: SiteCode; targets: AnnotationTarget[] } | { source: SiteCode; pageId: string } | undefined = args.localEdit && localTargets.length
      ? { source: args.localEdit.source, targets: localTargets } : args.pageEdit ? { source: args.pageEdit.source, pageId: args.pageEdit.pageId } : undefined;
    if (edit) {
      for (const candidate of [code, clean.code]) {
        const touchedPages = new Set('targets' in edit ? edit.targets.map(target => target.pageId) : [edit.pageId]);
        if (candidate.header !== edit.source.header || candidate.footer !== edit.source.footer || candidate.pages.length !== edit.source.pages.length || edit.source.pages.some((page, i) => candidate.pages[i]?.id !== page.id || candidate.pages[i]?.title !== page.title || (!touchedPages.has(page.id) && candidate.pages[i]?.html !== page.html))) checks.issues.push('修改越界：其他页面、页面标题或公共页头页脚改变');
      }
    }
    if (args.translationSource) checks.issues.push(...await browser.evaluate<string[]>(`(${englishFidelity.toString()})(${JSON.stringify(args.translationSource)},${JSON.stringify(clean.code)},${JSON.stringify(args.companyName || '')},${JSON.stringify(args.materials)})`));
    for (const contact of new Set(clean.contacts)) if (!args.materials.includes(contact.replace(/^(mailto|tel):/, ''))) checks.issues.push(`联系方式没有资料来源：${contact}`);
    if (checks.issues.length && !args.legacyImport) return { code: clean.code, checks };
    await browser.send('Network.setBlockedURLs', { urls: [] });
    const scan = (await readFile(path.join(process.cwd(), 'scripts/visitor-layout-scan.js'), 'utf8')).replace(/export default scanVisitorLayout;?/g, '').replace(/export function scanVisitorLayout/g, 'function scanVisitorLayout');
    const used = new Set((clean.code.header + clean.code.footer + clean.code.pages.map(p => p.html).join('')).match(/img_[a-z0-9]{16,40}/g));
    const credits = [...new Set(args.images.filter(i => used.has(i.imageId) && i.attribution).map(i => i.attribution))];
    const generatedText = new Set<string>();
    const factSegments = new Map<string, CodeFactSegment>();
    const widths = [375, 768, 1440];
    for (const page of clean.code.pages) {
      const targetPaths = localTargets.filter(target => target.pageId === page.id).map(target => target.path);
      const needsFactSegments = !args.legacyImport && !args.translationSource && !args.restoredFactReview && (!args.localEdit || targetPaths.length > 0);
      const separators = new Map<string, CodeFactSeparator>();
      if (needsFactSegments) {
        for (const width of widths) {
          await browser.send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
          await browser.send('Page.setDocumentContent', { frameId: frameTree.frame.id, html: renderSiteCode(args.siteId, clean.code, page.id, '', credits) });
          // Settle resources for container-dependent display. Image failures are
          // still reported by the existing full check below, before any audit.
          const observed = await browser.evaluate<CodeFactSeparator[]>(`(async () => {await document.fonts.ready;await Promise.allSettled([...document.images].map(image=>image.decode()));for(const detail of document.querySelectorAll('details')) detail.open=true;for(const node of document.querySelectorAll('[aria-hidden="true"]')) node.removeAttribute('aria-hidden');(${stopCodeCheckMotion.toString()})();return (${readCodeFactSeparators.toString()})();})()`);
          for (const separator of observed) {
            const key = JSON.stringify(separator.path), previous = separators.get(key);
            if (previous && previous.tag !== separator.tag) throw new Error('三档事实核对的文字分隔节点不一致，本次未保存版本。');
            separators.set(key, separator);
          }
        }
      }
      let remainingDynamicMs = localDynamicPageBudgetMs;
      for (const width of widths) {
        const viewportStarted = performance.now();
        await browser.send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
        if (dynamicBrowser) await dynamicBrowser.send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
        let dynamicState: CodeCheck['viewports'][number]['dynamicState'];
        const pageIsEdited = edit && ('targets' in edit ? edit.targets.some(target => target.pageId === page.id) : true);
        if (edit && pageIsEdited) {
          const dynamicStarted = performance.now();
          const wallStartedAt = Date.now();
          const preparationDeadlineAt = wallStartedAt + Math.min(remainingDynamicMs, args.dynamicStateBudgetMs ?? Infinity);
          let budget: NonNullable<CodeCheck['viewports'][number]['dynamicState']>['budget'];
          const plan = (sourceReads: number, candidateReads: number) => {
            const fullReads = sourceReads + candidateReads, calculatedMs = localDynamicViewportBudgetMs(fullReads);
            budget = { sourceReads, candidateReads, fullReads, calculatedMs,
              allowedMs: Math.min(calculatedMs, remainingDynamicMs, args.dynamicStateBudgetMs ?? Infinity), pageRemainingMs: remainingDynamicMs };
            recordCheckDiagnostic({ kind: 'dynamic-plan', siteId: args.siteId, pageId: page.id, width, recordedAt: Date.now(), budget });
            return wallStartedAt + budget.allowedMs;
          };
          let deadlineAt = preparationDeadlineAt;
          const scope = 'targets' in edit ? { paths: edit.targets.filter(target => target.pageId === page.id).map(target => target.path) }
            : page.id === edit.pageId ? { paths: [[]] } : undefined;
          let probeStates = false;
          const evidence: DynamicStateProbe[] = [];
          let classificationMs = 0, compareMs = 0, completed = false;
          try {
            const documents = [edit.source, code].map(value => renderSiteCode(args.siteId, value, page.id));
            for (const html of documents) {
              await browser.send('Page.setDocumentContent', { frameId: frameTree.frame.id, html });
              if (await browser.evaluate<boolean>(`(${authorStylesHaveDynamicStates.toString()})()`)) { probeStates = true; break; }
            }
            classificationMs = performance.now() - dynamicStarted;
            const probeOptions = (side: string) => ({ states: probeStates, diagnostic: { siteId: args.siteId, pageId: page.id, width, side } });
            if (probeStates) {
              if (!dynamicBrowser) dynamicBrowser = await codeCheckBrowser();
              await dynamicBrowser.send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
              const dynamicFrame = await dynamicBrowser.send<{ frameTree: { frame: { id: string } } }>('Page.getFrameTree');
              const prepared = await Promise.all([
                prepareOutsideCssApplications(browser, frameTree.frame.id, documents[0], scope, preparationDeadlineAt, probeOptions('source')),
                prepareOutsideCssApplications(dynamicBrowser, dynamicFrame.frameTree.frame.id, documents[1], scope, preparationDeadlineAt, probeOptions('candidate')),
              ]);
              deadlineAt = plan(prepared[0].fullReads, prepared[1].fullReads);
              evidence.push(...await Promise.all(prepared.map(probe => probe.read(deadlineAt))));
            } else {
              // Absence of author state rules removes only state probing. Static
              // DOM-triggered selector changes still cross the same full reader.
              deadlineAt = plan(1, 1);
              evidence.push(await outsideCssApplications(browser, frameTree.frame.id, documents[0], scope, deadlineAt, probeOptions('source')));
              evidence.push(await outsideCssApplications(browser, frameTree.frame.id, documents[1], scope, deadlineAt, probeOptions('candidate')));
            }
            const compareStarted = performance.now();
            const sourceReachable = new Set(evidence[0].states.flatMap(state => state.entries.map(entry => JSON.stringify(entry))));
            const reported = new Set<string>();
            for (const state of evidence[1].states) for (const entry of state.entries) if (!sourceReachable.has(JSON.stringify(entry))) {
              const issue = `修改越界：${page.id}/${width} 状态 ${state.state} 触发路径 ${JSON.stringify(state.trigger)} 改变范围外元素路径 ${JSON.stringify(entry.path)}${entry.pseudo} 的完整计算样式`;
              if (!reported.has(issue)) { reported.add(issue); checks.issues.push(issue); }
            }
            if (Date.now() > deadlineAt) throw new Error('局部动态状态检查超时，本次未保存版本。');
            compareMs = performance.now() - compareStarted;
            const metrics = (probe: DynamicStateProbe) => ({ interactiveElements: probe.interactiveElements, forceCalls: probe.forceCalls,
              statesChecked: probe.statesChecked, durationMs: probe.durationMs, cdpRoundTrips: probe.cdpRoundTrips, stageMs: probe.stageMs });
            dynamicState = { mode: probeStates ? 'states' : 'static', budget, classificationMs, compareMs, durationMs: performance.now() - dynamicStarted, source: metrics(evidence[0]), candidate: metrics(evidence[1]) };
            completed = true;
          } finally {
            const endedAt = Date.now();
            remainingDynamicMs = Math.max(0, remainingDynamicMs - Math.max(0, endedAt - wallStartedAt));
            recordCheckDiagnostic({ kind: 'dynamic-check', siteId: args.siteId, pageId: page.id, width, mode: probeStates ? 'states' : 'static',
              startedAt: wallStartedAt, endedAt, durationMs: performance.now() - dynamicStarted, classificationMs, compareMs, budget, completed });
          }
        }
        const languageLinks = { zh: `/published/${args.siteId}?page=${page.id}`, en: `/published/${args.siteId}/en?page=${page.id}` };
        let originalGenerated: ReturnType<typeof readGeneratedText> = [];
        if (args.translationSource) {
          // Match pseudo content at the same rendered DOM position and width.
          // Both documents include the system language links and components.
          await browser.send('Page.setDocumentContent', { frameId: frameTree.frame.id, html: renderSiteCode(args.siteId, args.translationSource, page.id, '', credits, undefined, { language: 'zh', languageLinks }) });
          await browser.evaluate('document.fonts.ready');
          originalGenerated = await browser.evaluate(`(() => {for(const detail of document.querySelectorAll('details')) detail.open=true;for(const node of document.querySelectorAll('[aria-hidden="true"]')) node.removeAttribute('aria-hidden');(${stopCodeCheckMotion.toString()})();return (${readGeneratedText.toString()})()})()`);
        }
        await browser.send('Page.setDocumentContent', { frameId: frameTree.frame.id, html: renderSiteCode(args.siteId, clean.code, page.id, '', credits, undefined, args.translationSource ? { language: 'en', languageLinks } : {}) });
        if (args.localEdit && localTargets.length) checks.issues.push(...await browser.evaluate<string[]>(`(${checkLocalSelectors.toString()})(${JSON.stringify(localTargets)},${JSON.stringify(page.id)},${JSON.stringify(localSelectors)})`));
        const structure = await browser.evaluate<{ contentType: string; hasMainHeading: boolean }>(`({contentType:document.contentType,hasMainHeading:!!document.querySelector('main h1')})`);
        if (structure.contentType !== 'text/html') throw new Error('底线检查未载入候选网页，本次未保存版本。');
        // Missing candidate structure is a rejection, not a browser failure.
        // Offline imports persist this result and continue with the next site.
        if (!structure.hasMainHeading) {
          const issue = `${page.id} 缺少 main 或 h1`;
          if (!checks.issues.includes(issue)) checks.issues.push(issue);
          return { code: clean.code, checks };
        }
        await browser.evaluate('document.fonts.ready.then(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))');
        const imageErrors = await browser.evaluate<string[]>(`Promise.all([...document.images].map(async image => {try{await image.decode();return ''}catch{return image.getAttribute('data-image-id')||'图片'}})).then(items=>items.filter(Boolean))`);
        if (imageErrors.length) checks.issues.push(`${page.id}/${width} 图片无法显示：${imageErrors.join('、')}`);
        const backdrops = await browser.evaluate<Awaited<ReturnType<typeof prepareSystemBackdrops>>>(`(${prepareSystemBackdrops.toString()})(${JSON.stringify(backdropUrls)})`);
        checks.issues.push(...backdrops.issues.map(issue => `${page.id}/${width} ${issue}`));
        const incomingAnchors = [...(clean.code.header + clean.code.footer + clean.code.pages.map(p => p.html).join('')).matchAll(/href="\/([a-z][a-z0-9-]*)#([a-zA-Z0-9_-]+)"/g)].filter(match => match[1] === page.id).map(match => match[2]);
        const productIds = args.images.filter(image => image.usageScope !== 'docs-only' && image.usageCategory === 'product').map(image => image.imageId);
        const qualityFeedback = await browser.evaluate<CodeQualityFeedback>(`(${readCodeQuality.toString()})(${JSON.stringify(page.id)},${width},${JSON.stringify(productIds)},${JSON.stringify(incomingAnchors)},(${stopCodeCheckMotion.toString()}))`);
        const layout = await browser.evaluate<LayoutReport & { repairs: CodeLayoutRepair[]; generatedText: ReturnType<typeof readGeneratedText> }>(`(() => {${scan};for(const detail of document.querySelectorAll('details')) detail.open=true;for(const node of document.querySelectorAll('[aria-hidden="true"]')) node.removeAttribute('aria-hidden');(${stopCodeCheckMotion.toString()})();const paths=${JSON.stringify(targetPaths)};const layout=scanVisitorLayout(document,${JSON.stringify(backdrops.colors)});return {...layout,repairs:(${readCodeLayoutRepairs.toString()})(${JSON.stringify(clean.code)},${JSON.stringify(page.id)},${width},layout,(${codeCssDeclarationNames.toString()})),generatedText:paths.length?paths.flatMap(path=>(${readGeneratedText.toString()})(path)):(${readGeneratedText.toString()})()};})()`);
        if (!args.localEdit || targetPaths.length) for (const entry of layout.generatedText) generatedText.add(entry.text);
        if (needsFactSegments) {
          const paths = targetPaths.length ? targetPaths : [undefined];
          for (const path of paths) {
            const segments = await browser.evaluate<CodeFactSegment[]>(`(${readCodeFactSegments.toString()})(${JSON.stringify(clean.code)},${JSON.stringify(page.id)},${JSON.stringify(path)},${JSON.stringify([...separators.values()])})`);
            for (const segment of segments) {
              const key = JSON.stringify([segment.group, segment.text]), previous = factSegments.get(key);
              factSegments.set(key, { ...segment, targets: [...(previous?.targets ?? []), ...(segment.targets ?? [])]
                .filter((target, index, all) => all.findIndex(other => other.pageId === target.pageId && other.root === target.root && JSON.stringify(other.path) === JSON.stringify(target.path) && other.readable === target.readable) === index),
                members: [...(previous?.members ?? []), ...(segment.members ?? [])].filter((member, index, all) => all.findIndex(other => JSON.stringify(other) === JSON.stringify(member)) === index),
                owners: [...(previous?.owners ?? []), ...(segment.owners ?? [])].filter((owner, index, all) => all.findIndex(other => other.pageId === owner.pageId && JSON.stringify(other.path) === JSON.stringify(owner.path)) === index) });
            }
          }
        }
        if (args.translationSource) {
          const before = new Map(originalGenerated.map(entry => [entry.key, entry.text]));
          const after = new Map(layout.generatedText.map(entry => [entry.key, entry.text]));
          const pairs = [...new Set([...before.keys(), ...after.keys()])].map(key => ({ field: `${page.id}/${width} CSS/${key}`, before: before.get(key) ?? '', after: after.get(key) ?? '' }));
          checks.issues.push(...await browser.evaluate<string[]>(`(${englishFidelity.toString()})(${JSON.stringify(args.translationSource)},${JSON.stringify(clean.code)},${JSON.stringify(args.companyName || '')},${JSON.stringify(args.materials)},${JSON.stringify(pairs)})`));
        }
        const contrast = layout.textContrast.map(t => ({ ...t, threshold: t.role === 'heading' ? t.threshold : 4.5 })).filter(t => t.status !== 'measured' || t.ratio === null || t.ratio < t.threshold);
        const long = layout.bodyLineLength.filter(l => l.tooLong);
        checks.viewports.push({ pageId: page.id, width, overflow: layout.overflowElements.length + Number(layout.horizontalScroll), overlaps: layout.textOverlaps.length, contrastIssues: contrast.length, longLines: long.length, qualityFeedback, ...(dynamicState ? { dynamicState } : {}) });
        args.timings?.push({ pageId: page.id, width, durationMs: performance.now() - viewportStarted });
        if (layout.repairs.length) {
          (checks.layoutRepairs ??= []).push(...layout.repairs);
          checks.issues.push(...layout.repairs.map(repair => repair.issue));
        }
        // Line length remains in viewport quality feedback; it never triggers repair.
      }
    }
    const readable = `${clean.text}\n${[...generatedText].join('\n')}`;
    if (args.translationSource && checks.issues.some(issue => issue.includes(' CSS/') && issue.includes('仍含中文文字'))) checks.issues.push('英文版仍含 CSS 生成的中文文字；请先把中文版这些文字改为 HTML 文字节点。');
    const numbers = (s: string) => s.normalize('NFKC').match(/\d+(?:\.\d+)?/g) ?? [];
    const allowedNumbers = new Set(numbers(args.materials));
    // English already compares equivalent values in each source paragraph; a raw
    // material-number pass would reject grouping and magnitude spelling changes.
    if (!args.translationSource) for (const number of new Set(numbers(readable))) if (!allowedNumbers.has(number)) checks.issues.push(`资料没有的数字：${number}`);
    const marker = args.materials.match(/核验记号[：:]\s*([^。\n\s]+)/)?.[1];
    if (marker && readable.includes(marker)) checks.issues.push('页面包含资料核验记号，请移除');
    // Fact auditing belongs to this same boundary, including restoration and manual submissions.
    if (!checks.issues.length && !args.legacyImport && !args.translationSource && !args.restoredFactReview) {
      if (args.localEdit && !args.factSourceMaterials) {
        // Legacy local versions retain the old issues-only reply shape; the
        // model helper accepts it only when no separated source boundary exists.
        checks.issues.push(...await auditCodeFacts(args.materials, readable, true, args.style));
      } else {
        if (!args.localEdit) {
        // Deleting the last full company name changes a site-wide obligation,
        // even when every remaining content segment was previously accepted.
          if (args.companyName) {
            const text = `站点公司名检查（系统观察）：记录公司名「${args.companyName}」，完整名称${readable.includes(args.companyName) ? '已出现' : '未出现'}。`;
            factSegments.set(text, { text, group: text, context: { pageId: 'site', outline: [], headings: [] } });
          }
        }
        const segments = [...factSegments.values()];
        const { pending, reused } = args.localEdit ? { pending: segments, reused: [] } : pendingCodeFactSegments(segments, args.materials, args.factReviews ?? [], args.factSourceMaterials);
        const reviewed = pending.length ? await auditCodeFacts(args.materials, pending, !!args.localEdit, args.style, args.factSourceMaterials) : [];
        const repairMembers = reviewed.flatMap(review => review.factRepair?.members ?? []);
        if (!args.localEdit) {
          const passed = [...reviewed.filter(review => !review.issues.length), ...reused];
          const protectedMembers = passed.flatMap(review => segments.find(segment => segment.text === review.text && segment.group === review.group)?.members ?? []);
          if (repairMembers.some(member => !member.context && protectedMembers.some(protectedMember => sameCodeFactMemberLocation(member, protectedMember))))
            throw new Error('事实修正公共成员仍被已通过核对段使用，无法确认全部受影响归属，本次未保存版本。');
        }
        const cssMembers = repairMembers.filter((member): member is CodeFactCssMember => member.kind === 'css' && !member.context);
        // Whole-site fragment repairs can edit shared declarations. Author-code
        // snapshots alone do not constrain their effects on accepted segments.
        // An unlocatable member already prevents every fragment repair. Keep
        // that specific refusal instead of probing other, unusable fragments.
        if (!args.localEdit && cssMembers.length && !repairMembers.some(member => member.kind === 'unsupported' && !member.context)) {
          const declarations = cssMembers.filter((member, i) => cssMembers.findIndex(other => sameCodeFactCssDeclaration(member, other)) === i);
          const observed = new Set<CodeFactCssMember>();
          for (const page of clean.code.pages) for (const width of [375, 768, 1440]) {
            await browser.send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
            await browser.send('Page.setDocumentContent', { frameId: frameTree.frame.id, html: renderSiteCode(args.siteId, clean.code, page.id, '', credits) });
            await browser.evaluate('document.fonts.ready.then(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))');
            const effects = await browser.evaluate<ReturnType<typeof readCodeFactCssEffects>>(`(() => {for(const detail of document.querySelectorAll('details')) detail.open=true;for(const node of document.querySelectorAll('[aria-hidden="true"]')) node.removeAttribute('aria-hidden');return (${readCodeFactCssEffects.toString()})(${JSON.stringify(clean.code)},${JSON.stringify(page.id)},${JSON.stringify(declarations)},(${authorStylesHaveDynamicStates.toString()}),(${stopCodeCheckMotion.toString()}));})()`);
            for (const effect of effects) {
              const declaration = declarations.find(member => sameCodeFactCssDeclaration(member, effect.declaration))!;
              if (effect.positions.length) observed.add(declaration);
              const allowed = cssMembers.filter(member => sameCodeFactCssDeclaration(member, declaration)).map(member => member.position);
              const outside = effect.positions.find(position => !allowed.some(member => member.pageId === position.pageId && member.width === position.width && member.pseudo === position.pseudo && member.path.length === position.path.length && member.path.every((value, i) => value === position.path[i])));
              if (outside) throw new Error(`CSS 声明修正会影响被拒核对段允许成员并集之外：${outside.pageId}/${outside.width} 路径 [${outside.path.join(',')}]${outside.pseudo}，本次未保存版本。`);
            }
          }
          if (observed.size !== declarations.length) throw new Error('CSS 文案修正无法核实实际影响位置，本次未保存版本。');
        }
        const receipts = [...reviewed, ...reused.map(segment => ({ text: segment.text, group: segment.group, issues: [], noFacts: segment.noFacts, factCategories: segment.factCategories, citations: segment.citations }))]
          .map(review => ({ ...review, citations: bindCodeFactCitations(segments.find(segment => segment.text === review.text && segment.group === review.group)!, review.citations!) }));
        if (!args.localEdit) checks.factSegments = { format: 4, materials: args.materials, sourceMaterials: args.factSourceMaterials ?? [], audited: pending.length, reused: reused.length, segments: receipts };
        const outside = (args.localEdit?.citations?.entries ?? []).map(citation => ({ ...citation, targets: citation.targets?.filter(target => !localTargets.some(scope => target.pageId === scope.pageId && target.root === 'main' && scope.path.every((index, i) => target.path[i] === index))) })).filter(citation => citation.targets?.length);
        const citations: CodeFactCitation[] = [];
        const citationKeys = new Map<string, CodeFactCitation>();
        for (const citation of [...outside, ...receipts.flatMap(review => review.citations)]) {
          const quote = normalizeFactQuote(citation.quote);
          const source = findFactSource(args.factSourceMaterials, quote);
          if (!quote || !source) {
            checks.issues.push(`范围外资料出处无法在当前企业资料中验真：${citation.claim}`);
            continue;
          }
          const key = JSON.stringify([citation.category, normalizeFactQuote(citation.claim), quote]);
          // Segment-local duplicates are rejected by the audit. The same
          // accepted fact can appear in several segments: retain every location.
          const existing = citationKeys.get(key);
          const targets = [...(existing?.targets ?? []), ...(citation.targets ?? [])]
            .filter((target, index, all) => all.findIndex(other => other.pageId === target.pageId && other.root === target.root && JSON.stringify(other.path) === JSON.stringify(target.path) && other.text === target.text) === index);
          if (existing) existing.targets = targets;
          else {
            const entry = { ...citation, source: factSourceRef(source), targets };
            citationKeys.set(key, entry); citations.push(entry);
          }
        }
        checks.factCitations = { complete: (!args.localEdit || !!args.localEdit.citations?.complete) && !checks.issues.some(issue => issue.includes('范围外资料出处')), entries: citations };
        checks.issues.push(...receipts.flatMap(segment => segment.issues));
      }
    }
    checks.passed = checks.issues.length === 0;
    return { code: clean.code, checks };
  } finally { await dynamicBrowser?.close(); await browser.close(); }
}
