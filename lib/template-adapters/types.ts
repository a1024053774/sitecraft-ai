import type { VisibilityKey } from "../site-document.ts";
import type { SiteStyleDirectionId, SiteStyleRule } from "../blocks/site-style.ts";

export type TemplateSlotAttr = "text" | "src";

export type TemplateSlot = {
  target: string;
  selector: string;
  attr?: TemplateSlotAttr;
};

export type TemplateSection = {
  key: VisibilityKey;
  selector: string;
  root?: "self" | "section";
};

export type TemplateSanitizeRules = {
  sections?: string[];
  leafPatterns?: string[];
};

export type TemplateDemoChrome = {
  key: string;
  selector: string;
  root?: "self" | "section";
};

/** Look-board ids that currently have an admitted same-family kit. */
export type TemplateFamilyId = "industrial" | "engineering-industrial" | "export-catalog" | "technical-product";

export type TemplateKitTokens = {
  background: string;
  surface?: string;
  text: string;
  muted?: string;
  accent: string;
  accentStrong?: string;
  accentSoft?: string;
  border: string;
  /** Semantic form/control roles; older kits derive these from surface/accentSoft/muted. */
  input?: string;
  focus?: string;
  disabled?: string;
  diagram?: string;
  tint?: string;
  font: string;
  /** Heading family selected by the kit; the model cannot write this value. */
  headingFont?: string;
  /** Data-role family selected by the kit; use only for specs, SKUs and units. */
  dataFont?: string;
  radius: string;
};

export type TemplateKitModuleKind = "shell" | "content" | "demo";

export type TemplateKitModule = {
  key: string;
  kind: TemplateKitModuleKind;
  selector: string;
  root?: "self" | "section";
};

/**
 * One visual family: tokens + shell + modules the shared bridge can read.
 * 1:1 snapshot mapping stays until a look has two interchangeable kits.
 */
export type TemplateKit = {
  familyId: TemplateFamilyId;
  /** Stable registry ids for the two self-hosted font roles. */
  fontFamilyId?: string;
  headingFontFamilyId?: string;
  dataFontFamilyId?: string;
  tokens: TemplateKitTokens;
  palettes?: Readonly<Record<string, TemplateKitTokens>>;
  modules: TemplateKitModule[];
  /**
   * Catalog-book product cards: how many specs sit on the card, whether the full list folds away,
   * and where the per-series inquiry link points. Families without it keep the plain card.
   */
  productCard?: {
    keySpecs: number;
    collapseSpecs: boolean;
    askHref: string;
  };
};

export type TemplatePreviewRuntime = "static-html" | "astro-static" | "next-static" | "spa-bundle";

export type TemplateSlotAlternative = {
  requested: string;
  proposed: string;
};

export type SlotApplyReport = {
  appliedSlots: string[];
  missingSlots: string[];
  fallbackMatched: string[];
  proposedAlternatives: TemplateSlotAlternative[];
};

/**
 * Block-library pages (T-053): the page keeps each variant of a block in a <template> and shows
 * one entity per block; the bridge mounts the draft's choice (or the default) before writing.
 */
export type TemplateBlocks = {
  order: string[];
  /** Content blocks in the look's default main-column order; hero and shell stay fixed. */
  main?: string[];
  defaults: Record<string, string>;
  /** Hero title policy for this look; only declared looks opt into word spans. */
  heroTitle?: "words";
  fitText?: "container";
  /** Paired content blocks move as one visual unit. */
  groups?: string[][];
  variants: Record<string, string[]>;
  /** How the bridge fills a mounted variant, from the block catalog: block -> variant -> params. */
  render?: Record<string, Record<string, TemplateBlockRender>>;
  styleDirections?: Readonly<Record<SiteStyleDirectionId, { label: string; summary: string; rules: readonly SiteStyleRule[] }>>;
};

/** Render parameters of one block variant. Blocks read only the fields that concern them. */
export type TemplateBlockRender = {
  /** Product block: cards, directory rows, category groups, a comparison table, or a model index table. */
  products?: "cards" | "rows" | "grouped" | "compare" | "index";
  /** Product cards and the index table: specs per product (the index shows each product's own first ones), whether the full list folds away, the inquiry link. */
  keySpecs?: number;
  collapseSpecs?: boolean;
  askHref?: string;
  /** Hero block: the key-spec strip shows under a product photo only, or whenever there are specs. */
  heroSpecs?: "with-photo" | "always";
  /** Hero block: the right side lists the product series (category and name, linking to the products block). */
  heroIndex?: boolean;
  /** Equipment block: "grouped" puts the items with a count and the items without one in two groups. */
  equipment?: "grouped";
};

/**
 * Data-only preview adapter. Selectors are injected into the shared iframe
 * bridge; per-template JavaScript source is not stored here.
 */
export type TemplateAdapter = {
  templateId: string;
  runtime: TemplatePreviewRuntime;
  slots: TemplateSlot[];
  sections?: TemplateSection[];
  alternatives?: Record<string, string>;
  sanitize?: TemplateSanitizeRules;
  demoChrome?: TemplateDemoChrome[];
  kit?: TemplateKit;
  blocks?: TemplateBlocks;
};
