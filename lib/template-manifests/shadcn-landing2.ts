import type { TemplateManifest } from "./types.ts";
import { ALL_UI_SURFACES, BOTH_LOCALES, NON_CONTENT_SLOTS, contentSlots } from "./shared.ts";

export const shadcnLanding2Manifest: TemplateManifest = {
  templateId: "shadcn-landing2",
  displayName: "SHADCN PRO / Modern",
  manifestVersion: 1,
  runtime: "next-static",
  nativeLocales: ["en"],
  outputLocales: BOTH_LOCALES,
  localizedUi: ALL_UI_SURFACES,
  requiredVisibleTargets: ["heroTitle"],
  slots: contentSlots({
    "hero.title": ["Shadcn Landing Page"],
    "about.body": ["About Shadcn Landing"],
    "features.items": ["Our features"],
    "services.items": ["Our services"],
    products: ["Pricing plans"],
    "contact.title": ["Contact Us"],
    "contact.body": ["Contact us"],
  }),
  nonContentSlots: NON_CONTENT_SLOTS,
  recommendation: "eligible",
};
