import type { LocalizedText, SiteDraft } from "./site-document.ts";
import { defaultDraft } from "./site-document.ts";

function isGap(value: string | undefined) {
  if (!value) return true;
  const trimmed = value.trim();
  return !trimmed
    || trimmed === "待补充"
    || trimmed === "To be provided"
    || trimmed === "To be completed"
    || trimmed === "地址待补充"
    || trimmed === "Address to be completed";
}

function enOf(value: LocalizedText | string | undefined): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  return typeof value.en === "string" ? value.en : "";
}

function authoredEnglishDiffers(current: string, sentinel: string) {
  if (isGap(current)) return false;
  return current.trim() !== sentinel.trim();
}

/**
 * Visitor EN switch is offered only when the draft has English that is not still
 * the default-draft English. Drafts that only keep default English are treated
 * as English-not-generated (intent.md).
 */
export function draftOffersVisitorEnglish(
  draft: SiteDraft,
  sentinel: SiteDraft = defaultDraft,
): boolean {
  const pairs: Array<[string, string]> = [
    [enOf(draft.content.hero.title), enOf(sentinel.content.hero.title)],
    [enOf(draft.content.hero.subtitle), enOf(sentinel.content.hero.subtitle)],
    [enOf(draft.content.hero.cta), enOf(sentinel.content.hero.cta)],
    [enOf(draft.content.about.title), enOf(sentinel.content.about.title)],
    [enOf(draft.content.about.body), enOf(sentinel.content.about.body)],
    [enOf(draft.content.features.title), enOf(sentinel.content.features.title)],
    [enOf(draft.content.features.intro), enOf(sentinel.content.features.intro)],
    [enOf(draft.content.services.title), enOf(sentinel.content.services.title)],
    [enOf(draft.content.services.intro), enOf(sentinel.content.services.intro)],
    [enOf(draft.content.products.title), enOf(sentinel.content.products.title)],
    [enOf(draft.content.products.intro), enOf(sentinel.content.products.intro)],
    [enOf(draft.content.contact.title), enOf(sentinel.content.contact.title)],
    [enOf(draft.content.contact.body), enOf(sentinel.content.contact.body)],
    [enOf(draft.content.contact.address), enOf(sentinel.content.contact.address)],
    [enOf(draft.navigation.about), enOf(sentinel.navigation.about)],
    [enOf(draft.navigation.features), enOf(sentinel.navigation.features)],
    [enOf(draft.navigation.services), enOf(sentinel.navigation.services)],
    [enOf(draft.navigation.products), enOf(sentinel.navigation.products)],
    [enOf(draft.navigation.contact), enOf(sentinel.navigation.contact)],
  ];

  for (const section of ["features", "services", "faq"] as const) {
    const items = draft.content[section]?.items ?? [];
    const sentinelItems = sentinel.content[section]?.items ?? [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const base = sentinelItems[i];
      pairs.push([enOf(item?.title), enOf(base?.title)]);
      pairs.push([enOf(item?.body), enOf(base?.body)]);
    }
  }

  for (const section of ["industries", "capabilities", "certifications"] as const) {
    const catalog = draft.content[section];
    if (!catalog) continue;
    pairs.push([enOf(catalog.title), ""]);
    pairs.push([enOf(catalog.intro), ""]);
    for (const item of catalog.items ?? []) {
      pairs.push([enOf(item.title), ""]);
      pairs.push([enOf(item.body), ""]);
    }
  }

  for (const product of draft.products ?? []) {
    const base = sentinel.products.find((item) => item.sku === product.sku);
    pairs.push([enOf(product.name), enOf(base?.name)]);
    pairs.push([enOf(product.summary), enOf(base?.summary)]);
  }

  return pairs.some(([current, sentinelEn]) => authoredEnglishDiffers(current, sentinelEn));
}
