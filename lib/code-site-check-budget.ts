// T-178: one edited page shares this ceiling across its three viewports.
export const localDynamicPageBudgetMs = 60_000;
export function localDynamicViewportBudgetMs(fullReads: number) {
  return Math.max(5_000, 1_000 + 150 * fullReads);
}
