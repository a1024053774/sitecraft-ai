import type { TemplateAdapter } from "./types.ts";

/**
 * signal（RICOFAST / ricofast）适配 —— 占位：搬运共享 route 既有片段，行为不变。
 * 现仅 designTokenCss；无 sanitize、无专属 servicesFn。
 */
const designTokenCss =
  'h1,h2,h3{color:var(--sitecraft-accent)!important}' +
  'button,a[class*="btn"],a[class*="button"]{background-color:var(--sitecraft-accent)!important;color:#111827!important}' +
  '[class*="card"],article{border-color:color-mix(in srgb,var(--sitecraft-accent) 26%,transparent)!important}';

export const signalAdapter: TemplateAdapter = {
  templateId: "signal",
  designTokenCss,
};
