import { templates } from "@/lib/site-model";
import { buildPreviewBridgeScript, getTemplateAdapter, stripHtmlScripts } from "@/lib/template-adapters";
import { readTemplateStaticFile } from "@/lib/template-static";

function escapeAttribute(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;");
}

function prepareHtml(html: string, baseUrl: string, templateId: string, local = false) {
  const assetBase = `/api/templates/${encodeURIComponent(templateId)}/assets/`;
  const rewritten = local
    ? html
        .replace(/(\b(?:src|href|poster)=["'])\/(?!\/)/gi, `$1${assetBase}`)
        .replace(/(\bsrcset=["'][^"']*)\/(?!\/)/gi, `$1${assetBase}`)
    : html;
  const sourceHtml = local ? stripHtmlScripts(rewritten) : rewritten;
  const base = `<base href="${escapeAttribute(local ? assetBase : baseUrl)}">`;
  const normalized = sourceHtml
    .replace(/<meta[^>]+http-equiv=["']?content-security-policy["']?[^>]*>/gi, "")
    .replace(/<base\b[^>]*>/gi, "");
  const injection = `${base}<meta name="sitecraft-template" content="${escapeAttribute(templateId)}"><style>html{scroll-behavior:smooth}body{min-height:100vh}[class*="scroll-fade"],[class*="fade-up"],[class*="reveal"],[data-aos]{opacity:1!important;visibility:visible!important;transform:none!important}[data-sitecraft-slot]{cursor:pointer}[data-sitecraft-slot]:hover{outline:2px solid rgba(46,107,79,.45);outline-offset:3px}</style>`;
  const finalStateStyle = `<style>html body [class*="scroll-fade"],html body [class*="fade-up"],html body [class*="reveal"],html body [data-aos]{opacity:1!important;visibility:visible!important;transform:none!important}</style>`;
  const bridge = buildPreviewBridgeScript(templateId, getTemplateAdapter(templateId) ?? null);
  if (/<head\b[^>]*>/i.test(normalized)) {
    return normalized
      .replace(/<head\b([^>]*)>/i, `<head$1>${injection}`)
      .replace(/<\/body\s*>/i, `${finalStateStyle}${bridge}</body>`);
  }
  return `<!doctype html><html><head>${injection}</head><body>${normalized}${finalStateStyle}${bridge}</body></html>`;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ templateId: string }> },
) {
  const { templateId } = await params;
  const template = templates.find((item) => item.id === templateId);
  if (!template) return new Response("Template not found", { status: 404 });

  const localIndex = await readTemplateStaticFile(template.id, ["index.html"]);
  if (localIndex) {
    const html = prepareHtml(localIndex.body.toString("utf8"), template.source.demoUrl, template.id, true);
    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=300",
        "Content-Security-Policy": `default-src 'none'; base-uri 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https:; img-src 'self' https: data: blob:; font-src 'self' https: data:; media-src 'self' https: data: blob:; connect-src 'none'; form-action 'none'; frame-ancestors 'self';`,
        "Referrer-Policy": "no-referrer",
        "X-Content-Type-Options": "nosniff",
        "X-Sitecraft-Preview-Source": "local-open-source-snapshot",
      },
    });
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
    const html = prepareHtml(await response.text(), response.url, template.id);
    const demoOrigin = new URL(response.url).origin;
    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
        "Content-Security-Policy": `default-src 'none'; base-uri ${demoOrigin}; script-src https: 'unsafe-inline'; style-src * 'unsafe-inline'; img-src * data: blob:; font-src * data:; media-src * data: blob:; connect-src https:; form-action 'none'; frame-ancestors 'self';`,
        "Referrer-Policy": "no-referrer",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown upstream error";
    if (template.id === "yukina") {
      const fallbackHtml = `<!doctype html><html lang="zh"><head><meta name="viewport" content="width=device-width"><style>*{box-sizing:border-box}body{margin:0;background:#f4f5f3;font:14px system-ui;color:#263238}.note{padding:10px 16px;background:#263238;color:white;text-align:center}.preview{display:block;width:100%;height:auto}</style></head><body><div class="note">Yukina 官方 README 预览 · 上游内容集合缺失，暂用官方全页预览图</div><main><section><h1>企业内容与品牌故事</h1><p>当前模板使用官方预览图，结构化内容仍会保存并回报可用槽位。</p></section><img class="preview" src="https://s2.loli.net/2025/01/26/S4URrsj9TFgOKAp.webp" alt="Yukina template official preview"></main></body></html>`;
      return new Response(
        prepareHtml(fallbackHtml, template.source.demoUrl, template.id),
        { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=300" } },
      );
    }
    return new Response(
      `<!doctype html><html lang="zh"><body style="font:14px system-ui;padding:40px;color:#33413a;background:#f4f7f4"><h1>模板预览暂时无法加载</h1><p>${message}</p><p>源码已经保存在本地模板库中，请稍后重试官方演示。</p></body></html>`,
      { status: 502, headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  }
}
