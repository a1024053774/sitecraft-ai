import { templates } from "@/lib/site-model";
import { getTemplateStaticRoot } from "@/lib/template-static";

// Server-only: uses getTemplateStaticRoot (filesystem). Do not import from Client Components.

export const SOURCE_MATERIAL_NOTICE = "原始模板素材/样例非客户事实，发布前需替换或核验";
export const EDIT_PREVIEW_CTA_LABEL = "进入编辑预览（非发布）";

export type TemplateReadiness = {
  templateId: string;
  hasLocalSnapshot: boolean;
  snapshotLabel: "本地静态预览" | "仅上游演示／待构建快照";
  assetLabel: "素材待核验";
  canEnterEditPreview: boolean;
};

export function getTemplateReadiness(templateId: string): TemplateReadiness {
  const hasLocalSnapshot = getTemplateStaticRoot(templateId) !== null;
  return {
    templateId,
    hasLocalSnapshot,
    snapshotLabel: hasLocalSnapshot ? "本地静态预览" : "仅上游演示／待构建快照",
    assetLabel: "素材待核验",
    canEnterEditPreview: hasLocalSnapshot,
  };
}

export function listTemplateReadiness(): TemplateReadiness[] {
  return templates.map((item) => getTemplateReadiness(item.id));
}
