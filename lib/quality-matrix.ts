import { readFile } from "node:fs/promises";
import path from "node:path";
import { getAIProviderStatus } from "./ai-provider.ts";
import {
  QUALITY_BASELINE,
  QUALITY_GROUPS,
  QUALITY_PACK_IDS,
  QUALITY_SUPPLEMENTARY,
  compareLookVsCopy,
  copyFingerprint,
  draftShowsPackNonce,
  lookFingerprint,
  qualityGroupMeta,
  qualityPacks,
  qualityRecipe,
  type QualityGroupId,
  type QualityPackId,
} from "./quality-comparison.ts";
import { defaultDraft } from "./site-document.ts";
import { getSite } from "./site-store.ts";
import { normalizeDraft, type SiteDraft } from "./site-model.ts";

export type QualityCellDraftView = {
  revision: number;
  templateId: string;
  visualBrief: { id: string; label: string; templateId: string };
  hiddenSections: string[];
  companyName: string;
  heroTitle: string;
  heroCta: string;
  contactPhone: string;
  hasHeroImage: boolean;
  nonceVisible: boolean;
  look: ReturnType<typeof lookFingerprint>;
  copy: ReturnType<typeof copyFingerprint>;
  lookVsDefault: ReturnType<typeof compareLookVsCopy>;
};

export type QualityCellView = {
  cellId: string;
  packId: QualityPackId;
  group: QualityGroupId;
  siteId: string;
  label: string;
  process: string;
  expectedLookId: string | null;
  draft: QualityCellDraftView;
  previewDraft: SiteDraft;
  result: {
    ok: boolean;
    live: boolean;
    unverified: string[];
    error?: string;
    model: string | null;
    latencyMs: number;
    lookVsDefault: string;
    rejected: string[];
    fixRounds: number;
  } | null;
};

export type QualityMatrixPayload = {
  baseline: typeof QUALITY_BASELINE;
  provider: ReturnType<typeof getAIProviderStatus>;
  packs: Array<{ id: QualityPackId; label: string; nonce: string; industry: string; materialsLookId: string }>;
  groups: Array<{ id: QualityGroupId; label: string; process: string }>;
  cells: QualityCellView[];
  packComparisons: Array<{ packId: QualityPackId; aVsB: string; bVsC: string; cVsD: string }>;
  supplementary: typeof QUALITY_SUPPLEMENTARY;
};

async function readSavedResult(cellId: string) {
  try {
    return JSON.parse(await readFile(path.join(process.cwd(), ".sitecraft-data", "quality", "p4", `${cellId}.json`), "utf8")) as QualityCellView["result"];
  } catch {
    return null;
  }
}

export async function cellSnapshot(packId: QualityPackId, group: QualityGroupId): Promise<QualityCellView> {
  const recipe = qualityRecipe(packId, group);
  const saved = await readSavedResult(recipe.cell.cellId);
  const site = await getSite(recipe.cell.siteId);
  const draft = normalizeDraft(site.draft);
  return {
    ...recipe.cell,
    label: qualityGroupMeta[group].label,
    process: qualityGroupMeta[group].process,
    expectedLookId: recipe.lookBriefId,
    draft: {
      revision: draft.revision,
      templateId: draft.templateId,
      visualBrief: draft.visualBrief,
      hiddenSections: draft.hiddenSections,
      companyName: draft.companyName,
      heroTitle: draft.content.hero.title.zh,
      heroCta: draft.content.hero.cta.zh,
      contactPhone: draft.content.contact.phone,
      hasHeroImage: Boolean(draft.content.hero.image),
      nonceVisible: draftShowsPackNonce(draft, recipe.pack),
      look: lookFingerprint(draft),
      copy: copyFingerprint(draft),
      lookVsDefault: compareLookVsCopy(defaultDraft, draft),
    },
    previewDraft: draft,
    result: saved,
  };
}

export async function loadQualityMatrix(): Promise<QualityMatrixPayload> {
  const cells: QualityCellView[] = [];
  for (const packId of QUALITY_PACK_IDS) {
    for (const group of QUALITY_GROUPS) {
      cells.push(await cellSnapshot(packId, group));
    }
  }
  const packComparisons = QUALITY_PACK_IDS.map((packId) => {
    const groupCells = cells.filter((item) => item.packId === packId);
    const byGroup = Object.fromEntries(groupCells.map((item) => [item.group, item])) as Record<string, QualityCellView>;
    const a = byGroup.A;
    const b = byGroup.B;
    const c = byGroup.C;
    const d = byGroup.D;
    return {
      packId,
      aVsB: a && b ? (JSON.stringify(a.draft.look) === JSON.stringify(b.draft.look) ? "copy-or-same-look" : "look-differed") : "pending",
      bVsC: b && c ? (JSON.stringify(b.draft.look) === JSON.stringify(c.draft.look) ? "copy-or-same-look" : "look-differed") : "pending",
      cVsD: c && d ? (JSON.stringify(c.draft.copy) === JSON.stringify(d.draft.copy) && JSON.stringify(c.draft.look) === JSON.stringify(d.draft.look) ? "unchanged" : JSON.stringify(c.draft.look) === JSON.stringify(d.draft.look) ? "copy-only" : "look-differed") : "pending",
    };
  });
  return {
    baseline: QUALITY_BASELINE,
    provider: getAIProviderStatus(),
    packs: QUALITY_PACK_IDS.map((id) => ({
      id,
      label: qualityPacks[id].label,
      nonce: qualityPacks[id].nonce,
      industry: qualityPacks[id].industry,
      materialsLookId: qualityPacks[id].materialsLookId,
    })),
    groups: QUALITY_GROUPS.map((id) => ({ id, ...qualityGroupMeta[id] })),
    cells,
    packComparisons,
    supplementary: QUALITY_SUPPLEMENTARY,
  };
}
