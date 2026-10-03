import type { BlockFragment } from "./types.ts";

/** Equipment: machine names with an optional count and source-backed specification. */
export const equipmentFragment: BlockFragment = {
  css: `
.sitecraft-equipment-list { border-top: 2px solid var(--site-line); }
.sitecraft-equipment-item { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(5em, .5fr) minmax(0, 1fr); gap: 16px; align-items: baseline; padding: 16px 0; border-bottom: 1px solid var(--site-line); }
.sitecraft-equipment-item h3, .sitecraft-equipment-item p { margin: 0; }
.sitecraft-equipment-item h3 { font-size: 15px; font-weight: 650; }
.sitecraft-equipment-item p { color: var(--site-value-ink, var(--site-ink)); line-height: 1.55; overflow-wrap: anywhere; }
.sitecraft-equipment-quantity { white-space: nowrap; }
`,
  narrow: `
.sitecraft-equipment-item { grid-template-columns: minmax(0, 1fr) minmax(5em, .55fr); gap: 8px 16px; }
.sitecraft-equipment-item [data-sitecraft-equipment-spec] { grid-column: 1 / -1; }
`,
  phone: `
.sitecraft-equipment-item { grid-template-columns: 1fr; gap: 5px; padding: 14px 0; }
.sitecraft-equipment-item [data-sitecraft-equipment-spec] { grid-column: auto; }
.sitecraft-equipment-quantity { white-space: normal; }
`,
  variants: {
    rows: `<section id="equipment" class="sitecraft-section" data-sitecraft-section="equipment" data-sc-block="equipment" data-sc-variant="rows">
          <div class="sitecraft-container">
            <div class="sitecraft-section-head" data-sc-part="head">
              <h2 data-sitecraft-ui="equipment" data-sc-part="title">设备</h2>
            </div>
            <div class="sitecraft-equipment-list" data-sitecraft-equipment-grid data-sc-part="list"></div>
          </div>
        </section>`,
  },
};
