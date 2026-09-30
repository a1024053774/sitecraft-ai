// Types for scripts/published-facts.mjs (plain JS so check-published runs without a build step).
export type PublishedFact = { kind: string; text: string };

export const ENTRY_SLOTS: Readonly<Record<"screwfast" | "forge" | "landwind" | "tailwind-landing", { faq: number; services: number }>>;

export function normalizeReadable(text: unknown): string;

export function expectedFacts(draft: unknown): PublishedFact[];

export function missingFacts(facts: PublishedFact[], readable: unknown): PublishedFact[];
