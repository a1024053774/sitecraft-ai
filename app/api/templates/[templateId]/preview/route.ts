import { mapPreviewUpstreamReason } from "@/lib/preview-load-timing";
import { templates } from "@/lib/site-model";
import { applyAdmittedKitFragments } from "@/lib/template-adapters/kit-fragments";
import { buildPreviewBridgeScript, getTemplateAdapter, stripHtmlScripts } from "@/lib/template-adapters";
import { previewPageSegments } from "@/lib/template-pages";
import { readTemplateStaticFile } from "@/lib/template-static";

const PREVIEW_CACHE_CONTROL = process.env.NODE_ENV === "production"
  ? "public, max-age=300, stale-while-revalidate=3600"
  : "no-store";

function escapeAttribute(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;");
}

function rewriteSrcsetValue(value: string, assetBase: string) {
  return value.replace(/(^|[\s,])(\/(?!\/|api\/templates\/)[^\s,]+)/g, (_match, lead: string, url: string) => `${lead}${assetBase}${url.slice(1)}`);
}

function rewriteLocalSnapshotHtml(html: string, assetBase: string) {
  return html
    .replace(/(\b(?:src|href|poster)=["'])\/(?!\/|api\/templates\/)/gi, `$1${assetBase}`)
    .replace(/\bsrcset=(["'])([^"']*)\1/gi, (_full, quote: string, value: string) => `srcset=${quote}${rewriteSrcsetValue(value, assetBase)}${quote}`)
    .replace(/url\(\s*(['"]?)\/(?!\/|api\/templates\/)/gi, `url($1${assetBase}`);
}

export function prepareHtml(html: string, baseUrl: string, templateId: string, local = false, editor = false) {
  const assetBase = `/api/templates/${encodeURIComponent(templateId)}/assets/`;
  const rewritten = local ? rewriteLocalSnapshotHtml(html, assetBase) : html;
  const sourceHtml = local
    ? applyAdmittedKitFragments(stripHtmlScripts(rewritten), templateId)
    : rewritten;
  const base = `<base href="${escapeAttribute(local ? assetBase : baseUrl)}">`;
  const normalized = sourceHtml
    .replace(/<meta[^>]+http-equiv=["']?content-security-policy["']?[^>]*>/gi, "")
    .replace(/<base\b[^>]*>/gi, "");
  const injection = `${base}<meta name="sitecraft-template" content="${escapeAttribute(templateId)}"><style>html{scroll-behavior:smooth}body{min-height:100vh}[class*="scroll-fade"],[class*="fade-up"],[class*="reveal"],[data-aos]{opacity:1!important;visibility:visible!important;transform:none!important}</style>`;
  const finalStateStyle = `<style>html body [class*="scroll-fade"],html body [class*="fade-up"],html body [class*="reveal"],html body [data-aos]{opacity:1!important;visibility:visible!important;transform:none!important}</style>`;
  const editorChrome = editor ? `<style>[data-sitecraft-slot]{cursor:pointer}[data-sitecraft-slot]:hover{outline:2px solid rgba(46,107,79,.45);outline-offset:3px}</style>` : "";
  const bridge = buildPreviewBridgeScript(templateId, getTemplateAdapter(templateId) ?? null);
  if (/<head\b[^>]*>/i.test(normalized)) {
    return normalized
      .replace(/<head\b([^>]*)>/i, `<head$1>${injection}${editorChrome}`)
      .replace(/<\/body\s*>/i, `${finalStateStyle}${bridge}</body>`);
  }
  return `<!doctype html><html><head>${injection}${editorChrome}</head><body>${normalized}${finalStateStyle}${bridge}</body></html>`;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ templateId: string }> },
) {
  const { templateId } = await params;
  const template = templates.find((item) => item.id === templateId);
  if (!template) return new Response("Template not found", { status: 404 });

  const requestedPath = new URL(request.url).searchParams.get("pagePath") ?? "";
  const segments = previewPageSegments(requestedPath);
  if (segments === null) {
    return new Response("Invalid template page path", { status: 400 });
  }
  const editor = new URL(request.url).searchParams.get("editor") === "1";
  const pageSegments = segments.length ? segments : ["index.html"];
  const localPage = await readTemplateStaticFile(template.id, pageSegments);
  if (requestedPath && !localPage) {
    return new Response("Template page not found", {
      status: 404,
      headers: { "X-Sitecraft-Preview-Page": requestedPath, "X-Sitecraft-Preview-Source": "missing-snapshot-page" },
    });
  }
  const localIndex = localPage;
  if (localIndex) {
    const html = prepareHtml(localIndex.body.toString("utf8"), template.source.demoUrl, template.id, true, editor);
    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": PREVIEW_CACHE_CONTROL,
        "Content-Security-Policy": `default-src 'none'; base-uri 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https:; img-src 'self' https: data: blob:; font-src 'self' https: data:; media-src 'self' https: data: blob:; connect-src 'none'; form-action 'none'; frame-ancestors 'self';`,
        "Referrer-Policy": "no-referrer",
        "X-Content-Type-Options": "nosniff",
        "X-Sitecraft-Preview-Source": "local-open-source-snapshot",
        "X-Sitecraft-Preview-Page": requestedPath || "index",
      },
    });
  }
  if (requestedPath) {
    return new Response("Template page not found", { status: 404 });
  }

  try {
    const response = await fetch(template.source.demoUrl, {
      headers: { "User-Agent": "Sitecraft-Template-Preview/1.0" },
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
      next: { revalidate: 3600 },
    });
    if (!response.ok) throw new Error(`upstream status ${response.status}`);
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) throw new Error("upstream did not return HTML");
    const html = prepareHtml(await response.text(), response.url, template.id, false, editor);
    const demoOrigin = new URL(response.url).origin;
    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": PREVIEW_CACHE_CONTROL,
        "Content-Security-Policy": `default-src 'none'; base-uri ${demoOrigin}; script-src https: 'unsafe-inline'; style-src * 'unsafe-inline'; img-src * data: blob:; font-src * data:; media-src * data: blob:; connect-src https:; form-action 'none'; frame-ancestors 'self';`,
        "Referrer-Policy": "no-referrer",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const raw = error instanceof Error ? error.message : "unknown upstream error";
    const message = mapPreviewUpstreamReason(raw);
    if (template.id === "yukina") {
      const fallbackHtml = `<!doctype html><html lang="zh"><head><meta name="viewport" content="width=device-width"><style>*{box-sizing:border-box}body{margin:0;background:#f4f5f3;font:14px system-ui;color:#263238}.note{padding:10px 16px;background:#263238;color:white;text-align:center}.preview{display:block;width:100%;height:auto}</style></head><body><div class="note">Yukina 官方 README 预览 · 上游内容集合缺失，暂用官方全页预览图</div><main><section><h1>企业内容与品牌故事</h1><p>当前模板使用官方预览图，结构化内容仍会保存并回报可用槽位。</p></section><img class="preview" src="https://s2.loli.net/2025/01/26/S4URrsj9TFgOKAp.webp" alt="Yukina template official preview"></main></body></html>`;
      return new Response(
        prepareHtml(fallbackHtml, template.source.demoUrl, template.id, false, editor),
        { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": PREVIEW_CACHE_CONTROL } },
      );
    }
    const reason = JSON.stringify(message);
    return new Response(
      `<!doctype html><html lang="zh"><body style="font:14px system-ui;padding:40px;color:#33413a;background:#f4f7f4"><h1>模板预览暂时无法加载</h1><p>${escapeAttribute(message)}</p><script>parent.postMessage({ type: "sitecraft:error", reason: ${reason} }, "*");</script></body></html>`,
      { status: 502, headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  }
}
