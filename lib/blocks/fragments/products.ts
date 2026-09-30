import type { BlockFragment } from "./types.ts";

// Product family cards: key specs on the card, the full list folded away. The bridge renders the
// cards into [data-sitecraft-product-grid].
export const productsFragment: BlockFragment = {
  css: `
.sitecraft-product-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 420px), 1fr)); gap: 24px; }
.sitecraft-product-card { display: flex; flex-direction: column; background: var(--site-surface); border: var(--site-rule); }
.sitecraft-product-media { aspect-ratio: 16 / 10; background: var(--site-diagram); overflow: hidden; }
.sitecraft-product-image { width: 100%; height: 100%; object-fit: cover; }
.sitecraft-product-body { flex: 1; display: flex; flex-direction: column; gap: 14px; padding: 26px 28px 24px; }
.sitecraft-product-category { margin: 0; font-size: 13px; font-weight: 600; color: var(--site-accent-strong); }
.sitecraft-product-card h3 { margin: 0; font-size: 24px; letter-spacing: -0.01em; }
.sitecraft-product-keys { margin: 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); border-top: var(--site-rule); border-bottom: var(--site-rule); }
.sitecraft-product-key { padding: 14px 12px 14px 0; }
.sitecraft-product-key + .sitecraft-product-key { padding-left: 14px; border-left: var(--site-rule); }
.sitecraft-product-key dt { font-size: 12px; color: var(--site-muted); }
.sitecraft-product-key dd { margin: 4px 0 0; font-size: 18px; font-weight: 700; font-variant-numeric: tabular-nums; white-space: nowrap; }
.sitecraft-product-card[data-sitecraft-product-photo="false"] .sitecraft-product-key dd { font-size: 22px; }
.sitecraft-product-summary { margin: 0; color: var(--site-muted); line-height: 1.6; }
.sitecraft-product-more summary { cursor: pointer; list-style: none; font-size: 14px; font-weight: 600; color: var(--site-accent-strong); }
.sitecraft-product-more summary::-webkit-details-marker { display: none; }
.sitecraft-product-more summary::after { content: " +"; }
.sitecraft-product-more[open] summary::after { content: " −"; }
.sitecraft-product-specs { width: 100%; margin-top: 10px; border-collapse: collapse; font-size: 14px; }
.sitecraft-product-specs th, .sitecraft-product-specs td { padding: 9px 0; border-bottom: var(--site-rule); text-align: left; vertical-align: top; }
.sitecraft-product-specs th { width: 44%; color: var(--site-muted); font-weight: 500; }
.sitecraft-product-specs td { font-variant-numeric: tabular-nums; }
.sitecraft-product-foot { margin-top: auto; padding-top: 6px; display: grid; gap: 6px; }
.sitecraft-product-ask { justify-self: start; font-size: 14px; font-weight: 650; }
.sitecraft-product-ask::after { content: " →"; }
.sitecraft-product-ask:hover { color: var(--site-accent-strong); }
.sitecraft-product-image-credit { margin: 0; font-size: 12px; color: var(--site-muted); }
.sitecraft-product-empty { margin: 0; color: var(--site-muted); }
`,
  phone: `
.sitecraft-product-body { padding: 20px; }
/* Narrow screens: key specs as name/value rows so units never break. */
.sitecraft-product-keys { grid-template-columns: 1fr; }
.sitecraft-product-key, .sitecraft-product-key + .sitecraft-product-key { display: flex; justify-content: space-between; gap: 12px; padding: 10px 0; border-left: 0; }
.sitecraft-product-key + .sitecraft-product-key { border-top: var(--site-rule); }
.sitecraft-product-key dd, .sitecraft-product-card[data-sitecraft-product-photo="false"] .sitecraft-product-key dd { margin: 0; font-size: 16px; }
`,
  variants: {
    cards: `<section id="products" class="sitecraft-section" data-sitecraft-section="products" data-sc-block="products" data-sc-variant="cards">
          <div class="sitecraft-container">
            <div class="sitecraft-section-head" data-sc-part="head">
              <h2 data-sitecraft-benchmark="products-title">产品</h2>
              <p class="sitecraft-section-intro" data-sitecraft-benchmark="products-intro" hidden></p>
            </div>
            <div class="sitecraft-product-grid" data-sitecraft-product-grid data-sc-part="grid"></div>
          </div>
        </section>`,
  },
};
