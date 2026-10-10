import { renderSiteCode, englishSiteCode, type CodeSiteRecord, type CodeVersion } from './code-site.ts';
import { listSiteImages } from './site-images.ts';

// Preview and both published languages read the same immutable version and renderer.
export async function serveCodePage(site: CodeSiteRecord, version: CodeVersion | null | undefined, pageId: string, language: 'zh' | 'en', published = false) {
  if (!version) return new Response('这个页面尚未生成', { status: 404 });
  const code = language === 'en' ? englishSiteCode(site, version) : version.code;
  if (!code || !code.pages.some(page => page.id === pageId)) return new Response('这个页面尚未生成', { status: 404 });
  const used = new Set((code.header + code.footer + code.pages.map(page => page.html).join('')).match(/img_[a-z0-9]{16,40}/g));
  const credits = [...new Set((await listSiteImages(site.siteId)).filter(image => used.has(image.imageId) && image.attribution).map(image => image.attribution))];
  const prefix = `/published/${encodeURIComponent(site.siteId)}`;
  const preview = `/api/sites/${encodeURIComponent(site.siteId)}/code-preview?page=${encodeURIComponent(pageId)}&version=${encodeURIComponent(version.id)}`;
  const zhPage = version.code.pages.some(page => page.id === pageId) ? pageId : 'home';
  const enPage = version.english?.pages.some(page => page.id === pageId) ? pageId : 'home';
  return new Response(renderSiteCode(site.siteId, code, pageId, published ? '' : version.id, credits, published ? prefix + (language === 'en' ? '/en' : '') : undefined,
    { language, ...(version.english ? { languageLinks: published ? { zh: `${prefix}?page=${zhPage}`, en: `${prefix}/en?page=${enPage}` } : { zh: preview.replace(`page=${encodeURIComponent(pageId)}`, `page=${encodeURIComponent(zhPage)}`), en: `${preview.replace(`page=${encodeURIComponent(pageId)}`, `page=${encodeURIComponent(enPage)}`)}&language=en` } } : {}) }), {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store',
      'Content-Security-Policy': "sandbox allow-forms; default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src 'self'; form-action 'self'; base-uri 'none'" },
  });
}
