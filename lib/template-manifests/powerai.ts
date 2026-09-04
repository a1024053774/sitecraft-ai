import type { TemplateManifest } from "./types.ts";
import { ALL_UI_SURFACES, BOTH_LOCALES, NON_CONTENT_SLOTS, contentSlots } from "./shared.ts";

export const poweraiManifest: TemplateManifest = {
  templateId: "powerai",
  displayName: "GENAI / AI Company",
  manifestVersion: 1,
  runtime: "astro-static",
  nativeLocales: ["en"],
  outputLocales: BOTH_LOCALES,
  localizedUi: ALL_UI_SURFACES,
  requiredVisibleTargets: ["heroTitle"],
  slots: contentSlots({
      "hero.title": ["Build the Future with GenAI"],
      "contact.title": ["Start Building Today"],
      "contact.email": ["hello@aiagentplatform.com"],
      "contact.body": ["Join thousands of teams"],
    }),
  nonContentSlots: NON_CONTENT_SLOTS,
  recommendation: "eligible",
};
