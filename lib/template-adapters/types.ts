export type TemplateSlotAttr = "text" | "src";

export type TemplateSlot = {
  target: string;
  selector: string;
  attr?: TemplateSlotAttr;
};

export type TemplateSanitizeRules = {
  sections?: string[];
  leafPatterns?: string[];
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
 * Data-only preview adapter. Selectors are injected into the shared iframe
 * bridge; per-template JavaScript source is not stored here.
 */
export type TemplateAdapter = {
  templateId: string;
  runtime: TemplatePreviewRuntime;
  slots: TemplateSlot[];
  alternatives?: Record<string, string>;
  sanitize?: TemplateSanitizeRules;
};
