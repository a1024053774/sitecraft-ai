import type { SiteDraft } from "./site-document.ts";

/**
 * Visitor EN switch is offered only when the draft has English that is not still
 * the default-draft English. Drafts that only keep default English are treated
 * as English-not-generated (intent.md).
 */
export function draftOffersVisitorEnglish(
  draft: SiteDraft,
): boolean {
  // Availability is provenance from the write path. Legacy drafts without the
  // marker are intentionally treated as Chinese-only, regardless of copied text.
  return draft.englishReady === true;
}
