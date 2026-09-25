import { defaultDraft, type LocalizedText, type SiteDraft } from "./site-document.ts";

function cloneLocalized(value: LocalizedText): LocalizedText {
  return { zh: value.zh, en: value.en };
}

/** Frozen default-draft copy used to detect “never authored” visitor values. */
export const DEFAULT_DRAFT_SENTINEL = {
  content: {
    hero: {
      title: cloneLocalized(defaultDraft.content.hero.title),
      subtitle: cloneLocalized(defaultDraft.content.hero.subtitle),
      cta: cloneLocalized(defaultDraft.content.hero.cta),
    },
    about: {
      title: cloneLocalized(defaultDraft.content.about.title),
      body: cloneLocalized(defaultDraft.content.about.body),
    },
    features: {
      title: cloneLocalized(defaultDraft.content.features.title),
      intro: cloneLocalized(defaultDraft.content.features.intro),
      items: defaultDraft.content.features.items.map((item) => ({
        id: item.id,
        title: cloneLocalized(item.title),
        body: cloneLocalized(item.body),
      })),
    },
    services: {
      title: cloneLocalized(defaultDraft.content.services.title),
      intro: cloneLocalized(defaultDraft.content.services.intro),
      items: defaultDraft.content.services.items.map((item) => ({
        id: item.id,
        title: cloneLocalized(item.title),
        body: cloneLocalized(item.body),
      })),
    },
    products: {
      title: cloneLocalized(defaultDraft.content.products.title),
      intro: cloneLocalized(defaultDraft.content.products.intro),
    },
    contact: {
      title: cloneLocalized(defaultDraft.content.contact.title),
      body: cloneLocalized(defaultDraft.content.contact.body),
      address: cloneLocalized(defaultDraft.content.contact.address),
    },
    faq: {
      title: cloneLocalized(defaultDraft.content.faq.title),
      intro: cloneLocalized(defaultDraft.content.faq.intro),
      items: defaultDraft.content.faq.items.map((item) => ({
        id: item.id,
        title: cloneLocalized(item.title),
        body: cloneLocalized(item.body),
      })),
    },
  },
} as const;

export type DraftSentinel = typeof DEFAULT_DRAFT_SENTINEL;

export function readSentinelValue(target: string, locale: string, sentinel: DraftSentinel = DEFAULT_DRAFT_SENTINEL): string | undefined {
  const content = sentinel.content;
  if (target === "hero.title") return content.hero.title[locale as "zh" | "en"];
  if (target === "hero.subtitle") return content.hero.subtitle[locale as "zh" | "en"];
  if (target === "hero.cta") return content.hero.cta[locale as "zh" | "en"];
  if (target === "about.title") return content.about.title[locale as "zh" | "en"];
  if (target === "about.body") return content.about.body[locale as "zh" | "en"];
  if (target === "features.title") return content.features.title[locale as "zh" | "en"];
  if (target === "features.intro") return content.features.intro[locale as "zh" | "en"];
  if (target === "services.title") return content.services.title[locale as "zh" | "en"];
  if (target === "services.intro") return content.services.intro[locale as "zh" | "en"];
  if (target === "products.title") return content.products.title[locale as "zh" | "en"];
  if (target === "products.intro") return content.products.intro[locale as "zh" | "en"];
  if (target === "contact.title") return content.contact.title[locale as "zh" | "en"];
  if (target === "contact.body") return content.contact.body[locale as "zh" | "en"];
  if (target === "contact.address") return content.contact.address[locale as "zh" | "en"];
  if (target === "faq.title") return content.faq.title[locale as "zh" | "en"];
  if (target === "faq.intro") return content.faq.intro[locale as "zh" | "en"];
  const featureMatch = /^features\.items\.(\d+)\.(title|body)$/.exec(target);
  if (featureMatch) {
    const item = content.features.items[Number(featureMatch[1])];
    return item ? item[featureMatch[2] as "title" | "body"][locale as "zh" | "en"] : undefined;
  }
  const serviceMatch = /^services\.items\.(\d+)\.(title|body)$/.exec(target);
  if (serviceMatch) {
    const item = content.services.items[Number(serviceMatch[1])];
    return item ? item[serviceMatch[2] as "title" | "body"][locale as "zh" | "en"] : undefined;
  }
  const faqMatch = /^faq\.items\.(\d+)\.(title|body)$/.exec(target);
  if (faqMatch) {
    const item = content.faq.items[Number(faqMatch[1])];
    return item ? item[faqMatch[2] as "title" | "body"][locale as "zh" | "en"] : undefined;
  }
  return undefined;
}

export function isDefaultDraftSentinelValue(
  target: string,
  value: string | undefined,
  locale: string,
  sentinel: DraftSentinel = DEFAULT_DRAFT_SENTINEL,
): boolean {
  if (typeof value !== "string") return false;
  const expected = readSentinelValue(target, locale, sentinel);
  if (expected == null) return false;
  return value.trim() === expected.trim();
}

/** Pack/workspace may keep this label; visitor pages must not show it. */
export function stripSimulationLabel(text: string, locale: string): string {
  if (locale === "en") {
    return text
      .replace(/\s*The following parameters are simulated settings\.?/gi, "")
      .replace(/\s*以下参数为模拟设定。?/g, "")
      .trim();
  }
  return text.replace(/\s*以下参数为模拟设定。?/g, "").trim();
}

export function draftEqualsDefaultSentinel(draft: SiteDraft, target: string, locale: string): boolean {
  // Convenience for tests; bridge uses isDefaultDraftSentinelValue on read values.
  const fromDraft = (() => {
    if (target === "contact.title") return draft.content.contact.title[locale as "zh" | "en"];
    if (target === "contact.body") return draft.content.contact.body[locale as "zh" | "en"];
    if (target === "services.items.0.title") return draft.content.services.items[0]?.title[locale as "zh" | "en"];
    return undefined;
  })();
  return isDefaultDraftSentinelValue(target, fromDraft, locale);
}
