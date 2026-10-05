import type { BlockFragment } from "./types.ts";

/** Ordered quality-control actions; the bridge creates only the entries backed by a draft. */
export const qualityProcessFragment: BlockFragment = {
  css: `
.sitecraft-quality-process-list { border-top: 2px solid var(--site-line); }
.sitecraft-quality-process-item { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.5fr); gap: 16px; align-items: baseline; padding: 16px 0; border-bottom: 1px solid var(--site-line); }
.sitecraft-quality-process-item h3, .sitecraft-quality-process-item p { margin: 0; }
.sitecraft-quality-process-item h3 { font-size: 15px; font-weight: 650; }
.sitecraft-quality-process-item p { color: var(--site-value-ink, var(--site-ink)); line-height: 1.55; overflow-wrap: anywhere; }
.sitecraft-quality-process-checklist { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1px; border: 1px solid var(--site-line); background: var(--site-line); }
.sitecraft-quality-process-checklist .sitecraft-quality-process-item { display: block; min-width: 0; padding: 18px 20px; background: var(--site-surface); border: 0; }
.sitecraft-quality-process-checklist .sitecraft-quality-process-item h3 { display: flex; gap: 10px; align-items: baseline; }
.sitecraft-quality-process-checklist .sitecraft-quality-process-item h3::before { content: ""; flex: none; width: 3px; height: 1.1em; background: var(--site-accent-strong); }
.sitecraft-quality-process-flow { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0; border-top: 1px solid var(--site-line); counter-reset: flow-step; }
.sitecraft-quality-process-flow .sitecraft-quality-process-item { position: relative; display: block; min-width: 0; padding: 20px 28px 20px 0; border-bottom: 1px solid var(--site-line); counter-increment: flow-step; }
.sitecraft-quality-process-flow .sitecraft-quality-process-item::before { content: counter(flow-step, decimal-leading-zero); display: block; margin-bottom: 12px; color: var(--site-accent-strong); font-size: 13px; font-weight: 700; }
.sitecraft-quality-process-flow .sitecraft-quality-process-item:not(:last-child)::after { content: ""; position: absolute; top: 28px; right: 8px; width: 20px; border-top: 1px solid var(--site-accent); }
.sitecraft-quality-process-flow .sitecraft-quality-process-item h3 { margin-bottom: 8px; }
`,
  narrow: `
.sitecraft-quality-process-item { grid-template-columns: minmax(0, 9em) minmax(0, 1fr); gap: 12px; }
.sitecraft-quality-process-checklist { grid-template-columns: 1fr; }
.sitecraft-quality-process-flow { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.sitecraft-quality-process-flow .sitecraft-quality-process-item:nth-child(2)::after { display: none; }
`,
  phone: `
.sitecraft-quality-process-item { grid-template-columns: 1fr; gap: 5px; padding: 14px 0; }
.sitecraft-quality-process-checklist .sitecraft-quality-process-item { padding: 16px; }
.sitecraft-quality-process-flow { display: block; position: relative; border-top: 0; padding-left: 24px; }
.sitecraft-quality-process-flow::before { content: ""; position: absolute; inset: 0 auto 0 7px; width: 1px; background: var(--site-line); }
.sitecraft-quality-process-flow .sitecraft-quality-process-item { padding: 16px 0; border-bottom: 0; }
.sitecraft-quality-process-flow .sitecraft-quality-process-item::after { top: 24px; right: auto; left: -21px; width: 12px; }
`,
  variants: {
    rows: `<section id="quality-process" class="sitecraft-section" data-sitecraft-section="qualityProcess" data-sc-block="qualityProcess" data-sc-variant="rows">
          <div class="sitecraft-container">
            <div class="sitecraft-section-head" data-sc-part="head">
              <h2 data-sitecraft-ui="qualityProcess" data-sc-part="title">质检流程</h2>
            </div>
            <div class="sitecraft-quality-process-list" data-sitecraft-quality-process-grid data-sc-part="list"></div>
          </div>
        </section>`,
    checklist: `<section id="quality-process" class="sitecraft-section" data-sitecraft-section="qualityProcess" data-sc-block="qualityProcess" data-sc-variant="checklist">
          <div class="sitecraft-container">
            <div class="sitecraft-section-head" data-sc-part="head">
              <h2 data-sitecraft-ui="qualityProcess" data-sc-part="title">质检流程</h2>
            </div>
            <div class="sitecraft-quality-process-list sitecraft-quality-process-checklist" data-sitecraft-quality-process-grid data-sc-part="list"></div>
          </div>
        </section>`,
    flow: `<section id="quality-process" class="sitecraft-section" data-sitecraft-section="qualityProcess" data-sc-block="qualityProcess" data-sc-variant="flow">
          <div class="sitecraft-container">
            <div class="sitecraft-section-head" data-sc-part="head">
              <h2 data-sitecraft-ui="qualityProcess" data-sc-part="title">质检流程</h2>
            </div>
            <div class="sitecraft-quality-process-list sitecraft-quality-process-flow" data-sitecraft-quality-process-grid data-sc-part="list"></div>
          </div>
        </section>`,
  },
};
