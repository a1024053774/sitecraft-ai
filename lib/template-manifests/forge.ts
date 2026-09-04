import type { TemplateManifest } from "./types.ts";
import { ALL_UI_SURFACES, BOTH_LOCALES, NON_CONTENT_SLOTS, contentSlots } from "./shared.ts";

export const forgeManifest: TemplateManifest = {
  templateId: "forge",
  displayName: "SMALL BIS / Small Business",
  manifestVersion: 1,
  runtime: "astro-static",
  nativeLocales: ["en"],
  outputLocales: BOTH_LOCALES,
  localizedUi: ALL_UI_SURFACES,
  requiredVisibleTargets: ["heroTitle"],
  slots: contentSlots({
    "hero.title": ["Small Business", "Solutions for your business"],
    "about.body": ["We are a small business"],
    "features.items": ["Why choose us"],
    "services.items": ["Our services"],
    products: ["Our products"],
    "contact.title": ["Contact Us"],
    "contact.body": ["Get in touch with us"],
  }),
  nonContentSlots: NON_CONTENT_SLOTS,
  recommendation: "eligible",
};
