import type { VisibilityKey } from "../site-document.ts";

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
export type TemplateFamilyId = "industrial" | "engineering-industrial" | "export-catalog";

export type TemplateKitTokens = {
  background: string;
  text: string;
  accent: string;
  border: string;
  font: string;
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
  tokens: TemplateKitTokens;
  modules: TemplateKitModule[];
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
  sections?: TemplateSection[];
  alternatives?: Record<string, string>;
  sanitize?: TemplateSanitizeRules;
  demoChrome?: TemplateDemoChrome[];
  kit?: TemplateKit;
};
