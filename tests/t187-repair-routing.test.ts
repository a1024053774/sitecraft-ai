import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import { parse, serialize, serializeOuter, type DefaultTreeAdapterTypes as Tree } from 'parse5';
import { codeCssDeclarationNames, readCodeLayoutRepairs, type CodeLayoutScan } from '../lib/code-site-layout-repair.ts';
import type { SiteCode } from '../lib/code-site.ts';
import type { CodeFactRepair } from '../lib/code-site-fact-segments.ts';

// Isolated evidence while Chrome is reserved for T-184. parse5 supplies only
// tree parsing/serialization; no CSS cascade or layout is simulated. Extract
// the unchanged production function, as Chrome receives it, without exporting
// an extra production API. Real scan/commit coverage lives in the browser suite.
// Failure modes: fact prose routed as layout; same-text neighbours selected;
// a readonly container's inline declaration omitted; harmless/leaf inline styles
// rejected even though their writable element or stylesheet can fix the issue.
const source = await readFile(new URL('../lib/code-site-repair.ts', import.meta.url), 'utf8');
const js = stripTypeScriptTypes(source.slice(source.indexOf('function repairDom('), source.indexOf('\nasync function inDom(')));
const repairDom = runInNewContext(`(${js})`, dom());

function dom(html = '') {
  const cache = new WeakMap<Tree.Node, DomNode>();
  const wrap = (raw: Tree.Node): DomNode => {
    let node = cache.get(raw);
    if (!node) { node = new (('tagName' in raw && raw.tagName === 'style') ? StyleNode : 'tagName' in raw ? ElementNode : DomNode)(raw); cache.set(raw, node); }
    return node;
  };
  class DomNode {
    raw: Tree.Node;
    constructor(raw: Tree.Node) { this.raw = raw; }
    get childNodes(): DomNode[] { return 'childNodes' in this.raw ? this.raw.childNodes.map(wrap) : []; }
    get nodeType() { return 'tagName' in this.raw ? 1 : this.raw.nodeName === '#text' ? 3 : this.raw.nodeName === '#comment' ? 8 : this.raw.nodeName === '#documentType' ? 10 : 9; }
    get nodeName() { return 'tagName' in this.raw ? this.raw.tagName.toUpperCase() : this.raw.nodeName; }
    get nodeValue() { return 'value' in this.raw ? this.raw.value : 'data' in this.raw ? this.raw.data : null; }
    get parentElement(): ElementNode | null { return 'parentNode' in this.raw && this.raw.parentNode && 'tagName' in this.raw.parentNode ? wrap(this.raw.parentNode) as ElementNode : null; }
    get textContent(): string { return this.nodeValue ?? this.childNodes.map(node => node.textContent).join(''); }
    set textContent(value: string) {
      assert.ok('childNodes' in this.raw);
      this.raw.childNodes = value ? [{ nodeName: '#text', value, parentNode: this.raw }] : [];
    }
    get length() { return this.nodeValue!.length; }
    get data() { return this.nodeValue; }
    replaceData(offset: number, count: number, after: string) {
      assert.ok('value' in this.raw); this.raw.value = this.raw.value.slice(0, offset) + after + this.raw.value.slice(offset + count);
    }
    appendChild(node: DomNode) {
      assert.ok('childNodes' in this.raw && 'parentNode' in node.raw);
      node.raw.parentNode = this.raw; this.raw.childNodes.push(node.raw); return node;
    }
    normalize() {} // Fixtures contain no adjacent text nodes.
    querySelectorAll(selector: string): ElementNode[] {
      return this.childNodes.flatMap(node => [...(node instanceof ElementNode && (selector === '*' || node.tagName.toLowerCase() === selector) ? [node] : []), ...node.querySelectorAll(selector)]);
    }
    querySelector(selector: string) { return this.querySelectorAll(selector)[0]; }
  }
  class ElementNode extends DomNode {
    get tagName() { return this.nodeName; }
    get children(): ElementNode[] { return this.childNodes.filter((node): node is ElementNode => node instanceof ElementNode); }
    get childElementCount() { return this.children.length; }
    get namespaceURI() { return (this.raw as Tree.Element).namespaceURI; }
    get attributes() { return (this.raw as Tree.Element).attrs.map(attr => ({ ...attr, namespaceURI: attr.namespace ?? null })); }
    getAttribute(name: string) { return this.attributes.find(attr => attr.name === name)?.value ?? null; }
    hasAttribute(name: string) { return this.getAttribute(name) !== null; }
    get classList() { return { contains: (name: string) => (this.getAttribute('class') ?? '').split(/\s+/).includes(name) }; }
    get style() { return { cssText: this.getAttribute('style') ?? '' }; }
    get outerHTML() { return serializeOuter(this.raw); }
    get innerHTML() { return serialize(this.raw); }
  }
  class StyleNode extends ElementNode {}
  class Parser {
    parseFromString(text: string): DomNode & { body: ElementNode; head: ElementNode; createElement: (tag: string) => ElementNode; importNode: (node: DomNode) => DomNode } {
      const root = wrap(parse(text));
      return Object.assign(root, {
        body: root.querySelector('body')!, head: root.querySelector('head')!,
        createElement: (tag: string) => new Parser().parseFromString(`<${tag}></${tag}>`).querySelector(tag)!,
        importNode: (node: DomNode) => new Parser().parseFromString(node instanceof ElementNode ? node.outerHTML : node.textContent).body.childNodes[0],
      });
    }
  }
  const document = new Parser().parseFromString(html);
  return { document: Object.assign(document, { implementation: { createHTMLDocument: () => new Parser().parseFromString('') } }),
    DOMParser: Parser, Node: { TEXT_NODE: 3 }, Element: ElementNode, HTMLStyleElement: StyleNode,
    CSSStyleSheet: class { cssRules = []; replaceSync() {} },
    getComputedStyle: () => ({ backgroundColor: 'transparent' }), structuredClone };
}

for (const claim of ['对比度提升效果显著。', '避免溢出效果显著。', '减少重叠效果显著。']) test(`事实成员含版面关键词仍只修被拒位置：${claim}`, () => {
  const code: SiteCode = { header: '<header>保留</header>', footer: '<footer>保留</footer>', css: '',
    pages: [{ id: 'home', title: '说明', html: `<main><h1>说明</h1><p>${claim}</p><p>${claim}</p></main>` }] };
  const issue = `资料不支持效果声明：${claim}`;
  const factRepairs: CodeFactRepair[] = [{ issues: [issue], members: [{ kind: 'text', field: 'pages/home/html', path: [0, 1, 0], text: claim, offset: 0, before: claim }] }];
  const selected = repairDom(code, { issues: [issue], cleaned: [], factRepairs, layoutRepairs: [] }, codeCssDeclarationNames);
  assert.equal(selected.error, undefined);
  assert.deepEqual(JSON.parse(JSON.stringify(selected.fragments)), [{ id: 0, field: 'pages/home/html', kind: 'text', path: [0, 1, 0], before: claim, text: claim, offset: 0 }]);
  const result = repairDom(code, { fragments: selected.fragments, replacements: [{ fragmentId: 0, after: '效果待补充。' }] }, codeCssDeclarationNames);
  assert.equal(result.error, undefined);
  assert.equal(result.code.pages[0].html, `<main><h1>说明</h1><p>效果待补充。</p><p>${claim}</p></main>`);
  assert.equal(result.code.header, code.header); assert.equal(result.code.footer, code.footer); assert.equal(result.code.css, code.css);
});

test('版面来源只认结构化扫描记录，缺少记录时不退回正文匹配', () => {
  const html = '<main><p>失败位置</p><p>失败位置</p></main>';
  const code: SiteCode = { header: '', footer: '', css: '', pages: [{ id: 'home', title: '说明', html }] };
  const issue = 'home/375 失败位置';
  const layoutRepairs = [{ issue, elements: [{ field: 'pages/home/html', path: [0, 0], before: '<p>失败位置</p>' }], declarations: [] }];
  const selected = repairDom(code, { issues: [issue], layoutRepairs }, codeCssDeclarationNames);
  assert.equal(selected.error, undefined);
  assert.deepEqual(JSON.parse(JSON.stringify(selected.fragments)), [{ id: 0, field: 'pages/home/html', kind: 'element', path: [0, 0], before: '<p>失败位置</p>' }]);
  assert.match(repairDom(code, { issues: [issue] }, codeCssDeclarationNames).error, /扫描.*缺少.*定位/);
});

for (const [name, html, key, refused] of [
  ['非叶子容器直接正文', '<main style="color:#bbb;background:#fff">直接正文<h1>标题</h1><p style="color:#111">正常子元素</p></main>', 'MAIN:0', true],
  ['叶子目标继承只读祖先', '<main style="color:#bbb"><p>正文</p></main>', 'MAIN:0/P:0', true],
  ['叶子目标自己的 inline 可整元素写回', '<main><p style="color:#bbb">正文</p></main>', 'MAIN:0/P:0', false],
  ['容器无关 inline 不阻止 CSS 修正', '<main style="padding:16px">直接正文<h1>标题</h1></main>', 'MAIN:0', false],
] as const) test(`inline 声明边界：${name}`, () => {
  const code: SiteCode = { header: '', footer: '', css: '', pages: [{ id: 'home', title: '说明', html }] };
  const scan: CodeLayoutScan = { horizontalScroll: false, overflowElements: [], textOverlaps: [], measurement: { textContrastEntries: 1 },
    textContrast: [{ key, text: '正文', status: 'measured', ratio: 1.9, threshold: 4.5, role: 'body' }] };
  const repairs = runInNewContext(`(${readCodeLayoutRepairs.toString()})(code,'home',375,scan,(${codeCssDeclarationNames.toString()}))`, { ...dom(html), code, scan });
  assert.equal(repairs.length, 1);
  assert.equal(repairs[0].elements[0].before, key === 'MAIN:0' ? html : html.includes('<p style=') ? '<p style="color:#bbb">正文</p>' : '<p>正文</p>');
  if (refused) assert.match(repairs[0].reason ?? '', /style 属性.*(?:只读|无法写回)/);
  else assert.equal(repairs[0].reason, undefined);
});
