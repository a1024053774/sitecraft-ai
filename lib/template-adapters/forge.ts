import type { TemplateAdapter } from "./types.ts";

/**
 * forge（SMALL BIS / small-bis）专属适配。
 *
 * 从共享 preview route 迁出的专属逻辑：
 *  1. servicesFn —— 原生服务卡区适配（Route B）。通用 scopeBy('services') 会被
 *     moreService 的 "Name of this service" 干扰误判到 Work 区，这里用 forge 卡区自身
 *     特征（section.mx-auto.mt-60 + .h-96 卡）精确定位并整卡写入 SiteDraft services。
 *  2. designTokenCss —— design token 应用后的 forge 专属覆盖。
 *  3. sanitize —— published 变体残留 demo 文案清理规则。
 * 不修改 vendor 源码，全部经注入层 CSS 选择器完成。
 */
const servicesFn = `
  const applyNativeServiceCards = (draft, locale, applied) => {
    const items = draft.content?.services?.items;
    if (!items?.length) return;
    const section = sectionScopes().find((scope) =>
      scope.classList?.contains('mx-auto') && /mt-60/.test(scope.className || '') && scope.querySelector('.h-96'));
    if (!section) return;
    const cards = Array.from(section.querySelectorAll('.h-96'));
    const visibleCount = Math.min(cards.length, items.length);
    // 隐藏超出 SiteDraft 项数的原生演示卡（如只有 2 项服务时第 3 张 "Services" dummy 卡不应残留）。
    cards.slice(visibleCount).forEach((card) => {
      card.style.setProperty('display', 'none', 'important');
      card.setAttribute('aria-hidden', 'true');
    });
    cards.slice(0, visibleCount).forEach((card, index) => {
      const item = items[index];
      const itemKey = (item && typeof item.id === 'string' && item.id) ? item.id : String(index);
      card.dataset.sitecraftSection = 'services';
      card.dataset.sitecraftItemId = itemKey;
      card.style.removeProperty('display');
      card.removeAttribute('aria-hidden');
      const titleNode = allVisible('p[class*="text-4xl"]', card)[0];
      const bodyNode = allVisible('p[class*="text-lg"]', card)[0];
      setText(titleNode, localize(item.title, locale), 'services.items.' + itemKey + '.title.' + locale, applied);
      setText(bodyNode, localize(item.body, locale), 'services.items.' + itemKey + '.body.' + locale, applied);
    });
    if (cards.length < items.length) {
      // SiteDraft 服务项多于原生卡位：补生成多余项，避免静默丢内容。
      const extra = items.slice(cards.length);
      const grid = document.createElement('div');
      grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(min(200px,100%),1fr));gap:16px;margin-top:16px;width:100%';
      extra.forEach((item, extraIndex) => {
        const itemKey = (item && typeof item.id === 'string' && item.id) ? item.id : String(cards.length + extraIndex);
        const card = document.createElement('article');
        card.style.cssText = 'min-width:0;padding:20px;border:1px solid rgba(255,255,255,.25);border-radius:8px;background:rgba(255,255,255,.05)';
        card.dataset.sitecraftSection = 'services';
        card.dataset.sitecraftItemId = itemKey;
        const t = document.createElement('p'); t.className = 'text-4xl'; t.style.cssText = 'margin:0 0 8px;font-weight:700;color:inherit';
        const b = document.createElement('p'); b.className = 'text-lg'; b.style.cssText = 'margin:0;opacity:.85;line-height:1.6;color:inherit';
        setText(t, localize(item.title, locale), 'services.items.' + itemKey + '.title.' + locale, applied);
        setText(b, localize(item.body, locale), 'services.items.' + itemKey + '.body.' + locale, applied);
        card.append(t, b);
        grid.append(card);
      });
      section.append(grid);
    }
  };
`;

const designTokenCss =
  'h1,h2,h3{color:var(--sitecraft-primary)!important}' +
  'button,a[class*="btn"],a[class*="button"]{background-color:var(--sitecraft-primary)!important;color:#fff!important}' +
  '[class*="card"],article{border-color:color-mix(in srgb,var(--sitecraft-primary) 22%,transparent)!important}';

const sanitize: TemplateAdapter["sanitize"] = {
  sections: ["Frequently Asked Questions"],
  leafPatterns: [
    "A List If Needed",
    "part [1-4]",
    "One or two sentences about what your company offers[.]",
    "brief description of services",
  ],
};

export const forgeAdapter: TemplateAdapter = {
  templateId: "forge",
  servicesFn,
  designTokenCss,
  sanitize,
};
