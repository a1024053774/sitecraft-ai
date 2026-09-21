import { imageLicenses, imageUsageScopes, listSiteImages, publicImagePayload, saveSiteImage, SiteImageError, type ImageLicense, type ImageUsageScope } from "@/lib/site-images";
import { getSite } from "@/lib/site-store";

export const runtime = "nodejs";

function statusFor(error: unknown) {
  if (error instanceof SiteImageError) {
    if (error.code === "empty" || error.code === "unsupported" || error.code === "too_small" || error.code === "too_large") return 400;
    if (error.code === "not_found") return 404;
    return 403;
  }
  return 500;
}

export async function GET(_request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  try {
    const records = await listSiteImages(siteId);
    return Response.json({
      siteId,
      images: records.map(publicImagePayload),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "无法列出图片" }, { status: statusFor(error) });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  try {
    await getSite(siteId);
    const form = await request.formData().catch(() => null);
    if (!form) return Response.json({ error: "需要 multipart 表单，字段名 file 或 image" }, { status: 400 });
    const file = form.get("file") ?? form.get("image");
    if (!(file instanceof Blob) || file.size <= 0) {
      return Response.json({ error: "需要图片文件" }, { status: 400 });
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const originalName = "name" in file && typeof file.name === "string" ? file.name : "upload";
    const textField = (name: string) => {
      const value = form.get(name);
      return typeof value === "string" ? value.trim() : undefined;
    };
    const requestedLicense = textField("license");
    const requestedScope = textField("usageScope");
    const license = requestedLicense && (imageLicenses as readonly string[]).includes(requestedLicense)
      ? requestedLicense as ImageLicense
      : undefined;
    const usageScope = requestedScope && (imageUsageScopes as readonly string[]).includes(requestedScope)
      ? requestedScope as ImageUsageScope
      : undefined;
    if (requestedLicense && !license) return Response.json({ error: "不支持的图片许可证" }, { status: 400 });
    if (requestedScope && !usageScope) return Response.json({ error: "不支持的图片用途范围" }, { status: 400 });
    const record = await saveSiteImage({
      siteId,
      bytes,
      originalName,
      provenance: license ? {
        sourceUrl: textField("sourceUrl"),
        license,
        licenseUrl: textField("licenseUrl") ?? null,
        author: textField("author"),
        attribution: textField("attribution"),
        usageScope,
        retrievedAt: textField("retrievedAt"),
      } : undefined,
    });
    return Response.json({
      ok: true,
      image: publicImagePayload(record),
    }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "上传失败" }, { status: statusFor(error) });
  }
}
