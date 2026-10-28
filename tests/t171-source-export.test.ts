import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { registerHooks } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { codeCheckDocument } from './fixtures/code-check-document.ts';
import { codeCheckBrowser } from '../lib/code-site-browser.ts';
import { createStoredZip } from '../lib/code-site-export.ts';
import { commitSiteCode, createCodeSite, getCodeSite, updateCodeSite } from '../lib/code-site-store.ts';
import { factAuditReply, factAuditPayload } from './fixtures/fact-audit-reply.ts';
import { saveSiteImage } from '../lib/site-images.ts';
import type { CodeSiteRecord, CodeVersion, SiteCode } from '../lib/code-site.ts';

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
// - home/index collision creates duplicate ZIP entries or links two pages to one file;
// - Chinese and English pages receive the other language's credits;
// - authored text containing img_<id> is mistaken for an actual image reference;
// - traversal/control characters in originalName reach an asset path or LICENSES.txt;
// - export reads legacy image metadata through a migration write, or body-wide cleanup
//   deletes authored text that merely contains data-image-id="...".
// - removing system image attributes changes CSS selector matching, layout and visibility;
// - a linked common stylesheet is CSP-blocked and duplicate inline CSS hides that failure.

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
    assert.equal(entries.has(name), false, 'ZIP 解析不能覆盖重复条目');
    assert.ok(!name.startsWith('/') && !name.includes('\\') && !/[\u0000-\u001f\u007f]/.test(name)
      && name.split('/').every(part => part && part !== '.' && part !== '..'), 'ZIP 解析必须拒绝非法路径');
    const bodyStart = offset + 30 + nameLength + extraLength;
    entries.set(name, bytes.slice(bodyStart, bodyStart + size));
    offset = bodyStart + size;
  }
  assert.ok(entries.size > 0, '导出必须是可读的 ZIP，而不是空响应');
  return entries;
}

function localZipEntryNames(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const decoder = new TextDecoder(); const names: string[] = []; let offset = 0;
  while (offset + 4 <= bytes.length && view.getUint32(offset, true) === 0x04034b50) {
    const nameLength = view.getUint16(offset + 26, true), extraLength = view.getUint16(offset + 28, true);
    const size = view.getUint32(offset + 18, true), start = offset + 30;
    names.push(decoder.decode(bytes.slice(start, start + nameLength)));
    offset = start + nameLength + extraLength + size;
  }
  return names;
}

async function snapshotFiles(root: string, siteId: string) {
  const result = new Map<string, { size: number; mtimeMs: number }>();
  async function visit(directory: string) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      const relative = path.relative(root, file), parts = relative.split(path.sep);
      if (entry.isDirectory()) {
        if (parts.includes(siteId) || parts.every(part => ['uploads', 'code-sites', 'conversations', process.env.DEFAULT_WORKSPACE_ID || 'demo'].includes(part))) await visit(file);
      } else if (parts.includes(siteId) || entry.name === `${siteId}.json`) {
        const info = await stat(file); result.set(relative, { size: info.size, mtimeMs: info.mtimeMs });
      }
    }
  }
  await visit(root); return result;
}

async function browserDomSnapshot(browser: Awaited<ReturnType<typeof codeCheckBrowser>>) {
  await browser.evaluate('document.querySelectorAll("details").forEach(node=>node.open=true)');
  return browser.evaluate<{ text: string; structure: string[]; scrollWidth: number; boxes: unknown[] }>(`({
    text: (document.body.innerText || '').replace(/\\s+/g, ' ').trim(),
    structure: [...document.body.querySelectorAll('*')].map(node => node.tagName.toLowerCase() + '[' + node.children.length + ']'),
    scrollWidth: document.documentElement.scrollWidth,
    boxes: [...document.body.querySelectorAll('*')].map(node => {const r=node.getBoundingClientRect();return [node.tagName, ...[r.x,r.y,r.width,r.height].map(value=>Math.round(value*1000)/1000),getComputedStyle(node).display]}),
  })`);
}

async function unpackSitePackage(entries: Map<string, Uint8Array>) {
  const directory = await mkdtemp(path.join(tmpdir(), 'sitecraft-t171-fidelity-'));
  for (const [name, bytes] of entries) {
    const file = path.join(directory, name);
    await mkdir(path.dirname(file), { recursive: true }); await writeFile(file, bytes);
  }
  return directory;
}

async function comparePublishedPages(site: CodeSiteRecord, version: CodeVersion, entries: Map<string, Uint8Array>) {
  const directory = await unpackSitePackage(entries);
  const observations: Array<{ language: string; page: string; width: number; published: Awaited<ReturnType<typeof browserDomSnapshot>>; exported: Awaited<ReturnType<typeof browserDomSnapshot>> }> = [];
  const browser = await codeCheckBrowser();
  try {
    for (const language of ['zh', 'en'] as const) {
      const pages = language === 'zh' ? version.code.pages : version.english?.pages;
      for (const page of pages ?? []) {
        const filename = (language === 'en' ? 'en/' : '') + (page.id === 'home' ? 'index.html' : `${page.id}.html`);
        for (const width of [1440, 768, 375]) {
          await browser.send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
          const snapshots = [];
          for (const url of [`${process.env.SITECRAFT_BASE}/published/${site.siteId}${language === 'en' ? '/en' : ''}?page=${page.id}`, pathToFileURL(path.join(directory, filename)).href]) {
            await browser.send('Page.navigate', { url }); await waitForHttpPage(browser, url);
            snapshots.push(await browserDomSnapshot(browser));
          }
          observations.push({ language, page: page.id, width, published: snapshots[0], exported: snapshots[1] });
        }
      }
    }
  } finally { await browser.close(); }
  await writeFile(path.join(output, `${site.siteId}-fidelity.json`), JSON.stringify(observations, null, 2), 'utf8');
  for (const item of observations) assert.deepEqual(item.exported, item.published, `${item.language}/${item.page}/${item.width} file:// 与发布的文字、DOM 和布局尺寸必须一致`);
}

function text(bytes: Uint8Array) { return new TextDecoder().decode(bytes); }
async function waitForHttpPage(browser: Awaited<ReturnType<typeof codeCheckBrowser>>, url?: string) {
  for (let attempt = 0; attempt < 120; attempt++) {
    if (await browser.evaluate<boolean>(`document.readyState==='complete' && ${url ? `location.href===${JSON.stringify(url)} && !!document.querySelector('main h1') && [...document.images].every(image=>image.complete && image.naturalWidth>0)` : 'true'}`)) return;
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

async function rejectedOrApplied(siteId: string, code: SiteCode, materials = '曜石接头。精密连接件。资料待补充。') {
  return commitSiteCode({ siteId, legacyImport: { kind: 'convert', name: '曜石接头', materials, code, exportIssues: [], source: { revision: 1, updatedAt: new Date().toISOString() } }, });
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
  assert.deepEqual([...entries.keys()].sort(), ['LICENSES.txt', `assets/images/${used.imageId}.jpg`, 'assets/system-backdrops/bd_grid_precision-steel--1440.webp', 'assets/system-backdrops/bd_grid_precision-steel--375.webp', 'assets/system-backdrops/bd_grid_precision-steel--768.webp', 'en/index.html', 'en/products.html', 'index.html', 'products.html', 'styles.css']);
  assert.ok(entries.get(`assets/images/${used.imageId}.jpg`)!.length > 0, '站点包包含已引用图片');
  for (const file of ['index.html', 'products.html', 'en/index.html', 'en/products.html']) {
    const html = text(entries.get(file)!);
    assert.doesNotMatch(html, /(?:href|src)=["'](?:\/(?:api|published)|https?:|\/\/)/i, `${file} must work without SiteCraft`);
    assert.match(html, /<link rel="stylesheet" href="(?:\.\.\/)?styles\.css">/, `${file} must use the package CSS`);
    if (file.endsWith('index.html')) assert.match(html, new RegExp(`data-image-id="${used.imageId}"`), `${file} 必须保留系统属性的选择器语义`);
    assert.doesNotMatch(html, /<script\b|\bon[a-z]+\s*=|javascript:|<iframe\b|url\(\s*["']?(?:https?:|\/\/)/i, `${file} must be inert and local`);
  }
  assert.match(text(entries.get('index.html')!), /href="products\.html#spec"/);
  assert.match(text(entries.get('products.html')!), /href="index\.html"/);
  assert.match(text(entries.get('en/index.html')!), /href="\.\.\/index\.html"/);
  assert.doesNotMatch(text(entries.get('LICENSES.txt')!), /对话内容不属于网站|t171-|密钥|factSource|factSegments/i);
  assert.match(text(entries.get('LICENSES.txt')!), /示例作者/);
  assert.match(text(entries.get('LICENSES.txt')!), /Lucide icons|ISC License/);
  assert.match(text(entries.get('LICENSES.txt')!), /Shader Effects Inc\.|MIT License/);
  assert.match(text(entries.get('styles.css')!), /font:\s*16px/);
  await comparePublishedPages(bilingual.site, bilingual.version, entries);
  assert.equal((await getCodeSite(siteId))!.versions.length, 2, '只读导出不得新建版本');
  const evidence = path.join(output, siteId); await mkdir(evidence, { recursive: true });
  await writeFile(path.join(evidence, 'export.zip'), Buffer.from(await (await exportSite(new Request(`http://sitecraft.local/api/sites/${siteId}/export`), { params: Promise.resolve({ siteId }) })).arrayBuffer()));
  const unpacked = await mkdtemp(path.join(tmpdir(), 'sitecraft-t171-export-'));
  for (const [name, bytes] of entries) { const file = path.join(unpacked, name); await mkdir(path.dirname(file), { recursive: true }); await writeFile(file, bytes); }
  const browser = await codeCheckBrowser();
  try {
    for (const [label, url] of [['export', pathToFileURL(path.join(unpacked, 'index.html')).href], ['published', `${process.env.SITECRAFT_BASE}/published/${siteId}`]] as const) {
      await browser.send('Page.navigate', { url });
      await waitForHttpPage(browser, url);
      for (const width of [1440, 768, 375]) {
        await browser.send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
        const shot = await browser.send<{ data: string }>('Page.captureScreenshot', { format: 'png' });
        await writeFile(path.join(evidence, `${label}-${width}.png`), Buffer.from(shot.data, 'base64'));
      }
    }
  } finally { await browser.close(); }
});

test('中英文导出页只携带各自语言实际引用图片的署名', async () => {
  const siteId = `t171-credit-${crypto.randomUUID().replaceAll('-', '').slice(0, 16)}`;
  const zhImage = await saveSiteImage({ siteId, bytes: sourceImage, originalName: 'zh.jpg', provenance: { attribution: '中文署名' } });
  const enImage = await saveSiteImage({ siteId, bytes: unusedImage, originalName: 'en.jpg', provenance: { attribution: 'English attribution' } });
  const zh: SiteCode = { header: '<header>曜石接头</header>', footer: '<footer>精密连接件。</footer>',
    css: 'body{margin:0;color:#111;background:#fff;font:16px/1.6 sans-serif}main{padding:24px}img{width:120px;height:100px;object-fit:contain}',
    pages: [{ id: 'home', title: '曜石接头', html: `<main><h1>曜石接头</h1><p>精密连接件。</p><img data-image-id="${zhImage.imageId}" alt="photo"></main>` }] };
  const en = structuredClone(zh); en.footer = '<footer>Precision connectors.</footer>'; en.pages[0].html = en.pages[0].html.replace('精密连接件。', 'Precision connectors.');
  // A real version chain: English keeps image A after a Chinese edit uses image B.
  // Only the fact-provider HTTP response is controlled locally; commits and export are real.
  const fixture = createServer(async (request, response) => {
    let raw = ''; for await (const chunk of request) raw += chunk;
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify(factAuditPayload(JSON.parse(raw), { choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(factAuditReply(JSON.parse(raw), { issues: [] })) } }] })));
  });
  await new Promise<void>(resolve => fixture.listen(0, '127.0.0.1', resolve));
  const original = Object.fromEntries(['DEEPSEEK_BASE_URL', 'DEEPSEEK_API_KEY', 'DEEPSEEK_MODEL'].map(key => [key, process.env[key]]));
  process.env.DEEPSEEK_BASE_URL = `http://127.0.0.1:${(fixture.address() as { port: number }).port}`;
  process.env.DEEPSEEK_API_KEY = 'local-fixture-only'; process.env.DEEPSEEK_MODEL = 'local-fixture-only';
  let site!: CodeSiteRecord, version!: CodeVersion;
  try {
    await createCodeSite(siteId, '曜石接头', 't171-credit');
    await updateCodeSite(siteId, () => ({ materials: '曜石接头。精密连接件。' }));
    for (const [index, input] of [{ code: zh }, { englishCode: en }, { code: { ...zh, css: zh.css + 'main{padding:36px}', pages: zh.pages.map(page => ({ ...page, html: page.html.replace(zhImage.imageId, enImage.imageId) })) } }].entries()) {
      const result = await commitSiteCode({ siteId, baseRevision: index, ...input, author: 'user', summary: '双语图片版本', request: '' });
      assert.equal(result.status, 'applied', result.status === 'rejected' ? result.checks.issues.join('；') : '版本链必须通过');
      if (result.status !== 'applied') return;
      site = result.site; version = result.version;
    }
  } finally {
    for (const [key, value] of Object.entries(original)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
    await new Promise<void>(resolve => fixture.close(() => resolve()));
  }
  const { GET } = await import('../app/api/sites/[siteId]/export/route.ts');
  const response = await GET(new Request('http://sitecraft.local/'), { params: Promise.resolve({ siteId }) });
  assert.equal(response.status, 200);
  const pack = parseStoredZip(new Uint8Array(await response.arrayBuffer()));
  await comparePublishedPages(site, version, pack);
  const zhHtml = text(pack.get('index.html')!), enHtml = text(pack.get('en/index.html')!);
  assert.match(zhHtml, /English attribution/); assert.doesNotMatch(zhHtml, /中文署名/);
  assert.match(enHtml, /中文署名/); assert.doesNotMatch(enHtml, /English attribution/);
});

test('页面 ID 映射单射，ZIP 无重复条目或路径穿越，站内链接同步到确定性文件名', async () => {
  const siteId = `t171-pages-${crypto.randomUUID().replaceAll('-', '').slice(0, 16)}`;
  const code: SiteCode = { header: '<header><a href="/home">home</a><a href="/index">index</a></header>', footer: '<footer>footer</footer>', css: 'body{font:16px sans-serif}',
    pages: [{ id: 'home', title: 'Home', html: '<main><h1>Home</h1><a href="/index">to index</a></main>' }, { id: 'index', title: 'Index', html: '<main><h1>Index</h1><a href="/home">to home</a></main>' }] };
  const result = await rejectedOrApplied(siteId, code); assert.equal(result.status, 'applied'); if (result.status !== 'applied') return;
  const { GET: exportSite } = await import('../app/api/sites/[siteId]/export/route.ts');
  const bytes = new Uint8Array(await (await exportSite(new Request(`http://sitecraft.local/api/sites/${siteId}/export`), { params: Promise.resolve({ siteId }) })).arrayBuffer());
  const names = localZipEntryNames(bytes);
  assert.equal(new Set(names).size, names.length, 'ZIP 不得有重复条目');
  assert.ok(names.every(name => !name.startsWith('/') && !name.split('/').includes('..')), 'ZIP 条目不得路径穿越');
  const htmlNames = names.filter(name => name.endsWith('.html') && !name.startsWith('en/'));
  assert.equal(htmlNames.length, 2, 'home/index 必须各有一个 HTML 文件');
  assert.match(text(parseStoredZip(bytes).get('index.html')!), /href="index-2\.html"|href="index-[a-z0-9-]+\.html"/);
});

test('正文中的 data-image-id 文本不被导出属性清理误删', async () => {
  const siteId = `t171-body-${crypto.randomUUID().replaceAll('-', '').slice(0, 16)}`;
  const code = structuredClone(safeCode); code.pages[0].html = code.pages[0].html.replace(/<img\b[^>]*>/i, '').replace('</main>', '<p>正文 data-image-id="foo" 应保留</p></main>');
  const result = await rejectedOrApplied(siteId, code); assert.equal(result.status, 'applied'); if (result.status !== 'applied') return;
  const { GET: exportSite } = await import('../app/api/sites/[siteId]/export/route.ts');
  const pack = parseStoredZip(new Uint8Array(await (await exportSite(new Request(`http://sitecraft.local/api/sites/${siteId}/export`), { params: Promise.resolve({ siteId }) })).arrayBuffer()));
  await comparePublishedPages(result.site, result.version, pack);
  assert.match(text(pack.get('index.html')!), /正文 data-image-id="foo" 应保留/);
});

for (const originalName of ['.', '../../x.jpg', 'photo.jpg\nInjected: bad']) test(`图片原名 ${JSON.stringify(originalName)} 不进入路径或许可文件`, async () => {
  const siteId = `t171-name-${crypto.randomUUID().replaceAll('-', '').slice(0, 16)}`;
  const image = await saveSiteImage({ siteId, bytes: sourceImage, originalName, provenance: { attribution: '署名' } });
  const code = structuredClone(safeCode); code.pages[0].html = code.pages[0].html.replace('img_used171000000000000000', image.imageId);
  const result = await rejectedOrApplied(siteId, code); assert.equal(result.status, 'applied'); if (result.status !== 'applied') return;
  const { GET: exportSite } = await import('../app/api/sites/[siteId]/export/route.ts');
  const pack = parseStoredZip(new Uint8Array(await (await exportSite(new Request(`http://sitecraft.local/api/sites/${siteId}/export`), { params: Promise.resolve({ siteId }) })).arrayBuffer()));
  const names = [...pack.keys()]; assert.ok(names.every(name => !name.startsWith('/') && !name.split('/').includes('..')));
  assert.ok(names.some(name => name === `assets/images/${image.imageId}.jpg`));
  assert.doesNotMatch(text(pack.get('LICENSES.txt')!), /\.\.\/x\.jpg|Injected: bad/);
});

test('正文提到图片 ID 不增加图片文件和署名', async () => {
  const siteId = `t171-reference-${crypto.randomUUID().replaceAll('-', '').slice(0, 12)}`;
  const unused = await saveSiteImage({ siteId, bytes: sourceImage, provenance: { attribution: '不该带入的署名' } });
  const code = structuredClone(safeCode);
  code.pages[0].html = `<main><h1>曜石接头</h1><p>编号说明 ${unused.imageId}</p></main>`;
  const result = await rejectedOrApplied(siteId, code, `曜石接头。编号说明 ${unused.imageId}`); assert.equal(result.status, 'applied'); if (result.status !== 'applied') return;
  const { GET } = await import('../app/api/sites/[siteId]/export/route.ts');
  const response = await GET(new Request('http://sitecraft.local/'), { params: Promise.resolve({ siteId }) });
  const entries = parseStoredZip(new Uint8Array(await response.arrayBuffer()));
  assert.equal([...entries.keys()].some(name => name.startsWith('assets/images/')), false);
  assert.doesNotMatch(text(entries.get('LICENSES.txt')!), /不该带入的署名/);
});

test('导出旧图片字段只读，不迁移写回，逐文件 mtime 和大小保持不变', async () => {
  const siteId = `t171-readonly-${crypto.randomUUID().replaceAll('-', '').slice(0, 12)}`;
  const used = await saveSiteImage({ siteId, bytes: sourceImage });
  const unused = await saveSiteImage({ siteId, bytes: unusedImage });
  const code = structuredClone(safeCode); code.pages[0].html = code.pages[0].html.replace('img_used171000000000000000', used.imageId);
  const result = await rejectedOrApplied(siteId, code); assert.equal(result.status, 'applied'); if (result.status !== 'applied') return;
  const directory = path.join(process.env.SITECRAFT_DATA_ROOT!, 'uploads', process.env.DEFAULT_WORKSPACE_ID || 'demo', siteId);
  for (const image of [used, unused]) {
    const file = path.join(directory, `${image.imageId}.json`);
    const metadata = JSON.parse(await readFile(file, 'utf8')); delete metadata.usageCategory;
    await writeFile(file, JSON.stringify(metadata), 'utf8');
  }
  const before = await snapshotFiles(process.env.SITECRAFT_DATA_ROOT!, siteId);
  const { GET } = await import('../app/api/sites/[siteId]/export/route.ts');
  assert.equal((await GET(new Request('http://sitecraft.local/'), { params: Promise.resolve({ siteId }) })).status, 200);
  assert.deepEqual(await snapshotFiles(process.env.SITECRAFT_DATA_ROOT!, siteId), before);
});

test('ZIP 写入前拒绝重复和非法条目', () => {
  const data = new TextEncoder().encode('fixture');
  for (const name of ['../escape', '/absolute', 'assets/../escape', 'assets/./file', '.', 'a\\b', 'a\nfile']) {
    assert.throws(() => createStoredZip([{ name, data }]), /ZIP|条目|路径/);
  }
  assert.throws(() => createStoredZip([{ name: 'index.html', data }, { name: 'index.html', data }]), /重复/);
});

test('ZIP 拒绝尾部换行条目', () => {
  assert.throws(() => createStoredZip([{ name: 'file.html\n', data: new TextEncoder().encode('fixture') }]), /ZIP|条目|路径/);
});

test('file:// 系统图片属性选择器保持中英文各页三档可见文本和布局', async () => {
  const siteId = `t171-selector-${crypto.randomUUID().slice(0, 8)}`;
  const image = await saveSiteImage({ siteId, bytes: sourceImage, provenance: { attribution: 'Review attribution' } });
  // The reviewer's 96×72 image and hidden adjacent paragraph are independent oracles.
  const code: SiteCode = { header: '<header>Review Company</header>', footer: '<footer>Footer</footer>',
    css: 'body{margin:0;color:#111;background:#fff;font:16px/1.6 sans-serif}main{padding:24px}img[data-image-id]{width:96px;height:72px;object-fit:contain}img[data-image-id]+p{display:none}',
    pages: ['home', 'products'].map(id => ({ id, title: 'Review Company', html: `<main><h1>Review Company</h1><img data-image-id="${image.imageId}" alt="connector"><p>Hidden image appendix.</p></main>` })) };
  const result = await rejectedOrApplied(siteId, code, 'Review Company.'); assert.equal(result.status, 'applied'); if (result.status !== 'applied') return;
  const english = await commitSiteCode({ siteId, baseRevision: 1, englishCode: code, author: 'user', summary: 'English retained', request: '' });
  assert.equal(english.status, 'applied'); if (english.status !== 'applied') return;
  const response = await fetch(`${process.env.SITECRAFT_BASE}/api/sites/${siteId}/export`); assert.equal(response.status, 200);
  await comparePublishedPages(english.site, english.version, parseStoredZip(new Uint8Array(await response.arrayBuffer())));
});

test('file:// 公共 CSS 只有文件来源，修改文件后中英文各页三档实际生效', async () => {
  const siteId = `t171-css-${crypto.randomUUID().slice(0, 8)}`;
  const code: SiteCode = { header: '<header>Review Company</header>', footer: '<footer>Footer</footer>',
    css: 'body{margin:0;color:#111;background:#fff;font:16px/1.6 sans-serif}main{padding:24px}h1{color:rgb(17,17,17)}',
    pages: ['home', 'products'].map(id => ({ id, title: 'Review Company', html: '<main><h1>Review Company</h1><p>Independent review body.</p></main>' })) };
  const result = await rejectedOrApplied(siteId, code, 'Review Company.'); assert.equal(result.status, 'applied');
  const english = await commitSiteCode({ siteId, baseRevision: 1, englishCode: code, author: 'user', summary: 'English retained', request: '' });
  assert.equal(english.status, 'applied');
  const response = await fetch(`${process.env.SITECRAFT_BASE}/api/sites/${siteId}/export`); assert.equal(response.status, 200);
  const entries = parseStoredZip(new Uint8Array(await response.arrayBuffer()));
  const directory = await unpackSitePackage(entries);
  await writeFile(path.join(directory, 'styles.css'), 'h1{color:rgb(128,0,128)!important}', 'utf8');
  const browser = await codeCheckBrowser();
  const observations: Array<{ file: string; width: number; links: number; inlineSheets: number; color: string }> = [];
  try {
    for (const file of ['index.html', 'products.html', 'en/index.html', 'en/products.html']) for (const width of [1440, 768, 375]) {
      await browser.send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
      const url = pathToFileURL(path.join(directory, file)).href;
      await browser.send('Page.navigate', { url }); await waitForHttpPage(browser, url);
      const observed = await browser.evaluate<{ links: number; inlineSheets: number; color: string }>(`({links:document.querySelectorAll('link[rel="stylesheet"]').length,inlineSheets:document.querySelectorAll('style').length,color:getComputedStyle(document.querySelector('h1')).color})`);
      observations.push({ file, width, ...observed });
    }
  } finally { await browser.close(); }
  await writeFile(path.join(output, `${siteId}-common-css.json`), JSON.stringify(observations, null, 2), 'utf8');
  for (const observed of observations) {
    assert.equal(observed.color, 'rgb(128, 0, 128)', '审查者的文件修改必须真正改变离线页面颜色');
    assert.equal(observed.links, 1); assert.equal(observed.inlineSheets, 0, '不能用重复内联遮住公共文件被拦截');
  }
});

const malicious: Array<[string, (code: SiteCode) => SiteCode]> = [
  ['script', code => ({ ...structuredClone(code), pages: code.pages.map((page, index) => index ? page : { ...page, html: page.html + '<script>alert(1)</script>' }) })],
  ['event', code => ({ ...structuredClone(code), pages: code.pages.map((page, index) => index ? page : { ...page, html: page.html.replace('<h1>', '<img src="x" onerror="alert(1)"><h1>') }) })],
  ['javascript', code => ({ ...structuredClone(code), pages: code.pages.map((page, index) => index ? page : { ...page, html: page.html.replace('href="/products#spec"', 'href="javascript:alert(1)"') }) })],
  ['iframe', code => ({ ...structuredClone(code), pages: code.pages.map((page, index) => index ? page : { ...page, html: page.html + '<iframe src="https://evil.example"></iframe>' }) })],
  ['external-css', code => ({ ...structuredClone(code), css: code.css + '.hero{background-image:url("https://evil.example/x.png")}' })],
  ['svg-script', code => ({ ...structuredClone(code), pages: code.pages.map((page, index) => index ? page : { ...page, html: page.html + '<svg><script>alert(1)</script></svg>' }) })],
  ['xlink-javascript', code => ({ ...structuredClone(code), pages: code.pages.map((page, index) => index ? page : { ...page, html: page.html + '<svg><a xlink:href="javascript:alert(1)">link</a></svg>' }) })],
  ['use-external', code => ({ ...structuredClone(code), pages: code.pages.map((page, index) => index ? page : { ...page, html: page.html + '<svg><use href="https://evil.example/icon.svg#icon"></use></svg>' }) })],
  ['data-url', code => ({ ...structuredClone(code), pages: code.pages.map((page, index) => index ? page : { ...page, html: page.html + '<img src="data:image/svg+xml,<svg onload=alert(1)></svg>">' }) })],
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
    const { GET } = await import('../app/api/sites/[siteId]/export/route.ts');
    assert.equal((await GET(new Request('http://sitecraft.local/'), { params: Promise.resolve({ siteId: badId }) })).status, 422);
    const exported = await GET(new Request('http://sitecraft.local/'), { params: Promise.resolve({ siteId: goodId }) });
    assert.equal(exported.status, 200);
    for (const [name, bytes] of parseStoredZip(new Uint8Array(await exported.arrayBuffer()))) if (/\.(html|css)$/.test(name)) {
      assert.doesNotMatch(text(bytes), /<script\b|\bon[a-z]+\s*=|javascript:|<iframe\b|(?:src|href)=["'](?:https?:|data:)|url\(\s*["']?(?:https?:|data:)/i);
    }
  });
}

test('测试静态检查页夹具仍是无脚本 HTML', () => {
  assert.doesNotMatch(codeCheckDocument, /<script\b/i);
});
