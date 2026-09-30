import type { TemplateSlot } from "../template-adapters/types.ts";
import type { VisibilityKey } from "../site-document.ts";

/**
 * SiteCraft block library (T-048, T-053): the data half. Each block lists its variants; each
 * variant says which slots it declares (the adapter's `selector -> target` form), which fixed
 * nodes the preview bridge renders into (`markers`) and which parts carry `data-sc-part`. The
 * HTML and CSS live in `fragments/` and are only read on the server. No functions here: the
 * catalog is reviewable data and ships to the client through the adapter registry.
 */
export const blockIds = [
  "nav",
  "hero",
  "products",
  "industries",
  "capabilities",
  "services",
  "certifications",
  "faq",
  "contact",
  "footer",
] as const;
export type BlockId = (typeof blockIds)[number];

export type BlockVariantSpec = {
  /** Name shown to users and the model: 布局 names, not internal ids. */
  label: string;
  slots: TemplateSlot[];
  /** Nodes the bridge fills by its own logic; each must hit exactly one node in the variant. */
  markers: string[];
  /** `data-sc-part` names in this variant, each used once (for site styles, T-054). */
  parts: string[];
};

export type BlockSpec = {
  label: string;
  /** Shell blocks are page chrome (navigation, footer); content blocks carry company facts. */
  kind: "shell" | "content";
  /** Visibility key and node for set_section_visibility; blocks without one cannot be hidden. */
  section?: { key: VisibilityKey; selector: string };
  /** Element id that navigation links point at; every variant of the block carries it. */
  anchor?: string;
  /** Draft fields the block reads. */
  reads: string[];
  variants: Record<string, BlockVariantSpec>;
};

const text = (target: string, selector: string): TemplateSlot => ({ target, selector, attr: "text" });
const src = (target: string, selector: string): TemplateSlot => ({ target, selector, attr: "src" });
const benchmark = (target: string, key: string) => text(target, `[data-sitecraft-benchmark="${key}"]`);
const itemSlots = (group: "services" | "faq", count: number) =>
  Array.from({ length: count }, (_, index) => [
    benchmark(`${group}.items.${index}.title`, `${group}-item-${index}-title`),
    benchmark(`${group}.items.${index}.body`, `${group}-item-${index}-body`),
  ]).flat();

export const blockCatalog: Readonly<Record<BlockId, BlockSpec>> = {
  nav: {
    label: "导航",
    kind: "shell",
    reads: ["companyName", "navigation", "englishReady"],
    variants: {
      bar: {
        label: "横排导航",
        slots: [
          text("companyName", '[data-sitecraft-brand="nav"]'),
          text("navigation.products", '[data-sitecraft-nav="products"]'),
          text("navigation.services", '[data-sitecraft-nav="services"]'),
          text("navigation.contact", '[data-sitecraft-nav="contact"]'),
        ],
        markers: ["[data-sitecraft-locale-switch]"],
        parts: ["rule", "bar", "brand", "links", "tools"],
      },
    },
  },
  hero: {
    label: "首屏",
    kind: "content",
    reads: ["content.hero", "industry", "products"],
    variants: {
      split: {
        label: "左文右图",
        slots: [
          benchmark("hero.title", "hero-title"),
          benchmark("hero.subtitle", "hero-subtitle"),
          benchmark("hero.cta", "hero-cta"),
          text("industry", '[data-sitecraft-optional="industry"]'),
          src("hero.image", '[data-sitecraft-benchmark="hero-image"]'),
        ],
        markers: ["[data-sitecraft-hero-visual]", "[data-sitecraft-hero-credit]", "[data-sitecraft-hero-nameplate]", "[data-sitecraft-hero-specs]"],
        parts: ["band", "copy", "actions", "visual", "specs"],
      },
    },
  },
  products: {
    label: "产品",
    kind: "content",
    section: { key: "products", selector: '[data-sitecraft-section="products"]' },
    anchor: "products",
    reads: ["content.products", "products"],
    variants: {
      cards: {
        label: "产品卡片",
        slots: [benchmark("products.title", "products-title"), benchmark("products.intro", "products-intro")],
        markers: ["[data-sitecraft-product-grid]"],
        parts: ["head", "grid"],
      },
    },
  },
  industries: {
    label: "应用行业",
    kind: "content",
    section: { key: "industries", selector: '[data-sitecraft-section="industries"]' },
    anchor: "industries",
    reads: ["content.industries"],
    variants: {
      list: {
        label: "行业清单",
        slots: [benchmark("industries.title", "industries-title"), benchmark("industries.intro", "industries-intro")],
        markers: ['[data-sitecraft-catalog-grid="industries"]'],
        parts: ["list"],
      },
    },
  },
  capabilities: {
    label: "加工能力",
    kind: "content",
    section: { key: "capabilities", selector: '[data-sitecraft-section="capabilities"]' },
    anchor: "capabilities",
    reads: ["content.capabilities"],
    variants: {
      list: {
        label: "能力清单",
        slots: [benchmark("capabilities.title", "capabilities-title"), benchmark("capabilities.intro", "capabilities-intro")],
        markers: ['[data-sitecraft-catalog-grid="capabilities"]'],
        parts: ["list"],
      },
    },
  },
  services: {
    label: "合作方式",
    kind: "content",
    section: { key: "services", selector: '[data-sitecraft-section="services"]' },
    anchor: "process",
    reads: ["content.services"],
    variants: {
      steps: {
        label: "编号步骤",
        slots: [benchmark("services.title", "services-title"), benchmark("services.intro", "services-intro"), ...itemSlots("services", 3)],
        markers: [],
        parts: ["head", "steps"],
      },
    },
  },
  certifications: {
    label: "认证",
    kind: "content",
    section: { key: "certifications", selector: '[data-sitecraft-section="certifications"]' },
    anchor: "certifications",
    reads: ["content.certifications"],
    variants: {
      badges: {
        label: "认证徽章",
        slots: [benchmark("certifications.title", "certifications-title"), benchmark("certifications.intro", "certifications-intro")],
        markers: ['[data-sitecraft-catalog-grid="certifications"]'],
        parts: ["head", "badges"],
      },
    },
  },
  faq: {
    label: "常见问题",
    kind: "content",
    section: { key: "faq", selector: '[data-sitecraft-section="faq"]' },
    anchor: "faq",
    reads: ["content.faq"],
    variants: {
      accordion: {
        label: "折叠问答",
        slots: [benchmark("faq.title", "faq-title"), benchmark("faq.intro", "faq-intro"), ...itemSlots("faq", 3)],
        markers: [],
        parts: ["head", "list"],
      },
    },
  },
  contact: {
    label: "询盘",
    kind: "content",
    section: { key: "contact", selector: '[data-sitecraft-section="contact"]' },
    anchor: "inquiry",
    reads: ["content.contact"],
    variants: {
      split: {
        label: "左右布局",
        slots: [
          benchmark("contact.title", "contact-title"),
          benchmark("contact.body", "contact-body"),
          text("contact.email", '[data-sitecraft-contact="email"]'),
          text("contact.phone", '[data-sitecraft-contact="phone"]'),
        ],
        markers: ['[data-sitecraft-inquiry="true"]'],
        parts: ["copy", "lines", "form"],
      },
    },
  },
  footer: {
    label: "页脚",
    kind: "shell",
    reads: ["companyName", "content.contact", "products"],
    variants: {
      columns: {
        label: "目录式多列",
        slots: [
          text("companyName", '[data-sitecraft-brand="footer"]'),
          text("contact.email", '[data-sitecraft-contact="footer-email"]'),
          text("contact.phone", '[data-sitecraft-contact="footer-phone"]'),
        ],
        markers: ["[data-sitecraft-footer-products]"],
        parts: ["columns", "about"],
      },
    },
  },
};

/** One item of a look's main column: a block, or two list blocks shown side by side. */
export type BlockLayoutItem = BlockId | readonly [BlockId, BlockId];

/**
 * A look on the block library: its design tokens (non-colour; colours come from the palette),
 * the page order, and the variant each block shows unless the draft picks another.
 */
export type BlockLook = {
  /** visualBrief id. */
  id: string;
  /** Template id behind the look; the preview route serves the composed page for it. */
  templateId: string;
  documentTitle: string;
  tokens: Readonly<Record<string, string>>;
  layout: {
    top: readonly BlockId[];
    main: readonly BlockLayoutItem[];
    bottom: readonly BlockId[];
  };
  defaults: Readonly<Record<BlockId, string>>;
};

export function layoutBlocks(look: BlockLook): BlockId[] {
  return [...look.layout.top, ...look.layout.main.flatMap((item) => (typeof item === "string" ? [item] : [...item])), ...look.layout.bottom];
}
