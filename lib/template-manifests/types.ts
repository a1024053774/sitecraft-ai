import type { Locale } from "../site-model.ts";

export type TemplateRuntime = "astro-static" | "next-static" | "static-html";
export type TemplateUiSurface = "navigation" | "faq" | "form" | "footer";
export type TemplateContentTarget =
  | "hero.title"
  | "about.body"
  | "features.items"
  | "services.items"
  | "products"
  | "contact.title"
  | "contact.body"
  | "contact.email"
  | "contact.phone"
  | "contact.address";
export type TemplateSlotContentType = "text" | "collection";

export type TemplateSlotBinding = {
  target: TemplateContentTarget;
  selector: string;
  contentType: TemplateSlotContentType;
  semanticType: string;
  aliases: readonly string[];
  locales: readonly Locale[];
  required: boolean;
  editable: boolean;
  maxLength: number;
  demoFingerprints: readonly string[];
};

export type TemplateNonContentSlot =
  | {
      target: "brand.logo" | "hero.image";
      selector: string;
      slotType: "asset";
      coverage: "excluded";
      support: "template-owned";
    }
  | {
      target: "contact.formAction";
      selector: string;
      slotType: "behavior";
      coverage: "excluded";
      support: "unsupported";
    };

export type TemplateManifest = {
  templateId: string;
  displayName: string;
  manifestVersion: number;
  runtime: TemplateRuntime;
  nativeLocales: readonly Locale[];
  outputLocales: readonly Locale[];
  localizedUi: readonly TemplateUiSurface[];
  requiredVisibleTargets: readonly string[];
  slots: readonly TemplateSlotBinding[];
  nonContentSlots: readonly TemplateNonContentSlot[];
  recommendation: "eligible" | "isolated";
};
