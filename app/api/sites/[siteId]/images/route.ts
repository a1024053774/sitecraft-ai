import { imageLicenses, imageUsageCategories, imageUsageScopes, listSiteImages, publicImagePayload, saveSiteImage, SiteImageError, type ImageLicense, type ImageUsageCategory, type ImageUsageScope } from "@/lib/site-images";
import { getExistingSite } from "@/lib/site-store";
import { userErrorPayload } from "@/lib/user-errors";

export const runtime = "nodejs";

function statusFor(error: unknown) {
  if (error instanceof SiteImageError) {
    if (error.code === "empty" || error.code === "unsupported" || error.code === "too_small" || error.code === "too_large") return 400;
    if (error.code === "not_found") return 404;
    return 403;
  }
  return 500;
}

function imageErrorPayload(error: unknown) {
  const code = error instanceof SiteImageError ? "image_invalid" : "database_error";
  return userErrorPayload({ code });
}

export async function GET(_request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  try {
    if (!await getExistingSite(siteId)) return Response.json(userErrorPayload({ code: "site_not_found" }), { status: 404 });
    const records = await listSiteImages(siteId);
    return Response.json({
      siteId,
      images: records.map(publicImagePayload),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json(imageErrorPayload(error), { status: statusFor(error) });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  try {
    if (!await getExistingSite(siteId)) return Response.json(userErrorPayload({ code: "site_not_found" }), { status: 404 });
    const form = await request.formData().catch(() => null);
    if (!form) return Response.json(userErrorPayload({ code: "image_invalid" }), { status: 400 });
    const file = form.get("file") ?? form.get("image");
    if (!(file instanceof Blob) || file.size <= 0) {
      return Response.json(userErrorPayload({ code: "image_invalid" }), { status: 400 });
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const originalName = "name" in file && typeof file.name === "string" ? file.name : "upload";
    const textField = (name: string) => {
      const value = form.get(name);
      return typeof value === "string" ? value.trim() : undefined;
    };
    const requestedLicense = textField("license");
    const requestedScope = textField("usageScope");
    const requestedCategory = textField("usageCategory");
    const license = requestedLicense && (imageLicenses as readonly string[]).includes(requestedLicense)
      ? requestedLicense as ImageLicense
      : undefined;
    const usageScope = requestedScope && (imageUsageScopes as readonly string[]).includes(requestedScope)
      ? requestedScope as ImageUsageScope
      : undefined;
    const usageCategory = requestedCategory && (imageUsageCategories as readonly string[]).includes(requestedCategory)
      ? requestedCategory as ImageUsageCategory
      : undefined;
    if (requestedLicense && !license) return Response.json(userErrorPayload({ code: "image_invalid" }), { status: 400 });
    if (requestedScope && !usageScope) return Response.json(userErrorPayload({ code: "image_invalid" }), { status: 400 });
    if (requestedCategory && !usageCategory) return Response.json(userErrorPayload({ code: "image_invalid" }), { status: 400 });
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
        usageCategory,
        retrievedAt: textField("retrievedAt"),
      } : undefined,
    });
    return Response.json({
      ok: true,
      image: publicImagePayload(record),
    }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json(imageErrorPayload(error), { status: statusFor(error) });
  }
}
