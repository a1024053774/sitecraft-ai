import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { codeCheckBrowser } from './code-site-browser.ts';
import { codeSiteSchema, renderSiteCode, type SiteCode, type CodeCheck, type CodeQualityFeedback, type CodeQualityKind } from './code-site.ts';
import { auditCodeFacts } from './code-site-model.ts';
import type { SiteImageRecord } from './site-images.ts';
import { systemIconIds } from './code-site-icons.ts';
import { systemBackdrops } from './code-site-backdrops.ts';

// Runs in an empty browser document. DOMParser keeps candidate markup inert until cleaning finishes.
function cleanCandidate(code: SiteCode, permitted: string[], iconIds: string[], backdropIds: string[], backdropUrls: string[], legacyImport = false) {
  const issues: string[] = [], cleaned: string[] = [];
  const allowed = new Set('header footer main section article aside nav div span p h1 h2 h3 h4 h5 h6 ul ol li dl dt dd table thead tbody tfoot tr th td caption colgroup col figure figcaption img a strong em b i small br hr details summary address blockquote time'.split(' '));
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
      if (legacyImport && node.tagName === 'FORM' && node.hasAttribute('data-sitecraft-inquiry')) {
        const placeholder = doc.createElement('div');
        placeholder.className = node.className; placeholder.setAttribute('data-system-inquiry', '');
        node.replaceWith(placeholder); cleaned.push('旧询盘表单转换为系统部件'); continue;
      }
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
        if (/^(class|id|alt|title|role|lang|width|height|colspan|rowspan|scope|headers|open|datetime)$/.test(name) || /^aria-[a-z-]+$/.test(name) || /^data-[a-z-]+$/.test(name)) continue;
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
      if (node.hasAttribute('data-system-inquiry')) {
        if (node.tagName !== 'DIV') issues.push('询盘部件必须使用 div');
        else { node.setAttribute('data-system-inquiry', ''); node.replaceChildren(); }
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
  const contacts = [...documents.values()].flatMap(doc => [...doc.querySelectorAll('a[href]')].map(a => a.getAttribute('href')!).filter(href => /^(mailto|tel):/.test(href)));
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
  const text = `公共页头：\n${readableFragment(safe.header)}\n${safe.pages.map(p => `页面标题：${p.title}\n页面正文：\n${readableFragment(p.html)}`).join('\n')}\n公共页脚：\n${readableFragment(safe.footer)}`;
  return { code: safe, issues: [...new Set(issues)], cleaned, text, contacts };
}
// Browser computed values have already resolved variables, shorthand and nesting.
function readGeneratedText() {
  const texts = new Set<string>();
  const strings = (value: string) => [...value.matchAll(/"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'/g)]
    .map(match => (match[1] ?? match[2]).replace(/\\([0-9a-f]{1,6})\s?|\\(.)/gi, (_escape, hex, char) => hex ? String.fromCodePoint(parseInt(hex, 16)) : char)).join('');
  for (const el of document.querySelectorAll('*')) {
    const style = getComputedStyle(el);
    if (style.display === 'list-item') {
      const text = strings(style.listStyleType); if (text) texts.add(text);
    }
    for (const pseudo of ['::before', '::after', '::marker']) {
      const text = strings(getComputedStyle(el, pseudo).content); if (text) texts.add(text);
    }
  }
  return [...texts];
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
function readCodeQuality(pageId: string, width: number, productIds: string[], incomingAnchors: string[]): CodeQualityFeedback {
  const feedback: CodeQualityFeedback = { truncatedText: 0, ungatedHover: 0, smallTargets: 0, coveredAnchors: 0, croppedProductImages: 0, details: [] };
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
    feedback[kind]++;
    feedback.details.push({ kind, target: targetFor(el), text: (el.textContent || el.getAttribute('alt') || '').trim().slice(0, 100), detail });
  };
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
type LayoutReport = { horizontalScroll: boolean; overflowElements: unknown[]; textOverlaps: unknown[];
  textContrast: Array<{ text: string; status: string; ratio: number | null; threshold: number; role: string }>;
  bodyLineLength: Array<{ tooLong: boolean; text: string }>; measurement: { textContrastEntries: number } };
export async function checkSiteCode(args: { siteId: string; code: SiteCode; materials: string; images: SiteImageRecord[]; legacyImport?: true }) {
  const code = codeSiteSchema.parse(args.code);
  const browser = await codeCheckBrowser();
  const checks: CodeCheck = { passed: false, issues: [], cleaned: [], checkedAt: new Date().toISOString(), viewports: [] };
  if (args.legacyImport) checks.factReview = 'legacy-unreviewed';
  try {
    const base = process.env.SITECRAFT_BASE || `http://127.0.0.1:${process.env.PORT || '3000'}`;
    // setDocumentContent retains the document MIME type: a JSON health document
    // renders candidate HTML as plain text. Establish an HTML origin without app scripts.
    await browser.send('Network.enable');
    await browser.send('Network.setBlockedURLs', { urls: ['*/_next/*'] });
    await browser.send('Page.navigate', { url: `${base}/` });
    await browser.evaluate(`new Promise((resolve,reject)=>{const end=Date.now()+10000;const poll=()=>location.origin===${JSON.stringify(new URL(base).origin)}&&document.readyState==='complete'?resolve(true):Date.now()>end?reject(new Error('检查站点地址不可用')):setTimeout(poll,50);poll()})`);
    await browser.send('Network.setBlockedURLs', { urls: ['*'] });
    const permitted = args.images.filter(i => i.usageScope !== 'docs-only').map(i => i.imageId);
    const backdropIds = Object.keys(systemBackdrops), backdropUrls = Object.values(systemBackdrops).flatMap(entry => Object.values(entry.urls));
    const clean = await browser.evaluate<ReturnType<typeof cleanCandidate>>(`(${cleanCandidate.toString()})(${JSON.stringify(code)},${JSON.stringify(permitted)},${JSON.stringify(systemIconIds)},${JSON.stringify(backdropIds)},${JSON.stringify(backdropUrls)},${!!args.legacyImport})`);
    checks.issues.push(...clean.issues); checks.cleaned = clean.cleaned;
    for (const contact of new Set(clean.contacts)) if (!args.materials.includes(contact.replace(/^(mailto|tel):/, ''))) checks.issues.push(`联系方式没有资料来源：${contact}`);
    if (checks.issues.length && !args.legacyImport) return { code: clean.code, checks };
    await browser.send('Network.setBlockedURLs', { urls: [] });
    const scan = (await readFile(path.join(process.cwd(), 'scripts/visitor-layout-scan.js'), 'utf8')).replace(/export default scanVisitorLayout;?/g, '').replace(/export function scanVisitorLayout/g, 'function scanVisitorLayout');
    const { frameTree } = await browser.send<{ frameTree: { frame: { id: string } } }>('Page.getFrameTree');
    const used = new Set((clean.code.header + clean.code.footer + clean.code.pages.map(p => p.html).join('')).match(/img_[a-z0-9]{16,40}/g));
    const credits = [...new Set(args.images.filter(i => used.has(i.imageId) && i.attribution).map(i => i.attribution))];
    const generatedText = new Set<string>();
    for (const page of clean.code.pages) {
      for (const width of [375, 768, 1440]) {
        await browser.send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
        await browser.send('Page.setDocumentContent', { frameId: frameTree.frame.id, html: renderSiteCode(args.siteId, clean.code, page.id, '', credits) });
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
        const layout = await browser.evaluate<LayoutReport & { generatedText: string[] }>(`(() => {${scan};for(const detail of document.querySelectorAll('details')) detail.open=true;for(const node of document.querySelectorAll('[aria-hidden="true"]')) node.removeAttribute('aria-hidden');return {...scanVisitorLayout(document,${JSON.stringify(backdrops.colors)}),generatedText:(${readGeneratedText.toString()})()};})()`);
        for (const text of layout.generatedText) generatedText.add(text);
        const contrast = layout.textContrast.map(t => ({ ...t, threshold: t.role === 'heading' ? t.threshold : 4.5 })).filter(t => t.status !== 'measured' || t.ratio === null || t.ratio < t.threshold);
        const long = layout.bodyLineLength.filter(l => l.tooLong);
        const incomingAnchors = [...(clean.code.header + clean.code.footer + clean.code.pages.map(p => p.html).join('')).matchAll(/href="\/([a-z][a-z0-9-]*)#([a-zA-Z0-9_-]+)"/g)].filter(match => match[1] === page.id).map(match => match[2]);
        const productIds = args.images.filter(image => image.usageScope !== 'docs-only' && image.usageCategory === 'product').map(image => image.imageId);
        const qualityFeedback = await browser.evaluate<CodeQualityFeedback>(`(${readCodeQuality.toString()})(${JSON.stringify(page.id)},${width},${JSON.stringify(productIds)},${JSON.stringify(incomingAnchors)})`);
        checks.viewports.push({ pageId: page.id, width, overflow: layout.overflowElements.length + Number(layout.horizontalScroll), overlaps: layout.textOverlaps.length, contrastIssues: contrast.length, longLines: long.length, qualityFeedback });
        if (!layout.measurement.textContrastEntries) checks.issues.push(`${page.id}/${width} 无可测量正文`);
        if (layout.horizontalScroll || layout.overflowElements.length) checks.issues.push(`${page.id}/${width} 横向溢出`);
        if (layout.textOverlaps.length) checks.issues.push(`${page.id}/${width} 文字重叠`);
        for (const text of contrast.slice(0, 8)) checks.issues.push(`${page.id}/${width} 对比度不足或无法测量：${text.text}（${text.ratio?.toFixed(2) ?? '未知'}，需 ${text.threshold}）`);
        // Line length remains in viewport quality feedback; it never triggers repair.
      }
    }
    const readable = `${clean.text}\n${[...generatedText].join('\n')}`;
    const numbers = (s: string) => s.normalize('NFKC').match(/\d+(?:\.\d+)?/g) ?? [];
    const allowedNumbers = new Set(numbers(args.materials));
    for (const number of new Set(numbers(readable))) if (!allowedNumbers.has(number)) checks.issues.push(`资料没有的数字：${number}`);
    const marker = args.materials.match(/核验记号[：:]\s*([^。\n\s]+)/)?.[1];
    if (marker && readable.includes(marker)) checks.issues.push('页面包含资料核验记号，请移除');
    // Fact auditing belongs to this same boundary, including restoration and manual submissions.
    if (!checks.issues.length && !args.legacyImport) checks.issues.push(...await auditCodeFacts(args.materials, readable));
    checks.passed = checks.issues.length === 0;
    return { code: clean.code, checks };
  } finally { await browser.close(); }
}
