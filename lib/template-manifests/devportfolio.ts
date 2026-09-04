import type { TemplateManifest } from "./types.ts";
import { ALL_UI_SURFACES, BOTH_LOCALES, NON_CONTENT_SLOTS, contentSlots } from "./shared.ts";

export const devportfolioManifest: TemplateManifest = {
  templateId: "devportfolio",
  displayName: "DEVPORTFOLIO / Profile",
  manifestVersion: 1,
  runtime: "static-html",
  nativeLocales: ["en"],
  outputLocales: BOTH_LOCALES,
  localizedUi: ALL_UI_SURFACES,
  requiredVisibleTargets: ["heroTitle"],
  slots: contentSlots({}, {
    // devportfolio 的 hero h1 位于 main/header 之外的 section/div 内（static 布局），
    // 默认 "main h1, header h1" 采集不到，放宽到页面首个非 sr-only h1。
    "hero.title": "main h1, header h1, body > h1, section h1",
  }),
  nonContentSlots: NON_CONTENT_SLOTS,
  recommendation: "eligible",
};
