import { z } from "zod";
import {
  cloneDraft,
  editableCardSchema,
  locales,
  localizedTextSchema,
  pagePlanSourceSchema,
  pageRoleSchema,
  productSchema,
  sectionKeySchema,
  sectionKeys,
  unsupportedSitePageSchema,
  visibilityKeySchema,
  visualBriefCatalog,
  visualBriefIds,
  type EditableCard,
  type Locale,
  type Product,
  type SectionKey,
  type SiteDraft,
  type SiteImageRef,
} from "./site-document.ts";
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
  value: z.string().min(1).max(1000),
});
const updateCardOperationSchema = z.object({
  op: z.literal("update_card"),
  section: z.enum(["features", "services", "faq"]),
  index: z.number().int().min(0).max(11),
  locale: z.enum(locales),
  title: z.string().min(1).max(160).optional(),
  body: z.string().min(1).max(600).optional(),
}).refine((value) => value.title || value.body, "Card update requires title or body");
const addCardOperationSchema = z.object({
  op: z.literal("add_card"),
  section: z.enum(["features", "services", "faq"]),
  index: z.number().int().min(0).max(12).optional(),
  item: editableCardSchema,
});
const removeCardOperationSchema = z.object({
  op: z.literal("remove_card"),
  section: z.enum(["features", "services", "faq"]),
  itemId: z.string().min(1).max(80),
});
const updateProductOperationSchema = z.object({
  op: z.literal("update_product"),
  sku: z.string().min(1).max(120),
  locale: z.enum(locales).optional(),
  name: z.string().min(1).max(200).optional(),
  summary: z.string().min(1).max(1000).optional(),
  category: z.string().min(1).max(120).optional(),
}).refine((value) => value.name || value.summary || value.category, "Product update requires at least one field");
const setTemplateOperationSchema = z.object({
  op: z.literal("set_template"),
  templateId: z.string().min(1).max(80),
});
const setVisualBriefOperationSchema = z.object({
  op: z.literal("set_visual_brief"),
  briefId: z.enum(visualBriefIds),
});
const setSectionVisibilityOperationSchema = z.object({
  op: z.literal("set_section_visibility"),
  section: visibilityKeySchema,
  visible: z.boolean(),
});
const reorderSectionsOperationSchema = z.object({
  op: z.literal("reorder_sections"),
  order: z.array(sectionKeySchema).length(sectionKeys.length),
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
  sku: z.string().min(1).max(120),
  ...imageRefFields,
});
const removeProductImageOperationSchema = z.object({
  op: z.literal("remove_product_image"),
  sku: z.string().min(1).max(120),
});
const replaceProductsOperationSchema = z.object({
  op: z.literal("replace_products"),
  products: z.array(productSchema).max(1000),
});
const replaceDraftOperationSchema = z.object({
  op: z.literal("replace_draft"),
  draft: z.custom<SiteDraft>(),
});

export const aiOperationSchema = z.discriminatedUnion("op", [
  setTextOperationSchema,
  updateCardOperationSchema,
  addCardOperationSchema,
  removeCardOperationSchema,
  updateProductOperationSchema,
  setTemplateOperationSchema,
  setSectionVisibilityOperationSchema,
  reorderSectionsOperationSchema,
  setPagePlanOperationSchema,
  setImageSlotOperationSchema,
  removeImageSlotOperationSchema,
  setProductImageOperationSchema,
  removeProductImageOperationSchema,
]);

export const siteOperationSchema = z.discriminatedUnion("op", [
  setTextOperationSchema,
  updateCardOperationSchema,
  addCardOperationSchema,
  removeCardOperationSchema,
  updateProductOperationSchema,
  setTemplateOperationSchema,
  setSectionVisibilityOperationSchema,
  reorderSectionsOperationSchema,
  setPagePlanOperationSchema,
  setImageSlotOperationSchema,
  removeImageSlotOperationSchema,
  setProductImageOperationSchema,
  removeProductImageOperationSchema,
  replaceProductsOperationSchema,
  replaceDraftOperationSchema,
  setVisualBriefOperationSchema,
]);
export type SiteOperation = z.infer<typeof siteOperationSchema>;
export type AIOperation = z.infer<typeof aiOperationSchema>;

export const aiChangeSchema = z.object({
  summary: z.string().min(1).max(500),
  operations: z.array(aiOperationSchema).max(20),
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
};

const nonLocalizedTargets = new Set<TextTarget>([
  "siteName",
  "companyName",
  "industry",
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
  if (target === "industry") return draft.industry;
  if (target === "goal") return draft.goal;
  if (target === "contact.email") return draft.content.contact.email;
  if (target === "contact.phone") return draft.content.contact.phone;
  return localizedValue(draft, target)?.[locale] ?? "";
}

function writeText(draft: SiteDraft, target: TextTarget, locale: Locale, value: string) {
  if (target === "siteName") draft.siteName = value;
  else if (target === "companyName") draft.companyName = value;
  else if (target === "industry") draft.industry = value;
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
  operation: { imageId: string; url: string; alt?: { zh: string; en: string } },
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
  return {
    imageId: operation.imageId,
    url,
    alt: operation.alt ?? structuredClone(missingAlt),
  };
}

function readHeroImage(draft: SiteDraft) {
  return draft.content.hero.image;
}

function writeHeroImage(draft: SiteDraft, image: SiteImageRef | undefined) {
  if (image) draft.content.hero.image = structuredClone(image);
  else delete draft.content.hero.image;
}

export function applySiteOperations(
  current: SiteDraft,
  operations: SiteOperation[],
  options: { templateIds: Set<string>; lastChange: string; siteId?: string },
): ApplyResult {
  let draft = cloneDraft(current);
  const inverseOperations: SiteOperation[] = [];
  const appliedTargets: string[] = [];

  for (const operation of operations) {
    if (operation.op === "replace_draft") {
      if (same(draft, operation.draft)) continue;
      inverseOperations.unshift({ op: "replace_draft", draft: cloneDraft(draft) });
      draft = cloneDraft(operation.draft);
      appliedTargets.push("draft");
      continue;
    }
    if (operation.op === "set_text") {
      const locale = nonLocalizedTargets.has(operation.target) ? "zh" : (operation.locale ?? "zh");
      const previous = readText(draft, operation.target, locale);
      if (previous === operation.value) continue;
      writeText(draft, operation.target, locale, operation.value);
      inverseOperations.unshift({ ...operation, locale, value: previous });
      appliedTargets.push(`${operation.target}.${locale}`);
      continue;
    }
    if (operation.op === "update_card") {
      const item = draft.content[operation.section].items[operation.index];
      if (!item) throw new Error(`${operation.section} item ${operation.index + 1} does not exist`);
      const inverse: SiteOperation = {
        op: "update_card",
        section: operation.section,
        index: operation.index,
        locale: operation.locale,
        ...(operation.title ? { title: item.title[operation.locale] } : {}),
        ...(operation.body ? { body: item.body[operation.locale] } : {}),
      };
      let changed = false;
      if (operation.title && item.title[operation.locale] !== operation.title) {
        item.title[operation.locale] = operation.title;
        appliedTargets.push(`${operation.section}.items.${operation.index}.title.${operation.locale}`);
        changed = true;
      }
      if (operation.body && item.body[operation.locale] !== operation.body) {
        item.body[operation.locale] = operation.body;
        appliedTargets.push(`${operation.section}.items.${operation.index}.body.${operation.locale}`);
        changed = true;
      }
      if (changed) inverseOperations.unshift(inverse);
      continue;
    }
    if (operation.op === "add_card") {
      const items = draft.content[operation.section].items;
      if (items.some((item) => item.id === operation.item.id)) throw new Error(`Card id ${operation.item.id} already exists`);
      const index = Math.min(operation.index ?? items.length, items.length);
      items.splice(index, 0, structuredClone(operation.item));
      inverseOperations.unshift({ op: "remove_card", section: operation.section, itemId: operation.item.id });
      appliedTargets.push(`${operation.section}.items.${index}`);
      continue;
    }
    if (operation.op === "remove_card") {
      const items = draft.content[operation.section].items;
      const index = items.findIndex((item) => item.id === operation.itemId);
      if (index < 0) throw new Error(`Card ${operation.itemId} does not exist`);
      const [item] = items.splice(index, 1);
      inverseOperations.unshift({ op: "add_card", section: operation.section, index, item });
      appliedTargets.push(`${operation.section}.items.${index}`);
      continue;
    }
    if (operation.op === "update_product") {
      const product = draft.products.find((item) => item.sku === operation.sku);
      if (!product) throw new Error(`Product ${operation.sku} does not exist`);
      const locale = operation.locale ?? "zh";
      const inverse: SiteOperation = {
        op: "update_product",
        sku: operation.sku,
        locale,
        ...(operation.name ? { name: product.name[locale] } : {}),
        ...(operation.summary ? { summary: product.summary[locale] } : {}),
        ...(operation.category ? { category: product.category } : {}),
      };
      let changed = false;
      if (operation.name && product.name[locale] !== operation.name) {
        product.name[locale] = operation.name;
        appliedTargets.push(`products.${operation.sku}.name.${locale}`);
        changed = true;
      }
      if (operation.summary && product.summary[locale] !== operation.summary) {
        product.summary[locale] = operation.summary;
        appliedTargets.push(`products.${operation.sku}.summary.${locale}`);
        changed = true;
      }
      if (operation.category && product.category !== operation.category) {
        product.category = operation.category;
        appliedTargets.push(`products.${operation.sku}.category`);
        changed = true;
      }
      if (changed) inverseOperations.unshift(inverse);
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
      if (draft.visualBrief.id === brief.id && draft.templateId === brief.templateId) continue;
      // A catalog id cannot reconstruct an older mapping or a manually selected
      // template. History must restore the actual saved design and content.
      inverseOperations.unshift({ op: "replace_draft", draft: cloneDraft(draft) });
      draft.visualBrief = structuredClone(brief);
      draft.templateId = brief.templateId;
      draft.pagePlan = rehostPagePlan(draft.pagePlan, draft.templateId);
      appliedTargets.push("visualBrief", "template", "pagePlan");
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
      if (new Set(operation.order).size !== sectionKeys.length) throw new Error("Section order contains duplicates");
      if (same(draft.sectionOrder, operation.order)) continue;
      inverseOperations.unshift({ op: "reorder_sections", order: [...draft.sectionOrder] });
      draft.sectionOrder = [...operation.order];
      appliedTargets.push("sections.order");
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
      });
      writeHeroImage(draft, undefined);
      appliedTargets.push(operation.target);
      continue;
    }
    if (operation.op === "set_product_image") {
      const product = draft.products.find((item) => item.sku === operation.sku);
      if (!product) throw new Error(`Product ${operation.sku} does not exist`);
      const next = resolveImageRef(operation, options.siteId);
      const previous = product.image;
      if (same(previous, next)) continue;
      if (previous) {
        inverseOperations.unshift({
          op: "set_product_image",
          sku: operation.sku,
          imageId: previous.imageId,
          url: previous.url,
          alt: previous.alt,
        });
      } else {
        inverseOperations.unshift({ op: "remove_product_image", sku: operation.sku });
      }
      product.image = next;
      appliedTargets.push(`products.${operation.sku}.image`);
      continue;
    }
    if (operation.op === "remove_product_image") {
      const product = draft.products.find((item) => item.sku === operation.sku);
      if (!product) throw new Error(`Product ${operation.sku} does not exist`);
      const previous = product.image;
      if (!previous) continue;
      inverseOperations.unshift({
        op: "set_product_image",
        sku: operation.sku,
        imageId: previous.imageId,
        url: previous.url,
        alt: previous.alt,
      });
      delete product.image;
      appliedTargets.push(`products.${operation.sku}.image`);
      continue;
    }
    if (operation.op === "replace_products") {
      if (same(draft.products, operation.products)) continue;
      inverseOperations.unshift({ op: "replace_products", products: structuredClone(draft.products) });
      draft.products = structuredClone(operation.products);
      appliedTargets.push("products");
    }
  }

  if (!inverseOperations.length) return { draft: current, inverseOperations: [], appliedTargets: [], changed: false };
  draft.revision = current.revision + 1;
  draft.lastChange = options.lastChange;
  return { draft, inverseOperations, appliedTargets, changed: true };
}

export function validateAIOperations(
  message: string,
  operations: AIOperation[],
  templateIds: Set<string>,
): { operations: SiteOperation[]; rejected: string[] } {
  const rejected: string[] = [];
  const explicitTemplateSwitch = /(?:换|切换|改用|使用|选择|更换).{0,10}(?:模板|版式)|(?:template).{0,20}(?:switch|change|use)/i.test(message);
  const accepted = operations.filter((operation) => {
    if (operation.op !== "set_template") return true;
    if (!explicitTemplateSwitch) {
      rejected.push("用户没有明确要求更换模板，已拒绝模板切换");
      return false;
    }
    if (!templateIds.has(operation.templateId)) {
      rejected.push(`模板 ${operation.templateId} 不在白名单中`);
      return false;
    }
    return true;
  });
  return { operations: accepted, rejected };
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
