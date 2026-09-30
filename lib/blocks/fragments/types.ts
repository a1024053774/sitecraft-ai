/** HTML and CSS of one block. `narrow` and `phone` go inside the page's two breakpoints. */
export type BlockFragment = {
  /** Rules at every width, covering all variants of the block. */
  css: string;
  /** Rules inside `@media (max-width: 900px)`. */
  narrow?: string;
  /** Rules inside `@media (max-width: 480px)`, after the narrow ones. */
  phone?: string;
  /** Variant id -> markup. The root carries data-sc-block and data-sc-variant. */
  variants: Record<string, string>;
};

export const BREAKPOINTS = {
  narrow: "(max-width: 900px)",
  phone: "(max-width: 480px)",
} as const;
