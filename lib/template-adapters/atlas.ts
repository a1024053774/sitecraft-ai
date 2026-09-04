import type { TemplateAdapter } from "./types.ts";

/**
 * atlas（ASTROPLATE / astroplate）适配 —— 占位：搬运共享 route 既有片段，行为不变。
 * sanitize 为 published 变体残留 demo 清理；暂无专属 servicesFn。
 */
const designTokenCss =
  'h1,h2,h3{color:var(--sitecraft-primary)!important}' +
  'button,a[class*="btn"],a[class*="button"]{background-color:var(--sitecraft-primary)!important;color:#fff!important}' +
  '[class*="badge"],[class*="tag"]{background-color:var(--sitecraft-accent)!important;color:var(--sitecraft-primary)!important}';

const sanitize: TemplateAdapter["sanitize"] = {
  sections: ["Top Reasons to Choose Astro", "Ready to build your next project with Astro"],
  leafPatterns: [
    "Lorem ipsum",
    "Marvin McKinney",
    "Web Designer",
    "Zero JS, by default",
    "UI-agnostic",
    "10[+] Pre-build pages",
    "Google Pagespeed",
  ],
};

export const atlasAdapter: TemplateAdapter = {
  templateId: "atlas",
  designTokenCss,
  sanitize,
};
