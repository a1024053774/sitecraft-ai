import type { TemplateManifest } from "./types.ts";
import { ALL_UI_SURFACES, BOTH_LOCALES, NON_CONTENT_SLOTS, contentSlots } from "./shared.ts";

export const screwfastManifest: TemplateManifest = {
  templateId: "screwfast",
  displayName: "ScrewFast / Industrial",
  manifestVersion: 1,
  runtime: "astro-static",
  nativeLocales: ["en"],
  outputLocales: BOTH_LOCALES,
  localizedUi: ALL_UI_SURFACES,
  requiredVisibleTargets: ["heroTitle"],
  slots: contentSlots({
    "hero.title": ["ScrewFast"],
    "about.body": ["ScrewFast is your trusted partner"],
    "features.items": ["Why choose ScrewFast"],
    "services.items": ["Our services"],
    products: ["Explore our products"],
    "contact.title": ["Contact Us"],
    "contact.body": ["Contact ScrewFast"],
  }),
  nonContentSlots: NON_CONTENT_SLOTS,
  recommendation: "eligible",
};
