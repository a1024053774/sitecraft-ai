import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { registerHooks } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { codeCheckBrowser } from '../lib/code-site-browser.ts';
import { commitSiteCode, createCodeSite, updateCodeSite } from '../lib/code-site-store.ts';
import { saveSiteImage } from '../lib/site-images.ts';
import { factAuditPayload, factAuditReply } from './fixtures/fact-audit-reply.ts';
import type { SiteCode } from '../lib/code-site.ts';

registerHooks({ resolve(specifier, context, next) {
  if (!specifier.startsWith('@/')) return next(specifier, context);
  const file = path.join(process.cwd(), specifier.slice(2));
  return next(pathToFileURL(existsSync(`${file}.ts`) ? `${file}.ts` : file).href, context);
} });

function parseStoredZip(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const decoder = new TextDecoder();
  const entries = new Map<string, Uint8Array>();
  let offset = 0;
  while (offset + 4 <= bytes.length && view.getUint32(offset, true) === 0x04034b50) {
    const method = view.getUint16(offset + 8, true);
    const size = view.getUint32(offset + 18, true);
    const nameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    assert.equal(method, 0, 'Expected stored ZIP entry');
    const name = decoder.decode(bytes.slice(offset + 30, offset + 30 + nameLength));
    const bodyStart = offset + 30 + nameLength + extraLength;
    entries.set(name, bytes.slice(bodyStart, bodyStart + size));
    offset = bodyStart + size;
  }
  assert.ok(entries.size > 0, 'Exported package must contain entries');
  return entries;
}

async function waitForPage(browser: Awaited<ReturnType<typeof codeCheckBrowser>>, url: string) {
  for (let attempt = 0; attempt < 120; attempt++) {
    const ready = await browser.evaluate<boolean>(
      `document.readyState==='complete' && location.href===${JSON.stringify(url)} && !!document.querySelector('details.sc-image-credits > summary') && [...document.images].every(img=>img.complete && img.naturalWidth>0)`
    );
    if (ready) return;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error(`Timed out loading ${url}`);
}

type CreditsObservation = {
  text: string;
  structure: string[];
  box: [number, number];
  styles: {
    detailsBg: number[];
    detailsRadius: string;
    detailsClip: string;
    detailsOpacity: number;
    summaryFg: number[];
    summaryBg: number[];
    markerFg: number[];
    paragraphFg: number[];
    paragraphBg: number[];
  };
  ratios: {
    summary: number;
    marker: number;
    paragraph: number | null;
  };
};

async function measureCreditsInBrowser(
  browser: Awaited<ReturnType<typeof codeCheckBrowser>>,
  openDetails: boolean
): Promise<CreditsObservation> {
  return browser.evaluate<CreditsObservation>(`(() => {
    const details = document.querySelector('details.sc-image-credits');
    if (!details) throw new Error('Missing details.sc-image-credits');
    const isOpen = ${JSON.stringify(openDetails)};
    details.open = isOpen;
    const summary = details.querySelector(':scope > summary');
    const paragraph = details.querySelector(':scope > p');
    if (!summary) throw new Error('Missing summary');

    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const parseRgba = (cssColor) => {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = cssColor;
      ctx.fillRect(0, 0, 1, 1);
      const d = ctx.getImageData(0, 0, 1, 1).data;
      return [d[0], d[1], d[2], Math.round((d[3] / 255) * 1000) / 1000];
    };
    const composite = (fg, bg) => {
      const a = fg[3] + bg[3] * (1 - fg[3]);
      if (a <= 0) return [0, 0, 0, 0];
      return [0, 1, 2].map(i => (fg[i] * fg[3] + bg[i] * bg[3] * (1 - fg[3])) / a).concat(a);
    };
    const lum = (rgb) => rgb.slice(0, 3).map(v => {
      const s = v / 255;
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    }).reduce((acc, c, i) => acc + c * [0.2126, 0.7152, 0.0722][i], 0);
    const contrast = (fg, bg) => {
      const painted = composite(fg, bg);
      const l1 = lum(painted), l2 = lum(bg);
      return Math.round(((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)) * 100) / 100;
    };

    const ds = getComputedStyle(details);
    const ss = getComputedStyle(summary);
    const ms = getComputedStyle(summary, '::marker');
    const ps = paragraph ? getComputedStyle(paragraph) : null;

    const bodyBg = composite(parseRgba(getComputedStyle(document.body).backgroundColor), [255, 255, 255, 1]);
    const detailsOpacity = Number.parseFloat(ds.opacity);
    const rawDetailsBg = parseRgba(ds.backgroundColor);
    const effectiveDetailsBg = composite([rawDetailsBg[0], rawDetailsBg[1], rawDetailsBg[2], rawDetailsBg[3] * detailsOpacity], bodyBg);

    const summaryBg = composite(parseRgba(ss.backgroundColor), effectiveDetailsBg);
    const summaryFg = parseRgba(ss.webkitTextFillColor || ss.color);
    summaryFg[3] *= detailsOpacity * Number.parseFloat(ss.opacity);

    const markerFg = parseRgba(ms.webkitTextFillColor || ms.color);
    markerFg[3] *= detailsOpacity * Number.parseFloat(ss.opacity);

    let paragraphRatio = null;
    let paragraphFg = [0, 0, 0, 0];
    let paragraphBg = [0, 0, 0, 0];
    if (isOpen && paragraph && ps) {
      paragraphBg = composite(parseRgba(ps.backgroundColor), effectiveDetailsBg);
      paragraphFg = parseRgba(ps.webkitTextFillColor || ps.color);
      paragraphFg[3] *= detailsOpacity * Number.parseFloat(ps.opacity);
      paragraphRatio = contrast(paragraphFg, paragraphBg);
    }

    const r = details.getBoundingClientRect();
    return {
      text: (details.innerText || '').replace(/\\s+/g, ' ').trim(),
      structure: [details, ...details.querySelectorAll('*')].map(n => n.tagName.toLowerCase() + '[' + n.children.length + ']'),
      box: [Math.round(r.width * 100) / 100, Math.round(r.height * 100) / 100],
      styles: {
        detailsBg: effectiveDetailsBg.map(v => Math.round(v * 100) / 100),
        detailsRadius: ds.borderRadius,
        detailsClip: ds.backgroundClip,
        detailsOpacity,
        summaryFg: summaryFg.map(v => Math.round(v * 100) / 100),
        summaryBg: summaryBg.map(v => Math.round(v * 100) / 100),
        markerFg: markerFg.map(v => Math.round(v * 100) / 100),
        paragraphFg: paragraphFg.map(v => Math.round(v * 100) / 100),
        paragraphBg: paragraphBg.map(v => Math.round(v * 100) / 100),
      },
      ratios: {
        summary: contrast(summaryFg, summaryBg),
        marker: contrast(markerFg, summaryBg),
        paragraph: paragraphRatio,
      },
    };
  })()`);
}

test('T-236: minimal global ::marker { color: <low-contrast> } keeps .sc-image-credits >= 4.5 contrast and passes commit gate', async () => {
  const siteId = `t236-min-${crypto.randomUUID().replaceAll('-', '').slice(0, 14)}`;
  const imageBytes = await readFile('tests/fixtures/company-images/packaging/product-corrugated-boxes.jpg');
  const uploaded = await saveSiteImage({
    siteId,
    bytes: imageBytes,
    originalName: 'corrugated-boxes.jpg',
    provenance: { attribution: 'Minimal marker test attribution — CC BY-SA 4.0.' },
  });
  const code: SiteCode = {
    header: '<header><a href="/home">青禾纸包装</a></header>',
    footer: '<footer>青禾纸包装</footer>',
    css: 'body{margin:0;background:#111317;color:#f1f4f8;font:16px/1.6 sans-serif}header a{color:#f1f4f8}main{padding:24px}::marker{color:#b3c486}img{width:200px;height:140px;object-fit:contain}',
    pages: [{
      id: 'home',
      title: '青禾纸包装',
      html: `<main><h1>青禾纸包装</h1><p>折叠彩盒打样。</p><img data-image-id="${uploaded.imageId}" alt="瓦楞纸盒"></main>`,
    }],
  };
  const provider = createServer(async (req, res) => {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    const body = JSON.parse(raw);
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(factAuditPayload(body, {
      choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(factAuditReply(body, { issues: [] })) } }],
    })));
  });
  await new Promise<void>(resolve => provider.listen(0, '127.0.0.1', resolve));
  const savedEnv = Object.fromEntries(['DEEPSEEK_BASE_URL', 'DEEPSEEK_API_KEY', 'DEEPSEEK_MODEL', 'AI_PROVIDER_FORMAT', 'AI_BASE_URL', 'AI_API_KEY', 'AI_MODEL'].map(k => [k, process.env[k]]));
  process.env.AI_PROVIDER_FORMAT = 'deepseek';
  delete process.env.AI_BASE_URL;
  delete process.env.AI_API_KEY;
  delete process.env.AI_MODEL;
  process.env.DEEPSEEK_BASE_URL = `http://127.0.0.1:${(provider.address() as { port: number }).port}`;
  process.env.DEEPSEEK_API_KEY = 't236-local-fixture';
  process.env.DEEPSEEK_MODEL = 't236-local-fixture';
  try {
    await createCodeSite(siteId, '青禾纸包装', 't236-min-conv');
    await updateCodeSite(siteId, () => ({ materials: '公司名：青禾纸包装\n折叠彩盒打样。' }));
    const committed = await commitSiteCode({ siteId, baseRevision: 0, code, author: 'assistant', summary: '初版', request: '生成首页' });
    assert.equal(committed.status, 'applied', committed.status === 'rejected' ? committed.checks.issues.join('；') : '必须通过提交入口');
  } finally {
    for (const [k, v] of Object.entries(savedEnv)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    await new Promise<void>(resolve => provider.close(() => resolve()));
  }
});

test('T-236: .sc-image-credits resists low-contrast ::marker and dark element overrides with >= 4.5 contrast and identical rendering across preview, published and T-171 package', async () => {
  const siteId = `t236-${crypto.randomUUID().replaceAll('-', '').slice(0, 16)}`;
  const imageBytes = await readFile('tests/fixtures/company-images/packaging/product-corrugated-boxes.jpg');
  const uploaded = await saveSiteImage({
    siteId,
    bytes: imageBytes,
    originalName: 'corrugated-boxes.jpg',
    provenance: { attribution: 'Corrugated boxes fixture — CC BY-SA 4.0; independent T-236 attribution line.' },
  });

  // Site CSS deliberately sets low-contrast ::marker (#b3c486 -> 1.88:1 on #fff) and dark/rounded/translucent
  // overrides on details, summary and p, while keeping <header>/<main>/<footer> high-contrast darkroom blocks.
  const zhCode: SiteCode = {
    header: '<header class="site-head"><a href="/home">青禾纸包装</a><nav><a href="/home">首页</a><a href="/products">包装产品</a></nav></header>',
    footer: '<footer class="site-foot">青禾纸包装 · 模拟资料验证</footer>',
    css: [
      'body{margin:0;background:#111317;color:#f1f4f8;font:16px/1.6 sans-serif}',
      '::marker,summary::marker,details summary::marker{color:#b3c486!important;-webkit-text-fill-color:#b3c486!important}',
      'details,summary,p,details p{background:#1b1f26;color:#cbd5e1;-webkit-text-fill-color:#cbd5e1;border-radius:12px;padding:0;opacity:0.55;list-style-position:outside}',
      '.site-head,.site-foot,.dark-main{background:#111317;color:#f1f4f8;padding:24px}',
      '.site-head a{color:#f1f4f8;margin-right:16px}',
      '.dark-main h1,.dark-main p,.dark-main li{background:transparent;color:#f1f4f8;-webkit-text-fill-color:#f1f4f8;border-radius:0;padding:0;opacity:1}',
      '.dark-main ul{border-radius:0;background-clip:border-box;padding-left:24px}',
      '.dark-main li{list-style-position:outside}',
      '.dark-main li::marker{color:#e0b86b!important;-webkit-text-fill-color:#e0b86b!important}',
      '.specimen-photo{display:block;width:240px;height:160px;object-fit:contain}',
    ].join('\n'),
    pages: [
      {
        id: 'home',
        title: '青禾纸包装',
        html: `<main class="dark-main"><h1>青禾纸包装</h1><p>折叠彩盒与瓦楞运输盒结构打样。</p><ul><li>白样确认结构与装载</li></ul><img class="specimen-photo" data-image-id="${uploaded.imageId}" alt="瓦楞运输盒配图"></main>`,
      },
      {
        id: 'products',
        title: '包装产品',
        html: `<main class="dark-main"><h1>包装产品</h1><p>按实物尺寸核对盒型。</p><img class="specimen-photo" data-image-id="${uploaded.imageId}" alt="纸盒配图"></main>`,
      },
    ],
  };

  const enCode: SiteCode = {
    ...structuredClone(zhCode),
    header: '<header class="site-head"><a href="/home">Qinghe Packaging</a><nav><a href="/home">Home</a><a href="/products">Products</a></nav></header>',
    footer: '<footer class="site-foot">Qinghe Packaging · Simulated fixture</footer>',
    pages: [
      {
        id: 'home',
        title: 'Qinghe Packaging',
        html: `<main class="dark-main"><h1>Qinghe Packaging</h1><p>Structural sampling for folding cartons and corrugated boxes.</p><ul><li>White sample confirms structure and fit</li></ul><img class="specimen-photo" data-image-id="${uploaded.imageId}" alt="Corrugated boxes reference"></main>`,
      },
      {
        id: 'products',
        title: 'Products',
        html: `<main class="dark-main"><h1>Products</h1><p>Box structure checked against physical dimensions.</p><img class="specimen-photo" data-image-id="${uploaded.imageId}" alt="Carton reference"></main>`,
      },
    ],
  };

  const provider = createServer(async (req, res) => {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    const body = JSON.parse(raw);
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(factAuditPayload(body, {
      choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(factAuditReply(body, { issues: [] })) } }],
    })));
  });
  await new Promise<void>(resolve => provider.listen(0, '127.0.0.1', resolve));
  const savedEnv = Object.fromEntries(['DEEPSEEK_BASE_URL', 'DEEPSEEK_API_KEY', 'DEEPSEEK_MODEL', 'AI_PROVIDER_FORMAT', 'AI_BASE_URL', 'AI_API_KEY', 'AI_MODEL'].map(k => [k, process.env[k]]));
  process.env.AI_PROVIDER_FORMAT = 'deepseek';
  delete process.env.AI_BASE_URL;
  delete process.env.AI_API_KEY;
  delete process.env.AI_MODEL;
  process.env.DEEPSEEK_BASE_URL = `http://127.0.0.1:${(provider.address() as { port: number }).port}`;
  process.env.DEEPSEEK_API_KEY = 't236-local-fixture';
  process.env.DEEPSEEK_MODEL = 't236-local-fixture';

  let versionId = '';
  try {
    await createCodeSite(siteId, '青禾纸包装', 't236-conv');
    await updateCodeSite(siteId, () => ({
      materials: '公司名：青禾纸包装\n英文名：Qinghe Packaging\n折叠彩盒与瓦楞运输盒结构打样。白样确认结构与装载。按实物尺寸核对盒型。模拟资料验证。',
    }));
    const zhCommit = await commitSiteCode({
      siteId,
      baseRevision: 0,
      code: zhCode,
      author: 'assistant',
      summary: '初版生成',
      request: '生成首页与包装产品页',
    });
    assert.equal(
      zhCommit.status,
      'applied',
      zhCommit.status === 'rejected' ? `真实提交入口拒收：${zhCommit.checks.issues.join('；')}` : '初版必须通过真实提交入口'
    );
    if (zhCommit.status !== 'applied') return;
    for (const vp of zhCommit.version.checks.viewports) {
      assert.equal(vp.contrastIssues, 0, `${vp.pageId}/${vp.width} 不得有对比度问题`);
    }

    const enCommit = await commitSiteCode({
      siteId,
      baseRevision: zhCommit.version.revision,
      englishCode: enCode,
      author: 'assistant',
      summary: '英文版',
      request: '',
    });
    assert.equal(
      enCommit.status,
      'applied',
      enCommit.status === 'rejected' ? `英文提交拒收：${enCommit.checks.issues.join('；')}` : '英文版必须通过真实提交入口'
    );
    if (enCommit.status !== 'applied') return;
    versionId = enCommit.version.id;
  } finally {
    for (const [k, v] of Object.entries(savedEnv)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    await new Promise<void>(resolve => provider.close(() => resolve()));
  }

  const exportRes = await fetch(`${process.env.SITECRAFT_BASE}/api/sites/${siteId}/export`);
  assert.equal(exportRes.status, 200, 'T-171 站点包导出必须返回 200');
  const zipEntries = parseStoredZip(new Uint8Array(await exportRes.arrayBuffer()));
  const unpackedDir = await mkdtemp(path.join(tmpdir(), 'sitecraft-t236-export-'));
  for (const [name, bytes] of zipEntries) {
    const target = path.join(unpackedDir, name);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, bytes);
  }

  const browser = await codeCheckBrowser();
  const artifactDir = path.resolve('artifacts/t236');
  await mkdir(artifactDir, { recursive: true });
  const records: Array<Record<string, unknown>> = [];
  try {
    for (const language of ['zh', 'en'] as const) {
      for (const pageId of ['home', 'products'] as const) {
        const exportedFile = (language === 'en' ? 'en/' : '') + (pageId === 'home' ? 'index.html' : `${pageId}.html`);
        const previewUrl = `${process.env.SITECRAFT_BASE}/api/sites/${siteId}/code-preview?page=${pageId}&version=${versionId}${language === 'en' ? '&language=en' : ''}`;
        const publishedUrl = `${process.env.SITECRAFT_BASE}/published/${siteId}${language === 'en' ? '/en' : ''}?page=${pageId}`;
        const packageUrl = pathToFileURL(path.join(unpackedDir, exportedFile)).href;

        for (const width of [1440, 768, 375]) {
          await browser.send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
          for (const openState of [false, true]) {
            const byRoute: Record<string, CreditsObservation> = {};
            for (const [routeName, url] of [['preview', previewUrl], ['published', publishedUrl], ['package', packageUrl]] as const) {
              await browser.send('Page.navigate', { url });
              await waitForPage(browser, url);
              byRoute[routeName] = await measureCreditsInBrowser(browser, openState);
              assert.ok(
                byRoute[routeName].ratios.summary >= 4.5,
                `${routeName} ${language}/${pageId}/${width} open=${openState}: summary contrast ${byRoute[routeName].ratios.summary} < 4.5`
              );
              assert.ok(
                byRoute[routeName].ratios.marker >= 4.5,
                `${routeName} ${language}/${pageId}/${width} open=${openState}: summary::marker contrast ${byRoute[routeName].ratios.marker} < 4.5`
              );
              if (openState) {
                assert.ok(
                  (byRoute[routeName].ratios.paragraph ?? 0) >= 4.5,
                  `${routeName} ${language}/${pageId}/${width} open=true: credit paragraph contrast ${byRoute[routeName].ratios.paragraph} < 4.5`
                );
              }
            }
            assert.deepEqual(
              byRoute.published,
              byRoute.preview,
              `${language}/${pageId}/${width} open=${openState}: published 与 preview 的 .sc-image-credits 渲染结果必须一致`
            );
            assert.deepEqual(
              byRoute.package,
              byRoute.published,
              `${language}/${pageId}/${width} open=${openState}: T-171 站点包与 published 的 .sc-image-credits 渲染结果必须一致`
            );
            records.push({ language, pageId, width, openState, observation: byRoute.preview });
          }
        }
      }
    }
  } finally {
    await browser.close();
  }
  await writeFile(path.join(artifactDir, 'three-way-credits-parity.json'), JSON.stringify(records, null, 2), 'utf8');
});
