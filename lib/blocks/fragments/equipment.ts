import { equipmentSchematic } from "./illustrations.ts";
import type { BlockFragment } from "./types.ts";

/** Equipment: machine names with an optional count and source-backed specification. */
export const equipmentFragment: BlockFragment = {
  css: `
.sitecraft-equipment-list { border-top: 2px solid var(--site-line); }
.sitecraft-equipment-item { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(5em, .5fr) minmax(0, 1fr); gap: 16px; align-items: baseline; padding: 16px 0; border-bottom: 1px solid var(--site-line); }
.sitecraft-equipment-item h3, .sitecraft-equipment-item p { margin: 0; }
.sitecraft-equipment-item h3 { font-size: 15px; font-weight: 650; }
.sitecraft-equipment-item p { color: var(--site-value-ink, var(--site-ink)); line-height: 1.55; overflow-wrap: anywhere; }
.sitecraft-equipment-schematic { display: none; margin-top: 24px; color: var(--site-diagram); }
.sitecraft-equipment-schematic-label { display: block; margin-bottom: 6px; color: var(--site-muted); font-size: 11px; letter-spacing: .08em; text-align: right; }
.sitecraft-equipment-schematic-svg { display: block; width: min(70%, 320px); min-height: 150px; height: auto; margin: 0 auto; }
.sitecraft-section#equipment .sitecraft-container:has([data-sitecraft-image-gallery="equipment"][hidden]) .sitecraft-equipment-schematic { display: block; }
.sitecraft-equipment-quantity { white-space: nowrap; }
/* 数量带: the items with a count as a band (the count big, the name under it, the specification
   under that, a rule above each), the items without one in a compact name list under a small title.
   A missing count is never an empty cell; there is no placeholder number. */
.sitecraft-equipment-band { border-top: 0; }
.sitecraft-equipment-band .sitecraft-equipment-counted { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 28px 32px; }
.sitecraft-equipment-band .sitecraft-equipment-counted[data-sitecraft-entry-count="1"] { grid-template-columns: minmax(0, 300px); }
.sitecraft-equipment-band .sitecraft-equipment-counted[data-sitecraft-entry-count="2"] { grid-template-columns: repeat(2, minmax(0, 300px)); }
.sitecraft-equipment-band .sitecraft-equipment-counted[data-sitecraft-entry-count="3"] { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.sitecraft-equipment-band .sitecraft-equipment-counted[data-sitecraft-entry-count="4"] { grid-template-columns: repeat(4, minmax(0, 1fr)); }
.sitecraft-equipment-band .sitecraft-equipment-counted .sitecraft-equipment-item { display: flex; flex-direction: column; min-width: 0; gap: 6px; padding: 16px 0 0; border: 0; border-top: var(--site-index-top, var(--site-rule-strong)); }
.sitecraft-equipment-band .sitecraft-equipment-counted .sitecraft-equipment-quantity { order: 0; font-size: clamp(34px, 4vw, 52px); font-weight: 700; line-height: 1; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
.sitecraft-equipment-band .sitecraft-equipment-quantity-label { display: none; }
.sitecraft-equipment-band .sitecraft-equipment-quantity-unit { margin-left: 2px; font-size: 16px; font-weight: 600; letter-spacing: 0; color: var(--site-muted); }
.sitecraft-equipment-band .sitecraft-equipment-counted .sitecraft-equipment-item h3 { order: 1; margin-top: 8px; font-size: 16px; line-height: 1.35; overflow-wrap: anywhere; }
.sitecraft-equipment-band .sitecraft-equipment-counted .sitecraft-equipment-item [data-sitecraft-equipment-spec] { order: 2; font-size: 14px; line-height: 1.5; color: var(--site-muted); }
.sitecraft-equipment-band .sitecraft-equipment-group-title { margin: 44px 0 0; padding-bottom: 10px; font-size: 13px; font-weight: 600; color: var(--site-muted); border-bottom: var(--site-index-row, var(--site-rule)); }
.sitecraft-equipment-band .sitecraft-equipment-plain { column-count: 3; column-gap: 32px; }
.sitecraft-equipment-band .sitecraft-equipment-counted:empty + .sitecraft-equipment-plain, .sitecraft-equipment-band > .sitecraft-equipment-plain:first-child { border-top: var(--site-index-top, var(--site-rule-strong)); }
.sitecraft-equipment-band .sitecraft-equipment-plain .sitecraft-equipment-item { display: block; break-inside: avoid; padding: 11px 0; border: 0; border-bottom: var(--site-index-row, var(--site-rule)); }
.sitecraft-equipment-band .sitecraft-equipment-plain .sitecraft-equipment-item h3 { font-size: 15px; font-weight: 600; overflow-wrap: anywhere; }
.sitecraft-equipment-band .sitecraft-equipment-plain .sitecraft-equipment-item [data-sitecraft-equipment-spec] { margin-top: 3px; font-size: 13px; color: var(--site-muted); }
/* 双栏清单: two columns filled row by row (item 1 left, item 2 right, ...) so the order of the materials
   is the reading order and no grouping appears that the materials do not have; up to three items are one
   full-width column. Formerly two columns read top to bottom, each item a name with its count at the right (and the
   specification under the name); an item without a count is just its name. */
.sitecraft-equipment-compact { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 48px; border-top: var(--site-index-top, var(--site-rule-strong)); }
.sitecraft-equipment-compact[data-sitecraft-entry-count="1"], .sitecraft-equipment-compact[data-sitecraft-entry-count="2"], .sitecraft-equipment-compact[data-sitecraft-entry-count="3"] { grid-template-columns: minmax(0, 1fr); }
.sitecraft-equipment-compact .sitecraft-equipment-item { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: baseline; gap: 2px 16px; padding: 13px 0; border: 0; border-bottom: var(--site-index-row, var(--site-rule)); }
.sitecraft-equipment-compact .sitecraft-equipment-item h3 { font-size: 16px; font-weight: 600; overflow-wrap: anywhere; }
.sitecraft-equipment-compact .sitecraft-equipment-quantity { grid-column: 2; grid-row: 1; font-size: 16px; font-weight: 700; text-align: right; font-variant-numeric: tabular-nums; }
.sitecraft-equipment-compact .sitecraft-equipment-quantity-label { display: none; }
.sitecraft-equipment-compact .sitecraft-equipment-quantity-unit { font-size: 13px; font-weight: 500; color: var(--site-muted); }
.sitecraft-equipment-compact .sitecraft-equipment-item [data-sitecraft-equipment-spec] { grid-column: 1 / -1; font-size: 13px; color: var(--site-muted); }
`,
  narrow: `
.sitecraft-equipment-item { grid-template-columns: minmax(0, 1fr) minmax(5em, .55fr); gap: 8px 16px; }
.sitecraft-equipment-item [data-sitecraft-equipment-spec] { grid-column: 1 / -1; }
.sitecraft-equipment-band .sitecraft-equipment-counted { grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 24px 24px; }
.sitecraft-equipment-band .sitecraft-equipment-counted[data-sitecraft-entry-count] { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.sitecraft-equipment-band .sitecraft-equipment-plain { column-count: 2; }
.sitecraft-equipment-compact { column-gap: 32px; }
`,
  phone: `
.sitecraft-equipment-item { grid-template-columns: 1fr; gap: 5px; padding: 14px 0; }
.sitecraft-equipment-item [data-sitecraft-equipment-spec] { grid-column: auto; }
.sitecraft-image-gallery { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-top: 24px; }
.sitecraft-image-gallery[hidden] { display: none; }
.sitecraft-image-gallery figure { margin: 0; min-width: 0; }
.sitecraft-image-gallery img { display: block; width: 100%; aspect-ratio: 4 / 3; object-fit: cover; border-radius: var(--site-card-radius); background: var(--site-diagram); }
.sitecraft-image-gallery figcaption { margin-top: 6px; color: var(--site-muted); font-size: 12px; line-height: 1.45; }
.sitecraft-equipment-quantity { white-space: normal; }
.sitecraft-equipment-band .sitecraft-equipment-counted, .sitecraft-equipment-band .sitecraft-equipment-counted[data-sitecraft-entry-count] { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px 20px; }
.sitecraft-equipment-band .sitecraft-equipment-counted[data-sitecraft-entry-count="1"] { grid-template-columns: minmax(0, 1fr); }
.sitecraft-equipment-band .sitecraft-equipment-counted .sitecraft-equipment-quantity { font-size: 34px; }
.sitecraft-equipment-band .sitecraft-equipment-plain { column-count: 1; }
.sitecraft-equipment-compact, .sitecraft-equipment-compact[data-sitecraft-entry-count] { grid-template-columns: minmax(0, 1fr); }
.sitecraft-equipment-compact .sitecraft-equipment-item { grid-template-columns: minmax(0, 1fr) auto; padding: 12px 0; }
`,
  variants: {
    band: `<section id="equipment" class="sitecraft-section" data-sitecraft-section="equipment" data-sc-block="equipment" data-sc-variant="band">
          <div class="sitecraft-container">
            <div class="sitecraft-section-head" data-sc-part="head">
              <h2 data-sitecraft-ui="equipment" data-sc-part="title">设备</h2>
            </div>
            <div class="sitecraft-equipment-band" data-sitecraft-equipment-grid data-sc-part="list"></div>
            <div class="sitecraft-image-gallery" data-sitecraft-image-gallery="equipment" hidden></div>
            <div class="sitecraft-equipment-schematic" data-sitecraft-equipment-schematic aria-label="示意"><span class="sitecraft-equipment-schematic-label">示意</span>${equipmentSchematic}</div>
          </div>
        </section>`,
    compact: `<section id="equipment" class="sitecraft-section" data-sitecraft-section="equipment" data-sc-block="equipment" data-sc-variant="compact">
          <div class="sitecraft-container">
            <div class="sitecraft-section-head" data-sc-part="head">
              <h2 data-sitecraft-ui="equipment" data-sc-part="title">设备</h2>
            </div>
            <div class="sitecraft-equipment-compact" data-sitecraft-equipment-grid data-sc-part="list"></div>
            <div class="sitecraft-image-gallery" data-sitecraft-image-gallery="equipment" hidden></div>
            <div class="sitecraft-equipment-schematic" data-sitecraft-equipment-schematic aria-label="示意"><span class="sitecraft-equipment-schematic-label">示意</span>${equipmentSchematic}</div>
          </div>
        </section>`,
    rows: `<section id="equipment" class="sitecraft-section" data-sitecraft-section="equipment" data-sc-block="equipment" data-sc-variant="rows">
          <div class="sitecraft-container">
            <div class="sitecraft-section-head" data-sc-part="head">
              <h2 data-sitecraft-ui="equipment" data-sc-part="title">设备</h2>
            </div>
            <div class="sitecraft-equipment-list" data-sitecraft-equipment-grid data-sc-part="list"></div>
            <div class="sitecraft-image-gallery" data-sitecraft-image-gallery="equipment" hidden></div>
            <div class="sitecraft-equipment-schematic" data-sitecraft-equipment-schematic aria-label="示意"><span class="sitecraft-equipment-schematic-label">示意</span>${equipmentSchematic}</div>
          </div>
        </section>`,
  },
};
