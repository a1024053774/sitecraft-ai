import type { BlockFragment } from "./types.ts";

/** Ordered company milestones; the bridge writes only source-backed year/event rows. */
export const historyFragment: BlockFragment = {
  css: `
.sitecraft-history-list { border-top: 2px solid var(--site-line); }
.sitecraft-history-item { display: grid; grid-template-columns: minmax(5em, .35fr) minmax(0, 1.65fr); gap: 16px; align-items: baseline; padding: 16px 0; border-bottom: 1px solid var(--site-line); }
.sitecraft-history-item h3, .sitecraft-history-item p { margin: 0; }
.sitecraft-history-item h3 { font-size: 15px; font-weight: 650; font-variant-numeric: tabular-nums; }
.sitecraft-history-item p { color: var(--site-value-ink, var(--site-ink)); line-height: 1.55; overflow-wrap: anywhere; }
`,
  narrow: `
.sitecraft-history-item { grid-template-columns: minmax(4em, .45fr) minmax(0, 1.55fr); gap: 12px; }
`,
  phone: `
.sitecraft-history-item { grid-template-columns: 1fr; gap: 5px; padding: 14px 0; }
`,
  variants: {
    rows: `<section id="history" class="sitecraft-section" data-sitecraft-section="history" data-sc-block="history" data-sc-variant="rows">
          <div class="sitecraft-container">
            <div class="sitecraft-section-head" data-sc-part="head">
              <h2 data-sitecraft-ui="history" data-sc-part="title">沿革</h2>
            </div>
            <div class="sitecraft-history-list" data-sitecraft-history-grid data-sc-part="list"></div>
          </div>
        </section>`,
  },
};
