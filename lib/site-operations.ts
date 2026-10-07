import { z } from "zod";
import { blockCatalog, layoutBlocks, type BlockId, type BlockLook } from "./blocks/catalog.ts";
import { effectiveBlockOrder } from "./blocks/order.ts";
import { blockLookForTemplate } from "./blocks/looks/index.ts";
import { checkVariantRequirements } from "./blocks/requirements.ts";
import { normalizeSiteStyle, siteStyleDirectionSchema, siteStyleRuleSchema, validateSiteStyleRules } from "./blocks/site-style.ts";
import { stripGapTalkBilingual } from "./visitor-prose.ts";
import { wrapCompanyMaterials } from "./simulated-packs.ts";
import {
  cloneDraft,
  commercialTermKindSchema,
  commercialTermSchema,
  commercialTermValueSchema,
  commercialTermsSchema,
  equipmentItemSchema,
  equipmentSchema,
  qualityProcessSchema,
  qualityProcessStepSchema,
  historySchema,
  historyItemSchema,
  ensureProductIds,
  normalizeDraft,
  blockIdSchema,
  editableCardSchema,
  locales,
  localizedTextSchema,
  pagePlanSourceSchema,
  pageRoleSchema,
  productSchema,
  productSpecParameterSchema,
  catalogSectionKeys,
  catalogSectionValueSchema,
  movableBlockIdSchema,
  movableBlockIds,
  unsupportedSitePageSchema,
  visibilityKeySchema,
  visualBriefCatalog,
  visualBriefIds,
  paletteIdSchema,
  defaultPaletteIdForVisualBrief,
  paletteCatalogForVisualBrief,
  hasHan,
  isCommercialTermGap,
  specValueText,
  type CatalogSectionKey,
  type CatalogSectionValue,
  type CommercialTerm,
  type CommercialTermKind,
  type EquipmentItem,
  type QualityProcessStep,
  type HistoryItem,
  type EditableCard,
  type Locale,
  type Product,
  type ProductSpecValue,
  type ProductSpecParameter,
  type SectionKey,
  type SiteDraft,
  type SiteImageRef,
} from "./site-document.ts";
import { customPaletteSchema } from "./custom-brand-color.ts";
import { validateColorPalette } from "./color-scale.ts";
import { SiteMigrationError, assertStableItemIds } from "./site-migration.ts";
import { rehostPagePlan, resolvePagePlan } from "./template-pages.ts";
import { canonicalizeOwnedImageUrl, isTemplateStockUrl } from "./site-images.ts";

export const textTargets = [
  "siteName",
  "companyName",
  "industry",
  "goal",
  "navigation.about",
  "navigation.features",
  "navigation.services",
  "navigation.products",
  "navigation.contact",
  "hero.title",
  "hero.subtitle",
  "hero.cta",
  "about.title",
  "about.body",
  "features.title",
  "features.intro",
  "services.title",
  "services.intro",
  "products.title",
  "products.intro",
  "contact.title",
  "contact.body",
  "contact.email",
  "contact.phone",
  "contact.address",
  "faq.title",
  "faq.intro",
] as const;
export const textTargetSchema = z.enum(textTargets);
export type TextTarget = z.infer<typeof textTargetSchema>;

const setTextOperationSchema = z.object({
  op: z.literal("set_text"),
  target: textTargetSchema,
  locale: z.enum(locales).optional(),
  value: z.union([
    z.string().min(1).max(1000),
    z.object({ zh: z.string().min(1).max(1000), en: z.string().min(1).max(1000) }),
  ]),
  englishReadyBefore: z.boolean().optional(),
});
const localizedOperationValueSchema = z.union([
  z.string().min(1).max(1000),
  z.object({ zh: z.string().min(1).max(1000), en: z.string().min(1).max(1000) }),
]);
const updateCardOperationSchema = z.object({
  op: z.literal("update_card"),
  section: z.enum(["features", "services", "faq"]),
  itemId: z.string().min(1).max(80),
  locale: z.enum(locales).optional(),
  title: localizedOperationValueSchema.optional(),
  body: localizedOperationValueSchema.optional(),
  englishReadyBefore: z.boolean().optional(),
}).refine((value) => value.title || value.body, "Card update requires title or body");
const addCardOperationSchema = z.object({
  op: z.literal("add_card"),
  section: z.enum(["features", "services", "faq"]),
  index: z.number().int().min(0).max(12).optional(),
  item: editableCardSchema,
});
// T-059: a whole card group in one operation (the model's whole-site generation), like
// set_catalog_section for catalogs. Up to the draft's own twelve entries, so undo can put back any
// list a draft already has; the model's own FAQ limit is applied in validateAIOperations.
const replaceCardsOperationSchema = z.object({
  op: z.literal("replace_cards"),
  section: z.enum(["features", "services", "faq"]),
  items: z.array(editableCardSchema).max(12).refine((list) => new Set(list.map((item) => item.id)).size === list.length, "Card ids must be unique"),
  englishReadyBefore: z.boolean().optional(),
});
const replaceCommercialTermsOperationSchema = z.object({
  op: z.literal("replace_commercial_terms"),
  terms: commercialTermsSchema,
  englishReadyBefore: z.boolean().optional(),
});
const updateCommercialTermOperationSchema = z.object({
  op: z.literal("update_commercial_term"),
  termId: z.string().min(1).max(80),
  kind: commercialTermKindSchema.optional(),
  value: commercialTermValueSchema.optional(),
  englishReadyBefore: z.boolean().optional(),
}).refine((operation) => operation.kind !== undefined || operation.value !== undefined, "Commercial term update requires kind or value");
const removeCommercialTermOperationSchema = z.object({
  op: z.literal("remove_commercial_term"),
  termId: z.string().min(1).max(80),
});
const replaceEquipmentOperationSchema = z.object({
  op: z.literal("replace_equipment"),
  equipment: equipmentSchema,
  englishReadyBefore: z.boolean().optional(),
});
const updateEquipmentOperationSchema = z.object({
  op: z.literal("update_equipment"),
  equipmentId: z.string().min(1).max(80),
  name: localizedTextSchema.optional(),
  quantity: z.number().int().nonnegative().nullable().optional(),
  spec: localizedTextSchema.nullable().optional(),
  englishReadyBefore: z.boolean().optional(),
}).strict().refine(
  (operation) => operation.name !== undefined || operation.quantity !== undefined || operation.spec !== undefined,
  "Equipment update requires name, quantity or spec",
);
const removeEquipmentOperationSchema = z.object({
  op: z.literal("remove_equipment"),
  equipmentId: z.string().min(1).max(80),
});
const replaceQualityProcessOperationSchema = z.object({
  op: z.literal("replace_quality_process"),
  steps: qualityProcessSchema,
  englishReadyBefore: z.boolean().optional(),
});
const updateQualityProcessOperationSchema = z.object({
  op: z.literal("update_quality_process"),
  stepId: z.string().min(1).max(80),
  title: localizedTextSchema.optional(),
  body: localizedTextSchema.nullable().optional(),
  englishReadyBefore: z.boolean().optional(),
}).strict().refine(
  (operation) => operation.title !== undefined || operation.body !== undefined,
  "Quality process update requires title or body",
);
const removeQualityProcessOperationSchema = z.object({
  op: z.literal("remove_quality_process"),
  stepId: z.string().min(1).max(80),
});
const reorderQualityProcessOperationSchema = z.object({
  op: z.literal("reorder_quality_process"),
  order: z.array(z.string().min(1).max(80)).max(12),
});
const replaceHistoryOperationSchema = z.object({
  op: z.literal("replace_history"),
  history: historySchema,
  englishReadyBefore: z.boolean().optional(),
});
const updateHistoryOperationSchema = z.object({
  op: z.literal("update_history"),
  itemId: z.string().min(1).max(80),
  year: z.number().int().min(1000).max(9999).optional(),
  event: localizedTextSchema.optional(),
  englishReadyBefore: z.boolean().optional(),
}).strict().refine(
  (operation) => operation.year !== undefined || operation.event !== undefined,
  "History update requires year or event",
);
const removeHistoryOperationSchema = z.object({
  op: z.literal("remove_history"),
  itemId: z.string().min(1).max(80),
});
const reorderHistoryOperationSchema = z.object({
  op: z.literal("reorder_history"),
  order: z.array(z.string().min(1).max(80)).max(12),
});
const removeCardOperationSchema = z.object({
  op: z.literal("remove_card"),
  section: z.enum(["features", "services", "faq"]),
  itemId: z.string().min(1).max(80),
});
const updateProductOperationSchema = z.object({
  op: z.literal("update_product"),
  productId: z.string().min(1).max(120),
  locale: z.enum(locales).optional(),
  name: localizedOperationValueSchema.optional(),
  summary: localizedOperationValueSchema.optional(),
  category: localizedOperationValueSchema.optional(),
  englishReadyBefore: z.boolean().optional(),
}).refine((value) => value.name || value.summary || value.category, "Product update requires at least one field");
const setProductSpecsOperationSchema = z.object({
  op: z.literal("set_product_specs"),
  productId: z.string().min(1).max(120),
  specs: z.array(productSpecParameterSchema).max(12),
  englishReadyBefore: z.boolean().optional(),
});
const setCatalogSectionOperationSchema = z.object({
  op: z.literal("set_catalog_section"),
  section: z.enum(catalogSectionKeys),
  value: catalogSectionValueSchema.nullable(),
});
const setTemplateOperationSchema = z.object({
  op: z.literal("set_template"),
  templateId: z.string().min(1).max(80),
});
const setVisualBriefOperationSchema = z.object({
  op: z.literal("set_visual_brief"),
  briefId: z.enum(visualBriefIds),
});
const setPaletteOperationSchema = z.object({
  op: z.literal("set_palette"),
  paletteId: paletteIdSchema,
});
/** 布局 (T-053): the variant a block-library block shows; null goes back to the look's default. */
const setBlockVariantOperationSchema = z.object({
  op: z.literal("set_block_variant"),
  block: blockIdSchema,
  variant: z.string().min(1).max(40).nullable(),
});
const setSiteStyleOperationSchema = z.object({
  op: z.literal("set_site_style"),
  direction: siteStyleDirectionSchema.nullable().optional(),
  rules: z.array(siteStyleRuleSchema).max(40),
});
const setCustomPaletteOperationSchema = z.object({
  op: z.literal("set_custom_palette"),
  palette: customPaletteSchema.nullable(),
});
const setSectionVisibilityOperationSchema = z.object({
  op: z.literal("set_section_visibility"),
  section: visibilityKeySchema,
  visible: z.boolean(),
});
const aiReorderSectionsOperationSchema = z.object({
  op: z.literal("reorder_sections"),
  order: z.array(z.string()).nullable(),
});
const siteReorderSectionsOperationSchema = z.object({
  op: z.literal("reorder_sections"),
  order: z.array(movableBlockIdSchema).max(movableBlockIds.length).nullable(),
});
const requestedPageSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]{0,39}$/).optional(),
  role: pageRoleSchema,
  label: localizedTextSchema.optional(),
  requested: z.string().min(1).max(80).optional(),
});
const setPagePlanOperationSchema = z.object({
  op: z.literal("set_page_plan"),
  source: pagePlanSourceSchema,
  pages: z.array(requestedPageSchema).max(12),
  unsupported: z.array(unsupportedSitePageSchema).max(12).optional(),
});
export const imageSlotTargets = ["hero.image"] as const;
export const imageSlotTargetSchema = z.enum(imageSlotTargets);
const imageRefFields = {
  imageId: z.string().regex(/^img_[a-z0-9]{16,40}$/),
  url: z.string().min(1).max(240),
  alt: localizedTextSchema.optional(),
  credit: localizedTextSchema.optional(),
};
const setImageSlotOperationSchema = z.object({
  op: z.literal("set_image_slot"),
  target: imageSlotTargetSchema,
  ...imageRefFields,
});
const removeImageSlotOperationSchema = z.object({
  op: z.literal("remove_image_slot"),
  target: imageSlotTargetSchema,
});
const setProductImageOperationSchema = z.object({
  op: z.literal("set_product_image"),
  productId: z.string().min(1).max(120),
  ...imageRefFields,
});
const removeProductImageOperationSchema = z.object({
  op: z.literal("remove_product_image"),
  productId: z.string().min(1).max(120),
});
const replaceProductsOperationSchema = z.object({
  op: z.literal("replace_products"),
  products: z.array(productSchema).max(1000),
  englishReadyBefore: z.boolean().optional(),
});
const replaceDraftOperationSchema = z.object({
  op: z.literal("replace_draft"),
  draft: z.custom<SiteDraft>(),
});

export const aiOperationSchema = z.discriminatedUnion("op", [
  setTextOperationSchema,
  updateCardOperationSchema,
  addCardOperationSchema,
  replaceCardsOperationSchema,
  replaceCommercialTermsOperationSchema,
  updateCommercialTermOperationSchema,
  removeCommercialTermOperationSchema,
  replaceEquipmentOperationSchema,
  updateEquipmentOperationSchema,
  removeEquipmentOperationSchema,
  replaceQualityProcessOperationSchema,
  updateQualityProcessOperationSchema,
  removeQualityProcessOperationSchema,
  replaceHistoryOperationSchema,
  updateHistoryOperationSchema,
  removeHistoryOperationSchema,
  removeCardOperationSchema,
  updateProductOperationSchema,
  setProductSpecsOperationSchema,
  setCatalogSectionOperationSchema,
  replaceProductsOperationSchema,
  setTemplateOperationSchema,
  setSectionVisibilityOperationSchema,
  aiReorderSectionsOperationSchema,
  setPagePlanOperationSchema,
  setImageSlotOperationSchema,
  removeImageSlotOperationSchema,
  setProductImageOperationSchema,
  removeProductImageOperationSchema,
  setBlockVariantOperationSchema,
  setSiteStyleOperationSchema,
]);

export const siteOperationSchema = z.discriminatedUnion("op", [
  setTextOperationSchema,
  updateCardOperationSchema,
  addCardOperationSchema,
  replaceCardsOperationSchema,
  replaceCommercialTermsOperationSchema,
  updateCommercialTermOperationSchema,
  removeCommercialTermOperationSchema,
  replaceEquipmentOperationSchema,
  updateEquipmentOperationSchema,
  removeEquipmentOperationSchema,
  replaceQualityProcessOperationSchema,
  updateQualityProcessOperationSchema,
  removeQualityProcessOperationSchema,
  reorderQualityProcessOperationSchema,
  replaceHistoryOperationSchema,
  updateHistoryOperationSchema,
  removeHistoryOperationSchema,
  reorderHistoryOperationSchema,
  removeCardOperationSchema,
  updateProductOperationSchema,
  setProductSpecsOperationSchema,
  setCatalogSectionOperationSchema,
  setTemplateOperationSchema,
  setSectionVisibilityOperationSchema,
  siteReorderSectionsOperationSchema,
  setPagePlanOperationSchema,
  setImageSlotOperationSchema,
  removeImageSlotOperationSchema,
  setProductImageOperationSchema,
  removeProductImageOperationSchema,
  replaceProductsOperationSchema,
  replaceDraftOperationSchema,
  setVisualBriefOperationSchema,
  setPaletteOperationSchema,
  setCustomPaletteOperationSchema,
  setBlockVariantOperationSchema,
  setSiteStyleOperationSchema,
]);
export type SiteOperation = z.infer<typeof siteOperationSchema>;
export type AIOperation = z.infer<typeof aiOperationSchema>;


/** How many operations one model answer may carry (T-053: 24, up from 20). */
export const MAX_AI_OPERATIONS = 24;
const aiOperationsSchema = z.array(aiOperationSchema).superRefine((operations, context) => {
  const ordinary = operations.filter((operation) => operation.op !== "set_site_style").length;
  if (ordinary > MAX_AI_OPERATIONS) context.addIssue({ code: "too_big", maximum: MAX_AI_OPERATIONS, origin: "array", inclusive: true, message: `最多 ${MAX_AI_OPERATIONS} 条普通 operation；站点样式另计` });
});

export const aiChangeSchema = z.object({
  summary: z.string().min(1).max(500),
  operations: aiOperationsSchema,
});
export type AIChange = z.infer<typeof aiChangeSchema>;

export const aiEditIntentSchema = aiChangeSchema.extend({
  type: z.literal("edit"),
});
export const aiAnswerIntentSchema = z.strictObject({
  type: z.literal("answer"),
  text: z.string().min(1).max(4000),
});
export const aiClarifyIntentSchema = z.strictObject({
  type: z.literal("clarify"),
  question: z.string().min(1).max(800),
  options: z.array(z.string().min(1).max(200)).max(8).optional(),
});
export const aiIntentResponseSchema = z.discriminatedUnion("type", [
  aiEditIntentSchema,
  aiAnswerIntentSchema,
  aiClarifyIntentSchema,
]);
export type AIIntentResponse = z.infer<typeof aiIntentResponseSchema>;
export type AIEditIntent = z.infer<typeof aiEditIntentSchema>;
export type AIAnswerIntent = z.infer<typeof aiAnswerIntentSchema>;
export type AIClarifyIntent = z.infer<typeof aiClarifyIntentSchema>;

export type ApplyResult = {
  draft: SiteDraft;
  inverseOperations: SiteOperation[];
  appliedTargets: string[];
  changed: boolean;
  /** Layouts put back to their default because this change left their materials short, in page words. */
  notices: string[];
};

/** Said when a layout is asked for on a look that has not moved to the block library yet. */
// The most FAQ entries the model may write in one card group: a draft carries six, and the
// engineering page shows six (T-059).
// Steps: the engineering page shows six (T-059).
const MAX_AI_CARDS: Partial<Record<"features" | "services" | "faq", number>> = { faq: 6, services: 6 };
const CARD_GROUP_WORDS: Record<"features" | "services" | "faq", { name: string; unit: string }> = { faq: { name: "常见问题", unit: "条" }, services: { name: "合作方式", unit: "步" }, features: { name: "优势", unit: "条" } };

export const LAYOUT_LOOK_NOT_READY = "当前样子还不能单独换首屏、产品或询盘的布局。";

function variantLabel(block: BlockId, variant: string) {
  return blockCatalog[block].variants[variant]?.label ?? variant;
}

/** 「产品仍按产品卡片显示」「产品仍按类别分组显示」 */
function keepsLayoutPhrase(block: BlockId, variant: string) {
  const label = variantLabel(block, variant);
  return `${blockCatalog[block].label}${label.startsWith("按") ? `仍${label}` : `仍按${label}`}显示`;
}

const withoutFullStop = (text: string) => text.replace(/[。.]\s*$/, "");

/** The layout request refused on this draft, and why; null when the draft can show it. */
function layoutRefusal(draft: SiteDraft, look: BlockLook | undefined, block: BlockId, variant: string): string | null {
  const spec = blockCatalog[block];
  if (!Object.hasOwn(spec.variants, variant)) return `${spec.label}没有这种布局。`;
  if (!look) return LAYOUT_LOOK_NOT_READY;
  if (!layoutBlocks(look).includes(block)) return `当前样子没有${spec.label}这一块。`;
  if (look.defaults[block] === variant) return null;
  const check = checkVariantRequirements(draft, block, variant);
  return check.ok ? null : check.failures.map((failure) => failure.message).join("");
}

const nonLocalizedTargets = new Set<TextTarget>([
  "siteName",
  "companyName",
  "goal",
  "contact.email",
  "contact.phone",
]);

function localizedValue(draft: SiteDraft, target: TextTarget) {
  const values: Record<string, { zh: string; en: string }> = {
    "navigation.about": draft.navigation.about,
    "navigation.features": draft.navigation.features,
    "navigation.services": draft.navigation.services,
    "navigation.products": draft.navigation.products,
    "navigation.contact": draft.navigation.contact,
    "hero.title": draft.content.hero.title,
    "hero.subtitle": draft.content.hero.subtitle,
    "hero.cta": draft.content.hero.cta,
    "about.title": draft.content.about.title,
    "about.body": draft.content.about.body,
    "features.title": draft.content.features.title,
    "features.intro": draft.content.features.intro,
    "services.title": draft.content.services.title,
    "services.intro": draft.content.services.intro,
    "products.title": draft.content.products.title,
    "products.intro": draft.content.products.intro,
    "contact.title": draft.content.contact.title,
    "contact.body": draft.content.contact.body,
    "contact.address": draft.content.contact.address,
    "faq.title": draft.content.faq.title,
    "faq.intro": draft.content.faq.intro,
  };
  return values[target];
}

export function readText(draft: SiteDraft, target: TextTarget, locale: Locale) {
  if (target === "siteName") return draft.siteName;
  if (target === "companyName") return draft.companyName;
  if (target === "industry") return typeof draft.industry === "string" ? draft.industry : draft.industry[locale];
  if (target === "goal") return draft.goal;
  if (target === "contact.email") return draft.content.contact.email;
  if (target === "contact.phone") return draft.content.contact.phone;
  return localizedValue(draft, target)?.[locale] ?? "";
}

export function writeText(draft: SiteDraft, target: TextTarget, locale: Locale, value: string) {
  if (target === "siteName") draft.siteName = value;
  else if (target === "companyName") draft.companyName = value;
  else if (target === "industry") {
    // An older single-language industry becomes bilingual on its first write.
    const current = typeof draft.industry === "string" ? { zh: draft.industry, en: draft.industry } : { ...draft.industry };
    current[locale] = value;
    draft.industry = current;
  }
  else if (target === "goal") draft.goal = value;
  else if (target === "contact.email") draft.content.contact.email = value;
  else if (target === "contact.phone") draft.content.contact.phone = value;
  else localizedValue(draft, target)[locale] = value;
}

function same(a: unknown, b: unknown) {
  return JSON.stringify(a) === JSON.stringify(b);
}

const missingAlt = { zh: "待补充", en: "To be completed" };

function resolveImageRef(
  operation: {
    imageId: string;
    url: string;
    alt?: { zh: string; en: string };
    credit?: { zh: string; en: string };
  },
  siteId?: string,
): SiteImageRef {
  if (isTemplateStockUrl(operation.url)) {
    throw new Error("模板演示图没有客户授权，不能写入生成站点");
  }
  const url = siteId
    ? canonicalizeOwnedImageUrl(operation.url, operation.imageId, siteId)
    : (() => {
      if (!operation.url.startsWith("/api/sites/") || !operation.url.includes(`/images/${operation.imageId}`)) {
        throw new Error("图片必须属于站点上传目录，不能引用模板或外站素材");
      }
      return operation.url;
    })();
  const next: SiteImageRef = {
    imageId: operation.imageId,
    url,
    alt: operation.alt ?? structuredClone(missingAlt),
  };
  if (operation.credit) next.credit = structuredClone(operation.credit);
  return next;
}

function readHeroImage(draft: SiteDraft) {
  return draft.content.hero.image;
}

function writeHeroImage(draft: SiteDraft, image: SiteImageRef | undefined) {
  if (image) draft.content.hero.image = structuredClone(image);
  else delete draft.content.hero.image;
}

function readCatalogSection(draft: SiteDraft, section: CatalogSectionKey): CatalogSectionValue | null {
  const value = draft.content[section];
  return value ? structuredClone(value) as CatalogSectionValue : null;
}

function normalizeCatalogSection(
  section: CatalogSectionKey,
  value: CatalogSectionValue | null,
): CatalogSectionValue | null {
  if (!value) return null;
  if (section !== "certifications") {
    return {
      title: structuredClone(value.title),
      intro: structuredClone(value.intro),
      items: value.items.map((item) => ({
        id: item.id,
        title: structuredClone(item.title),
        body: structuredClone(item.body),
      })),
    };
  }
  return {
    title: structuredClone(value.title),
    intro: structuredClone(value.intro),
    items: value.items.map((item) => ({
      id: item.id,
      title: structuredClone(item.title),
      body: structuredClone(item.body),
      status: item.status === "已有" || item.status === "认证中" ? item.status : "待补充",
    })),
  };
}

function writeCatalogSection(
  draft: SiteDraft,
  section: CatalogSectionKey,
  value: CatalogSectionValue | null,
) {
  if (!value) {
    delete draft.content[section];
    return;
  }
  if (section === "certifications") {
    draft.content.certifications = {
      title: structuredClone(value.title),
      intro: structuredClone(value.intro),
      items: value.items.map((item) => ({
        id: item.id,
        title: structuredClone(item.title),
        body: structuredClone(item.body),
        status: item.status === "已有" || item.status === "认证中" ? item.status : "待补充",
      })),
    };
    return;
  }
  draft.content[section] = {
    title: structuredClone(value.title),
    intro: structuredClone(value.intro),
    items: value.items.map((item) => ({
      id: item.id,
      title: structuredClone(item.title),
      body: structuredClone(item.body),
    })),
  };
}

const ENGLISH_SPEC_GAP = "To be provided";

function normalizeSpecValue(value: ProductSpecValue): ProductSpecValue {
  if (typeof value === "string") {
    const zh = value.trim();
    if (isGapMarker(zh) || !hasHan(zh)) return zh;
    return { zh, en: ENGLISH_SPEC_GAP };
  }
  const zh = value.zh.trim();
  const en = value.en.trim();
  if (isGapMarker(zh)) return zh || "待补充";
  if (!hasHan(zh)) return zh;
  if (!en || isGapMarker(en) || hasHan(en)) return { zh, en: ENGLISH_SPEC_GAP };
  return { zh, en };
}

function normalizeProductSpecs(product: Product): Product {
  if (!product.specs) return structuredClone(product);
  return {
    ...structuredClone(product),
    specs: product.specs.map((spec) => ({ ...structuredClone(spec), value: normalizeSpecValue(spec.value) })),
  };
}

function specsHaveReadyEnglish(specs: ProductSpecParameter[] | undefined): boolean {
  return Boolean(specs?.some((spec) => typeof spec.value !== "string" && !isGapMarker(spec.value.en)));
}

function productHasReadyEnglish(product: Product): boolean {
  return !isGapMarker(product.name.en)
    || !isGapMarker(product.summary.en)
    || (typeof product.category === "object" && !isGapMarker(product.category.en))
    || specsHaveReadyEnglish(product.specs);
}

type HistoricalChangeInput = {
  operations: unknown[];
  inverseOperations: unknown[];
  appliedTargets: string[];
  [key: string]: unknown;
};

function cardIdAt(draft: SiteDraft, section: "features" | "services" | "faq", index: number, context: { siteId?: string | null; changeId?: string } = {}) {
  const item = draft.content[section].items[index];
  if (!item?.id) {
    throw new SiteMigrationError({
      siteId: context.siteId,
      field: `history.${context.changeId ?? "unknown"}.cardTarget`,
      value: `${section}[${index}]`,
      reason: "卡片序号没有唯一对应的稳定 id",
    });
  }
  return item.id;
}

function productIdForSku(draft: SiteDraft, sku: string, context: { siteId?: string | null; changeId?: string } = {}) {
  const matches = draft.products.filter((item) => item.sku === sku);
  if (matches.length !== 1 || !matches[0].id) {
    throw new SiteMigrationError({
      siteId: context.siteId,
      field: `history.${context.changeId ?? "unknown"}.productTarget`,
      value: sku,
      reason: matches.length === 0 ? "SKU 没有唯一匹配的产品" : "SKU 匹配多个产品",
    });
  }
  return matches[0].id;
}

function migrateHistoricalOperation(raw: unknown, draft: SiteDraft, context: { siteId?: string | null; changeId?: string }): SiteOperation {
  if (!raw || typeof raw !== "object") throw new Error("Cannot migrate malformed historical operation");
  const operation = raw as Record<string, unknown>;
  if (operation.op === "update_card" && typeof operation.index === "number" && typeof operation.itemId !== "string") {
    const { index: _index, ...rest } = operation;
    return { ...rest, itemId: cardIdAt(draft, operation.section as "features" | "services" | "faq", operation.index, context) } as SiteOperation;
  }
  if (["update_product", "set_product_specs", "set_product_image", "remove_product_image"].includes(String(operation.op))
    && typeof operation.sku === "string" && typeof operation.productId !== "string") {
    const { sku: _sku, ...rest } = operation;
    return { ...rest, productId: productIdForSku(draft, operation.sku, context) } as SiteOperation;
  }
  if (operation.op === "replace_products" && Array.isArray(operation.products)) {
    const existingBySku = new Map<string, string>();
    for (const product of draft.products) {
      const previous = existingBySku.get(product.sku);
      if (previous) {
        throw new SiteMigrationError({
          siteId: context.siteId,
          field: `history.${context.changeId ?? "unknown"}.replace_products.sku`,
          value: product.sku,
          reason: "SKU 匹配多个产品",
        });
      }
      if (product.id) existingBySku.set(product.sku, product.id);
    }
    const products = ensureProductIds((operation.products as Product[]).map((product) => ({
      ...product,
      ...(product.id || !existingBySku.get(product.sku) ? {} : { id: existingBySku.get(product.sku) }),
    })));
    return { ...operation, products } as SiteOperation;
  }
  if (operation.op === "replace_draft" && operation.draft) {
    return { ...operation, draft: normalizeDraft(operation.draft, { siteId: context.siteId }) } as SiteOperation;
  }
  return raw as SiteOperation;
}

function migrateHistoricalOperations(raw: unknown[], draft: SiteDraft, context: { siteId?: string | null; changeId?: string }) {
  return raw.map((operation) => migrateHistoricalOperation(operation, draft, context));
}

function migrateHistoricalTarget(target: string, draft: SiteDraft, context: { siteId?: string | null; changeId?: string }) {
  const card = /^(features|services|faq)\.items\.(\d+)(\..*)?$/.exec(target);
  if (card) return `${card[1]}.items.${cardIdAt(draft, card[1] as "features" | "services" | "faq", Number(card[2]), context)}${card[3] ?? ""}`;
  if (target.startsWith("products.")) {
    const rest = target.slice("products.".length);
    if (draft.products.some((product) => product.id && rest.startsWith(`${product.id}.`))) return target;
    const match = [...draft.products]
      .filter((product) => rest.startsWith(`${product.sku}.`))
      .sort((a, b) => b.sku.length - a.sku.length)[0];
    if (!match) {
      throw new SiteMigrationError({
        siteId: context.siteId,
        field: `history.${context.changeId ?? "unknown"}.productTarget`,
        value: rest.split(".")[0] ?? rest,
        reason: "SKU 没有唯一匹配的产品",
      });
    }
    return `products.${productIdForSku(draft, match.sku, context)}${rest.slice(match.sku.length)}`;
  }
  return target;
}

function migrateHistoricalTargets(targets: string[], before: SiteDraft, after: SiteDraft, operations: SiteOperation[], context: { siteId?: string | null; changeId?: string }) {
  const targetState = operations.some((operation) => operation.op === "replace_cards" || operation.op === "replace_products" || operation.op === "add_card") ? after : before;
  return targets.map((target) => migrateHistoricalTarget(target, targetState, context));
}

function applyMigrationOperations(draft: SiteDraft, operations: SiteOperation[], templateIds: Set<string>) {
  return applySiteOperations(draft, operations, { templateIds, lastChange: "迁移旧历史" }).draft;
}

export function migrateSiteHistory(args: {
  draft: SiteDraft;
  history: HistoricalChangeInput[];
  future: HistoricalChangeInput[];
  templateIds: Set<string>;
  siteId?: string | null;
}) {
  const current = normalizeDraft(args.draft);
  let reverseState = current;
  const history = [...args.history];
  let changed = false;
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const change = history[index];
    const context = { siteId: args.siteId, changeId: typeof change.id === "string" ? change.id : undefined };
    const inverseOperations = migrateHistoricalOperations(change.inverseOperations, reverseState, context);
    const before = applyMigrationOperations(reverseState, inverseOperations, args.templateIds);
    const operations = migrateHistoricalOperations(change.operations, before, context);
    history[index] = {
      ...change,
      operations,
      inverseOperations,
      appliedTargets: migrateHistoricalTargets(change.appliedTargets, before, reverseState, operations, context),
    };
    reverseState = before;
    changed = changed || JSON.stringify(change.operations) !== JSON.stringify(operations) || JSON.stringify(change.inverseOperations) !== JSON.stringify(inverseOperations);
  }
  let futureState = current;
  const future = args.future.map((change) => {
    const before = futureState;
    const context = { siteId: args.siteId, changeId: typeof change.id === "string" ? change.id : undefined };
    const operations = migrateHistoricalOperations(change.operations, before, context);
    const after = applyMigrationOperations(before, operations, args.templateIds);
    const inverseOperations = migrateHistoricalOperations(change.inverseOperations, after, context);
    futureState = after;
    changed = changed || JSON.stringify(change.operations) !== JSON.stringify(operations) || JSON.stringify(change.inverseOperations) !== JSON.stringify(inverseOperations);
    return {
      ...change,
      operations,
      inverseOperations,
      appliedTargets: migrateHistoricalTargets(change.appliedTargets, before, after, operations, context),
    };
  });
  return { draft: current, history, future, changed };
}

export function applySiteOperations(
  current: SiteDraft,
  operations: SiteOperation[],
  options: { templateIds: Set<string>; lastChange: string; siteId?: string },
): ApplyResult {
  assertStableItemIds(current, options.siteId);
  let draft = cloneDraft(current);
  draft.products = ensureProductIds(draft.products);
  const inverseOperations: SiteOperation[] = [];
  const appliedTargets: string[] = [];
  // Layouts this batch asks for; checked once the whole batch is done (T-053).
  const layoutRequests = new Map<BlockId, string>();

  for (const operation of operations) {
    if (operation.op === "set_site_style") {
      const next = normalizeSiteStyle({ direction: operation.direction ?? null, rules: operation.rules });
      if (!next) {
        if (draft.siteStyle !== undefined) {
          inverseOperations.unshift({ op: "set_site_style", direction: draft.siteStyle.direction ?? null, rules: draft.siteStyle.rules });
          draft.siteStyle = undefined;
          appliedTargets.push("siteStyle");
        }
        continue;
      }
      const previous = draft.siteStyle;
      if (same(previous, next)) continue;
      draft.siteStyle = next;
      inverseOperations.unshift({ op: "set_site_style", direction: previous?.direction ?? null, rules: previous?.rules ?? [] });
      appliedTargets.push("siteStyle");
      continue;
    }
    if (operation.op === "set_block_variant") {
      const spec = blockCatalog[operation.block];
      if (operation.variant !== null && !Object.hasOwn(spec.variants, operation.variant)) throw new Error(`${spec.label}没有这种布局。`);
      const look = blockLookForTemplate(draft.templateId);
      const next = operation.variant === null || look?.defaults[operation.block] === operation.variant ? undefined : operation.variant;
      if (next === undefined) layoutRequests.delete(operation.block);
      else layoutRequests.set(operation.block, next);
      const previous = draft.blockVariants[operation.block];
      if (previous === next) continue;
      const blockVariants = { ...draft.blockVariants };
      if (next === undefined) delete blockVariants[operation.block];
      else blockVariants[operation.block] = next;
      draft.blockVariants = blockVariants;
      inverseOperations.unshift({ op: "set_block_variant", block: operation.block, variant: previous ?? null });
      appliedTargets.push(`blockVariants.${operation.block}`);
      continue;
    }
    if (operation.op === "replace_draft") {
      assertStableItemIds(operation.draft, options.siteId);
      if (same(draft, operation.draft)) continue;
      inverseOperations.unshift({ op: "replace_draft", draft: cloneDraft(draft) });
      draft = cloneDraft(operation.draft);
      draft.products = ensureProductIds(draft.products);
      appliedTargets.push("draft");
      continue;
    }
    if (operation.op === "set_text") {
      if (typeof operation.value === "object") {
        const previousEnglishReady = draft.englishReady;
        const previous = { zh: readText(draft, operation.target, "zh"), en: readText(draft, operation.target, "en") };
        if (previous.zh === operation.value.zh && previous.en === operation.value.en) continue;
        if (nonLocalizedTargets.has(operation.target)) {
          // A one-language field keeps the Chinese value; the English one used to overwrite it.
          writeText(draft, operation.target, "zh", operation.value.zh);
        } else {
          writeText(draft, operation.target, "zh", operation.value.zh);
          writeText(draft, operation.target, "en", operation.value.en);
          if (!isGapMarker(operation.value.en)) draft.englishReady = true;
        }
        inverseOperations.unshift({ op: "set_text", target: operation.target, value: previous, englishReadyBefore: previousEnglishReady });
        if (typeof operation.englishReadyBefore === "boolean") draft.englishReady = operation.englishReadyBefore;
        appliedTargets.push(`${operation.target}.zh`, `${operation.target}.en`);
        continue;
      }
      const locale = nonLocalizedTargets.has(operation.target) ? "zh" : (operation.locale ?? "zh");
      const previousEnglishReady = draft.englishReady;
      const previous = readText(draft, operation.target, locale);
      if (previous === operation.value) continue;
      writeText(draft, operation.target, locale, operation.value);
      if (locale === "en" && !isGapMarker(operation.value)) draft.englishReady = true;
      inverseOperations.unshift({ ...operation, locale, value: previous, englishReadyBefore: previousEnglishReady });
      if (typeof operation.englishReadyBefore === "boolean") draft.englishReady = operation.englishReadyBefore;
      appliedTargets.push(`${operation.target}.${locale}`);
      continue;
    }
    if (operation.op === "update_card") {
      const items = draft.content[operation.section].items;
      const index = items.findIndex((item) => item.id === operation.itemId);
      const item = index >= 0 ? items[index] : undefined;
      if (!item) throw new Error(`${operation.section} item ${operation.itemId} does not exist`);
      if ((typeof operation.title === "object" && operation.title) || (typeof operation.body === "object" && operation.body)) {
        const previousEnglishReady = draft.englishReady;
        const inverse: SiteOperation = {
          op: "update_card", section: operation.section, itemId: operation.itemId,
          ...(operation.title ? { title: typeof operation.title === "object" ? structuredClone(item.title) : item.title.zh } : {}),
          ...(operation.body ? { body: typeof operation.body === "object" ? structuredClone(item.body) : item.body.zh } : {}),
          englishReadyBefore: previousEnglishReady,
        };
        let changed = false;
        if (typeof operation.title === "object") { if (item.title.zh !== operation.title.zh || item.title.en !== operation.title.en) changed = true; item.title = structuredClone(operation.title); appliedTargets.push(`${operation.section}.items.${operation.itemId}.title.zh`, `${operation.section}.items.${operation.itemId}.title.en`); }
        if (typeof operation.body === "object") { if (item.body.zh !== operation.body.zh || item.body.en !== operation.body.en) changed = true; item.body = structuredClone(operation.body); appliedTargets.push(`${operation.section}.items.${operation.itemId}.body.zh`, `${operation.section}.items.${operation.itemId}.body.en`); }
        if (changed) { if ((typeof operation.title === "object" && !isGapMarker(operation.title.en)) || (typeof operation.body === "object" && !isGapMarker(operation.body.en))) draft.englishReady = true; if (typeof operation.englishReadyBefore === "boolean") draft.englishReady = operation.englishReadyBefore; inverseOperations.unshift(inverse); }
        continue;
      }
      const inverse: SiteOperation = {
        op: "update_card",
        section: operation.section,
        itemId: operation.itemId,
        locale: operation.locale ?? "zh",
        ...(operation.title ? { title: item.title[operation.locale ?? "zh"] } : {}),
        ...(operation.body ? { body: item.body[operation.locale ?? "zh"] } : {}),
      };
      let changed = false;
      const locale = operation.locale ?? "zh";
      const previousEnglishReady = draft.englishReady;
      if (operation.title && typeof operation.title === "string" && item.title[locale] !== operation.title) {
        item.title[locale] = operation.title;
        appliedTargets.push(`${operation.section}.items.${operation.itemId}.title.${locale}`);
        changed = true;
      }
      if (operation.body && typeof operation.body === "string" && item.body[locale] !== operation.body) {
        item.body[locale] = operation.body;
        appliedTargets.push(`${operation.section}.items.${operation.itemId}.body.${locale}`);
        changed = true;
      }
      if (changed) {
        if (locale === "en" && operation.title && typeof operation.title === "string" && !isGapMarker(operation.title)) draft.englishReady = true;
        if (locale === "en" && operation.body && typeof operation.body === "string" && !isGapMarker(operation.body)) draft.englishReady = true;
        if (typeof operation.englishReadyBefore === "boolean") draft.englishReady = operation.englishReadyBefore;
        inverseOperations.unshift({ ...inverse, englishReadyBefore: previousEnglishReady });
      }
      continue;
    }
    if (operation.op === "add_card") {
      const items = draft.content[operation.section].items;
      if (items.some((item) => item.id === operation.item.id)) throw new Error(`Card id ${operation.item.id} already exists`);
      const index = Math.min(operation.index ?? items.length, items.length);
      items.splice(index, 0, structuredClone(operation.item));
      inverseOperations.unshift({ op: "remove_card", section: operation.section, itemId: operation.item.id });
      appliedTargets.push(`${operation.section}.items.${operation.item.id}`);
      continue;
    }
    if (operation.op === "replace_cards") {
      const section = draft.content[operation.section];
      const previous = structuredClone(section.items);
      const next = structuredClone(operation.items);
      if (same(previous, next)) continue;
      const previousEnglishReady = draft.englishReady;
      section.items = next;
      inverseOperations.unshift({ op: "replace_cards", section: operation.section, items: previous, englishReadyBefore: previousEnglishReady });
      if (next.some((item) => !isGapMarker(item.title.en) || !isGapMarker(item.body.en))) draft.englishReady = true;
      if (typeof operation.englishReadyBefore === "boolean") draft.englishReady = operation.englishReadyBefore;
      for (const item of next) {
        for (const part of ["title", "body"]) appliedTargets.push(`${operation.section}.items.${item.id}.${part}.zh`, `${operation.section}.items.${item.id}.${part}.en`);
      }
      if (!next.length) appliedTargets.push(operation.section);
      continue;
    }
    if (operation.op === "replace_commercial_terms") {
      const previous = structuredClone(draft.content.commercialTerms);
      const next = commercialTermsSchema.parse(structuredClone(operation.terms));
      if (same(previous, next)) continue;
      const previousEnglishReady = draft.englishReady;
      inverseOperations.unshift({ op: "replace_commercial_terms", terms: previous, englishReadyBefore: previousEnglishReady });
      draft.content.commercialTerms = next;
      if (next.some((term) => !isGapMarker(term.value.en))) draft.englishReady = true;
      if (typeof operation.englishReadyBefore === "boolean") draft.englishReady = operation.englishReadyBefore;
      if (next.length) {
        appliedTargets.push("commercialTerms");
        for (const term of next) appliedTargets.push(`commercialTerms.items.${term.id}.value.zh`, `commercialTerms.items.${term.id}.value.en`);
      } else {
        appliedTargets.push("commercialTerms.visibility");
      }
      continue;
    }
    if (operation.op === "update_commercial_term") {
      const index = draft.content.commercialTerms.findIndex((term) => term.id === operation.termId);
      const previous = index >= 0 ? draft.content.commercialTerms[index] : undefined;
      if (!previous) throw new Error(`Commercial term ${operation.termId} does not exist`);
      const next = commercialTermSchema.parse({
        ...previous,
        ...(operation.kind !== undefined ? { kind: operation.kind } : {}),
        ...(operation.value !== undefined ? { value: structuredClone(operation.value) } : {}),
      });
      const nextTerms = structuredClone(draft.content.commercialTerms);
      nextTerms[index] = next;
      commercialTermsSchema.parse(nextTerms);
      if (same(previous, next)) continue;
      const previousEnglishReady = draft.englishReady;
      inverseOperations.unshift({
        op: "update_commercial_term",
        termId: previous.id,
        kind: previous.kind,
        value: structuredClone(previous.value),
        englishReadyBefore: previousEnglishReady,
      });
      draft.content.commercialTerms[index] = next;
      if (!isGapMarker(next.value.en)) draft.englishReady = true;
      if (typeof operation.englishReadyBefore === "boolean") draft.englishReady = operation.englishReadyBefore;
      appliedTargets.push("commercialTerms");
      if (previous.kind !== next.kind) appliedTargets.push("commercialTerms.visibility");
      if (!same(previous.value, next.value)) appliedTargets.push(`commercialTerms.items.${next.id}.value.zh`, `commercialTerms.items.${next.id}.value.en`);
      continue;
    }
    if (operation.op === "remove_commercial_term") {
      const index = draft.content.commercialTerms.findIndex((term) => term.id === operation.termId);
      if (index < 0) throw new Error(`Commercial term ${operation.termId} does not exist`);
      const previous = structuredClone(draft.content.commercialTerms);
      inverseOperations.unshift({ op: "replace_commercial_terms", terms: previous, englishReadyBefore: draft.englishReady });
      draft.content.commercialTerms.splice(index, 1);
      appliedTargets.push("commercialTerms.visibility");
      continue;
    }
    if (operation.op === "replace_equipment") {
      const previous = structuredClone(draft.content.equipment);
      const next = equipmentSchema.parse(structuredClone(operation.equipment));
      if (same(previous, next)) continue;
      const previousEnglishReady = draft.englishReady;
      inverseOperations.unshift({ op: "replace_equipment", equipment: previous, englishReadyBefore: previousEnglishReady });
      draft.content.equipment = next;
      if (next.some((item) => !isGapMarker(item.name.en) || (item.spec && !isGapMarker(item.spec.en)))) draft.englishReady = true;
      if (typeof operation.englishReadyBefore === "boolean") draft.englishReady = operation.englishReadyBefore;
      if (next.length) {
        appliedTargets.push("equipment");
        for (const item of next) {
          appliedTargets.push(`equipment.items.${item.id}.name.zh`, `equipment.items.${item.id}.name.en`);
          if (item.quantity !== null) appliedTargets.push(`equipment.items.${item.id}.quantity`);
          if (item.spec && !isGapMarker(item.spec.zh)) appliedTargets.push(`equipment.items.${item.id}.spec.zh`, `equipment.items.${item.id}.spec.en`);
        }
      } else {
        appliedTargets.push("equipment.visibility");
      }
      continue;
    }
    if (operation.op === "update_equipment") {
      const index = draft.content.equipment.findIndex((item) => item.id === operation.equipmentId);
      const previous = index >= 0 ? draft.content.equipment[index] : undefined;
      if (!previous) throw new Error(`Equipment ${operation.equipmentId} does not exist`);
      const next = equipmentItemSchema.parse({
        ...previous,
        ...(operation.name !== undefined ? { name: structuredClone(operation.name) } : {}),
        ...(operation.quantity !== undefined ? { quantity: operation.quantity } : {}),
        ...(operation.spec !== undefined ? { spec: structuredClone(operation.spec) } : {}),
      });
      const nextEquipment = structuredClone(draft.content.equipment);
      nextEquipment[index] = next;
      equipmentSchema.parse(nextEquipment);
      if (same(previous, next)) continue;
      const previousEnglishReady = draft.englishReady;
      inverseOperations.unshift({
        op: "update_equipment",
        equipmentId: previous.id,
        name: structuredClone(previous.name),
        quantity: previous.quantity,
        spec: structuredClone(previous.spec),
        englishReadyBefore: previousEnglishReady,
      });
      draft.content.equipment[index] = next;
      if (!isGapMarker(next.name.en) || (next.spec && !isGapMarker(next.spec.en))) draft.englishReady = true;
      if (typeof operation.englishReadyBefore === "boolean") draft.englishReady = operation.englishReadyBefore;
      appliedTargets.push("equipment");
      if (!same(previous.name, next.name)) appliedTargets.push(`equipment.items.${next.id}.name.zh`, `equipment.items.${next.id}.name.en`);
      if (previous.quantity !== next.quantity) appliedTargets.push(`equipment.items.${next.id}.quantity`);
      if (!same(previous.spec, next.spec)) {
        if (next.spec && !isGapMarker(next.spec.zh)) appliedTargets.push(`equipment.items.${next.id}.spec.zh`, `equipment.items.${next.id}.spec.en`);
      }
      continue;
    }
    if (operation.op === "remove_equipment") {
      const index = draft.content.equipment.findIndex((item) => item.id === operation.equipmentId);
      if (index < 0) throw new Error(`Equipment ${operation.equipmentId} does not exist`);
      const previous = structuredClone(draft.content.equipment);
      inverseOperations.unshift({ op: "replace_equipment", equipment: previous, englishReadyBefore: draft.englishReady });
      draft.content.equipment.splice(index, 1);
      appliedTargets.push("equipment.visibility");
      continue;
    }
    if (operation.op === "replace_quality_process") {
      const previous = structuredClone(draft.content.qualityProcess);
      const next = qualityProcessSchema.parse(structuredClone(operation.steps));
      if (same(previous, next)) continue;
      const previousEnglishReady = draft.englishReady;
      inverseOperations.unshift({ op: "replace_quality_process", steps: previous, englishReadyBefore: previousEnglishReady });
      draft.content.qualityProcess = next;
      if (next.some((step) => !isGapMarker(step.title.en) || (step.body && !isGapMarker(step.body.en)))) draft.englishReady = true;
      if (typeof operation.englishReadyBefore === "boolean") draft.englishReady = operation.englishReadyBefore;
      if (next.length) {
        appliedTargets.push("qualityProcess");
        for (const step of next) {
          appliedTargets.push(`qualityProcess.items.${step.id}.title.zh`, `qualityProcess.items.${step.id}.title.en`);
          if (step.body && !isGapMarker(step.body.zh)) appliedTargets.push(`qualityProcess.items.${step.id}.body.zh`, `qualityProcess.items.${step.id}.body.en`);
        }
      } else {
        appliedTargets.push("qualityProcess.visibility");
      }
      continue;
    }
    if (operation.op === "update_quality_process") {
      const index = draft.content.qualityProcess.findIndex((step) => step.id === operation.stepId);
      const previous = index >= 0 ? draft.content.qualityProcess[index] : undefined;
      if (!previous) throw new Error(`Quality process step ${operation.stepId} does not exist`);
      const next = qualityProcessStepSchema.parse({
        ...previous,
        ...(operation.title !== undefined ? { title: structuredClone(operation.title) } : {}),
        ...(operation.body !== undefined ? { body: structuredClone(operation.body) } : {}),
      });
      const nextSteps = structuredClone(draft.content.qualityProcess);
      nextSteps[index] = next;
      qualityProcessSchema.parse(nextSteps);
      if (same(previous, next)) continue;
      const previousEnglishReady = draft.englishReady;
      inverseOperations.unshift({
        op: "update_quality_process",
        stepId: previous.id,
        title: structuredClone(previous.title),
        body: structuredClone(previous.body),
        englishReadyBefore: previousEnglishReady,
      });
      draft.content.qualityProcess[index] = next;
      if (!isGapMarker(next.title.en) || (next.body && !isGapMarker(next.body.en))) draft.englishReady = true;
      if (typeof operation.englishReadyBefore === "boolean") draft.englishReady = operation.englishReadyBefore;
      appliedTargets.push("qualityProcess");
      if (!same(previous.title, next.title)) appliedTargets.push(`qualityProcess.items.${next.id}.title.zh`, `qualityProcess.items.${next.id}.title.en`);
      if (!same(previous.body, next.body) && next.body && !isGapMarker(next.body.zh)) appliedTargets.push(`qualityProcess.items.${next.id}.body.zh`, `qualityProcess.items.${next.id}.body.en`);
      continue;
    }
    if (operation.op === "remove_quality_process") {
      const index = draft.content.qualityProcess.findIndex((step) => step.id === operation.stepId);
      if (index < 0) throw new Error(`Quality process step ${operation.stepId} does not exist`);
      const previous = structuredClone(draft.content.qualityProcess);
      inverseOperations.unshift({ op: "replace_quality_process", steps: previous, englishReadyBefore: draft.englishReady });
      draft.content.qualityProcess.splice(index, 1);
      appliedTargets.push("qualityProcess.visibility");
      continue;
    }
    if (operation.op === "reorder_quality_process") {
      const previous = draft.content.qualityProcess.map((step) => step.id);
      const order = [...new Set(operation.order)];
      if (order.length !== previous.length || order.some((id) => !previous.includes(id))) throw new Error("Quality process order must contain every existing step exactly once");
      if (same(previous, order)) continue;
      const byId = new Map(draft.content.qualityProcess.map((step) => [step.id, step] as const));
      inverseOperations.unshift({ op: "reorder_quality_process", order: previous });
      draft.content.qualityProcess = order.map((id) => structuredClone(byId.get(id)!));
      appliedTargets.push("qualityProcess.order");
      continue;
    }
    if (operation.op === "replace_history") {
      const previous = structuredClone(draft.content.history);
      const next = historySchema.parse(structuredClone(operation.history));
      if (same(previous, next)) continue;
      const previousEnglishReady = draft.englishReady;
      inverseOperations.unshift({ op: "replace_history", history: previous, englishReadyBefore: previousEnglishReady });
      draft.content.history = next;
      if (next.some((item) => !isGapMarker(item.event.en))) draft.englishReady = true;
      if (typeof operation.englishReadyBefore === "boolean") draft.englishReady = operation.englishReadyBefore;
      if (next.length) {
        appliedTargets.push("history");
        for (const item of next) appliedTargets.push(`history.items.${item.id}.year`, `history.items.${item.id}.event.zh`, `history.items.${item.id}.event.en`);
      } else {
        appliedTargets.push("history.visibility");
      }
      continue;
    }
    if (operation.op === "update_history") {
      const index = draft.content.history.findIndex((item) => item.id === operation.itemId);
      const previous = index >= 0 ? draft.content.history[index] : undefined;
      if (!previous) throw new Error(`History item ${operation.itemId} does not exist`);
      const next = historyItemSchema.parse({
        ...previous,
        ...(operation.year !== undefined ? { year: operation.year } : {}),
        ...(operation.event !== undefined ? { event: structuredClone(operation.event) } : {}),
      });
      const nextHistory = structuredClone(draft.content.history);
      nextHistory[index] = next;
      historySchema.parse(nextHistory);
      if (same(previous, next)) continue;
      const previousEnglishReady = draft.englishReady;
      inverseOperations.unshift({ op: "update_history", itemId: previous.id, year: previous.year, event: structuredClone(previous.event), englishReadyBefore: previousEnglishReady });
      draft.content.history[index] = next;
      if (!isGapMarker(next.event.en)) draft.englishReady = true;
      if (typeof operation.englishReadyBefore === "boolean") draft.englishReady = operation.englishReadyBefore;
      appliedTargets.push("history");
      if (previous.year !== next.year) appliedTargets.push(`history.items.${next.id}.year`);
      if (!same(previous.event, next.event)) appliedTargets.push(`history.items.${next.id}.event.zh`, `history.items.${next.id}.event.en`);
      continue;
    }
    if (operation.op === "remove_history") {
      const index = draft.content.history.findIndex((item) => item.id === operation.itemId);
      if (index < 0) throw new Error(`History item ${operation.itemId} does not exist`);
      const previous = structuredClone(draft.content.history);
      inverseOperations.unshift({ op: "replace_history", history: previous, englishReadyBefore: draft.englishReady });
      draft.content.history.splice(index, 1);
      appliedTargets.push("history.visibility");
      continue;
    }
    if (operation.op === "reorder_history") {
      const previous = draft.content.history.map((item) => item.id);
      const order = [...new Set(operation.order)];
      if (order.length !== previous.length || order.some((id) => !previous.includes(id))) throw new Error("History order must contain every existing item exactly once");
      if (same(previous, order)) continue;
      const byId = new Map(draft.content.history.map((item) => [item.id, item] as const));
      inverseOperations.unshift({ op: "reorder_history", order: previous });
      draft.content.history = order.map((id) => structuredClone(byId.get(id)!));
      appliedTargets.push("history.order");
      continue;
    }
    if (operation.op === "remove_card") {
      const items = draft.content[operation.section].items;
      const index = items.findIndex((item) => item.id === operation.itemId);
      if (index < 0) throw new Error(`Card ${operation.itemId} does not exist`);
      const [item] = items.splice(index, 1);
      inverseOperations.unshift({ op: "add_card", section: operation.section, index, item });
      appliedTargets.push(`${operation.section}.items.${operation.itemId}`);
      continue;
    }
    if (operation.op === "update_product") {
      const product = draft.products.find((item) => item.id === operation.productId);
      if (!product) throw new Error(`Product ${operation.productId} does not exist`);
      if ((typeof operation.name === "object" && operation.name) || (typeof operation.summary === "object" && operation.summary) || (typeof operation.category === "object" && operation.category)) {
        const previousEnglishReady = draft.englishReady;
        const inverse: SiteOperation = { op: "update_product", productId: operation.productId,
          ...(operation.name ? { name: typeof operation.name === "object" ? structuredClone(product.name) : product.name.zh } : {}),
          ...(operation.summary ? { summary: typeof operation.summary === "object" ? structuredClone(product.summary) : product.summary.zh } : {}),
          ...(operation.category ? { category: structuredClone(product.category) } : {}),
          englishReadyBefore: previousEnglishReady,
        };
        let changed = false;
        if (typeof operation.name === "object") { if (product.name.zh !== operation.name.zh || product.name.en !== operation.name.en) changed = true; product.name = structuredClone(operation.name); appliedTargets.push(`products.${operation.productId}.name.zh`, `products.${operation.productId}.name.en`); }
        if (typeof operation.summary === "object") { if (product.summary.zh !== operation.summary.zh || product.summary.en !== operation.summary.en) changed = true; product.summary = structuredClone(operation.summary); appliedTargets.push(`products.${operation.productId}.summary.zh`, `products.${operation.productId}.summary.en`); }
        if (typeof operation.category === "object") { if (JSON.stringify(product.category) !== JSON.stringify(operation.category)) changed = true; product.category = structuredClone(operation.category); appliedTargets.push(`products.${operation.productId}.category.zh`, `products.${operation.productId}.category.en`); }
        if (changed) { if ((typeof operation.name === "object" && !isGapMarker(operation.name.en)) || (typeof operation.summary === "object" && !isGapMarker(operation.summary.en)) || (typeof operation.category === "object" && !isGapMarker(operation.category.en))) draft.englishReady = true; if (typeof operation.englishReadyBefore === "boolean") draft.englishReady = operation.englishReadyBefore; inverseOperations.unshift(inverse); }
        continue;
      }
      const locale = operation.locale ?? "zh";
      const previousEnglishReady = draft.englishReady;
      const inverse: SiteOperation = {
        op: "update_product",
        productId: operation.productId,
        locale,
        ...(operation.name ? { name: product.name[locale] } : {}),
        ...(operation.summary ? { summary: product.summary[locale] } : {}),
        ...(operation.category ? { category: structuredClone(product.category) } : {}),
        englishReadyBefore: previousEnglishReady,
      };
      let changed = false;
      if (operation.name && product.name[locale] !== operation.name) {
        product.name[locale] = operation.name;
        appliedTargets.push(`products.${operation.productId}.name.${locale}`);
        changed = true;
      }
      if (operation.summary && product.summary[locale] !== operation.summary) {
        product.summary[locale] = operation.summary;
        appliedTargets.push(`products.${operation.productId}.summary.${locale}`);
        changed = true;
      }
      if (operation.category && typeof operation.category === "string" && product.category !== operation.category) {
        product.category = operation.category;
        appliedTargets.push(`products.${operation.productId}.category`);
        changed = true;
      }
      if (changed) {
        if (typeof operation.englishReadyBefore === "boolean") draft.englishReady = operation.englishReadyBefore;
        inverseOperations.unshift(inverse);
      }
      continue;
    }
    if (operation.op === "set_product_specs") {
      const product = draft.products.find((item) => item.id === operation.productId);
      if (!product) throw new Error(`Product ${operation.productId} does not exist`);
      const previous = product.specs ? structuredClone(product.specs) : [];
      const next = operation.specs.map((spec) => ({ ...structuredClone(spec), value: normalizeSpecValue(spec.value) }));
      if (same(previous, next)) continue;
      const previousEnglishReady = draft.englishReady;
      inverseOperations.unshift({ op: "set_product_specs", productId: operation.productId, specs: previous, englishReadyBefore: previousEnglishReady });
      if (next.length) product.specs = next;
      else delete product.specs;
      if (specsHaveReadyEnglish(next)) draft.englishReady = true;
      if (typeof operation.englishReadyBefore === "boolean") draft.englishReady = operation.englishReadyBefore;
      appliedTargets.push(`products.${operation.productId}.specs`);
      continue;
    }
    if (operation.op === "set_catalog_section") {
      const previous = readCatalogSection(draft, operation.section);
      const next = normalizeCatalogSection(operation.section, operation.value);
      if (same(previous, next)) continue;
      inverseOperations.unshift({
        op: "set_catalog_section",
        section: operation.section,
        value: previous,
      });
      writeCatalogSection(draft, operation.section, next);
      appliedTargets.push(`content.${operation.section}`);
      continue;
    }
    if (operation.op === "set_template") {
      if (!options.templateIds.has(operation.templateId)) throw new Error(`Unknown template ${operation.templateId}`);
      if (draft.templateId === operation.templateId) continue;
      inverseOperations.unshift({ op: "replace_draft", draft: cloneDraft(draft) });
      draft.templateId = operation.templateId;
      draft.pagePlan = rehostPagePlan(draft.pagePlan, draft.templateId);
      appliedTargets.push("template", "pagePlan");
      continue;
    }
    if (operation.op === "set_visual_brief") {
      const brief = visualBriefCatalog.find((item) => item.id === operation.briefId);
      if (!brief) throw new Error(`Unknown visual brief ${operation.briefId}`);
      if (!options.templateIds.has(brief.templateId)) throw new Error(`Unknown template ${brief.templateId}`);
      const nextPaletteId = defaultPaletteIdForVisualBrief(brief.id);
      const lookUnchanged = draft.visualBrief.id === brief.id
        && draft.templateId === brief.templateId
        && draft.paletteId === nextPaletteId;
      if (lookUnchanged && !draft.legacyVisualBriefId) continue;
      // A catalog id cannot reconstruct an older mapping or a manually selected
      // template. History must restore the actual saved design and content.
      inverseOperations.unshift({ op: "replace_draft", draft: cloneDraft(draft) });
      draft.visualBrief = structuredClone(brief);
      draft.templateId = brief.templateId;
      draft.paletteId = nextPaletteId;
      draft.pagePlan = rehostPagePlan(draft.pagePlan, draft.templateId);
      delete draft.legacyVisualBriefId;
      appliedTargets.push("visualBrief", "template", "pagePlan");
      continue;
    }
    if (operation.op === "set_palette") {
      const allowed = operation.paletteId === "default"
        || paletteCatalogForVisualBrief(draft.visualBrief.id).some((palette) => palette.id === operation.paletteId);
      if (!allowed) throw new Error(`Palette ${operation.paletteId} is not available for ${draft.visualBrief.id}`);
      if (draft.paletteId === operation.paletteId && !draft.customPalette) continue;
      if (draft.customPalette) inverseOperations.unshift({ op: "set_custom_palette", palette: structuredClone(draft.customPalette) });
      inverseOperations.unshift({ op: "set_palette", paletteId: draft.paletteId });
      draft.paletteId = operation.paletteId;
      draft.customPalette = null;
      appliedTargets.push("palette");
      continue;
    }
    if (operation.op === "set_custom_palette") {
      if (operation.palette) {
        const checked = validateColorPalette(operation.palette);
        if (!checked.ok) throw new Error(checked.reason + "：" + checked.failures.join("、"));
      }
      if (JSON.stringify(draft.customPalette) === JSON.stringify(operation.palette)) continue;
      inverseOperations.unshift({ op: "set_custom_palette", palette: draft.customPalette ? structuredClone(draft.customPalette) : null });
      draft.customPalette = operation.palette ? structuredClone(operation.palette) : null;
      appliedTargets.push("palette");
      continue;
    }
    if (operation.op === "set_section_visibility") {
      const wasVisible = !draft.hiddenSections.includes(operation.section);
      if (wasVisible === operation.visible) continue;
      draft.hiddenSections = operation.visible
        ? draft.hiddenSections.filter((item) => item !== operation.section)
        : [...draft.hiddenSections, operation.section];
      inverseOperations.unshift({ ...operation, visible: wasVisible });
      appliedTargets.push(`${operation.section}.visibility`);
      continue;
    }
    if (operation.op === "reorder_sections") {
      const nextOrder = operation.order;
      if (new Set(nextOrder ?? []).size !== (nextOrder ?? []).length) throw new Error("区块顺序不能重复");
      const previous = draft.sectionOrder ? [...draft.sectionOrder] : null;
      if (same(previous, nextOrder)) continue;
      inverseOperations.unshift({ op: "reorder_sections", order: previous });
      if (nextOrder === null || nextOrder.length === 0) delete draft.sectionOrder;
      else draft.sectionOrder = [...nextOrder];
      appliedTargets.push("sectionOrder");
      continue;
    }
    if (operation.op === "set_page_plan") {
      const nextPlan = resolvePagePlan({
        templateId: draft.templateId,
        source: operation.source,
        requested: operation.pages,
        unsupported: operation.unsupported,
      });
      if (same(draft.pagePlan, nextPlan)) continue;
      inverseOperations.unshift({
        op: "set_page_plan",
        source: draft.pagePlan.source,
        pages: draft.pagePlan.pages.map((page) => ({
          id: page.id,
          role: page.role,
          label: page.label,
        })),
        unsupported: structuredClone(draft.pagePlan.unsupported),
      });
      draft.pagePlan = nextPlan;
      appliedTargets.push("pagePlan");
      continue;
    }
    if (operation.op === "set_image_slot") {
      const next = resolveImageRef(operation, options.siteId);
      const previous = readHeroImage(draft);
      if (same(previous, next)) continue;
      if (previous) {
        inverseOperations.unshift({
          op: "set_image_slot",
          target: operation.target,
          imageId: previous.imageId,
          url: previous.url,
          alt: previous.alt,
          ...(previous.credit ? { credit: previous.credit } : {}),
        });
      } else {
        inverseOperations.unshift({ op: "remove_image_slot", target: operation.target });
      }
      writeHeroImage(draft, next);
      appliedTargets.push(operation.target);
      continue;
    }
    if (operation.op === "remove_image_slot") {
      const previous = readHeroImage(draft);
      if (!previous) continue;
      inverseOperations.unshift({
        op: "set_image_slot",
        target: operation.target,
        imageId: previous.imageId,
        url: previous.url,
        alt: previous.alt,
        ...(previous.credit ? { credit: previous.credit } : {}),
      });
      writeHeroImage(draft, undefined);
      appliedTargets.push(operation.target);
      continue;
    }
    if (operation.op === "set_product_image") {
      const product = draft.products.find((item) => item.id === operation.productId);
      if (!product) throw new Error(`Product ${operation.productId} does not exist`);
      const next = resolveImageRef(operation, options.siteId);
      const previous = product.image;
      if (same(previous, next)) continue;
      if (previous) {
        inverseOperations.unshift({
          op: "set_product_image",
          productId: operation.productId,
          imageId: previous.imageId,
          url: previous.url,
          alt: previous.alt,
          ...(previous.credit ? { credit: previous.credit } : {}),
        });
      } else {
        inverseOperations.unshift({ op: "remove_product_image", productId: operation.productId });
      }
      product.image = next;
      appliedTargets.push(`products.${operation.productId}.image`);
      continue;
    }
    if (operation.op === "remove_product_image") {
      const product = draft.products.find((item) => item.id === operation.productId);
      if (!product) throw new Error(`Product ${operation.productId} does not exist`);
      const previous = product.image;
      if (!previous) continue;
      inverseOperations.unshift({
        op: "set_product_image",
        productId: operation.productId,
        imageId: previous.imageId,
        url: previous.url,
        alt: previous.alt,
        ...(previous.credit ? { credit: previous.credit } : {}),
      });
      delete product.image;
      appliedTargets.push(`products.${operation.productId}.image`);
      continue;
    }
    if (operation.op === "replace_products") {
      assertStableItemIds({ products: operation.products }, options.siteId);
      const next = ensureProductIds(operation.products).map(normalizeProductSpecs);
      if (same(draft.products, next)) continue;
      const previousEnglishReady = draft.englishReady;
      inverseOperations.unshift({ op: "replace_products", products: structuredClone(draft.products), englishReadyBefore: previousEnglishReady });
      draft.products = next;
      if (next.some(productHasReadyEnglish)) draft.englishReady = true;
      if (typeof operation.englishReadyBefore === "boolean") draft.englishReady = operation.englishReadyBefore;
      appliedTargets.push("products");
    }
  }

  // Layouts are checked on the draft the whole batch ends on, so a layout and the materials it
  // needs can come in either order, and an undo that restores both passes too. A layout asked for
  // here that the draft cannot show refuses the batch; one chosen earlier that this batch leaves
  // short goes back to the look's default, with a notice.
  const notices: string[] = [];
  const look = blockLookForTemplate(draft.templateId);
  const blockVariants = { ...draft.blockVariants };
  let layoutsChanged = false;
  for (const [block, variant] of layoutRequests) {
    const refusal = layoutRefusal(draft, look, block, variant);
    if (refusal) throw new Error(refusal);
    if (look?.defaults[block] === variant) {
      delete blockVariants[block];
      layoutsChanged = true;
    }
  }
  if (look) {
    for (const [key, variant] of Object.entries(draft.blockVariants)) {
      const block = key as BlockId;
      if (layoutRequests.has(block) || !variant) continue;
      if (!layoutBlocks(look).includes(block)) continue;
      const refusal = layoutRefusal(draft, look, block, variant);
      if (!refusal) continue;
      delete blockVariants[block];
      layoutsChanged = true;
      inverseOperations.unshift({ op: "set_block_variant", block, variant });
      appliedTargets.push(`blockVariants.${block}`);
      notices.push(`${withoutFullStop(refusal)}，${blockCatalog[block].label}改回${variantLabel(block, look.defaults[block])}。`);
    }
  }
  if (layoutsChanged) draft.blockVariants = blockVariants;

  if (!inverseOperations.length) return { draft: current, inverseOperations: [], appliedTargets: [], changed: false, notices: [] };
  draft.revision = current.revision + 1;
  draft.lastChange = options.lastChange;
  return { draft, inverseOperations, appliedTargets, changed: true, notices };
}

// Company and site names are facts: use the wording that appears in the user's message or materials
// (so a model translation such as an English rendering of a Chinese name is not kept). With no such
// wording the Chinese value is used; a gap never replaces the current neutral name.
function sourceWrittenName(value: string | { zh: string; en: string }, message: string): string | null {
  const candidates = (typeof value === "string" ? [value] : [value.zh, value.en])
    .map((item) => item.trim())
    .filter((item) => item && !isGapMarker(item));
  if (!candidates.length) return null;
  return candidates.find((item) => message.includes(item)) ?? candidates[0];
}

// Visitor prose drops gap-only and build-talk sentences before it reaches the draft (T-045).
const VISITOR_PROSE_TARGETS = new Set<TextTarget>(["hero.subtitle", "about.body", "features.intro", "services.intro", "products.intro", "contact.body", "faq.intro"]);

function cleanVisitorProse(operation: AIOperation, rejected: string[]): AIOperation | null {
  // Fact text must pass numeric admission before prose cleanup can discard
  // punctuation. Invalid raw spellings are rejected, never cleaned into facts.
  const cleanFact = (value: { zh: string; en: string }, label: string) => {
    if (canonicalCommercialNumbers(value.zh) === null || canonicalCommercialNumbers(value.en) === null) {
      rejected.push(`${label}中有暂不支持的数值写法，未写入`);
      return null;
    }
    return stripGapTalkBilingual(value) as { zh: string; en: string };
  };
  if (operation.op === "set_text" && VISITOR_PROSE_TARGETS.has(operation.target)) {
    return { ...operation, value: stripGapTalkBilingual(operation.value, operation.locale ?? "zh") } as AIOperation;
  }
  if (operation.op === "update_card" && operation.body) {
    return { ...operation, body: stripGapTalkBilingual(operation.body, operation.locale ?? "zh") } as AIOperation;
  }
  if (operation.op === "add_card") {
    return { ...operation, item: { ...operation.item, body: stripGapTalkBilingual(operation.item.body) as { zh: string; en: string } } } as AIOperation;
  }
  if (operation.op === "replace_cards") {
    return { ...operation, items: operation.items.map((item) => ({ ...item, body: stripGapTalkBilingual(item.body) as { zh: string; en: string } })) } as AIOperation;
  }
  if (operation.op === "replace_quality_process") {
    return { ...operation, steps: operation.steps.flatMap((step) => {
      const body = step.body ? cleanFact(step.body, "质检步骤") : null;
      return step.body && !body ? [] : [{ ...step, body }];
    }) } as AIOperation;
  }
  if (operation.op === "update_quality_process" && operation.body) {
    const body = cleanFact(operation.body, "质检步骤");
    return body ? { ...operation, body } as AIOperation : null;
  }
  if (operation.op === "replace_history") {
    return { ...operation, history: operation.history.flatMap((item) => {
      const event = cleanFact(item.event, "沿革条目");
      return event ? [{ ...item, event }] : [];
    }) } as AIOperation;
  }
  if (operation.op === "update_history" && operation.event) {
    const event = cleanFact(operation.event, "沿革条目");
    return event ? { ...operation, event } as AIOperation : null;
  }
  if (operation.op === "update_product" && operation.summary) {
    return { ...operation, summary: stripGapTalkBilingual(operation.summary, operation.locale ?? "zh") } as AIOperation;
  }
  if (operation.op === "replace_products") {
    return { ...operation, products: operation.products.map((product) => ({ ...product, summary: stripGapTalkBilingual(product.summary) as { zh: string; en: string } })) } as AIOperation;
  }
  if (operation.op === "set_catalog_section" && operation.value) {
    return {
      ...operation,
      value: {
        ...operation.value,
        intro: stripGapTalkBilingual(operation.value.intro) as { zh: string; en: string },
        items: operation.value.items.map((item) => {
          const body = stripGapTalkBilingual(item.body) as { zh: string; en: string };
          // Industry explanations are optional. Schema validation has already required both
          // language properties; only explicitly blank strings represent intentional omission.
          if (operation.section === "industries") {
            for (const locale of ["zh", "en"] as const) {
              if (typeof item.body[locale] === "string" && item.body[locale].trim() === "") body[locale] = "";
            }
          }
          return { ...item, body };
        }),
      },
    } as AIOperation;
  }
  return operation;
}

const INTERNAL_REASON = /HTML|CSS|快照|URL|声明|区块|字段|模板|槽|slot|operation/i;

/**
 * Checks the model's layout requests on the draft its other changes produce (T-053): a layout the
 * materials do not support is dropped with a reason, and a layout the change leaves short is
 * announced as going back to the default. Without a draft (older callers) requests pass through
 * and the commit checks them.
 */
function checkLayoutRequests(
  accepted: SiteOperation[],
  draft: SiteDraft,
  templateIds: Set<string>,
  rejected: string[],
  notes: string[],
): SiteOperation[] {
  const requests = accepted.filter((operation) => operation.op === "set_block_variant");
  const others = accepted.filter((operation) => operation.op !== "set_block_variant");
  let after: SiteDraft;
  try {
    after = applySiteOperations(draft, others, { templateIds, lastChange: "layout-check" }).draft;
  } catch {
    // The other changes fail on their own; the commit reports that. Nothing to add here.
    return accepted;
  }
  const look = blockLookForTemplate(after.templateId);
  const refused = new Set<SiteOperation>();
  for (const operation of requests) {
    if (operation.op !== "set_block_variant" || operation.variant === null) continue;
    const refusal = layoutRefusal(after, look, operation.block, operation.variant);
    if (!refusal) continue;
    refused.add(operation);
    const showing = after.blockVariants[operation.block] ?? look?.defaults[operation.block];
    const note = refusal === LAYOUT_LOOK_NOT_READY || !showing || !look
      ? refusal
      : `${withoutFullStop(refusal)}，${keepsLayoutPhrase(operation.block, showing)}。`;
    if (!notes.includes(note)) notes.push(note);
    rejected.push(note);
  }
  const kept = accepted.filter((operation) => !refused.has(operation));
  try {
    for (const notice of applySiteOperations(draft, kept, { templateIds, lastChange: "layout-check" }).notices) {
      if (!notes.includes(notice)) notes.push(notice);
    }
  } catch {
    // Same as above: the commit reports it.
  }
  return kept;
}

export function validateAIOperations(
  message: string,
  operations: AIOperation[],
  templateIds: Set<string>,
  draft?: SiteDraft,
): { operations: SiteOperation[]; rejected: string[]; notes: string[]; commercialTermRejections?: CommercialTermRejection[] } {
  const rejected: string[] = [];
  const notes: string[] = [];
  const commercialTermRejections: CommercialTermRejection[] = [];
  const accepted: SiteOperation[] = [];
  const explicitTemplateSwitch = /(?:换|切换|改用|使用|选择|更换).{0,10}(?:模板|版式)|(?:template).{0,20}(?:switch|change|use)/i.test(message);
  for (const [operationIndex, rawOperation] of operations.entries()) {
    const operation = cleanVisitorProse(rawOperation, rejected);
    if (!operation) continue;
    if (operation.op === "reorder_sections") {
      const rawOrder = operation.order;
      const dropped = rawOrder === null ? [] : rawOrder.filter((item) => !(movableBlockIds as readonly string[]).includes(item));
      const validOrder = rawOrder === null ? null : [...new Set(rawOrder.filter((item): item is (typeof movableBlockIds)[number] => (movableBlockIds as readonly string[]).includes(item)))];
      let normalized = { ...operation, order: validOrder } as typeof operation;
      if (dropped.length) notes.push(`区块顺序中忽略未知项：${dropped.join("、")}。`);
      if (draft && validOrder !== null) {
        const look = blockLookForTemplate(draft.templateId);
        if (look) {
          const resolved = effectiveBlockOrder({ ...draft, sectionOrder: validOrder ?? undefined }, look)
            .filter((block): block is (typeof movableBlockIds)[number] => (movableBlockIds as readonly string[]).includes(block));
          normalized = { ...operation, order: resolved } as typeof operation;
        }
      } else {
        normalized = { ...operation, order: validOrder } as typeof operation;
      }
      accepted.push(normalized as unknown as SiteOperation);
      continue;
    }
    if (operation.op === "set_site_style") {
      const checked = validateSiteStyleRules(operation.rules);
      if (!checked.ok) {
        rejected.push(...checked.errors.slice(0, 2).map((error) => `站点样式没有应用：${error}`));
        continue;
      }
      accepted.push({ ...operation, rules: checked.rules });
      continue;
    }
    if (operation.op === "set_page_plan" && operation.unsupported?.length) {
      // The model explains unsupported pages in its own words; reasons that talk about templates,
      // snapshots or HTML are replaced so the workspace only shows plain language.
      accepted.push({
        ...operation,
        unsupported: operation.unsupported.map((item) => INTERNAL_REASON.test(item.reason)
          ? { requested: item.requested, reason: `当前样子还没有「${item.requested}」页面，这一页先不单独做。` }
          : item),
      });
      continue;
    }
    if (operation.op === "set_text" && (operation.target === "companyName" || operation.target === "siteName")) {
      const name = sourceWrittenName(operation.value, message);
      if (!name) {
        rejected.push(`${operation.target === "companyName" ? "公司名" : "站名"}资料里没有，保留原来的名称`);
        continue;
      }
      accepted.push({ op: "set_text", target: operation.target, value: name });
      continue;
    }
    if (rawOperation.op === "set_text" && rawOperation.target === "faq.intro" && isModelInstruction(rawOperation.value)) {
      rejected.push("常见问题引言是写给模型的指令，已拒绝");
      continue;
    }
    if (operation.op === "update_card" && operation.title && operation.body && isGapMarker(operation.title) && isGapMarker(operation.body)) {
      rejected.push("标题和正文都缺的条目不会写入");
      continue;
    }
    if (operation.op === "add_card") {
      const cardIsGap = (["zh", "en"] as const).every((locale) => isGapMarker(operation.item.title[locale]) && isGapMarker(operation.item.body[locale]));
      if (cardIsGap) {
        rejected.push("标题和正文都缺的条目不会写入");
        continue;
      }
    }
    if (operation.op === "replace_cards") {
      if (!operation.items.length) {
        rejected.push("没有可写入的条目，整组没有修改");
        continue;
      }
      const shown = operation.items.filter((item) => !(["zh", "en"] as const).every((locale) => isGapMarker(item.title[locale]) && isGapMarker(item.body[locale])));
      if (shown.length < operation.items.length) rejected.push("标题和正文都缺的条目不会写入");
      if (operation.items.length && !shown.length) continue;
      const limit = MAX_AI_CARDS[operation.section];
      const words = CARD_GROUP_WORDS[operation.section];
      if (limit !== undefined && shown.length > limit) rejected.push(`${words.name}最多写 ${limit} ${words.unit}，其余 ${shown.length - limit} ${words.unit}没有写入`);
      accepted.push({ ...operation, items: limit === undefined ? shown : shown.slice(0, limit) });
      continue;
    }
    if (operation.op === "set_product_specs") {
      accepted.push({ ...operation, specs: groundProductSpecs(operation.specs, message, rejected, notes) });
      continue;
    }
    if (operation.op === "set_catalog_section") {
      if (!operation.value) {
        accepted.push(operation);
        continue;
      }
      accepted.push({ ...operation, value: groundCatalogSection(operation.value, message, rejected) });
      continue;
    }
    if (operation.op === "replace_commercial_terms") {
      const terms = groundCommercialTerms(operation.terms, message, rejected, { operationIndex, operation: operation.op, rejections: commercialTermRejections });
      if (terms.length) {
        accepted.push({ ...operation, terms });
      } else {
        rejected.push("没有可写入的商业条款，整组没有修改");
      }
      continue;
    }
    if (operation.op === "replace_equipment") {
      const equipment = groundEquipment(operation.equipment, message, rejected);
      if (equipment.length) {
        accepted.push({ ...operation, equipment });
      } else {
        rejected.push("没有可写入的设备，整组没有修改");
      }
      continue;
    }
    if (operation.op === "replace_quality_process") {
      const steps = groundQualityProcess(operation.steps, message, rejected);
      if (steps.length) {
        accepted.push({ ...operation, steps });
      } else {
        rejected.push("没有可写入的质检流程，整组没有修改");
      }
      continue;
    }
    if (operation.op === "replace_history") {
      const items = groundHistory(operation.history, message, rejected);
      if (items.length) accepted.push({ ...operation, history: items });
      else rejected.push("没有可写入的沿革，整组没有修改");
      continue;
    }
    if (operation.op === "update_equipment") {
      if (!draft) {
        accepted.push(operation);
        continue;
      }
      const current = draft.content.equipment.find((item) => item.id === operation.equipmentId);
      if (!current) {
        rejected.push(`设备 ${operation.equipmentId} 不存在`);
        continue;
      }
      const candidate = equipmentItemSchema.safeParse({
        ...current,
        ...(operation.name !== undefined ? { name: operation.name } : {}),
        ...(operation.quantity !== undefined ? { quantity: operation.quantity } : {}),
        ...(operation.spec !== undefined ? { spec: operation.spec } : {}),
      });
      if (!candidate.success) {
        rejected.push("设备修改未通过完整设备数组校验");
        continue;
      }
      const grounded = groundEquipment([candidate.data], message, rejected)[0];
      if (!grounded) continue;
      const nextEquipment = draft.content.equipment.map((item) => item.id === grounded.id ? grounded : item);
      const checkedEquipment = equipmentSchema.safeParse(nextEquipment);
      if (!checkedEquipment.success) {
        rejected.push("设备修改未通过完整设备数组校验");
        continue;
      }
      accepted.push({ ...operation, name: grounded.name, quantity: grounded.quantity, spec: grounded.spec });
      continue;
    }
    if (operation.op === "update_quality_process") {
      if (!draft) {
        accepted.push(operation);
        continue;
      }
      const current = draft.content.qualityProcess.find((step) => step.id === operation.stepId);
      if (!current) {
        rejected.push(`质检步骤 ${operation.stepId} 不存在`);
        continue;
      }
      const candidate = qualityProcessStepSchema.safeParse({
        ...current,
        ...(operation.title !== undefined ? { title: operation.title } : {}),
        ...(operation.body !== undefined ? { body: operation.body } : {}),
      });
      if (!candidate.success) {
        rejected.push("质检步骤修改未通过完整质检流程校验");
        continue;
      }
      const grounded = groundQualityProcess([candidate.data], message, rejected)[0];
      if (!grounded) continue;
      accepted.push({ ...operation, title: grounded.title, body: grounded.body });
      continue;
    }
    if (operation.op === "update_history") {
      if (!draft) {
        accepted.push(operation);
        continue;
      }
      const current = draft.content.history.find((item) => item.id === operation.itemId);
      if (!current) {
        rejected.push(`沿革条目 ${operation.itemId} 不存在`);
        continue;
      }
      const candidate = historyItemSchema.safeParse({
        ...current,
        ...(operation.year !== undefined ? { year: operation.year } : {}),
        ...(operation.event !== undefined ? { event: operation.event } : {}),
      });
      if (!candidate.success) {
        rejected.push("沿革修改未通过完整沿革校验");
        continue;
      }
      const grounded = groundHistory([candidate.data], message, rejected)[0];
      if (!grounded) continue;
      accepted.push({ ...operation, year: grounded.year, event: grounded.event });
      continue;
    }
    if (operation.op === "update_commercial_term") {
      if (!draft) {
        accepted.push(operation);
        continue;
      }
      const current = draft.content.commercialTerms.find((term) => term.id === operation.termId);
      if (!current) {
        rejected.push(`商业条款 ${operation.termId} 不存在`);
        continue;
      }
      const candidate = {
        ...current,
        ...(operation.kind !== undefined ? { kind: operation.kind } : {}),
        ...(operation.value !== undefined ? { value: operation.value } : {}),
      };
      const candidateTerms = draft.content.commercialTerms.map((term) => term.id === candidate.id ? candidate : term);
      const candidateSchema = commercialTermsSchema.safeParse(candidateTerms);
      if (!candidateSchema.success) {
        rejected.push("商业条款种类不能重复，未写入这次修改");
        continue;
      }
      const grounded = groundCommercialTerm(candidate, message, rejected, { operationIndex, operation: operation.op, rejections: commercialTermRejections });
      if (grounded) {
        const nextTerms = draft.content.commercialTerms.map((term) => term.id === grounded.id ? grounded : term);
        const checkedTerms = commercialTermsSchema.safeParse(nextTerms);
        if (!checkedTerms.success) {
          rejected.push("商业条款种类不能重复，未写入这次修改");
          continue;
        }
        accepted.push({ ...operation, kind: grounded.kind, value: grounded.value });
      }
      continue;
    }
    if (operation.op === "replace_products") {
      accepted.push({
        ...operation,
        products: operation.products.map((product) => {
          if (!product.specs?.length) return product;
          return { ...product, specs: groundProductSpecs(product.specs, message, rejected, notes) };
        }),
      });
      continue;
    }
    if (operation.op === "set_template") {
      if (!explicitTemplateSwitch) {
        rejected.push("用户没有明确要求更换模板，已拒绝模板切换");
        continue;
      }
      if (!templateIds.has(operation.templateId)) {
        rejected.push(`模板 ${operation.templateId} 不在白名单中`);
        continue;
      }
      accepted.push(operation);
      continue;
    }
    accepted.push(operation);
  }
  const equipmentNames = new Set<string>();
  if (draft) for (const item of draft.content.equipment) equipmentNames.add(item.name.zh.trim());
  for (const operation of accepted) {
    if (operation.op === "replace_equipment") for (const item of operation.equipment) equipmentNames.add(item.name.zh.trim());
    if (operation.op === "update_equipment" && operation.name) equipmentNames.add(operation.name.zh.trim());
  }
  const certificationNames = new Set<string>();
  if (draft?.content.certifications) for (const item of draft.content.certifications.items) certificationNames.add(item.title.zh.trim());
  for (const operation of accepted) {
    if (operation.op === "set_catalog_section" && operation.section === "certifications" && operation.value) {
      for (const item of operation.value.items) certificationNames.add(item.title.zh.trim());
    }
  }
  const deduped = accepted.map((operation): SiteOperation | null => {
    if (operation.op === "replace_quality_process") {
      const steps = operation.steps.filter((step) => {
        const text = `${step.title.zh} ${step.body?.zh ?? ""}`;
        const duplicate = [...equipmentNames, ...certificationNames].some((fact) => fact && text.includes(fact));
        if (duplicate) rejected.push(`质检流程步骤重复设备或认证事实，已忽略「${step.title.zh}」`);
        return !duplicate;
      });
      return steps.length ? { ...operation, steps } : null;
    }
    if (operation.op === "update_quality_process") {
      const text = `${operation.title?.zh ?? ""} ${operation.body?.zh ?? ""}`;
      const duplicate = [...equipmentNames, ...certificationNames].some((fact) => fact && text.includes(fact));
      if (duplicate) {
        rejected.push(`质检流程步骤重复设备或认证事实，已忽略「${operation.title?.zh ?? operation.stepId}」`);
        return null;
      }
    }
    if (operation.op !== "set_catalog_section" || operation.section !== "capabilities" || !operation.value || !equipmentNames.size) return operation;
    const items = operation.value.items.filter((item) => {
      const text = `${item.title.zh} ${item.body.zh}`;
      const duplicate = [...equipmentNames].some((name) => name && text.includes(name));
      if (duplicate) rejected.push(`加工能力条目重复设备事实，已忽略「${item.title.zh}」`);
      return !duplicate;
    });
    return { ...operation, value: { ...operation.value, items } };
  }).filter((operation): operation is SiteOperation => operation !== null);
  const checked = draft ? checkLayoutRequests(deduped, draft, templateIds, rejected, notes) : deduped;
  return { operations: checked, rejected, notes, ...(commercialTermRejections.length ? { commercialTermRejections } : {}) };
}

function groundProductSpecs(
  specs: ProductSpecParameter[],
  materials: string,
  rejected: string[],
  notes: string[] = [],
): ProductSpecParameter[] {
  return specs.map((spec) => {
    const value = specValueText(spec.value, "zh").trim();
    if (isGapMarker(value)) {
      return { ...spec, value: normalizeSpecValue(spec.value) };
    }
    if (materialsIncludesFact(materials, value)) {
      const normalized = normalizeSpecValue(spec.value);
      if (typeof normalized !== "string" && isGapMarker(normalized.en)) {
        notes.push(`参数「${spec.name.zh || spec.name.en}」还没有英文值，英文页暂不显示这一项`);
      }
      return { ...spec, value: normalized };
    }
    rejected.push(`参数「${spec.name.zh || spec.name.en}」的值不在资料中，已改为待补充`);
    return {
      ...spec,
      value: typeof spec.value === "object" || hasHan(value)
        ? { zh: "待补充", en: ENGLISH_SPEC_GAP }
        : "待补充",
    };
  });
}

function groundCatalogSection(
  section: CatalogSectionValue,
  materials: string,
  rejected: string[],
): CatalogSectionValue {
  return {
    ...section,
    items: section.items.map((item) => {
      const next = { ...item, title: { ...item.title }, body: { ...item.body } };
      for (const locale of ["zh", "en"] as const) {
        const title = next.title[locale].trim();
        const body = next.body[locale].trim();
        if (!isGapMarker(title) && !materialsIncludesFact(materials, title) && /[\d]/.test(title)) {
          rejected.push(`条目标题「${title}」含资料外数字，已改为待补充`);
          next.title[locale] = "待补充";
        }
        if (!isGapMarker(body) && !materialsIncludesFact(materials, body) && (/[\d]/.test(body) || !materialsIncludesFact(materials, next.title.zh || next.title.en))) {
          // Keep title when it appears in materials; only ground the invented body/fact.
          if (!materialsIncludesFact(materials, body)) {
            rejected.push(`条目正文不在资料中，已改为待补充`);
            next.body[locale] = "待补充";
          }
        }
      }
      return next;
    }),
  };
}

function groundCommercialTerms(terms: CommercialTerm[], materials: string, rejected: string[], audit: CommercialTermAuditContext): CommercialTerm[] {
  const grounded: CommercialTerm[] = [];
  for (const term of terms) {
    const next = groundCommercialTerm(term, materials, rejected, audit);
    if (next) grounded.push(next);
  }
  return grounded;
}

// Extract the declared unsigned decimal/range spelling. Admission below must
// first prove its leading context is a text/code or neutral delimiter boundary;
// an unknown attached symbol is not a boundary and cannot be skipped.
const COMMERCIAL_NUMBER_RE = /(\d+(?:(?:\s*[,.–—-])+\s*\d+)*)(?:\s*(万|亿|million|billion))?/gi;
// Consume the whole context between numeric tokens. Only plain letter words,
// letter-to-letter hyphens and the existing neutral separators prove a boundary;
// an isolated mark cannot stand in for a word or hide an earlier symbol.
const COMMERCIAL_NUMBER_CONTEXT_RE = /^(?:\p{Letter}|(?<=\p{Letter})[-–—](?=\p{Letter})|[\s:：,，;；、()（）\[\]【】{}"'“”‘’/=<>≤≥。！？!?]|\.(?=\s))*$/u;
// A complete ASCII alphanumeric code owns its internal hyphen/slash. Signs,
// spaces, marks and partial code prefixes cannot become a code boundary.
const COMMERCIAL_CODE_RE = /(?<![A-Za-z0-9/.-])(?:[A-Za-z][A-Za-z0-9]*(?:[-/][A-Za-z0-9]+)*|\d+(?:[-/][A-Za-z][A-Za-z0-9]*)+)(?![A-Za-z0-9/-]|\.(?=\S))/g;
const COMMERCIAL_KIND_HINTS: Record<CommercialTermKind, string[]> = {
  moq: ["moq", "起订量", "起订", "起接", "minimum order"],
  lead_time: ["交期", "lead time", "lead-time", "天数"],
  capacity: ["产能", "年产", "月产", "月注塑", "capacity"],
  trade_terms: ["贸易条款", "trade terms", "fob", "exw", "cif"],
  payment: ["付款", "payment"],
  packaging: ["包装", "packaging"],
};

type CommercialNumberToken = { value: string; start: number; end: number; code: boolean };

function canonicalCommercialNumbers(value: string, tokens?: CommercialNumberToken[]): string[] | null {
  // Unsupported Unicode numeric characters are quantities, not an absence of
  // quantities. Reject their representation without inventing a conversion.
  if (/(?![0-9])\p{Number}/u.test(value)) return null;
  const codes = [...value.matchAll(COMMERCIAL_CODE_RE)].filter((match) => /\d/.test(match[0]));
  const numbers: string[] = [];
  let previousEnd = 0;
  let previousNumeric = false;
  const scanner = new RegExp(COMMERCIAL_NUMBER_RE.source, COMMERCIAL_NUMBER_RE.flags);
  let match: RegExpExecArray | null;
  while ((match = scanner.exec(value))) {
    const start = match.index;
    const code = codes.find((token) => token.index <= start && start < token.index + token[0].length);
    const context = value.slice(previousEnd, code?.index ?? match.index);
    // Two uncoded numbers need a real token boundary. A glued Latin continuation
    // or numeric division is one unsupported notation, not neutral prose from
    // which scanning may restart (1e3 and 1/2 must not become scalar lists).
    if (previousNumeric && !code && (/^[A-Za-z]+$/.test(context) || /^\s*[/／]\s*$/.test(context))) return null;
    // Percent suffixes and digit-to-letter code hyphens belong to the preceding
    // admitted number; they are not permissible signs before a new number.
    const leading = previousEnd ? context.replace(/^(?:[%％]|[-–—](?=\p{Letter}))/u, "") : context;
    if (!COMMERCIAL_NUMBER_CONTEXT_RE.test(leading)) return null;
    if (code) {
      // Keep the full code identity, not only its numeric substring. This also
      // prevents R-17 -> S-17 / R17 / 17 from passing number correspondence.
      numbers.push(`code:${code[0].toUpperCase()}`);
      tokens?.push({ value: `code:${code[0].toUpperCase()}`, start: code.index, end: code.index + code[0].length, code: true });
      previousEnd = code.index + code[0].length;
      // A greedy numeric match can cross the code's last digit and a comma
      // into a separate quantity. Resume at the code end, not that match end.
      scanner.lastIndex = previousEnd;
      previousNumeric = false;
      continue;
    }
    const shift = { 万: 4, 亿: 8, million: 6, billion: 9 }[String(match[2] ?? "").toLowerCase()] ?? 0;
    const parts = match[1].replace(/\s*([–—-])\s*/g, "$1").replace(/[—-]/g, "–").split("–");
    if (parts.length > 2) return null;
    const normalized: string[] = [];
    for (const part of parts) {
      // Decimal identity is exact: validate grouping, then move the decimal
      // point by a power of ten. No binary float or safe-integer coercion.
      if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(part)) return null;
      const [integer, fraction = ""] = part.replace(/,/g, "").split(".");
      const digits = integer + fraction;
      const point = integer.length + shift;
      const whole = digits.slice(0, point).padEnd(point, "0").replace(/^0+(?=\d)/, "");
      const decimal = digits.slice(point).replace(/0+$/, "");
      normalized.push(decimal ? `${whole}.${decimal}` : whole);
    }
    numbers.push(normalized.join("–"));
    tokens?.push({ value: normalized.join("–"), start: match.index, end: match.index + match[0].length, code: false });
    previousEnd = match.index + match[0].length;
    previousNumeric = true;
  }
  if (numbers.length) {
    const tail = value.slice(previousEnd).replace(/^(?:[%％]|[-–—](?=\p{Letter}))/u, "").replace(/\.$/, ". ");
    if (!COMMERCIAL_NUMBER_CONTEXT_RE.test(tail)) return null;
  }
  return numbers;
}

// Derive the existing writer's exact prefix with a one-character body. The
// prefix includes its body delimiter; no instruction or optional body marker
// is used as company material, and direct undecorated input remains unchanged.
const COMPANY_MATERIALS_PREFIX = wrapCompanyMaterials("\u0000").slice(0, -1);

function stripWrappedCommercialInstructions(materials: string): string {
  const input = materials.trim();
  return input.startsWith(COMPANY_MATERIALS_PREFIX) ? input.slice(COMPANY_MATERIALS_PREFIX.length) : materials;
}

type CommercialFactFragment = { text: string; context: string; source: string };

// A removable field label must retain its meaning in the requested kind. Known
// materials/answer wrappers carry no quantity facts. Quantity verbs (年产/月产),
// subjects, limits and another kind's field label remain in the source clause.
const COMMERCIAL_WRAPPER_LABEL = /^(?:公司资料|资料|答)\s*[：:]\s*/;
const COMMERCIAL_FIELD_LABELS: Record<CommercialTermKind, RegExp> = {
  moq: /^(?:起订量|起订|起接|MOQ|minimum order)\s*[：:]\s*/i,
  lead_time: /^(?:交期|lead[ -]time)\s*[：:]\s*/i,
  capacity: /^(?:产能|capacity)\s*[：:]\s*/i,
  trade_terms: /^(?:贸易条款|trade terms)\s*[：:]\s*/i,
  payment: /^(?:付款方式|付款|payment)\s*[：:]\s*/i,
  packaging: /^(?:包装|packaging)\s*[：:]\s*/i,
};

function commercialFactFragments(materials: string, kind?: CommercialTermKind): CommercialFactFragment[] {
  const source = stripWrappedCommercialInstructions(materials);
  return source.split(/\r?\n/).flatMap((line) => {
    const trimmed = line.trim();
    if (!trimmed) return [];
    return trimmed.split(/[。！？!?]/).map((text) => {
      const sentence = text.trim();
      const context = Object.entries(COMMERCIAL_KIND_HINTS)
        .filter(([, hints]) => hints.some((hint) => sentence.toLowerCase().includes(hint.toLowerCase())))
        .map(([kind]) => kind)
        .join(" ");
      let value = sentence;
      let label = value.match(COMMERCIAL_WRAPPER_LABEL) ?? (kind ? value.match(COMMERCIAL_FIELD_LABELS[kind]) : null);
      while (label) {
        value = value.slice(label[0].length);
        label = value.match(COMMERCIAL_WRAPPER_LABEL) ?? (kind ? value.match(COMMERCIAL_FIELD_LABELS[kind]) : null);
      }
      return { text: value, context, source: sentence };
    }).filter((item) => item.text);
  });
}

const COMMERCIAL_KNOWN_CODES = /\b(?:EXW|FCA|FAS|FOB|CFR|CIF|CPT|CIP|DAP|DPU|DDP|MOQ|CNY|RMB|USD|EUR|JPY|GBP|HKD|CAD|AUD|SGD|KRW|INR|CHF|T\/T|L\/C|D\/P|D\/A|O\/A)\b/gi;

function englishCommercialCodes(value: string): string[] {
  const uppercase = /\b[A-Z][A-Z0-9/]{1,5}\b/g;
  return [...(value.match(COMMERCIAL_KNOWN_CODES) ?? []), ...(value.match(uppercase) ?? [])].map((code) => code.toUpperCase()).filter((code, index, all) => all.indexOf(code) === index);
}

const CAPACITY_PERIODS: Record<string, string> = {
  年: "year", 月: "month", 周: "week", 日: "day", 天: "day", 小时: "hour",
  annual: "year", annually: "year", yearly: "year", monthly: "month", weekly: "week", daily: "day", hourly: "hour",
};
const CAPACITY_EN_PERIOD_PATTERN = String.raw`(?:(?:\bper|\beach|\bevery|\ba|\ban)\s+|\/\s*)(year|month|week|day|hour)s?\b|\b(annually|yearly|monthly|weekly|daily|hourly)\b`;

const COMMERCIAL_UNIT_RULES = ([
  { key: "ten-thousand-piece", zhUnit: "万件", enUnit: "ten thousand (?:pcs?|pieces?|parts?)", en: /\b(?:10[,.]?000|ten thousand|\d[\d,.]*\s*million)\s+(?:[A-Za-z]+\s+)?(?:pcs?|pieces?|parts?)\b/i },
  { key: "piece", zhUnit: "件", enUnit: "(?:pcs?|pieces?|parts?)", en: /\d[\d,.]*\s*(?:pcs?|pieces?|parts?)\b/i },
  { key: "day", zhUnit: "天", enUnit: "days?", en: /\d[\d,.]*\s*days?\b/i },
  { key: "hour", zhUnit: "(?:小时|时)", enUnit: "(?:hours?|hrs?|h)", en: /\d[\d,.]*\s*(?:hours?|hrs?|h)\b/i },
  { key: "week", zhUnit: "(?:周|星期)", enUnit: "weeks?", en: /\d[\d,.]*\s*weeks?\b/i },
  { key: "month", zhUnit: "月", enUnit: "months?", en: /\d[\d,.]*\s*months?\b/i },
  { key: "year", zhUnit: "年", enUnit: "years?", en: /\d[\d,.]*\s*years?\b/i },
  { key: "equipment", zhUnit: "台", enUnit: "(?:units?|machines?)", en: /\d[\d,.]*(?:\s+[A-Za-z-]+){0,2}\s+(?:units?|machines?)\b/i },
  { key: "set", zhUnit: "套", enUnit: "sets?", zh: /单套/, en: /(?:\d[\d,.]*|\bone|\ba)\s+(?:sets?|molds?|moulds?)\b/i },
  { key: "ton", zhUnit: "(?:吨|t\\b)", enUnit: "(?:tons?|t)", en: /\d[\d,.]*\s*(?:tons?|t)\b/i },
  { key: "kg", zhUnit: "(?:千克|kg\\b)", enUnit: "kg", en: /\d[\d,.]*\s*kg\b/i },
] as const).map((rule) => ({ ...rule,
  zh: new RegExp(`(?:${COMMERCIAL_NUMBER_RE.source})\\s*(?:${rule.zhUnit})${"zh" in rule ? `|${rule.zh.source}` : ""}`, "i"),
  en: new RegExp(rule.en.source.replaceAll(String.raw`\d[\d,.]*`, `(?:${COMMERCIAL_NUMBER_RE.source})`), "i"),
}));
const COMMERCIAL_DECLARED_UNIT_RULES = COMMERCIAL_UNIT_RULES.map((rule) => {
  // Latin unit tokens keep their boundary inside Han text. A Han unit needs
  // its own token boundary or an explicit unit declaration; characters inside
  // 文件/台账/周边/套管 are not standalone unit identities.
  const latin = rule.key === "ton" || rule.key === "kg";
  const boundary = latin ? "A-Za-z0-9/-" : "\\p{Letter}\\p{Number}";
  const codeSuffix = "\\s+code\\b|编号|型";
  const unitNoun = ({ piece: "零件", day: "天数", year: "年份" } as Record<string, string>)[rule.key];
  const zhIdentity = `(?:${rule.zhUnit}${unitNoun ? `|${unitNoun}` : ""})`;
  const enIdentity = `(?:${rule.enUnit})`;
  return {
    key: rule.key,
    zh: new RegExp(`(?:每|按)(?:${rule.zhUnit})`, "i"),
    en: new RegExp(`\\b(?:in|per)\\s+(?:${rule.enUnit})\\b`, "i"),
    unquantifiedZh: new RegExp(`(?<![${boundary}])(?:${rule.zhUnit})(?![${boundary}]${latin ? `|${codeSuffix}` : ""})${unitNoun ? `|${unitNoun}` : ""}`, "iu"),
    unquantifiedEn: new RegExp(`(?<![A-Za-z0-9/-])(?:${rule.enUnit})(?![A-Za-z0-9-]|(?!${CAPACITY_EN_PERIOD_PATTERN})/|${codeSuffix})`, "i"),
    identityZh: new RegExp(`^${zhIdentity}$`, "iu"),
    identityEn: new RegExp(`^${enIdentity}$`, "i"),
    enDeclarationStart: new RegExp(`^${enIdentity}(?![A-Za-z0-9])`, "i"),
  };
});

// These are the only source phrases in the simulated packs where Chinese puts the
// business unit before the number. They are explicit source facts, not a generic
// window or a lexical-word exception.
const BUSINESS_UNIT_PHRASES = [
  { key: "year", zh: /年产(?:约|大约)?\s*\d[\d,.]*/ },
  { key: "month", zh: /月注塑能力(?:约|大约)?\s*\d[\d,.]*/ },
] as const;

const BARE_ZH_UNIT = new RegExp(`^(?:${COMMERCIAL_UNIT_RULES.map((rule) => rule.zhUnit).join("|")})$`, "i");
const BARE_EN_UNIT = new RegExp(`^(?:${COMMERCIAL_UNIT_RULES.map((rule) => rule.enUnit).join("|")})$`, "i");

function commercialUnitIdentities(value: string, capacity = false, equipmentName = false): { identities: string[]; quantified: Array<{ quantity: string; unit: string }>; ratios: Array<{ numerator: string; denominator: string; explicit: boolean }> } | null {
  const numberTokens: CommercialNumberToken[] = [];
  const numbers = canonicalCommercialNumbers(value, numberTokens);
  if (!numbers) return null;
  const declarations: Array<{ keys: string[]; start: number; end: number }> = [];
  const ratios: Array<{ numerator: string; denominator: string; explicit: boolean }> = [];
  for (const range of capacityClauseRanges(value)) {
    const rawClause = value.slice(range.start, range.end).trim();
    const clause = rawClause.replace(/\.$/, "");
    const chineseDeclaration = /单位/.test(clause);
    const marked = chineseDeclaration || /\b(?:measurement\s+)?units?\s*(?:(?:is|are)\s+|[:=]\s*)|\bas\s+(?:(?:a|the)\s+)?(?:measurement\s+)?units?\b/i.test(clause);
    const statement = marked ? clause.match(chineseDeclaration
      ? /^(?:计量)?单位\s*(?:为|是|[:：=])?\s*(.+)$|^(?:(?:以|按|每)\s*)?(.+?)\s*(?:为|作为|是)?\s*单位$/u
      : /^(?:measurement\s+)?units?\s*(?:(?:is|are)\s+|[:=]\s*)(.+)$|^(.+?)\s+as\s+(?:(?:a|the)\s+)?(?:measurement\s+)?units?$/i) : null;
    // Existing English "in <unit>" can carry the translated declaration.
    // Ordinary uses of "in" do not become new declarations.
    const inUnits = !marked ? clause.match(/\bin\s+(.+)$/i) : null;
    const bareParts = clause.split(/\s*[/／]\s*|\s+per\s+/i);
    const wholeCode = [...clause.matchAll(COMMERCIAL_CODE_RE)].some((code) => code[0].includes("/")
      && (/\d/.test(code[0]) || (code[0].match(COMMERCIAL_KNOWN_CODES) ?? []).some((known) => known.length === code[0].length)));
    // A whole ratio of existing unit atoms supplies its own relation marker.
    // Exact known codes retain their ownership; surrounding prose is not guessed
    // into a ratio. Partial/extra operands in a unit expression refuse below.
    const bareRatio = !marked && !inUnits && !wholeCode && bareParts.length > 1
      && bareParts.some((part) => COMMERCIAL_DECLARED_UNIT_RULES.some((rule) => rule.identityZh.test(part.trim()) || rule.identityEn.test(part.trim())))
      && (/[/／]/.test(clause) && bareParts.every((part) => /^\p{Letter}+$/u.test(part.trim()))
        || COMMERCIAL_DECLARED_UNIT_RULES.some((rule) => rule.identityZh.test(bareParts[0].trim()) || rule.identityEn.test(bareParts[0].trim())));
    if (!marked && !bareRatio && (!inUnits || !COMMERCIAL_DECLARED_UNIT_RULES.some((rule) => rule.enDeclarationStart.test(inUnits[1])))) continue;
    if (marked && !statement) return null;
    const expression = (statement?.[1] ?? statement?.[2] ?? (bareRatio ? clause : inUnits![1])).trim();
    // Consume the entire declared scalar or single ratio. Unknown atoms,
    // extra operators and residual prose are not evidence of absent units.
    const parts = expression.split(chineseDeclaration ? /\s*[/／]\s*/u : /\s*\/\s*|\s+per\s+/i);
    if (parts.length > 2 || parts.some((part) => !part)) return null;
    const keys: string[] = [];
    for (const part of parts) {
      const rule = COMMERCIAL_DECLARED_UNIT_RULES.find((rule) => rule.identityZh.test(part.trim()) || rule.identityEn.test(part.trim()));
      if (!rule) return null;
      keys.push(rule.key);
    }
    // Ordered ratio identity prevents kg/件 from passing as 件/kg or as two
    // independent units. The ordinary raw-token gate remains unchanged.
    if (keys.length === 2) ratios.push({ numerator: keys[0], denominator: keys[1], explicit: marked || bareRatio });
    // Only the declaration owns these tokens; an earlier "Pieces output" is
    // still ordinary raw text and must remain visible to the unit gate.
    const start = range.start + value.slice(range.start, range.end).indexOf(rawClause) + (inUnits?.index ?? 0);
    declarations.push({ keys, start, end: range.end });
  }
  // A complete code owns its digits. Resume after that owner if a unit pattern
  // starts inside it; neither a classifier nor a later quantity belongs to it.
  const codes = [...value.matchAll(COMMERCIAL_CODE_RE)].filter((match) => /\d|[-/]/.test(match[0]));
  const quantified = COMMERCIAL_UNIT_RULES.flatMap((rule) => [rule.zh, rule.en].flatMap((pattern) => {
    const scanner = new RegExp(pattern.source, `${pattern.flags}g`);
    const parts: Array<{ key: string; start: number; end: number }> = [];
    let match: RegExpExecArray | null;
    while ((match = scanner.exec(value))) {
      const start = match.index;
      const end = scanner.lastIndex;
      const code = codes.find((code) => start < code.index + code[0].length && end > code.index);
      if (code) {
        scanner.lastIndex = code.index + code[0].length;
        continue;
      }
      parts.push({ key: rule.key, start, end });
    }
    return parts;
  }));
  const unitContexts = COMMERCIAL_DECLARED_UNIT_RULES.flatMap((rule) => [rule.zh, rule.en].flatMap((pattern) =>
    [...value.matchAll(new RegExp(pattern.source, `${pattern.flags}g`))].map((match) => ({ start: match.index, end: match.index + match[0].length }))));
  // A declared/per-unit atom owns its spelling (including "ten thousand
  // pieces"); it is not an independently supplied output quantity.
  const quantities = quantified.filter((part) => ![...declarations, ...unitContexts].some((owner) => owner.start <= part.start && owner.end >= part.end));
  const measurements = quantities.filter((part) => part.key !== "equipment"
    || !quantities.some((other) => other.key !== "equipment" && other.start === part.start && other.end < part.end));
  const relations: Array<{ quantity: string; unit: string }> = [];
  const observed = new Set<string>();
  for (const part of measurements) {
    // A suffix match must bind to the entire original number: 3–25 天 owns
    // "3–25", never the matched suffix "25". Codes cannot supply its digits.
    const token = numberTokens.find((token) => !token.code && token.start <= part.start && part.start < token.end && token.end <= part.end);
    const quantity = token?.value ?? (part.key === "set" ? "1" : part.key === "ten-thousand-piece" ? "10000" : null);
    if (!quantity) return null;
    // 万/million already belongs to the exact numerical identity. Its output
    // dimension is pieces; two regex views of one landing point are one claim.
    const unit = part.key === "ten-thousand-piece" ? "piece" : part.key;
    const landing = `${token?.start ?? part.start}:${unit}`;
    if (observed.has(landing)) continue;
    observed.add(landing);
    relations.push({ quantity, unit });
  }
  const clauses = capacityClauseRanges(value);
  const identities: string[] = [
    ...declarations.flatMap((part) => part.keys),
    ...measurements.map((part) => part.key),
    ...COMMERCIAL_DECLARED_UNIT_RULES.filter((rule) => {
      // Field language is not a token identity: Chinese company materials can
      // contain existing Han/Latin units with or without quantities.
      if (rule.zh.test(value) || rule.en.test(value)) return true;
      // In a device name, bare machine/unit words are the name's classifier.
      // Quantities, per-unit wording and declarations still prove this identity;
      // no assertion about translation of the device's proper name is made.
      if (equipmentName && rule.key === "equipment") return false;
      // A declaration owns its full span, including the word "units". That
      // marker cannot also invent an equipment identity in "hours as units".
      return [rule.unquantifiedZh, rule.unquantifiedEn].some((pattern) =>
        [...value.matchAll(new RegExp(pattern.source, `${pattern.flags}g`))].some((match) =>
          !declarations.some((part) => part.start <= match.index && part.end >= match.index + match[0].length)
          // A production noun before an actual measurement is its business
          // subject ("molded parts 15 days"), not another quantity unit. Per-unit
          // wording/declarations above and standalone units remain accountable.
          && !(["piece", "set", "equipment"].includes(rule.key) && measurements.some((part) =>
            part.start >= match.index + match[0].length && clauses.some((clause) => clause.start <= match.index && part.end <= clause.end)))));
    }).map((rule) => rule.key),
    ...BUSINESS_UNIT_PHRASES.filter((rule) => rule.zh.test(value)).map((rule) => rule.key),
  ];
  // Read units/declarations from the original tokens first. Period aliases add
  // identities without rewriting pcs/day into pcsper day or erasing code edges.
  if (capacity) {
    for (const match of value.matchAll(/(小时|年|月|周|日|天)(?=产(?:量|能)?|[\p{Script=Han}]{0,12}能力)/gu)) identities.push(CAPACITY_PERIODS[match[1]]);
    for (const match of value.matchAll(new RegExp(CAPACITY_EN_PERIOD_PATTERN, "gi"))) identities.push(match[1]?.toLowerCase() ?? CAPACITY_PERIODS[match[2].toLowerCase()]);
    for (const match of value.matchAll(new RegExp(`\\b(?:${Object.keys(CAPACITY_PERIODS).filter((word) => /^[a-z]+$/.test(word)).join("|")})\\b`, "gi"))) identities.push(CAPACITY_PERIODS[match[0].toLowerCase()]);
  }
  return { identities: identities.filter((key, index, all) => all.indexOf(key) === index), quantified: relations, ratios };
}

function commercialUnitsMatch(zh: string, en: string, capacity = false, equipmentName = false): boolean {
  const expected = commercialUnitIdentities(zh, capacity, equipmentName);
  if (!expected) return false;
  if (BARE_ZH_UNIT.test(zh.trim()) || BARE_EN_UNIT.test(en.trim())) return false;
  if (canonicalCommercialNumbers(en)?.length && /\bh\b/i.test(en) && !/(?:\d[\d,.]*\s*|\b(?:in|per)\s+)h\b/i.test(en)) return false;
  const actual = commercialUnitIdentities(en, capacity, equipmentName);
  if (!actual) return false;
  const compatible = (source: string, target: string) => {
    if (source === target) return true;
    if (source === "equipment" && target === "set") return true;
    if (source === "set" && target === "equipment") return false;
    if (source === "ten-thousand-piece" && target === "piece") return true;
    if (source === "piece" && target === "ten-thousand-piece") return true;
    return false;
  };
  // A supplied number-unit production needs a number-unit counterpart; a bare
  // noun elsewhere ("pieces: 5000") cannot replace that proven landing point.
  const unmatched = [...actual.quantified];
  // Reserve exact set matches before the directional 台 -> set alias. Consume
  // each occurrence once; independent number/unit bags cannot prove a claim.
  const ordered = [...expected.quantified].sort((a, b) => Number(a.unit === "equipment") - Number(b.unit === "equipment"));
  for (const source of ordered) {
    const index = unmatched.findIndex((target) => source.quantity === target.quantity && compatible(source.unit, target.unit));
    if (index < 0) return false;
    unmatched.splice(index, 1);
  }
  if (unmatched.length) return false;
  // Explicit ratios need an ordered counterpart. Ordinary unquantified rates
  // retain the existing period gate (e.g. 按kg每月供货 -> in kg per month).
  const requireRatios = [...expected.ratios, ...actual.ratios].some((ratio) => ratio.explicit || !Object.values(CAPACITY_PERIODS).includes(ratio.denominator));
  if (requireRatios) {
    const ratioMatches = (source: typeof expected.ratios[number], target: typeof actual.ratios[number]) =>
      compatible(source.numerator, target.numerator) && compatible(source.denominator, target.denominator);
    if (!expected.ratios.every((ratio) => actual.ratios.some((candidate) => ratioMatches(ratio, candidate)))
      || !actual.ratios.every((ratio) => expected.ratios.some((candidate) => ratioMatches(candidate, ratio)))) return false;
  }
  return expected.identities.every((unit) => actual.identities.some((candidate) => compatible(unit, candidate)))
    && actual.identities.every((unit) => expected.identities.some((candidate) => compatible(candidate, unit)));
}

function commercialFactFragmentMatches(fragment: CommercialFactFragment, clause: string, kind: CommercialTermKind, englishCodes: string[]): boolean {
  const hints = COMMERCIAL_KIND_HINTS[kind];
  const source = fragment.text.toLowerCase();
  const related = hints.some((hint) => source.includes(hint.toLowerCase())) || fragment.context.includes(kind);
  if (!related) return false;
  if (canonicalCommercialNumbers(fragment.source) === null) return false;
  const sourceClauses = capacityClauses(fragment.text);
  if (!sourceClauses.includes(clause)) return false;
  const sourceCodes = new Set(englishCommercialCodes(`${clause} ${fragment.source}`).map((code) => code.toUpperCase()));
  return englishCodes.every((code) => sourceCodes.has(code.toUpperCase()));
}

function materialContainsCommercialFact(materials: string, value: { zh: string; en: string }, kind: CommercialTermKind): boolean {
  const clauses = capacityClauses(value.zh);
  const fragments = commercialFactFragments(materials, kind);
  const englishCodes = englishCommercialCodes(value.en);
  return clauses.length > 0 && fragments.some((fragment) => clauses.every((clause) => commercialFactFragmentMatches(fragment, clause, kind, englishCodes)));
}

type CapacityRelation = { quantity: string; unit: string | null; period: string | null; qualifiers: string[] };
type CapacityClaim = CapacityRelation & { equipmentParent?: CapacityRelation };

function capacityRelationMatches(source: CapacityRelation, target: CapacityRelation): boolean {
  return source.quantity === target.quantity && source.period === target.period
    && JSON.stringify(source.qualifiers) === JSON.stringify(target.qualifiers)
    && (source.unit === target.unit || (source.unit === "equipment" && target.unit === "set"));
}
type CommercialTermRejection = {
  operationIndex: number;
  operation: "replace_commercial_terms" | "update_commercial_term";
  term: CommercialTerm;
  termTruncated: boolean;
  failedChecks: string[];
  chineseClaims: CapacityClaim[] | null;
  englishClaims: CapacityClaim[] | null;
  sourceMatches: boolean;
  parseEvidence: { zh: ReturnType<typeof capacityParseEvidence>; en: ReturnType<typeof capacityParseEvidence> };
  claimsTruncated: boolean;
  sourceFragmentCount: number;
  sourceFragments: Array<{ fragmentIndex: number; source: string; truncated: boolean; matchedClauses: string[]; matchedClauseCount: number; matchedClausesTruncated: boolean; parseEvidence: ReturnType<typeof capacityParseEvidence> & { coordinateSpace: "source"; offsetUnit: "utf16"; sourceLength: number } }>;
};
type CommercialTermAuditContext = { operationIndex: number; operation: CommercialTermRejection["operation"]; rejections: CommercialTermRejection[] };

// Quantified capacity uses complete, finite productions. There is no word-skipping
// branch: unknown subjects and modifiers are unsupported, including source words.
// Unquantified wording retains the existing T-079/T-082 mechanical checks.
type CapacityBound = "minimum" | "maximum" | "greater_than" | "less_than";
type CapacityModifierError = "negation_scope" | "comparison_scope" | "unsupported_syntax";
type CapacitySpan = { start: number; end: number; depth: number; kind: string };
type CapacityResidual = { start: number; end: number; depth: number; text: string; reason: string };
type CapacityParse = {
  claims: CapacityClaim[] | null;
  status: "complete" | "unsupported";
  spans: CapacitySpan[];
  residuals: CapacityResidual[];
  error?: CapacityModifierError;
};

// These patterns classify a refusal only. They never authorize unconsumed text.
const ENGLISH_CAPACITY_NEGATION = /\b(?:no|not|never|without|neither|nor|cannot)\b|\b[A-Za-z]+n['’]t\b/i;
const ENGLISH_CAPACITY_COMPARISON = /\b(?:more|greater|less|fewer|over|under|above|below|least|most|minimum|maximum|than|equal|equals|exactly|about|around|approximately|approx|roughly)\b|[<>≥≤]/i;

// Preserve raw positions while applying the same semantic-space rule as source
// matching. ASCII numbers/codes keep separators; Chinese words may close spaces.
function capacityInput(value: string, locale: "zh" | "en"): { text: string; offsets: number[] } {
  let text = "";
  const offsets: number[] = [];
  for (let i = 0; i < value.length;) {
    const space = value.slice(i).match(/^\s+/)?.[0];
    if (space && locale === "zh") {
      // Keep clause delimiters before normalization; joining two complete
      // newline-separated quantities would erase their ownership boundary.
      if (/[\r\n]/.test(space)) {
        text += space;
        for (let j = 0; j < space.length; j += 1) offsets.push(i + j);
      } else if (/[A-Za-z0-9.]/.test(value[i - 1] ?? "") && /[A-Za-z0-9.]/.test(value[i + space.length] ?? "")) {
        text += " "; offsets.push(i);
      }
      i += space.length;
    } else {
      text += value[i]; offsets.push(i); i += 1;
    }
  }
  return { text, offsets };
}

function normalizeCapacityChinese(value: string): string {
  return capacityInput(value, "zh").text;
}

// A delimiter inside a parenthesis is part of that substructure, never a new
// production clause. Malformed/nested parentheses remain visible to the parser.
function capacityClauseRanges(value: string): Array<{ start: number; end: number }> {
  const ranges: Array<{ start: number; end: number }> = [];
  let start = 0;
  let depth = 0;
  for (let i = 0; i < value.length; i += 1) {
    const char = value[i];
    if (char === "(" || char === "（") depth += 1;
    else if (char === ")" || char === "）") depth = Math.max(0, depth - 1);
    const delimiter = /[，；;。！？!?\n]/.test(char) || (char === "," && !(/\d/.test(value[i - 1] ?? "") && /\d/.test(value[i + 1] ?? "")));
    if (depth === 0 && delimiter) { ranges.push({ start, end: i }); start = i + 1; }
  }
  ranges.push({ start, end: value.length });
  return ranges.filter((range) => value.slice(range.start, range.end).trim());
}

function capacityClauses(value: string): string[] {
  return capacityClauseRanges(value).map(({ start, end }) => value.slice(start, end).trim());
}

const CAPACITY_EN_PERIOD_SUFFIX = new RegExp(`^(?:${CAPACITY_EN_PERIOD_PATTERN})`, "i");
const CAPACITY_SIMPLE_UNIT_RULES = COMMERCIAL_UNIT_RULES.filter((rule) => !["ten-thousand-piece", "piece", "equipment", "set"].includes(rule.key));
const CAPACITY_ZH_UNIT = new RegExp(`^(套(?:模具)?|件(?:注塑件)?|台(?:注塑机)?|${CAPACITY_SIMPLE_UNIT_RULES.map((rule) => rule.zhUnit).join("|")})`, "i");
const CAPACITY_EN_UNIT = new RegExp(`^(?:(?:injection(?:\\s+molding)?|molding)\\s+)?(machines?|units?)\\b|^(?:(?:mold|mould)\\s+)?(sets?|moulds?|molds?)\\b|^(?:(?:injection(?:\\s+|-)molded|molded|injection)\\s+)?(pcs?|pieces?|parts?)\\b|^(${CAPACITY_SIMPLE_UNIT_RULES.map((rule) => rule.enUnit).join("|")})\\b`, "i");
const CAPACITY_BOUND_COMPLEMENT: Record<CapacityBound, CapacityBound> = {
  greater_than: "maximum", less_than: "minimum", minimum: "less_than", maximum: "greater_than",
};
const CAPACITY_BOUND_WORDS: Record<string, CapacityBound> = {
  more: "greater_than", greater: "greater_than", over: "greater_than", above: "greater_than", ">": "greater_than",
  less: "less_than", fewer: "less_than", under: "less_than", below: "less_than", "<": "less_than",
  least: "minimum", minimum: "minimum", ">=": "minimum", "≥": "minimum",
  most: "maximum", maximum: "maximum", up: "maximum", "<=": "maximum", "≤": "maximum",
  不少于: "minimum", 不低于: "minimum", 至少: "minimum", 以上: "minimum",
  不超过: "maximum", 最多: "maximum", 最高: "maximum", 至多: "maximum", 以下: "maximum", 以内: "maximum",
  不足: "less_than", 少于: "less_than", 低于: "less_than", 小于: "less_than",
  超过: "greater_than", 多于: "greater_than", 大于: "greater_than",
};
const CAPACITY_NUMBER = /^(\d+(?:[,.]\d+)*(?:\s*[–—-]\s*\d+(?:[,.]\d+)*)?)(?:\s*(万|亿|million|billion))?/i;
const CAPACITY_EN_MODIFIER = /^(?:(no|not)\s+)?((?:more|greater|less|fewer)\s+than(?:\s+or\s+equal\s+to)?|over|above|under|below|at\s+(?:least|most)|up\s+to|minimum|maximum)(?![A-Za-z])|^(?:(no|not)\s*)?(>=|<=|≥|≤|>|<)|^(about|around|approximately|approx\.?|roughly)(?![A-Za-z])/i;
const CAPACITY_ZH_MODIFIER = /^(大约|约为|约|左右|不少于|不低于|至少|不超过|最多|最高|至多|不足|少于|低于|小于|超过|多于|大于|以上|以下|以内|>=|<=|≥|≤|>|<)/;

function capacityClaims(raw: string, locale: "zh" | "en"): CapacityParse {
  const input = capacityInput(raw, locale);
  const { text, offsets } = input;
  const claims: CapacityClaim[] = [];
  const spans: CapacitySpan[] = [];
  const residuals: CapacityResidual[] = [];
  const rawStart = (position: number) => offsets[position] ?? raw.length;
  const rawEnd = (position: number) => position > 0 ? (offsets[position - 1] ?? raw.length - 1) + 1 : rawStart(position);
  const span = (kind: string, start: number, end: number, depth = 0) => spans.push({ kind, start: rawStart(start), end: rawEnd(end), depth });
  const unsupported = (start: number, end: number, depth: number, reason: string, contextStart = start): CapacityParse => {
    const remaining = text.slice(contextStart, end);
    const error: CapacityModifierError = (locale === "en" ? ENGLISH_CAPACITY_NEGATION.test(remaining) : /不|未|非|无|没有/.test(remaining)) ? "negation_scope"
      : (locale === "en" ? ENGLISH_CAPACITY_COMPARISON.test(remaining) : /约|以上|以下|以内|左右|[<>≥≤]/.test(remaining)) ? "comparison_scope" : "unsupported_syntax";
    residuals.push({ start: rawStart(start), end: rawEnd(end), depth, text: raw.slice(rawStart(start), rawEnd(end)), reason });
    return { claims: null, status: "unsupported", spans, residuals, error };
  };
  // Validate numeric lexemes before clause boundaries can split malformed ones.
  if (canonicalCommercialNumbers(raw) === null) return unsupported(0, text.length, 0, "invalid_numeric_lexeme");
  // No numerical relationships are asserted here. Source/code/unit/cycle gates
  // still run below, so this does not invent absent dimensions or prove completeness.
  if (!/\p{Number}/u.test(text)) {
    if (text.trim()) span("unquantified", 0, text.length);
    return { claims, status: "complete", spans, residuals };
  }
  for (const range of capacityClauseRanges(text)) {
    let cursor = range.start;
    const skipSpace = () => { cursor += text.slice(cursor, range.end).match(/^\s*/)?.[0].length ?? 0; };
    const consume = (pattern: RegExp, kind: string, depth = 0): RegExpMatchArray | null => {
      skipSpace();
      const match = text.slice(cursor, range.end).match(pattern);
      if (!match) return null;
      span(kind, cursor, cursor + match[0].length, depth);
      cursor += match[0].length;
      return match;
    };
    let period: string | null = null;
    let approximate = false;
    let bound: CapacityBound | null = null;
    let qualifierConflict = false;
    const modifier = (position: "prefix" | "postfix"): boolean => {
      skipSpace();
      const start = cursor;
      // Post-number 'or fewer' is an inclusive bound, not a unit descriptor.
      const inclusive = locale === "en" && position === "postfix" ? consume(/^or\s+(fewer|less|more|greater)(?![A-Za-z])/i, "qualifier") : null;
      if (!inclusive && position === "postfix" && !(locale === "zh"
        ? /^(?:以上|以下|以内|左右)/.test(text.slice(cursor, range.end))
        : /^(?:at\s+(?:least|most)|minimum|maximum|about|around|approximately|approx\.?|roughly)(?![A-Za-z])/i.test(text.slice(cursor, range.end)))) return false;
      const match = inclusive ? null : consume(locale === "zh" ? CAPACITY_ZH_MODIFIER : CAPACITY_EN_MODIFIER, "qualifier");
      if (!inclusive && !match) return false;
      let nextBound: CapacityBound | null = null;
      if (inclusive) nextBound = /^(?:fewer|less)$/i.test(inclusive[1]) ? "maximum" : "minimum";
      else if (locale === "zh") {
        if (/^(?:大约|约为|约|左右)$/.test(match![1])) {
          if (approximate) qualifierConflict = true;
          approximate = true;
        } else nextBound = CAPACITY_BOUND_WORDS[match![1]];
      } else if (match![5]) {
        if (approximate) qualifierConflict = true;
        approximate = true;
      } else {
        const comparison = (match![2] ?? match![4]).toLowerCase().replace(/\s+/g, " ");
        nextBound = CAPACITY_BOUND_WORDS[comparison.replace(/^at /, "").split(" ")[0]];
        if (comparison.endsWith(" or equal to")) nextBound = nextBound === "greater_than" ? "minimum" : "maximum";
        if (match![1] || match![3]) {
          if (/^(?:up to|minimum|maximum)$/.test(comparison)) qualifierConflict = true;
          else nextBound = CAPACITY_BOUND_COMPLEMENT[nextBound];
        }
      }
      if (nextBound) {
        if (bound) qualifierConflict = true;
        bound = nextBound;
      }
      // Chinese equality exclusion is attached to this bound, never free prose.
      if (locale === "zh" && /^(?:以上|以下)$/.test(match![1])) {
        skipSpace();
        const exclusion = text.slice(cursor, range.end).match(/^(（不含）|\(不含\))/);
        if (exclusion) {
          span("parenthesis", cursor, cursor + 1);
          span("qualifier", cursor + 1, cursor + exclusion[0].length - 1, 1);
          span("parenthesis", cursor + exclusion[0].length - 1, cursor + exclusion[0].length);
          cursor += exclusion[0].length;
          bound = bound === "minimum" ? "greater_than" : "less_than";
        }
      }
      if (cursor === start) throw new Error("Capacity modifier did not consume text");
      return true;
    };
    // Finite neutral skeleton: [subject] [cycle + production predicate], or the
    // English [cycle adjective] [business subject + output/capacity predicate].
    // These domain categories do not authorize arbitrary company/product names.
    if (locale === "zh") {
      consume(/^(?:注塑机|注塑件|模具)/, "subject");
      const cycle = consume(/^(?:(?:每|按)(小时|年|月|周|日|天)(?:生产|产(?:量|能)?)?|(小时|年|月|周|日|天)(?:注塑能力|产(?:量|能)?))/, "period");
      if (cycle) period = CAPACITY_PERIODS[cycle[1] ?? cycle[2]];
      else consume(/^(?:生产|产能|产量|注塑能力)/, "predicate");
    } else {
      const cycle = consume(/^(annual(?:ly)?|yearly|monthly|weekly|daily|hourly)\b/i, "period");
      if (cycle) period = CAPACITY_PERIODS[cycle[1].toLowerCase()];
      consume(/^(?:(?:mold|mould|injection(?:\s+molding)?|molding)\s+)?(?:output|capacity|production)\b/i, "predicate");
    }
    // At most one approximate and one bound node may precede the quantity.
    for (let count = 0; count < 2 && modifier("prefix"); count += 1) { /* consume */ }
    skipSpace();
    const quantityStart = cursor;
    const number = consume(CAPACITY_NUMBER, "quantity");
    if (!number) return unsupported(cursor, range.end, 0, "expected_quantity_or_unknown_prefix", range.start);
    const quantity = canonicalCommercialNumbers(number[0])?.[0];
    if (!quantity) return unsupported(quantityStart, cursor, 0, "invalid_quantity");
    modifier("postfix");
    const unitMatch = consume(locale === "zh" ? CAPACITY_ZH_UNIT : CAPACITY_EN_UNIT, "unit");
    const unitWord = unitMatch ? (locale === "zh" ? unitMatch[1].replace(/模具|注塑件|注塑机/g, "") : unitMatch[1] ?? unitMatch[2] ?? unitMatch[3] ?? unitMatch[4]).toLowerCase() : null;
    const unit = !unitWord ? null : locale === "en" && unitMatch?.[1] ? "equipment"
      : locale === "en" && unitMatch?.[2] ? "set" : locale === "en" && unitMatch?.[3] ? "piece"
        : COMMERCIAL_UNIT_RULES.find((rule) => new RegExp(`^(?:${locale === "zh" ? rule.zhUnit : rule.enUnit})$`, "i").test(unitWord))?.key;
    for (let count = 0; count < 2 && modifier("postfix"); count += 1) { /* consume */ }
    const suffixCycle = consume(locale === "zh" ? /^(?:[/／]|每|按)(小时|年|月|周|日|天)/
      : CAPACITY_EN_PERIOD_SUFFIX, "period");
    if (suffixCycle) {
      if (period) return unsupported(quantityStart, cursor, 0, "multiple_cycles_for_quantity");
      const word = (suffixCycle[1] ?? suffixCycle[2]).toLowerCase();
      period = CAPACITY_PERIODS[word] ?? word;
    }
    // Only self-contained modifiers may follow a period. A relational phrase
    // requiring a later amount cannot bind back across the clause boundary.
    if (locale === "en") {
      for (let count = 0; count < 2; count += 1) {
        skipSpace();
        if (!/^(?:at\s+(?:least|most)|minimum|maximum|about|around|approximately|approx\.?|roughly)(?![A-Za-z])/i.test(text.slice(cursor, range.end))) break;
        modifier("postfix");
      }
    }
    if (qualifierConflict) return unsupported(range.start, cursor, 0, "ambiguous_or_duplicate_qualifier");
    const claim: CapacityClaim = { quantity, unit: unit ?? null, period, qualifiers: [...(approximate ? ["approximate"] : []), ...(bound ? [bound] : [])] };
    claims.push(claim);
    skipSpace();
    if (text[cursor] === "(" || text[cursor] === "（") {
      const close = text[cursor] === "(" ? ")" : "）";
      consume(/^[（(]/, "parenthesis");
      skipSpace();
      const childStart = cursor;
      // Equipment specifications are independent quantities. They cannot inherit
      // a production cycle, and their attachment is retained for relation matching.
      const specification = (unit === "equipment" || unit === "set") ? consume(CAPACITY_NUMBER, "quantity", 1) : null;
      if (!specification) return unsupported(childStart, range.end, 1, "unsupported_parenthetical_structure");
      const specUnit = consume(/^(t|tons?|kg|吨|千克)(?![A-Za-z])/i, "unit", 1);
      if (!specUnit) return unsupported(cursor, range.end, 1, "expected_equipment_specification_unit");
      skipSpace();
      if (text[cursor] !== close) return unsupported(cursor, range.end, 1, "unconsumed_equipment_specification");
      consume(close === ")" ? /^\)/ : /^）/, "parenthesis");
      const specWord = specUnit[1].toLowerCase();
      const specQuantity = canonicalCommercialNumbers(specification[0])?.[0];
      if (!specQuantity) return unsupported(childStart, cursor, 1, "invalid_quantity");
      claims.push({ quantity: specQuantity, unit: /^(?:kg|千克)$/.test(specWord) ? "kg" : "ton", period: null, qualifiers: [], equipmentParent: claim });
    }
    skipSpace();
    // One terminal English full stop is punctuation, not a wildcard tail.
    if (locale === "en") consume(/^\.(?=\s*$)/, "punctuation");
    skipSpace();
    if (cursor !== range.end) return unsupported(cursor, range.end, 0, "unconsumed_clause");
  }
  return { claims, status: "complete", spans, residuals };
}

function capacityParseEvidence(parsed: CapacityParse, offset = 0) {
  return {
    status: parsed.status,
    spans: parsed.spans.slice(0, 48).map((part) => ({ ...part, start: part.start + offset, end: part.end + offset })),
    residuals: parsed.residuals.slice(0, 4).map((part) => ({ ...part, start: part.start + offset, end: part.end + offset, text: part.text.slice(0, 160) })),
    truncated: parsed.spans.length > 48 || parsed.residuals.length > 4 || parsed.residuals.some((part) => part.text.length > 160),
  };
}

function groundCommercialTerm(term: CommercialTerm, materials: string, rejected: string[], audit: CommercialTermAuditContext): CommercialTerm | null {
  const zh = term.value.zh.trim();
  const en = term.value.en.trim();
  if (term.kind === "capacity") {
    const clauses = capacityClauses(zh);
    const compact = normalizeCapacityChinese;
    const codes = englishCommercialCodes(en);
    const fragments = commercialFactFragments(materials, term.kind).map((fragment, fragmentIndex) => ({ ...fragment, fragmentIndex }))
      .filter((fragment) => fragment.context.includes("capacity"))
      .map((fragment) => ({ ...fragment, sourceParse: capacityClaims(fragment.text, "zh") }));
    const matchingFragments = fragments.filter((fragment) => {
      const sourceClauses = capacityClauses(fragment.text).map(compact);
      return clauses.length > 0 && clauses.every((clause) => sourceClauses.includes(compact(clause)));
    });
    // A quantity clause can be selected only from a completely parsed source
    // sentence. Unknown neighboring context may restrict that quantity; it is
    // not an independently omittable fact. Fully parsed numeric facts/specs can
    // still be selected or combined without requiring the whole source to copy.
    const independentFragments = matchingFragments.filter((fragment) => fragment.sourceParse.status === "complete");
    const sourceMatches = independentFragments.some((fragment) => codes.every((code) => englishCommercialCodes(fragment.source).includes(code)));
    const expectedParse = capacityClaims(term.value.zh, "zh");
    const expected = expectedParse.claims;
    const actualParse = capacityClaims(term.value.en, "en");
    const actual = actualParse.claims;
    // Complete quantitative claims carry the unit/cycle contract checked below.
    // Unquantified unit identity uses raw token boundaries. The compact form
    // above proves clause correspondence, but must not erase a source/candidate
    // boundary before the textual unit/cycle gate.
    const failedChecks: string[] = [];
    if (!zh || !en || isCommercialTermGap(zh) || isCommercialTermGap(en)) failedChecks.push("empty_value");
    if (!matchingFragments.length) failedChecks.push("source_clause");
    else if (!independentFragments.length) failedChecks.push("source_capacity_parse");
    else if (!sourceMatches) failedChecks.push("english_code");
    if (!expected) failedChecks.push("chinese_capacity_parse");
    if (expectedParse.error) failedChecks.push(`chinese_${expectedParse.error}`);
    if (!actual) failedChecks.push("english_capacity_parse");
    if (actualParse.error) failedChecks.push(`english_${actualParse.error}`);
    if (expected?.length === 0 && actual?.length === 0) {
      const sourceUnitsMatch = independentFragments.some((fragment) => {
        if (!codes.every((code) => englishCommercialCodes(fragment.source).includes(code))) return false;
        const selectedSourceClauses = capacityClauses(fragment.text).filter((source) => clauses.some((clause) => compact(source) === compact(clause)));
        return commercialUnitsMatch(selectedSourceClauses.join("; "), en, true);
      });
      if (!commercialUnitsMatch(zh, en, true) || (sourceMatches && !sourceUnitsMatch)) failedChecks.push("capacity_units");
    }
    if (expected && actual) {
      const unmatched = [...actual];
      // Preserve T-082's directional 台 -> set alias for both a quantity and its
      // parent. Reserve set-only matches before quantities with the equipment alias.
      const ordered = [...expected].sort((a, b) => Number(a.unit === "equipment" || a.equipmentParent?.unit === "equipment")
        - Number(b.unit === "equipment" || b.equipmentParent?.unit === "equipment"));
      const relationsMatch = ordered.every((source) => {
        const index = unmatched.findIndex((target) => capacityRelationMatches(source, target)
          && (source.equipmentParent
            ? target.equipmentParent && capacityRelationMatches(source.equipmentParent, target.equipmentParent)
            : !target.equipmentParent));
        if (index < 0) return false;
        unmatched.splice(index, 1);
        return true;
      });
      if (!relationsMatch || unmatched.length) failedChecks.push("capacity_relation");
    }
    if (failedChecks.length) {
      const modifierError = expectedParse.error ?? actualParse.error;
      const language = expectedParse.error ? "中文" : "英文";
      rejected.push(modifierError === "negation_scope" ? `${language}产能里的否定限定无法核实，已忽略`
        : modifierError === "comparison_scope" ? `${language}产能里的比较限定无法核实，已忽略`
          : failedChecks.includes("source_capacity_parse") ? "资料里的产能中有暂不支持的表达，未写入"
          : modifierError === "unsupported_syntax" ? `${language}产能中有暂不支持的表达，未写入`
            : "产能的数量、产出单位、周期或限定与资料不一致，已忽略");
      // Schema-valid model values are <=1000 chars per language. Explicit limits
      // also bound direct validation calls; truncation is declared, never hidden.
      if (audit.rejections.length < MAX_AI_OPERATIONS) audit.rejections.push({
        operationIndex: audit.operationIndex, operation: audit.operation,
        term: { id: term.id.slice(0, 80), kind: term.kind, value: { zh: term.value.zh.slice(0, 1000), en: term.value.en.slice(0, 1000) } },
        termTruncated: term.id.length > 80 || term.value.zh.length > 1000 || term.value.en.length > 1000,
        failedChecks, chineseClaims: expected?.slice(0, 24) ?? null, englishClaims: actual?.slice(0, 24) ?? null, sourceMatches,
        parseEvidence: { zh: capacityParseEvidence(expectedParse), en: capacityParseEvidence(actualParse) },
        claimsTruncated: (expected?.length ?? 0) > 24 || (actual?.length ?? 0) > 24,
        sourceFragmentCount: fragments.length,
        sourceFragments: fragments.map((fragment) => {
          const matched = clauses.filter((clause) => capacityClauses(fragment.text).some((source) => compact(source) === compact(clause)));
          return {
            fragmentIndex: fragment.fragmentIndex, source: fragment.source.slice(0, 1000), truncated: fragment.source.length > 1000,
            matchedClauses: matched.slice(0, 12).map((clause) => clause.slice(0, 1000)),
            matchedClauseCount: matched.length, matchedClausesTruncated: matched.length > 12 || matched.some((clause) => clause.length > 1000),
            parseEvidence: {
              // Field-label removal only cuts a prefix. Project actual parse
              // positions onto the original, possibly clipped source string.
              ...capacityParseEvidence(fragment.sourceParse, fragment.source.length - fragment.text.length),
              coordinateSpace: "source" as const, offsetUnit: "utf16" as const, sourceLength: fragment.source.length,
            },
          };
        }).sort((a, b) => b.matchedClauses.length - a.matchedClauses.length).slice(0, 4),
      });
      return null;
    }
    return { ...term, value: { zh, en } };
  }
  if (!zh || !en || isCommercialTermGap(zh) || isCommercialTermGap(en)) {
    rejected.push(`商业条款「${term.kind}」的值为空，已忽略`);
    return null;
  }
  const zhNumbers = canonicalCommercialNumbers(zh);
  const enNumbers = canonicalCommercialNumbers(en);
  if (!zhNumbers || !enNumbers || JSON.stringify(zhNumbers.sort()) !== JSON.stringify(enNumbers.sort()) || !commercialUnitsMatch(zh, en) || !materialContainsCommercialFact(materials, { zh, en }, term.kind)) {
    rejected.push(`商业条款「${term.kind}」的值不在资料中，已忽略`);
    return null;
  }
  return { ...term, value: { zh, en } };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function commercialFactSourceSpan(source: string, pattern: RegExp): { start: number; end: number } | null {
  const tokens: CommercialNumberToken[] = [];
  if (canonicalCommercialNumbers(source, tokens) === null) return null;
  // Reuse the complete numeric/code owners, including the existing codes that
  // have no digits. Ordinary prose is still eligible for substring extraction.
  const owners = [...tokens, ...[...source.matchAll(COMMERCIAL_CODE_RE)]
    .filter((code) => englishCommercialCodes(code[0]).includes(code[0].toUpperCase()))
    .map((code) => ({ start: code.index, end: code.index + code[0].length }))];
  for (const match of source.matchAll(pattern)) {
    const start = match.index;
    const end = start + match[0].length;
    if (!owners.some((token) => token.start < start && start < token.end || token.start < end && end < token.end)) return { start, end };
  }
  return null;
}

function equipmentQuantitySourceSpan(source: string, name: string, quantity: number): { start: number; end: number } | null {
  const pattern = new RegExp(`${escapeRegExp(name.trim())}\\s*${quantity}(?=\\s*(?:台|套|个|件|units?|machines?|sets?)?\\b|[（(，,；;。.!！?？]|$)`, "g");
  return commercialFactSourceSpan(source, pattern);
}

function equipmentSourceIsProcessOnly(source: string, name: string, quantity: number | null): boolean {
  if (!/加工能力\s*\/\s*主设备/.test(source)) return false;
  return quantity === null || !equipmentQuantitySourceSpan(source, name, quantity);
}

function equipmentEnglishMatches(item: EquipmentItem, fragment: CommercialFactFragment): boolean {
  if (canonicalCommercialNumbers(fragment.source) === null) return false;
  for (const field of [item.name, ...(item.spec ? [item.spec] : [])]) {
    const zhNumbers = canonicalCommercialNumbers(field.zh);
    const enNumbers = canonicalCommercialNumbers(field.en);
    if (!zhNumbers || !enNumbers || JSON.stringify(zhNumbers.sort()) !== JSON.stringify(enNumbers.sort())) return false;
    const sourceCodes = new Set(englishCommercialCodes(field.zh));
    if (!englishCommercialCodes(field.en).every((code) => sourceCodes.has(code))) return false;
  }
  if (!commercialUnitsMatch(item.name.zh, item.name.en, false, true)) return false;
  if (item.spec && !commercialUnitsMatch(item.spec.zh, item.spec.en)) return false;
  return true;
}

function groundEquipmentItem(item: EquipmentItem, materials: string, rejected: string[]): EquipmentItem | null {
  const nameZh = item.name.zh.trim();
  const nameEn = item.name.en.trim();
  if (!nameZh || !nameEn || isGapMarker(nameZh) || isGapMarker(nameEn)) {
    rejected.push(`设备「${nameZh || nameEn}」名称为空，已忽略`);
    return null;
  }
  if (item.quantity !== null && (!Number.isInteger(item.quantity) || item.quantity < 0)) {
    rejected.push(`设备「${nameZh}」数量必须是非负整数，已忽略`);
    return null;
  }
  const specZh = item.spec?.zh.trim() ?? "";
  const specEn = item.spec?.en.trim() ?? "";
  const fragment = commercialFactFragments(materials).find((candidate) => {
    const name = item.quantity === null
      ? commercialFactSourceSpan(candidate.source, new RegExp(escapeRegExp(nameZh), "g"))
      : equipmentQuantitySourceSpan(candidate.source, nameZh, item.quantity);
    if (!name) return false;
    if (equipmentSourceIsProcessOnly(candidate.source, nameZh, item.quantity)) return false;
    const spec = specZh ? commercialFactSourceSpan(candidate.source, new RegExp(escapeRegExp(specZh), "g")) : null;
    if (specZh && !spec) return false;
    return equipmentEnglishMatches({
      ...item,
      name: { zh: candidate.source.slice(name.start, name.start + nameZh.length), en: nameEn },
      spec: item.spec ? { zh: spec ? candidate.source.slice(spec.start, spec.end) : "", en: specEn } : null,
    }, candidate);
  });
  if (!fragment) {
    rejected.push(`设备「${nameZh}」的名称、数量或规格不在同一句资料中，已忽略`);
    return null;
  }
  if (item.spec && (!specZh || !specEn || isGapMarker(specZh) || isGapMarker(specEn))) {
    rejected.push(`设备「${nameZh}」的规格为空，已忽略`);
    return null;
  }
  return {
    ...item,
    name: { zh: nameZh, en: nameEn },
    spec: item.spec ? { zh: specZh, en: specEn } : null,
  };
}

function groundEquipment(items: EquipmentItem[], materials: string, rejected: string[]): EquipmentItem[] {
  const grounded: EquipmentItem[] = [];
  for (const item of items) {
    const next = groundEquipmentItem(item, materials, rejected);
    if (next) grounded.push(next);
  }
  return grounded;
}

type QualityProcessFactFragment = { text: string; source: string };

function qualityProcessFactFragments(materials: string): QualityProcessFactFragment[] {
  const source = stripWrappedCommercialInstructions(materials);
  return source.split(/\r?\n/).flatMap((line) => {
    const trimmed = line.trim();
    if (!trimmed || !/质检流程|quality process/i.test(trimmed)) return [];
    const value = trimmed.replace(/^[^：:]{1,32}[：:]\s*/, "");
    return value.split(/[；;]/).map((text) => text.trim()).filter(Boolean).map((text) => ({ text, source: text }));
  });
}

function qualityProcessEnglishMatches(step: QualityProcessStep, fragment: QualityProcessFactFragment): boolean {
  if (canonicalCommercialNumbers(fragment.source) === null) return false;
  const zh = `${step.title.zh} ${step.body?.zh ?? ""}`;
  const en = `${step.title.en} ${step.body?.en ?? ""}`;
  const zhNumbers = canonicalCommercialNumbers(zh);
  const enNumbers = canonicalCommercialNumbers(en);
  if (!zhNumbers || !enNumbers || JSON.stringify(zhNumbers.sort()) !== JSON.stringify(enNumbers.sort())) return false;
  if (!commercialUnitsMatch(zh, en)) return false;
  const sourceCodes = new Set(englishCommercialCodes(`${fragment.source} ${zh}`).map((code) => code.toUpperCase()));
  return englishCommercialCodes(en).every((code) => sourceCodes.has(code.toUpperCase()));
}

function groundQualityProcessStep(step: QualityProcessStep, materials: string, rejected: string[]): QualityProcessStep | null {
  const titleZh = step.title.zh.trim();
  const titleEn = step.title.en.trim();
  if (!titleZh || !titleEn || isGapMarker(titleZh) || isGapMarker(titleEn)) {
    rejected.push(`质检步骤「${titleZh || titleEn}」标题为空，已忽略`);
    return null;
  }
  const body = step.body && !isGapMarker(step.body.zh) && !isGapMarker(step.body.en)
    ? { zh: step.body.zh.trim(), en: step.body.en.trim() }
    : null;
  const bodySource = body?.zh.replace(/[。.!！?？]+$/g, "");
  const fragment = qualityProcessFactFragments(materials).find((candidate) => {
    const title = commercialFactSourceSpan(candidate.text, new RegExp(escapeRegExp(titleZh), "g"));
    const description = bodySource ? commercialFactSourceSpan(candidate.text, new RegExp(escapeRegExp(bodySource), "g")) : null;
    if (!title || bodySource && !description) return false;
    return qualityProcessEnglishMatches({
      ...step,
      title: { zh: candidate.text.slice(title.start, title.end), en: titleEn },
      body: body ? { zh: description ? candidate.text.slice(description.start, description.end) : "", en: body.en } : null,
    }, candidate);
  });
  if (!fragment) {
    rejected.push(`质检步骤「${titleZh}」的标题或说明不在同一句资料中，已忽略`);
    return null;
  }
  return { ...step, title: { zh: titleZh, en: titleEn }, body };
}

function groundQualityProcess(steps: QualityProcessStep[], materials: string, rejected: string[]): QualityProcessStep[] {
  const grounded: QualityProcessStep[] = [];
  for (const step of steps) {
    const next = groundQualityProcessStep(step, materials, rejected);
    if (next) grounded.push(next);
  }
  return grounded;
}

type HistoryFactFragment = { text: string; source: string; sourceIndex: number };

function historyFactFragments(materials: string): HistoryFactFragment[] {
  const source = stripWrappedCommercialInstructions(materials);
  let sourceIndex = 0;
  return source.split(/\r?\n/).flatMap((line) => {
    const trimmed = line.trim();
    if (!trimmed || !/沿革|history/i.test(trimmed)) return [];
    const value = trimmed.replace(/^[^：:]{1,32}[：:]\s*/, "");
    return value.split(/[；;]/).map((text) => text.trim()).filter(Boolean).map((text) => ({ text, source: text, sourceIndex: sourceIndex++ }));
  });
}

function historyEnglishMatches(item: HistoryItem, fragment: HistoryFactFragment): boolean {
  if (canonicalCommercialNumbers(fragment.source) === null) return false;
  const zhNumbers = canonicalCommercialNumbers(`${item.year} ${item.event.zh}`);
  const enNumbers = canonicalCommercialNumbers(item.event.en);
  if (!zhNumbers || !enNumbers) return false;
  zhNumbers.sort();
  enNumbers.sort();
  const yearIndex = zhNumbers.indexOf(String(item.year));
  if (yearIndex < 0) return false;
  zhNumbers.splice(yearIndex, 1);
  if (JSON.stringify(zhNumbers) !== JSON.stringify(enNumbers)) return false;
  if (!commercialUnitsMatch(item.event.zh, item.event.en)) return false;
  const sourceCodes = new Set(englishCommercialCodes(`${fragment.source} ${item.event.zh}`).map((code) => code.toUpperCase()));
  return englishCommercialCodes(item.event.en).every((code) => sourceCodes.has(code.toUpperCase()));
}

function groundHistoryItem(item: HistoryItem, materials: string, rejected: string[]): { item: HistoryItem; sourceIndex: number } | null {
  const eventZh = item.event.zh.trim().replace(/[。.!！?？]+$/g, "");
  const eventEn = item.event.en.trim();
  if (!Number.isInteger(item.year) || item.year < 1000 || item.year > 9999 || !eventZh || !eventEn || isGapMarker(eventZh) || isGapMarker(eventEn)) {
    rejected.push(`沿革条目「${eventZh || eventEn}」年份或事件为空，已忽略`);
    return null;
  }
  const year = String(item.year);
  const eventPattern = escapeRegExp(eventZh);
  const grounded = { ...item, year: item.year, event: { zh: eventZh, en: eventEn } };
  const fragment = historyFactFragments(materials).find((candidate) => {
    const event = commercialFactSourceSpan(candidate.text, new RegExp(`${year}\\s*年?\\s*${eventPattern}`, "g"));
    return event !== null && historyEnglishMatches({
      ...grounded, event: { zh: candidate.text.slice(event.end - eventZh.length, event.end), en: eventEn },
    }, candidate);
  });
  if (!fragment) {
    rejected.push(`沿革条目「${eventZh}」的年份或事件不在同一句资料中，已忽略`);
    return null;
  }
  return { item: grounded, sourceIndex: fragment.sourceIndex };
}

function groundHistory(items: HistoryItem[], materials: string, rejected: string[]): HistoryItem[] {
  const grounded: HistoryItem[] = [];
  let previousSourceIndex = -1;
  for (const item of items) {
    const next = groundHistoryItem(item, materials, rejected);
    if (!next) continue;
    if (next.sourceIndex <= previousSourceIndex) {
      rejected.push("沿革条目的资料顺序与输入顺序不一致，整组没有写入");
      return [];
    }
    previousSourceIndex = next.sourceIndex;
    grounded.push(next.item);
  }
  return grounded;
}

function materialsIncludesFact(materials: string, value: string) {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (materials.includes(trimmed)) return true;
  // Allow minor whitespace differences around ranges like "i=25–100".
  const compact = trimmed.replace(/\s+/g, "");
  const compactMaterials = materials.replace(/\s+/g, "");
  return compactMaterials.includes(compact);
}

function isGapMarker(value: string | { zh: string; en: string }) {
  const text = typeof value === "string" ? value.trim() : value.zh.trim();
  return text.length === 0 || text === "待补充" || text === "To be provided";
}

function isModelInstruction(value: string | { zh: string; en: string }) {
  const text = typeof value === "string" ? value : `${value.zh}\n${value.en}`;
  return /只回答资料|没有的写成待补充|写成待补充|mark gaps/i.test(text);
}

export function describeTarget(target: string) {
  const labels: Record<string, string> = {
    brand: "品牌名称",
    heroTitle: "首屏标题",
    heroSubtitle: "首屏说明",
    primaryCta: "主行动按钮",
    about: "关于我们",
    features: "核心优势",
    services: "服务模块",
    products: "产品与能力",
    contact: "联系模块",
  };
  return labels[target] ?? target;
}

export type { EditableCard, Product, SectionKey };
