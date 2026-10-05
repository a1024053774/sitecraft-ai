import type { BlockFragment } from "./types.ts";

/** Ordered company milestones; the bridge writes only source-backed year/event rows. */
export const historyFragment: BlockFragment = {
  css: `
.sitecraft-history-list { border-top: 2px solid var(--site-line); }
.sitecraft-history-item { display: grid; grid-template-columns: minmax(5em, .35fr) minmax(0, 1.65fr); gap: 16px; align-items: baseline; padding: 16px 0; border-bottom: 1px solid var(--site-line); }
.sitecraft-history-item h3, .sitecraft-history-item p { margin: 0; }
.sitecraft-history-item h3 { font-size: 15px; font-weight: 650; font-variant-numeric: tabular-nums; }
.sitecraft-history-item p { color: var(--site-value-ink, var(--site-ink)); line-height: 1.55; overflow-wrap: anywhere; }
.sitecraft-history-timeline { position: relative; border-top: 0; padding-left: 32px; }
.sitecraft-history-timeline::before { content: ""; position: absolute; inset: 0 auto 0 7px; width: 1px; background: var(--site-line); }
.sitecraft-history-timeline .sitecraft-history-item { position: relative; grid-template-columns: minmax(5em, .35fr) minmax(0, 1.65fr); gap: 20px; padding: 20px 0; border-bottom: 0; }
.sitecraft-history-timeline .sitecraft-history-item::before { content: ""; position: absolute; left: -29px; top: 25px; width: 9px; height: 9px; border: 2px solid var(--site-accent); border-radius: 50%; background: var(--site-bg); }
.sitecraft-history-timeline .sitecraft-history-item h3 { color: var(--site-accent-strong); }
.sitecraft-history-alternating { position: relative; display: grid; gap: 0; border-top: 0; }
.sitecraft-history-alternating::before { content: ""; position: absolute; inset: 0 50% 0 auto; width: 1px; background: var(--site-line); }
.sitecraft-history-alternating .sitecraft-history-item { position: relative; display: block; width: calc(50% - 28px); padding: 20px 0; border-bottom: 0; }
.sitecraft-history-alternating .sitecraft-history-item:nth-child(even) { margin-left: auto; }
.sitecraft-history-alternating .sitecraft-history-item:nth-child(odd) { margin-right: auto; text-align: right; }
.sitecraft-history-alternating .sitecraft-history-item::before { content: ""; position: absolute; top: 26px; right: -33px; width: 9px; height: 9px; border: 2px solid var(--site-accent); border-radius: 50%; background: var(--site-bg); }
.sitecraft-history-alternating .sitecraft-history-item:nth-child(even)::before { left: -33px; right: auto; }
.sitecraft-history-alternating .sitecraft-history-item h3 { color: var(--site-accent-strong); }
`,
  narrow: `
.sitecraft-history-item { grid-template-columns: minmax(4em, .45fr) minmax(0, 1.55fr); gap: 12px; }
.sitecraft-history-timeline { padding-left: 28px; }
.sitecraft-history-timeline .sitecraft-history-item { grid-template-columns: minmax(4em, .45fr) minmax(0, 1.55fr); gap: 12px; }
.sitecraft-history-alternating { padding-inline: 16px; }
`,
  phone: `
.sitecraft-history-item { grid-template-columns: 1fr; gap: 5px; padding: 14px 0; }
.sitecraft-history-timeline { padding-left: 24px; }
.sitecraft-history-timeline .sitecraft-history-item { grid-template-columns: 1fr; gap: 5px; padding: 16px 0; }
.sitecraft-history-alternating { display: block; padding-left: 24px; }
.sitecraft-history-alternating::before { inset: 0 auto 0 7px; }
.sitecraft-history-alternating .sitecraft-history-item, .sitecraft-history-alternating .sitecraft-history-item:nth-child(even), .sitecraft-history-alternating .sitecraft-history-item:nth-child(odd) { width: 100%; margin: 0; padding: 16px 0; text-align: left; }
.sitecraft-history-alternating .sitecraft-history-item::before, .sitecraft-history-alternating .sitecraft-history-item:nth-child(even)::before { left: -21px; right: auto; top: 21px; }
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
    timeline: `<section id="history" class="sitecraft-section" data-sitecraft-section="history" data-sc-block="history" data-sc-variant="timeline">
          <div class="sitecraft-container">
            <div class="sitecraft-section-head" data-sc-part="head">
              <h2 data-sitecraft-ui="history" data-sc-part="title">沿革</h2>
            </div>
            <div class="sitecraft-history-list sitecraft-history-timeline" data-sitecraft-history-grid data-sc-part="list"></div>
          </div>
        </section>`,
    alternating: `<section id="history" class="sitecraft-section" data-sitecraft-section="history" data-sc-block="history" data-sc-variant="alternating">
          <div class="sitecraft-container">
            <div class="sitecraft-section-head" data-sc-part="head">
              <h2 data-sitecraft-ui="history" data-sc-part="title">沿革</h2>
            </div>
            <div class="sitecraft-history-list sitecraft-history-alternating" data-sitecraft-history-grid data-sc-part="list"></div>
          </div>
        </section>`,
  },
};
