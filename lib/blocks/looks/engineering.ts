import type { BlockLook } from "../catalog.ts";

/**
 * 工程工业 (engineering-industrial): a catalog book. White product plates with the key specs on
 * the card and the full list folded away; the accent only marks the top rule, the buttons and
 * the series labels. Colours come from the palette (registry kit); these are the other tokens.
 */
export const engineeringLook: BlockLook = {
  id: "engineering-industrial",
  templateId: "screwfast",
  documentTitle: "工程工业首页",
  tokens: {
    "--site-container": "1200px",
    "--site-gutter": "48px",
    "--site-gutter-narrow": "32px",
    "--site-section-space": "80px",
    "--site-section-space-narrow": "52px",
    "--site-h1": "clamp(34px, 4.6vw, 58px)",
    "--site-h1-display": "clamp(34px, 5.6vw, 76px)",
    "--site-h2": "clamp(27px, 3vw, 38px)",
    "--site-rule": "1px solid var(--site-line)",
    "--site-rule-strong": "2px solid var(--site-ink)",
  },
  layout: {
    top: ["nav"],
    main: ["hero", "products", ["industries", "capabilities"], "services", "certifications", "faq", "contact"],
    bottom: ["footer"],
  },
  defaults: {
    nav: "bar",
    hero: "split",
    products: "cards",
    industries: "list",
    capabilities: "list",
    services: "steps",
    certifications: "badges",
    faq: "accordion",
    contact: "split",
    footer: "columns",
  },
};
