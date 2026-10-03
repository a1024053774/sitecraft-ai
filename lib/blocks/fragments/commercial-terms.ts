import type { BlockFragment } from "./types.ts";

/** 商业条款: fixed bilingual kind labels plus material-backed values. */
export const commercialTermsFragment: BlockFragment = {
  css: `
.sitecraft-commercial-terms-list { border-top: 2px solid var(--site-line); }
.sitecraft-commercial-term { display: grid; grid-template-columns: minmax(0, 11em) minmax(0, 1fr); gap: 16px; align-items: baseline; padding: 16px 0; border-bottom: 1px solid var(--site-line); }
.sitecraft-commercial-term h3 { margin: 0; font-size: 15px; font-weight: 650; }
.sitecraft-commercial-term p { margin: 0; color: var(--site-value-ink, var(--site-ink)); line-height: 1.55; overflow-wrap: anywhere; }
`,
  narrow: `
.sitecraft-commercial-term { grid-template-columns: minmax(0, 9em) minmax(0, 1fr); gap: 12px; }
`,
  phone: `
.sitecraft-commercial-term { grid-template-columns: 1fr; gap: 5px; padding: 14px 0; }
.sitecraft-commercial-term h3 { font-size: 14px; }
`,
  variants: {
    rows: `<section id="commercial-terms" class="sitecraft-section" data-sitecraft-section="commercialTerms" data-sc-block="commercialTerms" data-sc-variant="rows">
          <div class="sitecraft-container">
            <div class="sitecraft-section-head" data-sc-part="head">
              <h2 data-sitecraft-ui="commercialTerms" data-sc-part="title">商业条款</h2>
            </div>
            <div class="sitecraft-commercial-terms-list" data-sitecraft-commercial-terms-grid data-sc-part="list"></div>
          </div>
        </section>`,
  },
};
