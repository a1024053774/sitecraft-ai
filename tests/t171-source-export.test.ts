import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { codeCheckDocument } from './fixtures/code-check-document.ts';
import { codeCheckBrowser } from '../lib/code-site-browser.ts';
import { commitSiteCode, getCodeSite } from '../lib/code-site-store.ts';
import { saveSiteImage } from '../lib/site-images.ts';
import type { SiteCode } from '../lib/code-site.ts';

registerHooks({ resolve(specifier, context, next) {
  if (!specifier.startsWith('@/')) return next(specifier, context);
  const file = path.join(process.cwd(), specifier.slice(2));
  return next(pathToFileURL(existsSync(`${file}.ts`) ? `${file}.ts` : file).href, context);
} });

// T-171 failure modes (each must remain observable in the focused red/green run):
// - export and published pages diverge because export owns a second renderer;
// - links still target SiteCraft routes, so a double-clicked index.html leaves the package;
// - an image used by the current version is missing, or an unreferenced upload is included;
// - LICENSES.txt omits image attribution, Lucide, or the registered backdrop license;
// - materials, conversations, annotations, fact citations, internal ids, or secrets leak;
// - <script>, onerror=, javascript:, <iframe>, external url(), and SVG scripts bypass the
//   commit boundary, or a clean paired candidate leaves scripts/events/external resources.

const output = path.resolve('artifacts/t171', `source-export-${crypto.randomUUID()}`);
await mkdir(output, { recursive: true });

function parseStoredZip(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const decoder = new TextDecoder();
  const entries = new Map<string, Uint8Array>();
  let offset = 0;
  while (offset + 4 <= bytes.length && view.getUint32(offset, true) === 0x04034b50) {
    const nameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    const method = view.getUint16(offset + 8, true);
    const size = view.getUint32(offset + 18, true);
    assert.equal(method, 0, '测试夹具只解析无压缩 ZIP，避免用实现自身解压作预期');
    const name = decoder.decode(bytes.slice(offset + 30, offset + 30 + nameLength));
    const bodyStart = offset + 30 + nameLength + extraLength;
    entries.set(name, bytes.slice(bodyStart, bodyStart + size));
    offset = bodyStart + size;
  }
  assert.ok(entries.size > 0, '导出必须是可读的 ZIP，而不是空响应');
  return entries;
}

function text(bytes: Uint8Array) { return new TextDecoder().decode(bytes); }
async function waitForHttpPage(browser: Awaited<ReturnType<typeof codeCheckBrowser>>) {
  for (let attempt = 0; attempt < 120; attempt++) {
    if (await browser.evaluate<string>('document.readyState') === 'complete') return;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error('发布页未完成载入');
}

const sourceImage = await readFile('tests/fixtures/company-images/export/product-compression-union.jpg');
const unusedImage = await readFile('tests/fixtures/company-images/export/product-compression-tee.jpg');
const safeCode: SiteCode = {
  header: '<header><span data-system-icon="factory"></span><nav><a href="/home">首页</a><a href="/products">产品</a></nav></header>',
  footer: '<footer>资料中的公司简介；对话内容不属于网站。</footer>',
  css: 'body{margin:0;background:#fff;color:#111;font:16px/1.6 sans-serif}main{padding:32px}.hero{padding:24px;background:#fff}.photo{width:240px;height:180px;object-fit:contain}',
  pages: [
    { id: 'home', title: '曜石接头', html: '<main><h1>曜石接头</h1><section class="hero" data-system-backdrop="bd_grid_precision-steel"><p>精密连接件。</p><img class="photo" data-image-id="img_used171000000000000000" alt="压缩接头" /></section><a href="/products#spec">查看产品</a></main>' },
    { id: 'products', title: '产品', html: '<main><h1>产品</h1><section id="spec"><p>压缩接头，资料待补充。</p></section></main>' },
  ],
};

async function rejectedOrApplied(siteId: string, code: SiteCode) {
  return commitSiteCode({ siteId, legacyImport: { kind: 'convert', name: '曜石接头', materials: '曜石接头。精密连接件。资料待补充。', code, exportIssues: [], source: { revision: 1, updatedAt: new Date().toISOString() } }, });
}

test('导出当前版本包含相对链接、准确资源、署名和英文目录且不泄漏内部资料', async () => {
  const siteId = `t171-${crypto.randomUUID().replaceAll('-', '').slice(0, 20)}`;
  const used = await saveSiteImage({ siteId, bytes: sourceImage, originalName: 'used.jpg', provenance: { attribution: '示例作者 / 用户提供；仅当前站点使用' } });
  const unused = await saveSiteImage({ siteId, bytes: unusedImage, originalName: 'unused.jpg', provenance: { attribution: '未引用图片' } });
  assert.notEqual(used.imageId, unused.imageId, '夹具需要两个可区分的图片记录');
  const code = structuredClone(safeCode);
  code.pages[0].html = code.pages[0].html.replace('img_used171000000000000000', used.imageId);
  const result = await rejectedOrApplied(siteId, { ...code, pages: code.pages.map(page => ({ ...page, html: page.html })) });
  assert.equal(result.status, 'applied', result.status === 'unavailable' ? result.record.readError : '正常版本必须先通过真实提交入口');
  if (result.status !== 'applied') return;
  const englishCode = structuredClone(code);
  englishCode.header = englishCode.header.replace('首页', 'Home').replace('产品', 'Products');
  englishCode.footer = '<footer>Precision connectors; source materials stay outside the site.</footer>';
  englishCode.pages = englishCode.pages.map(page => page.id === 'home'
    ? { ...page, title: '曜石接头', html: page.html.replace('精密连接件。', 'Precision connectors.').replace('压缩接头', 'Compression connector').replace('查看产品', 'View products') }
    : { ...page, title: 'Products', html: page.html.replace('产品', 'Products').replace('压缩接头', 'Compression connectors').replace('资料待补充', 'To be provided') });
  const bilingual = await commitSiteCode({ siteId, baseRevision: result.version.revision, englishCode, author: 'user', summary: '英文版夹具', request: '' });
  assert.equal(bilingual.status, 'applied', bilingual.status === 'rejected' ? bilingual.checks.issues.join('；') : '英文版必须走同一提交边界');
  if (bilingual.status !== 'applied') return;
  const { GET: exportSite } = await import('../app/api/sites/[siteId]/export/route.ts');
  const response = await exportSite(new Request(`http://sitecraft.local/api/sites/${siteId}/export`), { params: Promise.resolve({ siteId }) });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') || '', /^application\/zip/);
  assert.match(response.headers.get('content-disposition') || '', /sitecraft-[a-z0-9_-]+\.zip/);
  const entries = parseStoredZip(new Uint8Array(await response.arrayBuffer()));
  assert.deepEqual([...entries.keys()].sort(), ['LICENSES.txt', 'assets/images/used.jpg', 'assets/system-backdrops/bd_grid_precision-steel--1440.webp', 'assets/system-backdrops/bd_grid_precision-steel--375.webp', 'assets/system-backdrops/bd_grid_precision-steel--768.webp', 'en/index.html', 'en/products.html', 'index.html', 'products.html', 'styles.css']);
  assert.equal(text(entries.get('assets/images/used.jpg')!), text(sourceImage));
  for (const file of ['index.html', 'products.html', 'en/index.html', 'en/products.html']) {
    const html = text(entries.get(file)!);
    assert.doesNotMatch(html, /(?:href|src)=["'](?:\/(?:api|published)|https?:|\/\/)/i, `${file} must work without SiteCraft`);
    assert.match(html, /<link rel="stylesheet" href="(?:\.\.\/)?styles\.css">/, `${file} must use the package CSS`);
    assert.doesNotMatch(html, /data-image-id|img_[a-z0-9]{16,40}/i, `${file} must not expose image ids`);
    assert.doesNotMatch(html, /<script\b|\bon[a-z]+\s*=|javascript:|<iframe\b|url\(\s*["']?(?:https?:|\/\/)/i, `${file} must be inert and local`);
  }
  assert.match(text(entries.get('index.html')!), /href="products\.html#spec"/);
  assert.match(text(entries.get('products.html')!), /href="index\.html"/);
  assert.match(text(entries.get('en/index.html')!), /href="\.\.\/index\.html"/);
  assert.doesNotMatch(text(entries.get('LICENSES.txt')!), /对话内容不属于网站|t171-|img_[a-z0-9]{16,40}|密钥|fact/i);
  assert.match(text(entries.get('LICENSES.txt')!), /示例作者/);
  assert.match(text(entries.get('LICENSES.txt')!), /Lucide icons|ISC License/);
  assert.match(text(entries.get('LICENSES.txt')!), /Shader Effects Inc\.|MIT License/);
  assert.match(text(entries.get('styles.css')!), /font:\s*16px/);
  assert.equal((await getCodeSite(siteId))!.versions.length, 2, '只读导出不得新建版本');
  const evidence = path.join(output, siteId); await mkdir(evidence, { recursive: true });
  await writeFile(path.join(evidence, 'export.zip'), Buffer.from(await (await exportSite(new Request(`http://sitecraft.local/api/sites/${siteId}/export`), { params: Promise.resolve({ siteId }) })).arrayBuffer()));
  const unpacked = await mkdtemp(path.join(tmpdir(), 'sitecraft-t171-export-'));
  for (const [name, bytes] of entries) { const file = path.join(unpacked, name); await mkdir(path.dirname(file), { recursive: true }); await writeFile(file, bytes); }
  const browser = await codeCheckBrowser();
  try {
    for (const [label, url] of [['export', pathToFileURL(path.join(unpacked, 'index.html')).href], ['published', `${process.env.SITECRAFT_BASE}/published/${siteId}`]] as const) {
      await browser.send('Page.navigate', { url });
      if (label === 'published') await waitForHttpPage(browser);
      for (const width of [1440, 768, 375]) {
        await browser.send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
        const shot = await browser.send<{ data: string }>('Page.captureScreenshot', { format: 'png' });
        await writeFile(path.join(evidence, `${label}-${width}.png`), Buffer.from(shot.data, 'base64'));
      }
    }
  } finally { await browser.close(); }
});

const malicious: Array<[string, (code: SiteCode) => SiteCode]> = [
  ['script', code => ({ ...structuredClone(code), pages: code.pages.map((page, index) => index ? page : { ...page, html: page.html + '<script>alert(1)</script>' }) })],
  ['event', code => ({ ...structuredClone(code), pages: code.pages.map((page, index) => index ? page : { ...page, html: page.html.replace('<h1>', '<img src="x" onerror="alert(1)"><h1>') }) })],
  ['javascript', code => ({ ...structuredClone(code), pages: code.pages.map((page, index) => index ? page : { ...page, html: page.html.replace('href="/products#spec"', 'href="javascript:alert(1)"') }) })],
  ['iframe', code => ({ ...structuredClone(code), pages: code.pages.map((page, index) => index ? page : { ...page, html: page.html + '<iframe src="https://evil.example"></iframe>' }) })],
  ['external-css', code => ({ ...structuredClone(code), css: code.css + '.hero{background-image:url("https://evil.example/x.png")}' })],
  ['svg-script', code => ({ ...structuredClone(code), pages: code.pages.map((page, index) => index ? page : { ...page, html: page.html + '<svg><script>alert(1)</script></svg>' }) })],
];

for (const [label, makeBad] of malicious) {
  test(`提交入口拒绝 ${label} 候选，正常对照仍可提交`, async () => {
    const plainCode = structuredClone(safeCode);
    plainCode.pages[0].html = plainCode.pages[0].html.replace(/<img\b[^>]*>/i, '');
    const badId = `t171-bad-${label}-${crypto.randomUUID().replaceAll('-', '').slice(0, 16)}`;
    const bad = await rejectedOrApplied(badId, makeBad(plainCode));
    assert.equal(bad.status, 'unavailable', `${label} 候选必须在提交入口拒绝`);
    assert.equal((await getCodeSite(badId).catch(() => null)), null, '恶意候选不能生成可导出的版本记录');
    const goodId = `t171-good-${label}-${crypto.randomUUID().replaceAll('-', '').slice(0, 16)}`;
    const good = await rejectedOrApplied(goodId, plainCode);
    assert.equal(good.status, 'applied', `${label} 的正常对照必须通过同一入口`);
  });
}

test('测试静态检查页夹具仍是无脚本 HTML', () => {
  assert.doesNotMatch(codeCheckDocument, /<script\b/i);
});
