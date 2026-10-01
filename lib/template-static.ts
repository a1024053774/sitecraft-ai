import { readFileSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { composedPageForTemplate } from "@/lib/blocks/compose";
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

// Snapshots built for a public base path (Astro `base`) keep that prefix in
// HTML. The files themselves sit at the snapshot root, and the preview frame
// asks for them through the asset route.
const SNAPSHOT_PUBLIC_BASE: Record<string, string> = {
  powerai: "astro-genai-startup-theme",
};

function assetRoutePrefix(templateId: string) {
  return `/api/templates/${encodeURIComponent(templateId)}/assets/`;
}

function rewriteSnapshotCssUrls(css: string, templateId: string) {
  const prefix = assetRoutePrefix(templateId);
  return css.replace(/url\(\s*(['"]?)\/(?!\/|api\/templates\/)/g, `url($1${prefix}`);
}

function ensureLocalStylesheetCrossorigin(html: string) {
  return html.replace(/<link\b[^>]*>/gi, (tag) => {
    if (!/\brel=["'][^"']*\bstylesheet\b/i.test(tag)) return tag;
    if (/\bcrossorigin\b/i.test(tag)) return tag;
    const href = tag.match(/\bhref=["']([^"']+)["']/i)?.[1] ?? "";
    if (/^(?:https?:)?\/\//i.test(href)) return tag;
    return tag.replace(/^<link\b/i, '<link crossorigin="anonymous"');
  });
}

function containedSnapshotPath(root: string, segments: string[]) {
  const candidate = path.resolve(root, ...segments);
  if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) return null;
  return candidate;
}

async function existingSnapshotTarget(root: string, segments: string[]) {
  const candidate = containedSnapshotPath(root, segments);
  if (!candidate) return null;
  try {
    const details = await stat(/* turbopackIgnore: true */ candidate);
    const target = details.isDirectory() ? path.join(candidate, "index.html") : candidate;
    await stat(/* turbopackIgnore: true */ target);
    return target;
  } catch {
    return null;
  }
}

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

export const TAILWIND_HOST_OVERLAY_PATH = "lib/template-adapters/overlays/tailwind-landing.index.html";

function tailwindHostOverlayFile() {
  return path.resolve(/* turbopackIgnore: true */ process.cwd(), TAILWIND_HOST_OVERLAY_PATH);
}

export async function readTemplateStaticFile(templateId: string, segments: string[]) {
  // A look on the block library (T-053) serves one page, composed from lib/blocks, and nothing from
  // the vendor snapshot: not its pages, not its files (the composed page uses none), and it does not
  // need the snapshot to be built.
  const composed = composedPageForTemplate(templateId);
  if (composed !== null) {
    const isRootIndex = segments.length === 0 || (segments.length === 1 && segments[0] === "index.html");
    return isRootIndex ? { body: Buffer.from(ensureLocalStylesheetCrossorigin(composed)), contentType: contentTypes[".html"] } : null;
  }
  const root = getTemplateStaticRoot(templateId);
  if (!root) return null;
  const base = SNAPSHOT_PUBLIC_BASE[templateId];
  let target = await existingSnapshotTarget(root, segments);
  if (!target && base && segments[0] === base && segments.length > 1) {
    target = await existingSnapshotTarget(root, segments.slice(1));
  }
  if (!target) return null;
  try {
    const isRootIndex = target === path.join(root, "index.html");
    if (isRootIndex && templateId === "tailwind-landing") {
      target = tailwindHostOverlayFile();
    }
    const body = await readFile(/* turbopackIgnore: true */ target);
    const extension = path.extname(target).toLowerCase();
    if (extension === ".html") {
      return { body: Buffer.from(ensureLocalStylesheetCrossorigin(body.toString("utf8"))), contentType: contentTypes[".html"] };
    }
    if (extension === ".css") {
      return { body: Buffer.from(rewriteSnapshotCssUrls(body.toString("utf8"), templateId)), contentType: contentTypes[".css"] };
    }
    return { body, contentType: contentTypes[extension] ?? "application/octet-stream" };
  } catch {
    return null;
  }
}
