import type { TemplateManifest } from "./types.ts";
import { ALL_UI_SURFACES, BOTH_LOCALES, NON_CONTENT_SLOTS, contentSlots } from "./shared.ts";

export const foxiManifest: TemplateManifest = {
  templateId: "foxi",
  displayName: "FOXI / SaaS Suite",
  manifestVersion: 1,
  runtime: "astro-static",
  nativeLocales: ["en"],
  outputLocales: BOTH_LOCALES,
  localizedUi: ALL_UI_SURFACES,
  requiredVisibleTargets: ["heroTitle"],
  slots: contentSlots({
      "hero.title": ["Enhance team performance with seamless integration", "Foxi"],
    }),
  nonContentSlots: NON_CONTENT_SLOTS,
  recommendation: "eligible",
};
