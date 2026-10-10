import assert from 'node:assert/strict';
import test from 'node:test';
import { renderSiteCode, type SiteCode } from '../lib/code-site.ts';
import { checkSiteCode } from '../lib/code-site-check.ts';

// Merge risks: language controls overwrite backdrop CSS/licensing, or the
// backdrop scanner replaces source-English fidelity and pseudo-text pairing.
const siteId = 't151-backdrop-merge', materials = '提供询盘入口。尺寸待补充。';
const source: SiteCode = { header: '<header><a href="/home">首页</a></header>', footer: '',
  css: 'body{margin:0;background:#fff;color:#111;font:16px/1.7 sans-serif}header,main,footer{padding:24px}h1{font-size:28px}.hero{padding:24px;background-color:#222;color:#20262a}',
  pages: [{ id: 'home', title: '首页', html: '<main><h1>精密加工</h1><section class="hero" data-system-backdrop="bd_grid_precision-steel"><p>尺寸待补充。</p></section><div data-system-inquiry=""></div></main>' }] };
const translate = (code: SiteCode): SiteCode => ({ ...code,
  header: code.header.replace('首页', 'Home'),
  pages: code.pages.map(page => ({ ...page, title: 'Home', html: page.html.replace('精密加工', 'Precision machining').replace('尺寸待补充。', 'Dimensions: To be provided.') })) });

test('merged renderer preserves English controls and all three backdrop assets and licensing', () => {
  const html = renderSiteCode(siteId, translate(source), 'home', '', ['用户提供；仅当前站点使用'], undefined,
    { language: 'en', languageLinks: { zh: `/published/${siteId}`, en: `/published/${siteId}/en` } });
  assert.match(html, /^<!doctype html><html lang="en">/);
  assert.match(html, /language=en/);
  assert.match(html, /aria-current="page">English/);
  assert.match(html, /Send inquiry/);
  assert.match(html, /Image sources and licenses/);
  assert.match(html, /User supplied; for this site only/);
  for (const width of [1440, 768, 375]) assert.ok(html.includes(`/system-backdrops/bd_grid_precision-steel--${width}.webp`));
  assert.match(html, /Abstract backdrops generated offline/);
  assert.match(html, /Not product, equipment, or facility photographs/);
  assert.match(html, /Shader Effects Inc\./);
  assert.match(html, /MIT License/);
  assert.doesNotMatch(html, /<script\b|webgpu|抽象底图|发送询盘/);
});

let checkedSource: SiteCode;
test.before(async () => {
  const result = await checkSiteCode({ siteId, code: source, materials, images: [], legacyImport: true });
  assert.equal(result.checks.passed, true, result.checks.issues.join('\n'));
  checkedSource = result.code;
});
test('English submission checks keep registered backdrops and source fidelity together', async () => {
  const good = translate(checkedSource);
  const result = await checkSiteCode({ siteId, code: good, translationSource: checkedSource, materials, images: [] });
  assert.equal(result.checks.passed, true, result.checks.issues.join('\n'));
  assert.deepEqual(result.checks.viewports.map(v => [v.width, v.overflow, v.overlaps, v.contrastIssues]), [[375, 0, 0, 0], [768, 0, 0, 0], [1440, 0, 0, 0]]);
  const wrong = structuredClone(good); wrong.pages[0].html = wrong.pages[0].html.replace('Dimensions:', 'Dimensions 100 mm:');
  const refused = await checkSiteCode({ siteId, code: wrong, translationSource: checkedSource, materials, images: [] });
  assert.equal(refused.checks.passed, false);
  assert.match(refused.checks.issues.join('\n'), /保真/);
});
test('English contrast uses the actual light backdrop instead of a dark CSS fallback', async () => {
  const badSource = { ...checkedSource, css: checkedSource.css + '\n.hero{color:#fff}' };
  const normalized = await checkSiteCode({ siteId, code: badSource, materials, images: [], legacyImport: true });
  const refused = await checkSiteCode({ siteId, code: translate(normalized.code), translationSource: normalized.code, materials, images: [] });
  assert.equal(refused.checks.passed, false);
  assert.match(refused.checks.issues.join('\n'), /对比度/);
});
