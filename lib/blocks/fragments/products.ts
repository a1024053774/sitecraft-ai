import type { BlockFragment } from "./types.ts";

// Product layouts on one grid marker; the bridge fills [data-sitecraft-product-grid] by the
// mounted variant's render mode: cards (key specs on the card, the full list folded away), cards
// grouped under their category, series notes above a comparison table, or a model index table
// (one row per product, each row naming its own first specs).
const section = (variant: string, gridClass: string) => `<section id="products" class="sitecraft-section" data-sitecraft-section="products" data-sc-block="products" data-sc-variant="${variant}">
          <div class="sitecraft-container">
            <div class="sitecraft-section-head" data-sc-part="head">
              <h2 data-sitecraft-benchmark="products-title" data-sc-part="title">产品</h2>
              <p class="sitecraft-section-intro" data-sitecraft-benchmark="products-intro" hidden></p>
            </div>
            <div class="${gridClass}" data-sitecraft-product-grid data-sc-part="grid"></div>
          </div>
        </section>`;

export const productsFragment: BlockFragment = {
  css: `
.sitecraft-product-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 420px), 1fr)); gap: 24px; }
.sitecraft-product-card { display: flex; flex-direction: column; background: var(--site-surface); border: var(--site-rule); border-radius: var(--site-card-radius); }
.sitecraft-product-media { aspect-ratio: 16 / 10; background: var(--site-diagram); overflow: hidden; }
.sitecraft-product-image { width: 100%; height: 100%; object-fit: cover; }
.sitecraft-product-body { flex: 1; display: flex; flex-direction: column; gap: 14px; padding: 26px 28px 24px; }
.sitecraft-product-category { margin: 0; font-size: 13px; font-weight: 600; color: var(--site-accent-strong); }
.sitecraft-product-card h3 { margin: 0; font-size: 24px; letter-spacing: -0.01em; }
.sitecraft-product-keys { margin: 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--site-key-gap); background: var(--site-key-bg); border-top: var(--site-keys-border); border-bottom: var(--site-keys-border); }
.sitecraft-product-key { padding: 14px 12px 14px 0; }
.sitecraft-product-key + .sitecraft-product-key { padding-left: 14px; border-left: var(--site-rule); }
.sitecraft-product-key dt { font-size: 12px; color: var(--site-muted); }
.sitecraft-product-key dd { margin: 4px 0 0; font-size: 18px; font-weight: 700; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; text-wrap: balance; }
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
/* 目录行: one series per row; photos occupy a fixed left column and no-photo rows use the full width. */
.sitecraft-product-rows { display: grid; gap: 20px; }
.sitecraft-product-rows .sitecraft-product-card { display: grid; grid-template-columns: minmax(0, 300px) minmax(0, 1fr); min-width: 0; }
.sitecraft-product-rows .sitecraft-product-card[data-sitecraft-product-photo="false"] { grid-template-columns: 1fr; border-left: var(--site-card-edge); }
.sitecraft-product-rows .sitecraft-product-media { height: 100%; min-height: 220px; aspect-ratio: auto; }
.sitecraft-product-rows .sitecraft-product-body { min-width: 0; }
.sitecraft-product-rows .sitecraft-product-keys { border: var(--site-keys-border); }
/* 按类别分组: each category heads its own row of cards; key specs read as name/value rows so long
   values (materials lists, tolerances with notes) wrap instead of running out of the card. */
.sitecraft-product-groups { display: grid; gap: 44px; }
.sitecraft-product-group { display: grid; grid-template-columns: var(--site-group-columns, minmax(0, 12em) minmax(0, 1fr)); gap: 20px 44px; padding-top: 22px; border-top: var(--site-rule-strong); }
.sitecraft-product-group-title { margin: 0; font-size: 21px; font-weight: 700; line-height: 1.3; letter-spacing: -0.01em; overflow-wrap: anywhere; }
.sitecraft-product-group-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 340px), 1fr)); gap: 20px; }
.sitecraft-product-groups .sitecraft-product-body { padding: 24px 26px 22px; }
.sitecraft-product-groups .sitecraft-product-card h4 { margin: 0; font-size: 21px; line-height: 1.3; letter-spacing: -0.01em; overflow-wrap: anywhere; }
.sitecraft-product-groups .sitecraft-product-keys { grid-template-columns: 1fr; }
.sitecraft-product-groups .sitecraft-product-key, .sitecraft-product-groups .sitecraft-product-key + .sitecraft-product-key { display: flex; justify-content: space-between; align-items: baseline; gap: 16px; padding: 10px 0; border-left: 0; }
.sitecraft-product-groups .sitecraft-product-key + .sitecraft-product-key { border-top: var(--site-rule); }
.sitecraft-product-groups .sitecraft-product-key dt { flex: none; max-width: 45%; font-size: 13px; }
.sitecraft-product-groups .sitecraft-product-key dd, .sitecraft-product-groups .sitecraft-product-card[data-sitecraft-product-photo="false"] .sitecraft-product-key dd { margin: 0; min-width: 0; font-size: 17px; text-align: right; white-space: normal; overflow-wrap: anywhere; }
.sitecraft-product-groups .sitecraft-product-specs td { overflow-wrap: anywhere; }
.sitecraft-look-industrial .sitecraft-product-group-title { padding-bottom: 10px; border-bottom: var(--site-rule-strong); }
/* 参数对比表: one short note per series, then a table with a row for each spec every series has
   and a column per series. On phones every row becomes a block that names the series per value. */
.sitecraft-compare { display: grid; gap: 28px; }
.sitecraft-compare-series { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr)); gap: 16px; }
.sitecraft-compare-series-card { display: flex; flex-direction: column; gap: 10px; min-width: 0; padding: 22px 24px 20px; background: var(--site-surface); border: var(--site-rule); border-top: 3px solid var(--site-accent); }
.sitecraft-compare-series-card h3 { margin: 0; font-size: 21px; line-height: 1.3; letter-spacing: -0.01em; overflow-wrap: anywhere; }
.sitecraft-compare-summary { margin: 0; color: var(--site-muted); line-height: 1.6; }
.sitecraft-compare-series-card .sitecraft-product-ask { align-self: flex-start; margin-top: auto; padding-top: 4px; }
.sitecraft-compare-extra { margin: 8px 0 0; }
.sitecraft-compare-extra div { display: flex; justify-content: space-between; align-items: baseline; gap: 16px; padding: 8px 0; border-bottom: var(--site-rule); font-size: 14px; }
.sitecraft-compare-extra dt { flex: none; max-width: 45%; color: var(--site-muted); }
.sitecraft-compare-extra dd { margin: 0; min-width: 0; text-align: right; font-weight: 600; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.sitecraft-compare-table { width: 100%; table-layout: fixed; border-collapse: collapse; background: var(--site-surface); border: var(--site-rule); font-size: 15px; }
.sitecraft-compare-table th, .sitecraft-compare-table td { padding: 15px 20px; border-bottom: var(--site-rule); text-align: left; vertical-align: top; line-height: 1.45; overflow-wrap: anywhere; }
.sitecraft-compare-table thead th { background: var(--site-ink); color: #fff; font-size: 15px; font-weight: 650; border-bottom: 0; }
.sitecraft-compare-table thead th:first-child { width: 26%; color: rgba(255, 255, 255, 0.66); font-size: 13px; font-weight: 600; }
.sitecraft-compare-table tbody th { color: var(--site-muted); font-weight: 500; }
.sitecraft-compare-table td { font-weight: 650; font-variant-numeric: tabular-nums; }
.sitecraft-compare-table td + td, .sitecraft-compare-table th + td, .sitecraft-compare-table thead th + th { border-left: var(--site-rule); }
.sitecraft-compare-table tbody tr:last-child > * { border-bottom: 0; }
.sitecraft-compare-label { display: none; }
/* 型号索引表: a ledger, one row per product. Each spec cell names its spec, so rows need not share
   any. Below 900px every row becomes a block (name, a wrapping run of spec cells, the inquiry link);
   on phones the spec cells read as name/value lines. */
.sitecraft-section[data-sc-variant="index"] .sitecraft-section-head { margin-bottom: 20px; }
.sitecraft-index-table { width: 100%; table-layout: fixed; border-collapse: collapse; border-top: var(--site-index-top, var(--site-rule-strong)); }
.sitecraft-index-table thead th, .sitecraft-index-table thead td { padding: 12px 20px 10px 0; border-bottom: var(--site-index-row, var(--site-rule)); font-size: 13px; font-weight: 600; text-align: left; color: var(--site-muted); }
.sitecraft-index-table thead th[colspan] { padding-left: 16px; }
.sitecraft-index-name-col { width: 30%; }
.sitecraft-index-ask-col { width: 14%; }
.sitecraft-index-table tbody th, .sitecraft-index-table tbody td { padding: 22px 20px 22px 0; text-align: left; vertical-align: top; }
.sitecraft-index-table tbody + tbody > tr:first-child > * { border-top: var(--site-index-row, var(--site-rule)); }
.sitecraft-index-table tbody tr[data-sitecraft-product] > * { padding-bottom: 12px; }
.sitecraft-index-name .sitecraft-product-category { margin: 0 0 6px; }
.sitecraft-index-name h3 { margin: 0; font-size: 20px; line-height: 1.3; letter-spacing: -0.01em; overflow-wrap: anywhere; }
.sitecraft-index-table tbody td.sitecraft-index-spec { padding-left: 16px; border-left: var(--site-rule); }
.sitecraft-index-spec-label { display: block; margin-bottom: 4px; font-size: 12px; color: var(--site-muted); overflow-wrap: anywhere; }
.sitecraft-index-spec-value { display: block; font-size: 16px; font-weight: 700; line-height: 1.4; font-variant-numeric: tabular-nums; word-break: keep-all; overflow-wrap: anywhere; }
.sitecraft-index-table tbody td.sitecraft-index-ask { padding-right: 0; text-align: right; }
.sitecraft-index-ask .sitecraft-product-ask { white-space: nowrap; }
/* The detail band: a folded line under the row that spans the whole row; opened, the summary sits
   under the name column and the specs after the first three run in columns under the spec columns. */
.sitecraft-index-table tbody td[colspan] { padding: 0 0 18px; }
.sitecraft-index-more summary { cursor: pointer; list-style: none; font-size: 14px; font-weight: 600; color: var(--site-accent-strong); }
.sitecraft-index-more summary::-webkit-details-marker { display: none; }
.sitecraft-index-more summary::after { content: " +"; }
.sitecraft-index-more[open] summary::after { content: " −"; }
.sitecraft-index-detail-body { display: grid; grid-template-columns: 30% minmax(0, 1fr); margin-top: 14px; }
.sitecraft-index-summary { grid-column: 1; margin: 0; padding-right: 20px; font-size: 14px; line-height: 1.55; color: var(--site-muted); overflow-wrap: anywhere; }
.sitecraft-index-rest { grid-column: 2; box-sizing: border-box; width: 80%; margin: 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px 0; }
.sitecraft-index-table[data-sc-cols="2"] .sitecraft-index-rest { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.sitecraft-index-table[data-sc-cols="1"] .sitecraft-index-rest { grid-template-columns: minmax(0, 1fr); }
.sitecraft-index-rest-item { min-width: 0; padding: 0 20px 0 16px; }
.sitecraft-index-rest-item dd { margin: 0; }
`,
  narrow: `
.sitecraft-product-group { grid-template-columns: 1fr; gap: 16px; }
.sitecraft-look-industrial .sitecraft-product-grid { grid-template-columns: 1fr; }
.sitecraft-look-industrial .sitecraft-product-keys { grid-template-columns: 1fr; }
.sitecraft-look-industrial .sitecraft-product-key, .sitecraft-look-industrial .sitecraft-product-key + .sitecraft-product-key { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; padding: 10px 0; border-left: 0; }
.sitecraft-look-industrial .sitecraft-product-key + .sitecraft-product-key { border-top: var(--site-rule); }
.sitecraft-look-industrial .sitecraft-product-key dt { min-width: 0; overflow-wrap: anywhere; }
.sitecraft-look-industrial .sitecraft-product-key dd, .sitecraft-look-industrial .sitecraft-product-card[data-sitecraft-product-photo="false"] .sitecraft-product-key dd { margin: 0; flex: 0 0 auto; max-width: 70%; font-size: 16px; text-align: right; }
.sitecraft-compare-table th, .sitecraft-compare-table td { padding: 13px 14px; }
.sitecraft-index-table, .sitecraft-index-table tbody { display: block; }
.sitecraft-index-table thead { display: none; }
.sitecraft-index-table tbody.sitecraft-index-item { border-bottom: var(--site-index-row, var(--site-rule)); }
.sitecraft-index-table tbody.sitecraft-index-item:last-child { border-bottom: 0; }
.sitecraft-index-table tbody + tbody > tr:first-child > * { border-top: 0; }
.sitecraft-index-table tbody tr[data-sitecraft-product] { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); padding: 20px 0 8px; }
.sitecraft-index-table tbody tr.sitecraft-index-detail { display: block; padding: 0 0 18px; }
.sitecraft-index-table tbody td[colspan] { display: block; padding: 0; }
.sitecraft-index-detail-body { grid-template-columns: minmax(0, 1fr); gap: 12px; }
.sitecraft-index-summary { grid-column: 1; padding-right: 0; }
.sitecraft-index-rest, .sitecraft-index-table[data-sc-cols] .sitecraft-index-rest { grid-column: 1; width: 100%; grid-template-columns: repeat(3, minmax(0, 1fr)); }
.sitecraft-index-table[data-sc-cols="2"] .sitecraft-index-rest { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.sitecraft-index-table[data-sc-cols="1"] .sitecraft-index-rest { grid-template-columns: minmax(0, 1fr); }
.sitecraft-index-rest-item { padding: 0 20px 0 0; }
.sitecraft-index-table tbody tr:last-child { border-bottom: 0; }
.sitecraft-index-table tbody th, .sitecraft-index-table tbody td, .sitecraft-index-table tbody td.sitecraft-index-spec, .sitecraft-index-table tbody td.sitecraft-index-ask { min-width: 0; padding: 0; border: 0; text-align: left; }
.sitecraft-index-table[data-sc-cols="2"] tbody tr { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.sitecraft-index-table[data-sc-cols="1"] tbody tr { grid-template-columns: minmax(0, 1fr); }
.sitecraft-index-name { grid-column: 1 / -1; margin-bottom: 14px; }
.sitecraft-index-table tbody td.sitecraft-index-spec { padding: 10px 20px 0 0; border-top: var(--site-rule); }
.sitecraft-index-table tbody td.sitecraft-index-spec:empty { display: none; }
.sitecraft-index-table tbody td.sitecraft-index-ask { grid-column: 1 / -1; margin-top: 14px; }
`,
  phone: `
.sitecraft-product-body { padding: 20px; }
.sitecraft-product-rows .sitecraft-product-card { grid-template-columns: 1fr; }
.sitecraft-product-rows .sitecraft-product-media { min-height: 0; aspect-ratio: 16 / 10; }
/* Narrow screens: key specs as name/value rows so units never break. */
.sitecraft-product-keys { grid-template-columns: 1fr; }
.sitecraft-product-key, .sitecraft-product-key + .sitecraft-product-key { display: flex; justify-content: space-between; gap: 12px; padding: 10px 0; border-left: 0; }
.sitecraft-product-key + .sitecraft-product-key { border-top: var(--site-rule); }
.sitecraft-product-key dd, .sitecraft-product-card[data-sitecraft-product-photo="false"] .sitecraft-product-key dd { margin: 0; font-size: 16px; }
/* Default cards on phones: the value keeps its line and the label wraps, unless the value needs
   more than most of the row. */
.sitecraft-product-grid .sitecraft-product-key dt { min-width: 0; overflow-wrap: anywhere; }
.sitecraft-product-grid .sitecraft-product-key dd { flex: 0 0 auto; max-width: 70%; text-align: right; }
.sitecraft-look-technical-product .sitecraft-product-grid .sitecraft-product-key dd { flex: 1 1 auto; min-width: 0; max-width: 70%; white-space: normal; overflow-wrap: anywhere; word-break: keep-all; }
.sitecraft-product-groups .sitecraft-product-body { padding: 20px; }
.sitecraft-product-groups .sitecraft-product-key dd, .sitecraft-product-groups .sitecraft-product-card[data-sitecraft-product-photo="false"] .sitecraft-product-key dd { font-size: 16px; }
.sitecraft-compare-series-card { padding: 18px 18px 16px; }
.sitecraft-index-table tbody tr, .sitecraft-index-table[data-sc-cols] tbody tr { grid-template-columns: minmax(0, 1fr); padding: 18px 0; }
.sitecraft-index-table tbody td.sitecraft-index-spec:not(:empty) { display: flex; justify-content: space-between; align-items: baseline; gap: 16px; padding: 10px 0 8px; }
.sitecraft-index-spec-label { flex: none; max-width: 45%; margin: 0; font-size: 13px; }
.sitecraft-index-spec-value { min-width: 0; font-size: 16px; text-align: right; }
.sitecraft-index-rest, .sitecraft-index-table[data-sc-cols] .sitecraft-index-rest { grid-template-columns: minmax(0, 1fr); gap: 0; }
.sitecraft-index-rest-item { display: flex; justify-content: space-between; align-items: baseline; gap: 16px; padding: 9px 0 8px; border-top: var(--site-rule); }
.sitecraft-compare-table, .sitecraft-compare-table tbody, .sitecraft-compare-table tr, .sitecraft-compare-table th, .sitecraft-compare-table td { display: block; width: auto; }
.sitecraft-compare-table thead { display: none; }
.sitecraft-compare-table tbody tr { padding: 14px 16px; border-bottom: var(--site-rule); }
.sitecraft-compare-table tbody tr:last-child { border-bottom: 0; }
.sitecraft-compare-table tbody th { padding: 0 0 6px; border: 0; font-size: 13px; }
.sitecraft-compare-table td, .sitecraft-compare-table td + td, .sitecraft-compare-table th + td { display: flex; justify-content: space-between; align-items: baseline; gap: 16px; padding: 6px 0; border: 0; }
.sitecraft-compare-label { display: block; flex: none; max-width: 45%; color: var(--site-muted); font-weight: 500; }
.sitecraft-compare-value { min-width: 0; text-align: right; overflow-wrap: anywhere; }
`,
  variants: {
    cards: section("cards", "sitecraft-product-grid"),
    rows: section("rows", "sitecraft-product-rows"),
    grouped: section("grouped", "sitecraft-product-groups"),
    compare: section("compare", "sitecraft-compare"),
    index: section("index", "sitecraft-index"),
  },
};
