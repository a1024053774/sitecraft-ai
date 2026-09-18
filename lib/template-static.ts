import { readFileSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { getTemplate } from "@/lib/site-model";

const contentTypes: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".avif": "image/avif",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".xml": "application/xml; charset=utf-8",
};

const EMPTY_MOUNT = /<(?:div|main)([^>]*\bid=["'](?:root|app|__next)["'][^>]*)>(\s*)<\/(?:div|main)>/i;

export function isSpaShellHtml(html: string) {
  const withoutComments = html.replace(/<!--[\s\S]*?-->/g, "");
  const withoutAssets = withoutComments
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<link\b[^>]*>/gi, "")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, "");
  const bodyMatch = withoutAssets.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  const body = bodyMatch ? bodyMatch[1] : withoutAssets;
  const text = body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const hasHeading = /<h[1-6]\b[^>]*>\s*\S/i.test(body);
  if (hasHeading && text.length >= 20) return false;
  if (EMPTY_MOUNT.test(body) && text.length < 80) return true;
  return text.length < 40 && /<(?:div|main)[^>]*id=["'](?:root|app|__next)["']/i.test(body);
}

export function isUsableStaticHtml(html: string) {
  if (!/<(?:!doctype\s+html|html\b)/i.test(html)) return false;
  if (isSpaShellHtml(html)) return false;
  const withoutComments = html.replace(/<!--[\s\S]*?-->/g, "");
  const withoutAssets = withoutComments
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<link\b[^>]*>/gi, "")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, "")
    .replace(/<title\b[^>]*>[\s\S]*?<\/title>/gi, "");
  const bodyMatch = withoutAssets.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  const body = bodyMatch ? bodyMatch[1] : withoutAssets;
  const text = body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return text.length >= 40;
}

function readIndexHtml(root: string) {
  try {
    return readFileSync(path.join(root, "index.html"), "utf8");
  } catch {
    return null;
  }
}

export function getTemplateStaticRoot(templateId: string) {
  const template = getTemplate(templateId);
  if (template.id !== templateId) return null;
  const sourceRoot = path.resolve(/* turbopackIgnore: true */ process.cwd(), template.source.localPath);
  for (const root of [path.join(sourceRoot, "dist"), path.join(sourceRoot, "out"), sourceRoot]) {
    const html = readIndexHtml(root);
    if (html && isUsableStaticHtml(html)) return root;
  }
  return null;
}

export const LANDWIND_HOST_OVERLAY_PATH = "lib/template-adapters/overlays/landwind.index.html";

function landwindHostOverlayFile() {
  return path.resolve(/* turbopackIgnore: true */ process.cwd(), LANDWIND_HOST_OVERLAY_PATH);
}

export async function readTemplateStaticFile(templateId: string, segments: string[]) {
  const root = getTemplateStaticRoot(templateId);
  if (!root) return null;
  const candidate = path.resolve(root, ...segments);
  if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) return null;
  let target = candidate;
  try {
    const details = await stat(/* turbopackIgnore: true */ target);
    if (details.isDirectory()) target = path.join(target, "index.html");
    if (templateId === "landwind" && path.basename(target) === "index.html") {
      target = landwindHostOverlayFile();
    }
    const body = await readFile(/* turbopackIgnore: true */ target);
    return { body, contentType: contentTypes[path.extname(target).toLowerCase()] ?? "application/octet-stream" };
  } catch {
    return null;
  }
}
