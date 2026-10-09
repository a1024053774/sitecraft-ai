import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { codeCheckBrowser } from './code-site-browser.ts';
import { codeSiteSchema, renderSiteCode, type SiteCode, type CodeCheck } from './code-site.ts';
import { auditCodeFacts } from './code-site-model.ts';
import type { SiteImageRecord } from './site-images.ts';
import { systemIconIds } from './code-site-icons.ts';

// Runs in an empty browser document. DOMParser keeps candidate markup inert until cleaning finishes.
function cleanCandidate(code: SiteCode, permitted: string[], iconIds: string[], legacyImport = false) {
  const issues: string[] = [], cleaned: string[] = [];
  const allowed = new Set('header footer main section article aside nav div span p h1 h2 h3 h4 h5 h6 ul ol li dl dt dd table thead tbody tfoot tr th td caption colgroup col figure figcaption img a strong em b i small br hr details summary address blockquote time'.split(' '));
  const safeCss = (style: CSSStyleDeclaration) => {
    for (const name of [...style]) {
      const value = style.getPropertyValue(name);
      if (/url\s*\(|image-set\s*\(|cross-fade\s*\(|expression\s*\(|\\|[<>]/i.test(value) || /^(behavior|-moz-binding)$/i.test(name)) {
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
    const clean = await browser.evaluate<ReturnType<typeof cleanCandidate>>(`(${cleanCandidate.toString()})(${JSON.stringify(code)},${JSON.stringify(permitted)},${JSON.stringify(systemIconIds)},${!!args.legacyImport})`);
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
        await browser.evaluate(`(() => {if(document.contentType!=='text/html'||!document.querySelector('main h1'))throw new Error('底线检查未载入候选网页，本次未保存版本。')})()`);
        await browser.evaluate('document.fonts.ready.then(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))');
        const imageErrors = await browser.evaluate<string[]>(`Promise.all([...document.images].map(async image => {try{await image.decode();return ''}catch{return image.getAttribute('data-image-id')||'图片'}})).then(items=>items.filter(Boolean))`);
        if (imageErrors.length) checks.issues.push(`${page.id}/${width} 图片无法显示：${imageErrors.join('、')}`);
        const layout = await browser.evaluate<LayoutReport & { generatedText: string[] }>(`(() => {${scan};for(const detail of document.querySelectorAll('details')) detail.open=true;for(const node of document.querySelectorAll('[aria-hidden="true"]')) node.removeAttribute('aria-hidden');return {...scanVisitorLayout(document),generatedText:(${readGeneratedText.toString()})()};})()`);
        for (const text of layout.generatedText) generatedText.add(text);
        const contrast = layout.textContrast.map(t => ({ ...t, threshold: t.role === 'heading' ? t.threshold : 4.5 })).filter(t => t.status !== 'measured' || t.ratio === null || t.ratio < t.threshold);
        const long = layout.bodyLineLength.filter(l => l.tooLong);
        checks.viewports.push({ pageId: page.id, width, overflow: layout.overflowElements.length + Number(layout.horizontalScroll), overlaps: layout.textOverlaps.length, contrastIssues: contrast.length, longLines: long.length });
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
