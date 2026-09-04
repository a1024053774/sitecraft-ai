import type { TemplateManifest } from "./types.ts";
import { ALL_UI_SURFACES, BOTH_LOCALES, NON_CONTENT_SLOTS, contentSlots } from "./shared.ts";

export const landwindManifest: TemplateManifest = {
  templateId: "landwind",
  displayName: "LANDWIND / Clean",
  manifestVersion: 1,
  runtime: "astro-static",
  nativeLocales: ["en"],
  outputLocales: BOTH_LOCALES,
  localizedUi: ALL_UI_SURFACES,
  requiredVisibleTargets: ["heroTitle"],
  slots: contentSlots({
      "hero.title": ["Building digital products & brands", "Landwind"],
    }),
  nonContentSlots: NON_CONTENT_SLOTS,
  recommendation: "eligible",
};
