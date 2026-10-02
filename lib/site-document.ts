import { z } from "zod";
import { blockCatalog, blockIds } from "./blocks/catalog.ts";
import { normalizeSiteStyle, siteStyleSchema } from "./blocks/site-style.ts";
import { customPaletteSchema } from "./custom-brand-color.ts";
import {
  defaultPagePlanFor,
  pagePlanSources,
  pagePlacements,
  pageRoles,
  pageSectionKeys,
  rehostPagePlan,
  type PagePlan,
} from "./template-pages.ts";

export const locales = ["zh", "en"] as const;
export type Locale = (typeof locales)[number];
export type Device = "desktop" | "tablet" | "mobile";

export const localizedTextSchema = z.object({
  zh: z.string().max(1000),
  en: z.string().max(1000),
});
export type LocalizedText = z.infer<typeof localizedTextSchema>;

export const stableItemIdSchema = z.string().regex(/^[A-Za-z0-9_-]+$/).max(80);

const HAN_OR_FULLWIDTH_RE = /[\u3400-\u9fff\u3000-\u303f\uff00-\uffef]/;
export function hasHan(value: string): boolean {
  return HAN_OR_FULLWIDTH_RE.test(value);
}

export const productSpecValueSchema = z.union([z.string().max(200), localizedTextSchema]);
export type ProductSpecValue = z.infer<typeof productSpecValueSchema>;

export function specValueText(value: ProductSpecValue, locale: Locale): string {
  return typeof value === "string" ? value : value[locale];
}

export const visualBriefIds = [
  "industrial",
  "engineering-industrial",
  "export-catalog",
  "technical-product",
  "editorial-service",
] as const;
/**
 * 色彩集: the colour directions a user picks. Each look carries one 色板 (palette) per set, so a
 * palette id is `<look prefix>-<colour set>`. Values live in the adapter kit (registry.ts).
 */
export const colorSetCatalog = [
  { id: "porcelain", label: "青花瓷", summary: "钴蓝强调配冷白底，清楚、稳重。" },
  { id: "graphite", label: "石墨工坊", summary: "石墨灰强调，低饱和，适合参数和图纸为主的页面。" },
  { id: "warm-orange", label: "工程暖橙", summary: "暖橙强调，行动入口醒目。" },
  { id: "patina", label: "铜锈", summary: "铜绿强调配石灰底，沉稳，适合重型设备。" },
  { id: "turquoise", label: "松石", summary: "松石青强调配冷底，适合流体、洁净和精密件。" },
  { id: "morandi", label: "莫兰迪", summary: "灰调陶土强调配暖灰底，克制、柔和。" },
] as const;
export type ColorSetId = (typeof colorSetCatalog)[number]["id"];
const palettePrefixByVisualBrief = {
  industrial: "industrial",
  "engineering-industrial": "engineering",
  "export-catalog": "export",
  "technical-product": "technical",
} as const;
const defaultColorSetByVisualBrief: Record<keyof typeof palettePrefixByVisualBrief, ColorSetId> = {
  industrial: "porcelain",
  "engineering-industrial": "warm-orange",
  "export-catalog": "porcelain",
  "technical-product": "porcelain",
};
type PalettePrefix = (typeof palettePrefixByVisualBrief)[keyof typeof palettePrefixByVisualBrief];
const paletteIdList = (Object.values(palettePrefixByVisualBrief) as PalettePrefix[])
  .flatMap((prefix) => colorSetCatalog.map((set) => `${prefix}-${set.id}` as `${PalettePrefix}-${ColorSetId}`));
export const paletteIds = ["default", ...paletteIdList] as ["default", ...Array<`${PalettePrefix}-${ColorSetId}`>];
export const paletteIdSchema = z.enum(paletteIds);
export type PaletteId = z.infer<typeof paletteIdSchema>;
export type PaletteCatalogEntry = { id: PaletteId; colorSet: ColorSetId; label: string; summary: string };

/**
 * Palette ids before colour sets (2026-09-27). Stored drafts still carry them, so they are renamed
 * on read to the nearest colour set. Remove once every stored draft has been rewritten with a
 * current id (for example by a save through commitOperations after this change).
 */
const retiredPaletteIds: Record<string, PaletteId> = {
  "industrial-white": "industrial-porcelain",
  "industrial-minimal-gray": "industrial-graphite",
  "industrial-mint": "industrial-turquoise",
  "industrial-sand": "industrial-morandi",
  "engineering-orange": "engineering-warm-orange",
  "engineering-slate": "engineering-porcelain",
  "engineering-deep-blue": "engineering-porcelain",
  "engineering-oxide": "engineering-morandi",
  "export-sea": "export-porcelain",
  "export-industrial-slate": "export-graphite",
  "export-cobalt": "export-porcelain",
  "export-ink": "export-turquoise",
  "technical-white": "technical-porcelain",
  "technical-neutral": "technical-graphite",
  "technical-cobalt": "technical-porcelain",
  "technical-olive": "technical-patina",
};

export function paletteCatalogForVisualBrief(briefId: (typeof visualBriefIds)[number]): PaletteCatalogEntry[] {
  if (!(briefId in palettePrefixByVisualBrief)) return [];
  const prefix = palettePrefixByVisualBrief[briefId as keyof typeof palettePrefixByVisualBrief];
  return colorSetCatalog.map((set) => ({ id: `${prefix}-${set.id}` as PaletteId, colorSet: set.id, label: set.label, summary: set.summary }));
}
export function defaultPaletteIdForVisualBrief(briefId: (typeof visualBriefIds)[number]): PaletteId {
  if (!(briefId in palettePrefixByVisualBrief)) return "default";
  const key = briefId as keyof typeof palettePrefixByVisualBrief;
  return `${palettePrefixByVisualBrief[key]}-${defaultColorSetByVisualBrief[key]}` as PaletteId;
}
export const visualBriefSchema = z.object({
  version: z.literal(1),
  id: z.enum(visualBriefIds),
  label: z.string().min(1).max(80),
  summary: z.string().min(1).max(240),
  audience: z.string().min(1).max(160),
  primaryAction: z.string().min(1).max(160),
  templateId: z.string().min(1).max(80),
});
export type VisualBrief = z.infer<typeof visualBriefSchema>;

export const visualBriefCatalog: VisualBrief[] = [
  {
    version: 1,
    id: "industrial",
    label: "明亮产品",
    summary: "留白充足，产品先于故事。",
    audience: "需要先看清产品的访客",
    primaryAction: "查看产品能力",
    templateId: "forge",
  },
  {
    version: 1,
    id: "engineering-industrial",
    label: "工程工业",
    summary: "产品线、工况与询盘路径清楚。",
    audience: "需要工程可信度的访客",
    primaryAction: "获取技术方案",
    templateId: "screwfast",
  },
  {
    version: 1,
    id: "export-catalog",
    label: "蓝白目录",
    summary: "蓝白分层，分类清楚，转化组件完整。",
    audience: "需要目录与询盘路径的访客",
    primaryAction: "获取产品目录",
    templateId: "landwind",
  },
  {
    version: 1,
    id: "technical-product",
    label: "灰底短路径",
    summary: "灰底单页，把品类和询盘压进短路径。",
    audience: "需要快速判断下一步的访客",
    primaryAction: "提交询盘",
    templateId: "tailwind-landing",
  },
];

export const editableCardSchema = z.object({
  id: stableItemIdSchema,
  title: localizedTextSchema,
  body: localizedTextSchema,
});
export type EditableCard = z.infer<typeof editableCardSchema>;

export const siteImageRefSchema = z.object({
  imageId: z.string().regex(/^img_[a-z0-9]{16,40}$/),
  url: z.string().min(1).max(240),
  alt: localizedTextSchema,
  /** Visitor-facing attribution for CC-BY / CC-BY-SA photos; absent when no credit is required. */
  credit: localizedTextSchema.optional(),
});
export type SiteImageRef = z.infer<typeof siteImageRefSchema>;

export const productSpecParameterSchema = z.object({
  name: localizedTextSchema,
  value: productSpecValueSchema,
});
export type ProductSpecParameter = z.infer<typeof productSpecParameterSchema>;

export const productSchema = z.object({
  /** Stable identity for addressing a product; absent only on pre-T-069 drafts. */
  id: stableItemIdSchema.optional(),
  sku: z.string().min(1).max(120),
  name: localizedTextSchema,
  summary: localizedTextSchema,
  category: z.union([z.string().max(120), localizedTextSchema]),
  status: z.enum(["published", "draft"]),
  imageColor: z.string().max(30).default("#e6e1cf"),
  image: siteImageRefSchema.optional(),
  /** Optional; absent on old drafts means the product has no declared parameters. */
  specs: z.array(productSpecParameterSchema).max(12).optional(),
  aiGenerated: z.boolean().optional(),
});
export type Product = z.infer<typeof productSchema>;

function stableProductHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

/** Deterministic only for migration: once written, a product keeps its id if its SKU changes. */
export function productStableId(product: Pick<Product, "sku">, index: number) {
  return `prod-${index.toString(36)}-${stableProductHash(`${index}\u0000${product.sku}`)}`;
}

export function ensureProductIds(products: readonly Product[]): Product[] {
  const explicit = new Set<string>();
  for (const product of products) {
    if (!product.id) continue;
    if (explicit.has(product.id)) throw new Error(`Duplicate product id ${product.id}`);
    explicit.add(product.id);
  }
  const used = new Set(explicit);
  return products.map((product, index) => {
    if (product.id) return product;
    let id = productStableId(product, index);
    let suffix = 1;
    while (used.has(id)) id = `${productStableId(product, index)}-${suffix++}`;
    used.add(id);
    return product.id === id ? product : { ...product, id };
  });
}

export const sectionKeys = [
  "about",
  "features",
  "services",
  "products",
  "contact",
] as const;
export const sectionKeySchema = z.enum(sectionKeys);
export type SectionKey = z.infer<typeof sectionKeySchema>;

/** Content blocks that can move in the block-library page. Shell and hero blocks stay fixed. */
export const movableBlockIds = [
  "products",
  "industries",
  "capabilities",
  "services",
  "certifications",
  "faq",
  "contact",
] as const;
export const movableBlockIdSchema = z.enum(movableBlockIds);
export type MovableBlockId = z.infer<typeof movableBlockIdSchema>;

/** Plan v0.6 KonsTuck / Lozitick lists. Visibility-only keys may sit outside sectionOrder. */
export const familyModuleInventory = {
  konstuck: ["products", "services", "features", "faq", "contact"],
  lozitick: ["solutions", "process", "partners", "industries", "faq"],
} as const;

export const visibilityKeys = [
  ...sectionKeys,
  "faq",
  "partners",
  "process",
  "solutions",
  "industries",
  "capabilities",
  "certifications",
] as const;
export const visibilityKeySchema = z.enum(visibilityKeys);
export type VisibilityKey = z.infer<typeof visibilityKeySchema>;

export const pageRoleSchema = z.enum(pageRoles);
export const pagePlanSourceSchema = z.enum(pagePlanSources);
export const pagePlacementSchema = z.enum(pagePlacements);
export const pageSectionKeySchema = z.enum(pageSectionKeys);
export type PageSectionKey = z.infer<typeof pageSectionKeySchema>;

export const unsupportedSitePageSchema = z.object({
  requested: z.string().min(1).max(80),
  reason: z.string().min(1).max(240),
});
export const sitePageSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]{0,39}$/),
  role: pageRoleSchema,
  label: localizedTextSchema,
  placement: pagePlacementSchema,
  section: pageSectionKeySchema.optional(),
  route: z.string().max(80).optional(),
  source: pagePlanSourceSchema,
}).refine((page) => {
  if (page.placement === "route") return typeof page.route === "string";
  return Boolean(page.section);
}, "Section pages need a section; route pages need a snapshot path");
export const pagePlanSchema = z.object({
  version: z.literal(1),
  source: pagePlanSourceSchema,
  pages: z.array(sitePageSchema).min(1).max(12),
  unsupported: z.array(unsupportedSitePageSchema).max(12),
});
export type { PagePlan, PagePlanSource, PagePlacement, PageRole, SitePage, UnsupportedSitePage } from "./template-pages.ts";

const contentSectionSchema = z.object({
  title: localizedTextSchema,
  intro: localizedTextSchema,
  items: z.array(editableCardSchema).max(12),
});
export type ContentSection = z.infer<typeof contentSectionSchema>;

export const certificationStatuses = ["已有", "认证中", "待补充"] as const;
export const certificationStatusSchema = z.enum(certificationStatuses);
export type CertificationStatus = z.infer<typeof certificationStatusSchema>;

export const certificationItemSchema = editableCardSchema.extend({
  status: certificationStatusSchema,
});
export type CertificationItem = z.infer<typeof certificationItemSchema>;

export const certificationSectionSchema = z.object({
  title: localizedTextSchema,
  intro: localizedTextSchema,
  items: z.array(certificationItemSchema).max(12),
});
export type CertificationSection = z.infer<typeof certificationSectionSchema>;

export const catalogSectionKeys = ["industries", "capabilities", "certifications"] as const;
export type CatalogSectionKey = (typeof catalogSectionKeys)[number];

/** The block-library blocks a draft can pick a layout for (T-053). */
export const blockIdSchema = z.enum(blockIds);
/**
 * 布局: block -> the variant it shows. A missing block shows its look's default. Not bound to a
 * look: looks on the block library share blocks, and other looks ignore it.
 */
export const blockVariantsSchema = z.partialRecord(blockIdSchema, z.string().min(1).max(40));
export type BlockVariants = z.infer<typeof blockVariantsSchema>;

export const catalogSectionValueSchema = z.object({
  title: localizedTextSchema,
  intro: localizedTextSchema,
  items: z.array(editableCardSchema.extend({
    status: certificationStatusSchema.optional(),
  })).max(12),
});
export type CatalogSectionValue = z.infer<typeof catalogSectionValueSchema>;

export const siteDraftSchema = z.object({
  schemaVersion: z.literal(2),
  siteName: z.string().min(1).max(120),
  companyName: z.string().min(1).max(120),
  templateId: z.string().min(1).max(80),
  visualBrief: visualBriefSchema,
  legacyVisualBriefId: z.literal("editorial-service").optional(),
  paletteId: paletteIdSchema.default("default"),
  customPalette: customPaletteSchema.nullable().default(null),
  locale: z.enum(locales),
  /** Set by a bilingual content operation once English has been authored. */
  englishReady: z.boolean().default(false),
  revision: z.number().int().nonnegative(),
  lastChange: z.string().max(240),
  // Bilingual since T-037; a single string is the older one-language form and shows on both pages.
  industry: z.union([z.string().max(120), localizedTextSchema]),
  goal: z.string().max(500),
  navigation: z.object({
    about: localizedTextSchema,
    features: localizedTextSchema,
    services: localizedTextSchema,
    products: localizedTextSchema,
    contact: localizedTextSchema,
  }),
  content: z.object({
    hero: z.object({
      title: localizedTextSchema,
      subtitle: localizedTextSchema,
      cta: localizedTextSchema,
      image: siteImageRefSchema.optional(),
    }),
    about: z.object({
      title: localizedTextSchema,
      body: localizedTextSchema,
    }),
    features: contentSectionSchema,
    services: contentSectionSchema,
    products: z.object({
      title: localizedTextSchema,
      intro: localizedTextSchema,
    }),
    contact: z.object({
      title: localizedTextSchema,
      body: localizedTextSchema,
      email: z.string().max(240),
      phone: z.string().max(80),
      address: localizedTextSchema,
    }),
    faq: contentSectionSchema,
    /** Optional manufacturer blocks; absent on old drafts means hide. */
    industries: contentSectionSchema.optional(),
    capabilities: contentSectionSchema.optional(),
    certifications: certificationSectionSchema.optional(),
  }),
  sectionOrder: z.array(movableBlockIdSchema).optional(),
  hiddenSections: z.array(visibilityKeySchema),
  blockVariants: blockVariantsSchema.default({}),
  siteStyle: siteStyleSchema.optional(),
  pagePlan: pagePlanSchema,
  products: z.array(productSchema).max(1000),
  supportConfig: z.object({
    enabled: z.boolean(),
    knowledgeSourceIds: z.array(z.string().max(120)).max(100),
  }),
});
export type SiteDraft = z.infer<typeof siteDraftSchema>;

// New drafts carry no demo products; products come only from the user's materials, tables or chat.
export const starterProducts: Product[] = [];

export const defaultDraft: SiteDraft = {
  schemaVersion: 2,
  siteName: "未命名站点",
  companyName: "未命名企业",
  templateId: "forge",
  visualBrief: structuredClone(visualBriefCatalog[0]),
  paletteId: "industrial-porcelain",
  customPalette: null,
  locale: "zh",
  englishReady: false,
  revision: 1,
  lastChange: "草稿已保存",
  industry: { zh: "待补充", en: "To be provided" },
  goal: "展示核心产品与工程能力，获取全球客户询盘",
  navigation: {
    about: { zh: "关于", en: "About" },
    features: { zh: "优势", en: "Advantages" },
    services: { zh: "合作方式", en: "How we work" },
    products: { zh: "产品", en: "Products" },
    contact: { zh: "联系", en: "Contact" },
  },
  // A new draft has no company facts yet: fact fields are gaps (hidden on the visitor page by
  // the gap rules) and headings are neutral interface labels. Never put demo copy here.
  content: {
    hero: {
      title: { zh: "待补充", en: "To be provided" },
      subtitle: { zh: "待补充", en: "To be provided" },
      cta: { zh: "提交询盘", en: "Send an inquiry" },
    },
    about: {
      title: { zh: "关于我们", en: "About us" },
      body: { zh: "待补充", en: "To be provided" },
    },
    features: {
      title: { zh: "优势", en: "Advantages" },
      intro: { zh: "待补充", en: "To be provided" },
      items: [
        { id: "quality", title: { zh: "待补充", en: "To be provided" }, body: { zh: "待补充", en: "To be provided" } },
        { id: "delivery", title: { zh: "待补充", en: "To be provided" }, body: { zh: "待补充", en: "To be provided" } },
        { id: "support", title: { zh: "待补充", en: "To be provided" }, body: { zh: "待补充", en: "To be provided" } },
      ],
    },
    services: {
      title: { zh: "合作方式", en: "How we work" },
      intro: { zh: "待补充", en: "To be provided" },
      items: [
        { id: "discovery", title: { zh: "待补充", en: "To be provided" }, body: { zh: "待补充", en: "To be provided" } },
        { id: "integration", title: { zh: "待补充", en: "To be provided" }, body: { zh: "待补充", en: "To be provided" } },
        { id: "delivery", title: { zh: "待补充", en: "To be provided" }, body: { zh: "待补充", en: "To be provided" } },
      ],
    },
    products: {
      title: { zh: "产品", en: "Products" },
      intro: { zh: "待补充", en: "To be provided" },
    },
    contact: {
      title: { zh: "询盘", en: "Inquiry" },
      body: { zh: "待补充", en: "To be provided" },
      email: "待补充",
      phone: "待补充",
      address: { zh: "待补充", en: "To be provided" },
    },
    faq: {
      title: { zh: "常见问题", en: "Frequently asked questions" },
      intro: { zh: "待补充", en: "To be provided" },
      items: [
        { id: "faq-1", title: { zh: "待补充", en: "To be provided" }, body: { zh: "待补充", en: "To be provided" } },
        { id: "faq-2", title: { zh: "待补充", en: "To be provided" }, body: { zh: "待补充", en: "To be provided" } },
        { id: "faq-3", title: { zh: "待补充", en: "To be provided" }, body: { zh: "待补充", en: "To be provided" } },
        { id: "faq-4", title: { zh: "待补充", en: "To be provided" }, body: { zh: "待补充", en: "To be provided" } },
        { id: "faq-5", title: { zh: "待补充", en: "To be provided" }, body: { zh: "待补充", en: "To be provided" } },
        { id: "faq-6", title: { zh: "待补充", en: "To be provided" }, body: { zh: "待补充", en: "To be provided" } },
      ],
    },
  },
  hiddenSections: [],
  blockVariants: {},
  pagePlan: defaultPagePlanFor("forge"),
  products: starterProducts,
  supportConfig: { enabled: false, knowledgeSourceIds: [] },
};

export function cloneDraft(draft: SiteDraft): SiteDraft {
  return structuredClone(draft);
}

function hydrateVisualBrief(brief: VisualBrief): VisualBrief {
  const catalog = visualBriefCatalog.find((item) => item.id === brief.id);
  return catalog ? { ...catalog, templateId: brief.templateId } : brief;
}

function hydratePaletteId(draft: SiteDraft): SiteDraft {
  if (draft.paletteId === "default") {
    const next = defaultPaletteIdForVisualBrief(draft.visualBrief.id);
    if (next !== "default") return { ...draft, paletteId: next };
  }
  return draft;
}

function migrateRetiredVisualBrief(draft: SiteDraft): SiteDraft {
  if (draft.visualBrief.id !== "editorial-service" && draft.templateId !== "fresh") return draft;
  const fallback = visualBriefCatalog.find((item) => item.id === "technical-product");
  if (!fallback) return draft;
  return {
    ...draft,
    templateId: fallback.templateId,
    visualBrief: structuredClone(fallback),
    paletteId: defaultPaletteIdForVisualBrief(fallback.id),
    legacyVisualBriefId: "editorial-service",
  };
}

function pagePlanForLegacy(legacy: Record<string, unknown>): PagePlan {
  const templateId = typeof legacy.templateId === "string" && legacy.templateId.trim()
    ? legacy.templateId
    : "forge";
  const parsed = pagePlanSchema.safeParse(legacy.pagePlan);
  return parsed.success ? parsed.data : defaultPagePlanFor(templateId);
}

function renameRetiredPalette(input: unknown): unknown {
  if (!input || typeof input !== "object") return input;
  const paletteId = (input as { paletteId?: unknown }).paletteId;
  if (typeof paletteId !== "string" || !Object.hasOwn(retiredPaletteIds, paletteId)) return input;
  return { ...(input as Record<string, unknown>), paletteId: retiredPaletteIds[paletteId] };
}

// A stored layout for a block or a variant the library does not have (any more) is dropped on
// read, so one stale entry cannot make the whole draft fail to load.
function dropUnknownBlockVariants(input: unknown): unknown {
  if (!input || typeof input !== "object" || !Object.hasOwn(input, "blockVariants")) return input;
  const raw = (input as { blockVariants?: unknown }).blockVariants;
  const kept: Record<string, string> = {};
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    for (const [block, variant] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof variant !== "string" || !(blockIds as readonly string[]).includes(block)) continue;
      if (!Object.hasOwn(blockCatalog[block as (typeof blockIds)[number]].variants, variant)) continue;
      kept[block] = variant;
    }
  }
  return { ...(input as Record<string, unknown>), blockVariants: kept };
}

function dropInvalidSiteStyle(input: unknown): unknown {
  if (!input || typeof input !== "object" || !Object.hasOwn(input, "siteStyle")) return input;
  const siteStyle = normalizeSiteStyle((input as { siteStyle?: unknown }).siteStyle);
  if (!siteStyle) {
    const copy = { ...(input as Record<string, unknown>) };
    delete copy.siteStyle;
    return copy;
  }
  return { ...(input as Record<string, unknown>), siteStyle };
}

function normalizeSectionOrder(input: unknown): unknown {
  if (!input || typeof input !== "object" || !Object.hasOwn(input, "sectionOrder")) return input;
  const raw = (input as { sectionOrder?: unknown }).sectionOrder;
  if (!Array.isArray(raw)) {
    const copy = { ...(input as Record<string, unknown>) };
    delete copy.sectionOrder;
    return copy;
  }
  const legacy = raw.length === sectionKeys.length
    && raw.every((item) => typeof item === "string" && (sectionKeys as readonly string[]).includes(item))
    && new Set(raw).size === sectionKeys.length;
  if (legacy) {
    const copy = { ...(input as Record<string, unknown>) };
    delete copy.sectionOrder;
    return copy;
  }
  const kept: MovableBlockId[] = [];
  for (const item of raw) {
    if (typeof item !== "string" || !(movableBlockIds as readonly string[]).includes(item)) continue;
    if (!kept.includes(item as MovableBlockId)) kept.push(item as MovableBlockId);
  }
  if (!kept.length) {
    const copy = { ...(input as Record<string, unknown>) };
    delete copy.sectionOrder;
    return copy;
  }
  return { ...(input as Record<string, unknown>), sectionOrder: kept };
}

export function normalizeDraft(rawInput: unknown): SiteDraft {
  const input = normalizeSectionOrder(dropInvalidSiteStyle(dropUnknownBlockVariants(renameRetiredPalette(rawInput))));
  const parsed = siteDraftSchema.safeParse(input);
  if (parsed.success) {
    const hydrated = migrateRetiredVisualBrief(hydratePaletteId({ ...parsed.data, products: ensureProductIds(parsed.data.products), visualBrief: hydrateVisualBrief(parsed.data.visualBrief) }));
    return { ...hydrated, pagePlan: rehostPagePlan(hydrated.pagePlan, hydrated.templateId) };
  }

  const legacy = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  // Existing v2 documents predate visualBrief/pagePlan. Add only the missing metadata;
  // never run them through the v1 conversion that reconstructs content.
  if (legacy.schemaVersion === 2) {
    const content = legacy.content && typeof legacy.content === "object"
      ? { ...(legacy.content as Record<string, unknown>) }
      : {};
    if (!Object.hasOwn(content, "faq")) content.faq = structuredClone(defaultDraft.content.faq);
    const restored = siteDraftSchema.parse({
      ...legacy,
      content,
      ...(!Object.hasOwn(legacy, "visualBrief") ? { visualBrief: structuredClone(defaultDraft.visualBrief) } : {}),
      ...(!Object.hasOwn(legacy, "pagePlan") ? { pagePlan: pagePlanForLegacy(legacy) } : {}),
    });
    const hydrated = migrateRetiredVisualBrief(hydratePaletteId({ ...restored, products: ensureProductIds(restored.products), visualBrief: hydrateVisualBrief(restored.visualBrief) }));
    return { ...hydrated, pagePlan: rehostPagePlan(hydrated.pagePlan, hydrated.templateId) };
  }
  const legacyHero = legacy.hero && typeof legacy.hero === "object"
    ? (legacy.hero as Record<string, unknown>)
    : {};
  const candidate = cloneDraft(defaultDraft);
  if (typeof legacy.siteName === "string" && legacy.siteName.trim()) candidate.siteName = legacy.siteName;
  if (typeof legacy.companyName === "string" && legacy.companyName.trim()) candidate.companyName = legacy.companyName;
  if (typeof legacy.templateId === "string" && legacy.templateId.trim()) candidate.templateId = legacy.templateId;
  candidate.pagePlan = defaultPagePlanFor(candidate.templateId);
  const visualBrief = visualBriefSchema.safeParse(legacy.visualBrief);
  if (visualBrief.success) candidate.visualBrief = hydrateVisualBrief(visualBrief.data);
  if (typeof legacy.industry === "string") candidate.industry = legacy.industry;
  if (typeof legacy.goal === "string") candidate.goal = legacy.goal;
  if (typeof legacyHero.title === "string") candidate.content.hero.title.zh = legacyHero.title;
  if (typeof legacyHero.subtitle === "string") candidate.content.hero.subtitle.zh = legacyHero.subtitle;
  if (typeof legacyHero.cta === "string") candidate.content.hero.cta.zh = legacyHero.cta;
  const products = z.array(productSchema).max(1000).safeParse(legacy.products);
  if (products.success) candidate.products = products.data;
  candidate.products = ensureProductIds(candidate.products);
  return migrateRetiredVisualBrief(candidate);
}
