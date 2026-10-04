import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { isPng, readPngSize } from "./preview-vision.ts";

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MIN_UPLOAD_EDGE = 32;
export const MIN_ANALYZE_EDGE = 160;
export const MIN_ANALYZE_BYTES = 8 * 1024;
export const IMAGE_ID_PATTERN = /^img_[a-z0-9]{16,40}$/;
export const SITE_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,79}$/i;

export const imageMimeTypes = ["image/png", "image/jpeg", "image/webp"] as const;
export type ImageMime = (typeof imageMimeTypes)[number];
export const imageLicenses = ["user-provided", "CC0", "Public Domain", "MIT", "Apache-2.0", "CC BY", "CC BY-SA"] as const;
export type ImageLicense = (typeof imageLicenses)[number];
export const imageUsageScopes = ["current-site-only", "generated-sites", "docs-only"] as const;
export type ImageUsageScope = (typeof imageUsageScopes)[number];
export const imageUsageCategories = ["product", "equipment", "facility", "inspection"] as const;
export type ImageUsageCategory = (typeof imageUsageCategories)[number];
export type ImageSource = "user-upload" | "public-material";

export type SiteImageRecord = {
  imageId: string;
  siteId: string;
  workspaceId: string;
  mime: ImageMime;
  byteLength: number;
  width: number;
  height: number;
  originalName: string;
  source: ImageSource;
  sourceUrl: string;
  license: ImageLicense;
  licenseUrl: string | null;
  author: string;
  attribution: string;
  usageScope: ImageUsageScope;
  usageCategory?: ImageUsageCategory;
  retrievedAt: string;
  sha256: string;
  createdAt: string;
};

export class SiteImageError extends Error {
  readonly code: "empty" | "too_large" | "unsupported" | "too_small" | "not_found" | "forbidden";

  constructor(code: SiteImageError["code"], message: string) {
    super(message);
    this.name = "SiteImageError";
    this.code = code;
  }
}

const workspaceId = process.env.DEFAULT_WORKSPACE_ID || "demo";
const storageRoot = path.join(process.cwd(), ".sitecraft-data", "uploads");

export function safeSiteId(siteId: string) {
  if (!SITE_ID_PATTERN.test(siteId)) throw new SiteImageError("forbidden", "Invalid site id");
  return siteId;
}

export function safeImageId(imageId: string) {
  if (!IMAGE_ID_PATTERN.test(imageId)) throw new SiteImageError("forbidden", "Invalid image id");
  return imageId;
}

export function siteImagePublicPath(siteId: string, imageId: string) {
  return `/api/sites/${safeSiteId(siteId)}/images/${safeImageId(imageId)}`;
}

export function isTemplateStockUrl(url: string) {
  const value = url.trim();
  if (!value) return false;
  const pathOnly = value.split("?")[0] ?? value;
  if (/^\/api\/sites\/[a-z0-9][a-z0-9_-]{0,79}\/images\/img_[a-z0-9]{16,40}$/i.test(pathOnly)) return false;
  return (
    /\/api\/templates\//i.test(value)
    || /vendor\/open-source-templates/i.test(value)
    || /\/_astro\//i.test(value)
    || /(?:^|\.\/)images\/.+\.(?:png|jpe?g|webp|avif|svg|gif)$/i.test(value)
    || /\/img\/(?:illustrations|logo|icons)\//i.test(value)
    || /\b(?:hero|feature-1|feature-2|pilot|growth|cube-leg)\.(?:png|jpe?g|webp|avif|svg)\b/i.test(value)
    || /(?:flowbite\.s3|res\.cloudinary\.com)\./i.test(value)
  );
}

export function isOwnedSiteImageUrl(url: string, imageId: string, siteId?: string) {
  const trimmed = url.trim();
  if (!trimmed || isTemplateStockUrl(trimmed)) return false;
  try {
    const parsed = new URL(trimmed, "http://sitecraft.local");
    if (parsed.username || parsed.password || parsed.hash) return false;
    if (parsed.search) return false;
    const match = parsed.pathname.match(/^\/api\/sites\/([a-z0-9][a-z0-9_-]{0,79})\/images\/(img_[a-z0-9]{16,40})$/i);
    if (!match) return false;
    if (match[2] !== imageId) return false;
    if (siteId && match[1] !== siteId) return false;
    return parsed.origin === "http://sitecraft.local" || parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function canonicalizeOwnedImageUrl(url: string, imageId: string, siteId: string) {
  if (isTemplateStockUrl(url)) {
    throw new SiteImageError("forbidden", "模板演示图没有客户授权，不能写入生成站点");
  }
  if (!isOwnedSiteImageUrl(url, imageId, siteId)) {
    throw new SiteImageError("forbidden", "图片必须属于当前站点上传目录，不能引用外站或模板素材");
  }
  return siteImagePublicPath(siteId, imageId);
}

function isJpeg(bytes: Uint8Array) {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

function isWebp(bytes: Uint8Array) {
  return (
    bytes.length >= 12
    && bytes[0] === 0x52
    && bytes[1] === 0x49
    && bytes[2] === 0x46
    && bytes[3] === 0x46
    && bytes[8] === 0x57
    && bytes[9] === 0x45
    && bytes[10] === 0x42
    && bytes[11] === 0x50
  );
}

function readJpegSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (!isJpeg(bytes)) return null;
  let index = 2;
  while (index + 8 < bytes.length) {
    if (bytes[index] !== 0xff) {
      index += 1;
      continue;
    }
    const marker = bytes[index + 1];
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) {
      index += 2;
      continue;
    }
    if (index + 3 >= bytes.length) return null;
    const length = (bytes[index + 2] << 8) | bytes[index + 3];
    if (length < 2) return null;
    const sof = (
      (marker >= 0xc0 && marker <= 0xc3)
      || (marker >= 0xc5 && marker <= 0xc7)
      || (marker >= 0xc9 && marker <= 0xcb)
      || (marker >= 0xcd && marker <= 0xcf)
    );
    if (sof) {
      const height = (bytes[index + 5] << 8) | bytes[index + 6];
      const width = (bytes[index + 7] << 8) | bytes[index + 8];
      if (width >= 1 && height >= 1) return { width, height };
      return null;
    }
    index += 2 + length;
  }
  return null;
}

function readWebpSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (!isWebp(bytes) || bytes.length < 30) return null;
  const kind = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]);
  if (kind === "VP8X") {
    const width = 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16));
    const height = 1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16));
    if (width >= 1 && height >= 1) return { width, height };
    return null;
  }
  if (kind === "VP8 " && bytes.length > 29 && bytes[20] === 0x9d && bytes[21] === 0x01 && bytes[22] === 0x2a) {
    const width = bytes[26] | ((bytes[27] & 0x3f) << 8);
    const height = bytes[28] | ((bytes[29] & 0x3f) << 8);
    if (width >= 1 && height >= 1) return { width, height };
  }
  if (kind === "VP8L" && bytes.length > 24 && bytes[20] === 0x2f) {
    const bits = bytes[21] | (bytes[22] << 8) | (bytes[23] << 16) | (bytes[24] << 24);
    const width = (bits & 0x3fff) + 1;
    const height = ((bits >> 14) & 0x3fff) + 1;
    if (width >= 1 && height >= 1) return { width, height };
  }
  return null;
}

export function detectImageMime(bytes: Uint8Array): ImageMime | null {
  if (isPng(bytes)) return "image/png";
  if (isJpeg(bytes)) return "image/jpeg";
  if (isWebp(bytes)) return "image/webp";
  return null;
}

export function readImageSize(bytes: Uint8Array) {
  const mime = detectImageMime(bytes);
  if (mime === "image/png") return readPngSize(bytes);
  if (mime === "image/jpeg") return readJpegSize(bytes);
  if (mime === "image/webp") return readWebpSize(bytes);
  return null;
}

export function inspectSiteImage(
  bytes: Uint8Array,
  purpose: "upload" | "analyze",
): { mime: ImageMime; width: number; height: number; byteLength: number } {
  if (!bytes.length) {
    throw new SiteImageError("empty", "图片为空，拒绝保存。");
  }
  if (bytes.length > MAX_IMAGE_BYTES) {
    throw new SiteImageError(
      "too_large",
      `本地上限：图片为 ${bytes.length} bytes，超过 ${MAX_IMAGE_BYTES}（本地硬上限，不是服务端上限）。`,
    );
  }
  const mime = detectImageMime(bytes);
  const size = readImageSize(bytes);
  if (!mime || !size) {
    throw new SiteImageError("unsupported", "只接受能用 magic bytes 识别的 PNG / JPEG / WebP，扩展名不可信。");
  }
  const minEdge = purpose === "analyze" ? MIN_ANALYZE_EDGE : MIN_UPLOAD_EDGE;
  if (size.width < minEdge || size.height < minEdge) {
    throw new SiteImageError(
      "too_small",
      purpose === "analyze"
        ? `分析用图为 ${size.width}×${size.height}，小于真实产品图下限 ${MIN_ANALYZE_EDGE}×${MIN_ANALYZE_EDGE}，拒绝 1×1 或合成小图。`
        : `图片为 ${size.width}×${size.height}，小于上传下限 ${MIN_UPLOAD_EDGE}×${MIN_UPLOAD_EDGE}，拒绝 1×1。`,
    );
  }
  if (purpose === "analyze" && bytes.length < MIN_ANALYZE_BYTES) {
    throw new SiteImageError(
      "too_small",
      `分析用图仅 ${bytes.length} bytes，不像真实产品照片，拒绝合成小图。`,
    );
  }
  return { mime, width: size.width, height: size.height, byteLength: bytes.length };
}

export function imageDataUrl(bytes: Uint8Array, purpose: "upload" | "analyze" = "analyze") {
  const info = inspectSiteImage(bytes, purpose);
  return `data:${info.mime};base64,${Buffer.from(bytes).toString("base64")}`;
}

function siteDir(siteId: string) {
  return path.join(storageRoot, workspaceId, safeSiteId(siteId));
}

function metaPath(siteId: string, imageId: string) {
  return path.join(siteDir(siteId), `${safeImageId(imageId)}.json`);
}

function bytesPath(siteId: string, imageId: string, mime: ImageMime) {
  const ext = mime === "image/png" ? ".png" : mime === "image/webp" ? ".webp" : ".jpg";
  return path.join(siteDir(siteId), `${safeImageId(imageId)}${ext}`);
}

function sha256(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function validateImageProvenance(record: SiteImageRecord) {
  if (!(imageLicenses as readonly string[]).includes(record.license) || !(imageUsageScopes as readonly string[]).includes(record.usageScope) || !(["user-upload", "public-material"] as const).includes(record.source)) {
    throw new SiteImageError("forbidden", "图片许可证、来源类型或用途范围无效，不能进入客户成品");
  }
  if (!record.sourceUrl || !record.author || !record.attribution || !record.retrievedAt || Number.isNaN(Date.parse(record.retrievedAt)) || !/^[a-f0-9]{64}$/i.test(record.sha256)) {
    throw new SiteImageError("forbidden", "图片缺少来源、归属、下载时间或 hash，不能进入客户成品");
  }
  if (record.usageCategory && !(imageUsageCategories as readonly string[]).includes(record.usageCategory)) {
    throw new SiteImageError("forbidden", "图片用途类别无效，不能进入客户成品");
  }
  if (record.license === "user-provided") {
    if (record.source !== "user-upload" || record.usageScope !== "current-site-only") {
      throw new SiteImageError("forbidden", "用户上传图片只能绑定当前站点使用");
    }
    return record;
  }
  if (record.source !== "public-material" || !/^https?:\/\//i.test(record.sourceUrl) || !/^https?:\/\//i.test(record.licenseUrl ?? "")) {
    throw new SiteImageError("forbidden", "公共素材必须记录可访问的来源和许可证 URL");
  }
  if (!record.licenseUrl) {
    throw new SiteImageError("forbidden", "公共素材必须记录 licenseUrl，不能进入客户成品");
  }
  if (record.license === "MIT" || record.license === "Apache-2.0") {
    throw new SiteImageError("forbidden", "MIT/Apache 图片准入当前仅覆盖可核验 SVG，PNG/JPEG/WebP 不能按代码许可证放行");
  }
  if ((record.license === "CC BY" || record.license === "CC BY-SA") && !record.attribution.trim()) {
    throw new SiteImageError("forbidden", "CC BY / CC BY-SA 素材必须保留署名");
  }
  return record;
}

async function writeAtomic(target: string, contents: Uint8Array | string) {
  await mkdir(path.dirname(target), { recursive: true });
  const temp = `${target}.${process.pid}.${crypto.randomUUID()}.tmp`;
  if (typeof contents === "string") await writeFile(temp, contents, "utf8");
  else await writeFile(temp, contents);
  await rename(temp, target);
}

export async function saveSiteImage(args: {
  siteId: string;
  bytes: Uint8Array;
  originalName?: string;
  provenance?: {
    sourceUrl?: string;
    license?: ImageLicense;
    licenseUrl?: string | null;
    author?: string;
    attribution?: string;
    usageScope?: ImageUsageScope;
    usageCategory?: ImageUsageCategory;
    retrievedAt?: string;
  };
}): Promise<SiteImageRecord> {
  const info = inspectSiteImage(args.bytes, "upload");
  const imageId = `img_${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`;
  const createdAt = new Date().toISOString();
  const site = safeSiteId(args.siteId);
  const provenance = args.provenance ?? {};
  const license = provenance.license ?? "user-provided";
  const isUserUpload = license === "user-provided";
  const record: SiteImageRecord = {
    imageId,
    siteId: site,
    workspaceId,
    mime: info.mime,
    byteLength: info.byteLength,
    width: info.width,
    height: info.height,
    originalName: (args.originalName ?? "upload").slice(0, 180),
    source: isUserUpload ? "user-upload" : "public-material",
    sourceUrl: provenance.sourceUrl?.trim() || `user-upload://${workspaceId}/${site}/${imageId}`,
    license,
    licenseUrl: provenance.licenseUrl?.trim() || null,
    author: isUserUpload ? (provenance.author?.trim() || "用户提供") : (provenance.author?.trim() || ""),
    attribution: isUserUpload ? (provenance.attribution?.trim() || "用户提供；仅当前站点使用") : (provenance.attribution?.trim() || ""),
    usageScope: provenance.usageScope ?? "current-site-only",
    ...(provenance.usageCategory ? { usageCategory: provenance.usageCategory } : {}),
    retrievedAt: provenance.retrievedAt?.trim() || createdAt,
    sha256: sha256(args.bytes),
    createdAt,
  };
  validateImageProvenance(record);
  await writeAtomic(bytesPath(record.siteId, imageId, info.mime), args.bytes);
  await writeAtomic(metaPath(record.siteId, imageId), JSON.stringify(record, null, 2));
  return record;
}

export async function readSiteImage(siteId: string, imageId: string): Promise<{ record: SiteImageRecord; bytes: Uint8Array } | null> {
  const id = safeImageId(imageId);
  const site = safeSiteId(siteId);
  let raw: string;
  try {
    raw = await readFile(metaPath(site, id), "utf8");
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
    if (code === "ENOENT") return null;
    throw error;
  }
  const rawRecord = JSON.parse(raw) as Partial<SiteImageRecord> & Pick<SiteImageRecord, "imageId" | "siteId" | "workspaceId" | "mime" | "byteLength" | "width" | "height" | "originalName" | "source" | "license" | "createdAt">;
  if (!(imageMimeTypes as readonly string[]).includes(rawRecord.mime)) {
    throw new SiteImageError("forbidden", "图片元数据的 MIME 类型无效");
  }
  const bytes = new Uint8Array(await readFile(bytesPath(site, id, rawRecord.mime)));
  const needsMigration = rawRecord.sourceUrl === undefined
    || rawRecord.licenseUrl === undefined
    || rawRecord.author === undefined
    || rawRecord.attribution === undefined
    || rawRecord.usageScope === undefined
    || rawRecord.usageCategory === undefined
    || rawRecord.retrievedAt === undefined
    || rawRecord.sha256 === undefined;
  const record: SiteImageRecord = {
    ...rawRecord,
    sourceUrl: rawRecord.sourceUrl ?? `user-upload://${workspaceId}/${site}/${id}`,
    licenseUrl: rawRecord.licenseUrl ?? null,
    author: rawRecord.author ?? "用户提供",
    attribution: rawRecord.attribution ?? "用户提供；仅当前站点使用",
    usageScope: rawRecord.usageScope ?? "current-site-only",
    ...(rawRecord.usageCategory ? { usageCategory: rawRecord.usageCategory } : {}),
    retrievedAt: rawRecord.retrievedAt ?? rawRecord.createdAt,
    sha256: rawRecord.sha256 ?? sha256(bytes),
  };
  if (record.siteId !== site || record.workspaceId !== workspaceId || record.imageId !== id) {
    throw new SiteImageError("forbidden", "图片不属于当前工作区站点");
  }
  validateImageProvenance(record);
  if (record.sha256.toLowerCase() !== sha256(bytes)) {
    throw new SiteImageError("forbidden", "图片 hash 与文件内容不一致，不能进入客户成品");
  }
  if (needsMigration) await writeAtomic(metaPath(site, id), JSON.stringify(record, null, 2));
  return { record, bytes };
}

export async function listSiteImages(siteId: string): Promise<SiteImageRecord[]> {
  const site = safeSiteId(siteId);
  let names: string[] = [];
  try {
    names = await readdir(siteDir(site));
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
    if (code === "ENOENT") return [];
    throw error;
  }
  const records: SiteImageRecord[] = [];
  for (const name of names) {
    if (!name.endsWith(".json")) continue;
    const imageId = name.slice(0, -5);
    if (!IMAGE_ID_PATTERN.test(imageId)) continue;
    const loaded = await readSiteImage(site, imageId);
    if (loaded) records.push(loaded.record);
  }
  return records.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function deleteImagesForSite(siteId: string) {
  await rm(siteDir(siteId), { recursive: true, force: true });
}

export function publicImagePayload(record: SiteImageRecord) {
  validateImageProvenance(record);
  return {
    imageId: record.imageId,
    siteId: record.siteId,
    url: siteImagePublicPath(record.siteId, record.imageId),
    mime: record.mime,
    width: record.width,
    height: record.height,
    byteLength: record.byteLength,
    originalName: record.originalName,
    source: record.source,
    sourceUrl: record.sourceUrl,
    license: record.license,
    licenseUrl: record.licenseUrl,
    author: record.author,
    attribution: record.attribution,
    usageScope: record.usageScope,
    usageCategory: record.usageCategory ?? null,
    ...((record.license === "CC BY" || record.license === "CC BY-SA") && record.attribution
      ? { credit: { zh: record.attribution, en: record.attribution } }
      : {}),
    retrievedAt: record.retrievedAt,
    sha256: record.sha256,
    createdAt: record.createdAt,
  };
}

export async function bindSiteImageOperations(
  siteId: string,
  operations: Array<{ op: string; imageId?: string; url?: string }>,
) {
  for (const operation of operations) {
    if (operation.op !== "set_image_slot" && operation.op !== "set_product_image") continue;
    if (!operation.imageId) throw new SiteImageError("forbidden", "缺少 imageId");
    if (operation.url && isTemplateStockUrl(operation.url)) {
      throw new SiteImageError("forbidden", "模板演示图没有客户授权，不能写入生成站点");
    }
    const loaded = await readSiteImage(siteId, operation.imageId);
    if (!loaded) throw new SiteImageError("not_found", `图片 ${operation.imageId} 不属于当前站点`);
    operation.url = siteImagePublicPath(siteId, operation.imageId);
  }
}
