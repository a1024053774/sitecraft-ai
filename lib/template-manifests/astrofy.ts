import type { TemplateManifest } from "./types.ts";
import { ALL_UI_SURFACES, BOTH_LOCALES, NON_CONTENT_SLOTS, contentSlots } from "./shared.ts";

export const astrofyManifest: TemplateManifest = {
  templateId: "astrofy",
  displayName: "ASTROFY / Portfolio",
  manifestVersion: 1,
  runtime: "astro-static",
  nativeLocales: ["en"],
  outputLocales: BOTH_LOCALES,
  localizedUi: ALL_UI_SURFACES,
  requiredVisibleTargets: ["heroTitle"],
  slots: contentSlots({
      "hero.title": ["Astrofy", "Hey there", "I'm Manuel Ernesto", "Demo Project"],
    }),
  nonContentSlots: NON_CONTENT_SLOTS,
  recommendation: "eligible",
};
