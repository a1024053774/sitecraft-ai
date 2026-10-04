import { z } from "zod";
import { blockCatalog, layoutBlocks, type BlockId, type BlockLook } from "./blocks/catalog.ts";
import { effectiveBlockOrder } from "./blocks/order.ts";
import { blockLookForTemplate } from "./blocks/looks/index.ts";
import { checkVariantRequirements } from "./blocks/requirements.ts";
import { normalizeSiteStyle, siteStyleDirectionSchema, siteStyleRuleSchema, validateSiteStyleRules } from "./blocks/site-style.ts";
import { stripGapTalkBilingual } from "./visitor-prose.ts";
import {
  cloneDraft,
  commercialTermKindSchema,
  commercialTermSchema,
  commercialTermValueSchema,
  commercialTermsSchema,
  equipmentItemSchema,
  equipmentSchema,
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

function readText(draft: SiteDraft, target: TextTarget, locale: Locale) {
  if (target === "siteName") return draft.siteName;
  if (target === "companyName") return draft.companyName;
  if (target === "industry") return typeof draft.industry === "string" ? draft.industry : draft.industry[locale];
  if (target === "goal") return draft.goal;
  if (target === "contact.email") return draft.content.contact.email;
  if (target === "contact.phone") return draft.content.contact.phone;
  return localizedValue(draft, target)?.[locale] ?? "";
}

function writeText(draft: SiteDraft, target: TextTarget, locale: Locale, value: string) {
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

function cleanVisitorProse(operation: AIOperation): AIOperation {
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
        items: operation.value.items.map((item) => ({ ...item, body: stripGapTalkBilingual(item.body) as { zh: string; en: string } })),
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
): { operations: SiteOperation[]; rejected: string[]; notes: string[] } {
  const rejected: string[] = [];
  const notes: string[] = [];
  const accepted: SiteOperation[] = [];
  const explicitTemplateSwitch = /(?:换|切换|改用|使用|选择|更换).{0,10}(?:模板|版式)|(?:template).{0,20}(?:switch|change|use)/i.test(message);
  for (const rawOperation of operations) {
    const operation = cleanVisitorProse(rawOperation);
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
      const terms = groundCommercialTerms(operation.terms, message, rejected);
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
      const grounded = groundCommercialTerm(candidate, message, rejected);
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
  const deduped = accepted.map((operation) => {
    if (operation.op !== "set_catalog_section" || operation.section !== "capabilities" || !operation.value || !equipmentNames.size) return operation;
    const items = operation.value.items.filter((item) => {
      const text = `${item.title.zh} ${item.body.zh}`;
      const duplicate = [...equipmentNames].some((name) => name && text.includes(name));
      if (duplicate) rejected.push(`加工能力条目重复设备事实，已忽略「${item.title.zh}」`);
      return !duplicate;
    });
    return { ...operation, value: { ...operation.value, items } };
  });
  const checked = draft ? checkLayoutRequests(deduped, draft, templateIds, rejected, notes) : deduped;
  return { operations: checked, rejected, notes };
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

function groundCommercialTerms(terms: CommercialTerm[], materials: string, rejected: string[]): CommercialTerm[] {
  const grounded: CommercialTerm[] = [];
  for (const term of terms) {
    const next = groundCommercialTerm(term, materials, rejected);
    if (next) grounded.push(next);
  }
  return grounded;
}

const COMMERCIAL_NUMBER_RE = /(\d+(?:[,.]\d+)*(?:\s*[–—-]\s*\d+(?:[,.]\d+)*)?)(?:\s*(万|亿|million|billion))?/gi;
const COMMERCIAL_KIND_HINTS: Record<CommercialTermKind, string[]> = {
  moq: ["moq", "起订量", "minimum order"],
  lead_time: ["交期", "lead time", "lead-time", "天数"],
  capacity: ["产能", "年产", "月注塑", "capacity"],
  trade_terms: ["贸易条款", "trade terms", "fob", "exw", "cif"],
  payment: ["付款", "payment"],
  packaging: ["包装", "packaging"],
};

function canonicalCommercialNumbers(value: string): string[] {
  return [...value.matchAll(COMMERCIAL_NUMBER_RE)].map((match) => {
    const multiplier = { 万: 1e4, 亿: 1e8, million: 1e6, billion: 1e9 }[String(match[2] ?? "").toLowerCase()] ?? 1;
    return match[1].replace(/[\s,]/g, "").replace(/—/g, "–").split("–").map((part) => String(Number(part) * multiplier)).join("–");
  });
}

function stripWrappedCommercialInstructions(materials: string): string {
  const input = materials.trim();
  if (!input.startsWith("【公司资料】")) return materials;
  const bodyStart = input.indexOf("资料性质：模拟。");
  return bodyStart >= 0 ? input.slice(bodyStart) : materials;
}

type CommercialFactFragment = { text: string; context: string; source: string };

function commercialFactFragments(materials: string): CommercialFactFragment[] {
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
      for (let label = 0; label < 3; label += 1) value = value.replace(/^[^：:]{1,32}[：:]\s*/, "");
      return { text: value, context, source: sentence };
    }).filter((item) => item.text);
  });
}

function englishCommercialCodes(value: string): string[] {
  const known = /\b(?:EXW|FCA|FAS|FOB|CFR|CIF|CPT|CIP|DAP|DPU|DDP|MOQ|CNY|RMB|USD|EUR|JPY|GBP|HKD|CAD|AUD|SGD|KRW|INR|CHF|T\/T|L\/C|D\/P|D\/A|O\/A)\b/gi;
  const uppercase = /\b[A-Z][A-Z0-9/]{1,5}\b/g;
  return [...(value.match(known) ?? []), ...(value.match(uppercase) ?? [])].map((code) => code.toUpperCase()).filter((code, index, all) => all.indexOf(code) === index);
}

const COMMERCIAL_UNIT_RULES = [
  { key: "ten-thousand-piece", zh: /万件/, en: /\b(?:10[,.]?000|ten thousand|million)\s+(?:[A-Za-z]+\s+)?(?:pcs?|pieces?|parts?)\b/i },
  { key: "piece", zh: /件/, en: /\b(?:pcs?|pieces?|parts?)\b/i },
  { key: "day", zh: /天/, en: /\bdays?\b/i },
  { key: "week", zh: /周|星期/, en: /\bweeks?\b/i },
  { key: "month", zh: /月/, en: /\bmonths?\b|\bmonthly\b/i },
  { key: "year", zh: /年/, en: /\byears?\b|\byearly\b/i },
  { key: "equipment", zh: /台/, en: /\b(?:units?|machines?)\b/i },
  { key: "set", zh: /套/, en: /\bsets?\b|\b(?:one|a|\d[\d,.]*)\s+(?:molds?|moulds?)\b/i },
  { key: "ton", zh: /\bt\b/i, en: /\btons?\b|\bt\b/i },
  { key: "kg", zh: /\bkg\b/i, en: /\bkg\b/i },
] as const;

function chineseCommercialUnits(value: string): string[] {
  return COMMERCIAL_UNIT_RULES.filter((rule) => rule.zh.test(value)).map((rule) => rule.key);
}

function englishCommercialUnits(value: string): string[] {
  return COMMERCIAL_UNIT_RULES.filter((rule) => rule.en.test(value)).map((rule) => rule.key);
}

function commercialUnitsMatch(zh: string, en: string): boolean {
  const expected = chineseCommercialUnits(zh);
  const actual = englishCommercialUnits(en);
  const compatible = (source: string, target: string) => {
    if (source === target) return true;
    if (source === "equipment" && target === "set") return true;
    if (source === "set" && target === "equipment") return false;
    if (source === "ten-thousand-piece" && target === "piece") return true;
    if (source === "piece" && target === "ten-thousand-piece") return true;
    return false;
  };
  return expected.every((unit) => actual.some((candidate) => compatible(unit, candidate)))
    && actual.every((unit) => expected.some((candidate) => compatible(candidate, unit)));
}

function commercialFactFragmentMatches(fragment: CommercialFactFragment, clause: string, kind: CommercialTermKind, englishCodes: string[]): boolean {
  const hints = COMMERCIAL_KIND_HINTS[kind];
  const source = fragment.text.toLowerCase();
  const related = hints.some((hint) => source.includes(hint.toLowerCase())) || fragment.context.includes(kind);
  if (!related) return false;
  const sourceClauses = fragment.text.split(/[，,；;]/).map((part) => part.trim()).filter(Boolean);
  if (!sourceClauses.includes(clause)) return false;
  const sourceCodes = new Set(englishCommercialCodes(`${clause} ${fragment.source}`).map((code) => code.toUpperCase()));
  return englishCodes.every((code) => sourceCodes.has(code.toUpperCase()));
}

function materialContainsCommercialFact(materials: string, value: { zh: string; en: string }, kind: CommercialTermKind): boolean {
  const clauses = value.zh.split(/[，,；;。！？!?\n]+/).map((clause) => clause.trim()).filter(Boolean);
  const fragments = commercialFactFragments(materials);
  const englishCodes = englishCommercialCodes(value.en);
  return clauses.length > 0 && clauses.every((clause) => fragments.some((fragment) => commercialFactFragmentMatches(fragment, clause, kind, englishCodes)));
}

function groundCommercialTerm(term: CommercialTerm, materials: string, rejected: string[]): CommercialTerm | null {
  const zh = term.value.zh.trim();
  const en = term.value.en.trim();
  if (!zh || !en || isCommercialTermGap(zh) || isCommercialTermGap(en)) {
    rejected.push(`商业条款「${term.kind}」的值为空，已忽略`);
    return null;
  }
  const zhNumbers = canonicalCommercialNumbers(zh).sort();
  const enNumbers = canonicalCommercialNumbers(en).sort();
  if (JSON.stringify(zhNumbers) !== JSON.stringify(enNumbers) || !commercialUnitsMatch(zh, en) || !materialContainsCommercialFact(materials, { zh, en }, term.kind)) {
    rejected.push(`商业条款「${term.kind}」的值不在资料中，已忽略`);
    return null;
  }
  return { ...term, value: { zh, en } };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function equipmentSourceHasName(source: string, name: string): boolean {
  return source.includes(name.trim());
}

function equipmentQuantityIsAdjacent(source: string, name: string, quantity: number): boolean {
  const pattern = new RegExp(`${escapeRegExp(name.trim())}\\s*${quantity}(?=\\s*(?:台|套|个|件|units?|machines?|sets?)?\\b|[（(，,；;。.!！?？]|$)`, "i");
  return pattern.test(source);
}

function equipmentSourceIsProcessOnly(source: string, name: string, quantity: number | null): boolean {
  if (!/加工能力\s*\/\s*主设备/.test(source)) return false;
  return quantity === null || !equipmentQuantityIsAdjacent(source, name, quantity);
}

function equipmentEnglishMatches(item: EquipmentItem, fragment: CommercialFactFragment): boolean {
  const zhParts = [item.name.zh, item.spec?.zh ?? ""].join(" ");
  const enParts = [item.name.en, item.spec?.en ?? ""].join(" ");
  const zhNumbers = canonicalCommercialNumbers(zhParts).sort();
  const enNumbers = canonicalCommercialNumbers(enParts).sort();
  if (JSON.stringify(zhNumbers) !== JSON.stringify(enNumbers)) return false;
  if (item.spec && !commercialUnitsMatch(item.spec.zh, item.spec.en)) return false;
  const sourceCodes = new Set(englishCommercialCodes(`${fragment.source} ${item.name.zh} ${item.spec?.zh ?? ""}`).map((code) => code.toUpperCase()));
  return englishCommercialCodes(enParts).every((code) => sourceCodes.has(code.toUpperCase()));
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
    if (!equipmentSourceHasName(candidate.source, nameZh)) return false;
    if (equipmentSourceIsProcessOnly(candidate.source, nameZh, item.quantity)) return false;
    if (specZh && !equipmentSourceHasName(candidate.source, specZh)) return false;
    if (item.quantity !== null && !equipmentQuantityIsAdjacent(candidate.source, nameZh, item.quantity)) return false;
    return true;
  });
  if (!fragment || !equipmentEnglishMatches(item, fragment)) {
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
