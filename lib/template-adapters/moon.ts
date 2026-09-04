import type { TemplateAdapter } from "./types.ts";

/**
 * moon（MOON / astro-landing-page moon）专属适配。
 *
 * 模板首屏唯一 h1 是 sr-only（屏幕阅读器用，"Astro"），真实标题是可见的
 * h2.gradient-text.text-6xl。共享 findHero() 排除 sr-only 后找不到可见 h1，
 * 因此用 heroFn 把首屏标题定位到该可见 h2。
 */
const heroFn = `const resolveHeroByAdapter = () => {
  const existing = document.querySelector('[data-sitecraft-slot^="hero.title."]');
  if (existing) return existing;
  return allVisible('h2[class*="gradient-text"][class*="text-6xl"], h2.gradient-text')[0] || null;
}`;

export const moonAdapter: TemplateAdapter = {
  templateId: "moon",
  heroFn,
};
