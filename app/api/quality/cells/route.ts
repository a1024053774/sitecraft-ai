import { z } from "zod";
import {
  QUALITY_GROUPS,
  QUALITY_PACK_IDS,
  QUALITY_SUPPLEMENTARY,
  compareLookVsCopy,
  lookFingerprint,
  qualityRecipe,
} from "@/lib/quality-comparison";
import { loadQualityMatrix } from "@/lib/quality-matrix";
import { runQualityCell } from "@/lib/quality-run";
import { applySiteOperations } from "@/lib/site-operations";
import { commitOperations, getExistingSite } from "@/lib/site-store";
import { templates } from "@/lib/site-model";
import { userErrorPayload, userFacingError } from "@/lib/user-errors";

export const runtime = "nodejs";
export const maxDuration = 300;

function missingSite(siteId: string) {
  return Response.json({ ...userErrorPayload({ code: "site_not_found" }), siteId }, { status: 404 });
}

const runSchema = z.object({
  packId: z.enum(QUALITY_PACK_IDS),
  group: z.enum(QUALITY_GROUPS),
  reviewOnly: z.boolean().optional(),
  screenshotBase64: z.string().min(100).max(14_000_000).optional(),
});

const supplementarySchema = z.object({
  action: z.enum(["style-switch", "long-title"]),
  sourceSiteId: z.string().min(1).max(80).optional(),
});

function previewOriginFrom(request: Request) {
  return process.env.QUALITY_CAPTURE_ORIGIN || new URL(request.url).origin;
}

function decodePng(value: string | undefined) {
  if (!value) return null;
  const cleaned = value.replace(/^data:image\/png;base64,/, "");
  return new Uint8Array(Buffer.from(cleaned, "base64"));
}

export async function GET() {
  try {
    return Response.json(await loadQualityMatrix(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("site_not_found:")) return missingSite(message.slice("site_not_found:".length));
    return Response.json(userErrorPayload({ code: "database_error" }), { status: 500 });
  }
}

export async function POST(request: Request) {
  const raw = await request.json().catch(() => null);
  if (raw && typeof raw === "object" && "action" in raw) {
    const parsed = supplementarySchema.safeParse(raw);
    if (!parsed.success) return Response.json(userErrorPayload({ code: "invalid_payload" }), { status: 400 });
    try {
      if (parsed.data.action === "style-switch") {
        const sourceId = parsed.data.sourceSiteId || "p4m-c";
        const source = await getExistingSite(sourceId);
        if (!source) return missingSite(sourceId);
        const templateIds = new Set(templates.map((item) => item.id));
        const brightOps = applySiteOperations(structuredClone(source.draft), [
          { op: "set_visual_brief", briefId: "industrial" },
        ], { templateIds, lastChange: "P4 样式切换明亮产品" });
        const engineeringOps = applySiteOperations(structuredClone(source.draft), [
          { op: "set_visual_brief", briefId: "engineering-industrial" },
        ], { templateIds, lastChange: "P4 样式切换工程工业" });
        const brightSite = await getExistingSite(QUALITY_SUPPLEMENTARY.styleSwitchBrightSiteId);
        if (!brightSite) return missingSite(QUALITY_SUPPLEMENTARY.styleSwitchBrightSiteId);
        const engSite = await getExistingSite(QUALITY_SUPPLEMENTARY.styleSwitchEngineeringSiteId);
        if (!engSite) return missingSite(QUALITY_SUPPLEMENTARY.styleSwitchEngineeringSiteId);
        await commitOperations({
          siteId: QUALITY_SUPPLEMENTARY.styleSwitchBrightSiteId,
          baseRevision: brightSite.draft.revision,
          operations: [{ op: "replace_draft", draft: brightOps.draft }],
          summary: "P4 样式切换：明亮产品",
          source: "template",
        });
        await commitOperations({
          siteId: QUALITY_SUPPLEMENTARY.styleSwitchEngineeringSiteId,
          baseRevision: engSite.draft.revision,
          operations: [{ op: "replace_draft", draft: engineeringOps.draft }],
          summary: "P4 样式切换：工程工业",
          source: "template",
        });
        const bright = await getExistingSite(QUALITY_SUPPLEMENTARY.styleSwitchBrightSiteId);
        const engineering = await getExistingSite(QUALITY_SUPPLEMENTARY.styleSwitchEngineeringSiteId);
        if (!bright) return missingSite(QUALITY_SUPPLEMENTARY.styleSwitchBrightSiteId);
        if (!engineering) return missingSite(QUALITY_SUPPLEMENTARY.styleSwitchEngineeringSiteId);
        return Response.json({
          action: "style-switch",
          lookVs: compareLookVsCopy(bright.draft, engineering.draft),
          bright: lookFingerprint(bright.draft),
          engineering: lookFingerprint(engineering.draft),
        });
      }
      const sourceId = parsed.data.sourceSiteId || "p4m-c";
      const source = await getExistingSite(sourceId);
      if (!source) return missingSite(sourceId);
      const longSite = await getExistingSite(QUALITY_SUPPLEMENTARY.longTitleSiteId);
      if (!longSite) return missingSite(QUALITY_SUPPLEMENTARY.longTitleSiteId);
      await commitOperations({
        siteId: QUALITY_SUPPLEMENTARY.longTitleSiteId,
        baseRevision: longSite.draft.revision,
        operations: [
          { op: "replace_draft", draft: structuredClone(source.draft) },
          { op: "set_text", target: "hero.title", locale: "zh", value: QUALITY_SUPPLEMENTARY.longTitle },
        ],
        summary: "P4 超长标题反例",
        source: "manual",
      });
      const long = await getExistingSite(QUALITY_SUPPLEMENTARY.longTitleSiteId);
      if (!long) return missingSite(QUALITY_SUPPLEMENTARY.longTitleSiteId);
      return Response.json({
        action: "long-title",
        title: long.draft.content.hero.title.zh,
        length: long.draft.content.hero.title.zh.length,
        templateId: long.draft.templateId,
      });
    } catch (error) {
      return Response.json(userErrorPayload({ code: "operation_error" }), { status: 422 });
    }
  }

  const parsed = runSchema.safeParse(raw);
  if (!parsed.success) return Response.json(userErrorPayload({ code: "invalid_payload" }), { status: 400 });
  const cell = qualityRecipe(parsed.data.packId, parsed.data.group).cell;
  if (!await getExistingSite(cell.siteId)) return missingSite(cell.siteId);
  const result = await runQualityCell({
    packId: parsed.data.packId,
    group: parsed.data.group,
    previewOrigin: previewOriginFrom(request),
    screenshotBytes: decodePng(parsed.data.screenshotBase64),
    reviewOnly: parsed.data.reviewOnly,
  });
  if (result.ok) {
    return Response.json(result, { status: 200, headers: { "Cache-Control": "no-store" } });
  }
  return Response.json({
    ...result,
    code: result.errorCode ?? "operation_error",
    error: userFacingError({ code: result.errorCode, message: result.error }),
  }, { status: 422, headers: { "Cache-Control": "no-store" } });
}
