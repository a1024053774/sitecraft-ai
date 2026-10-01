import type { BlockFragment } from "./types.ts";

// Page-wide rules every block relies on: reset, container, buttons, section heading, and the
// list rows that 应用行业 / 加工能力 / 认证 share. Moved from the engineering overlay unchanged
// except that spacing, headings and dividers read the look's tokens.
export const baseFragment: Omit<BlockFragment, "variants"> = {
  css: `
* { box-sizing: border-box; }
html { background: var(--site-bg); color: var(--site-ink); font-family: var(--site-font); overflow-x: hidden; -webkit-font-smoothing: antialiased; scroll-behavior: smooth; }
@media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } }
body { margin: 0; min-width: 320px; background: var(--site-bg); color: var(--site-ink); overflow-x: hidden; }
a { color: inherit; text-decoration: none; }
button, input, textarea { font: inherit; }
img { display: block; max-width: 100%; }
[hidden] { display: none !important; }
.sitecraft-container { width: min(100% - var(--site-gutter), var(--site-container)); margin: 0 auto; }
.sitecraft-btn { display: inline-flex; align-items: center; justify-content: center; min-height: 46px; padding: 0 22px; border: 1px solid transparent; border-radius: var(--site-control-radius); font-size: 15px; font-weight: 650; cursor: pointer; }
.sitecraft-primary { background: var(--site-primary-bg); color: var(--site-plate-ink); }
.sitecraft-primary:hover { background: var(--site-primary-hover); }
.sitecraft-secondary { background: var(--site-surface); border-color: var(--site-line); color: var(--site-ink); }
.sitecraft-secondary:hover { border-color: var(--site-ink); }
a:focus-visible, button:focus-visible, summary:focus-visible { outline: 2px solid var(--site-accent); outline-offset: 2px; }
.sitecraft-section { padding: var(--site-section-space) 0; border-bottom: var(--site-rule); }
.sitecraft-section-head { display: flex; justify-content: space-between; align-items: end; gap: 32px; margin-bottom: 36px; }
.sitecraft-section h2 { margin: 0; font-size: var(--site-h2); letter-spacing: var(--site-heading-tracking); line-height: 1.15; }
.sitecraft-section-intro { margin: 0; max-width: 32em; color: var(--site-muted); font-size: 16px; line-height: 1.6; }
/* Two list blocks side by side (the look decides which); either may be absent. */
.sitecraft-pair { padding: var(--site-section-space) 0; border-bottom: var(--site-rule); }
.sitecraft-pair:not(:has(> .sitecraft-container > section:not([data-sitecraft-section-hidden="true"]))) { display: none; }
.sitecraft-pair > .sitecraft-container { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 420px), 1fr)); gap: 56px; }
.sitecraft-list h2 { margin: 0 0 8px; font-size: 26px; letter-spacing: -0.02em; }
.sitecraft-list .sitecraft-section-intro { margin-bottom: 20px; font-size: 15px; }
.sitecraft-catalog-grid { border-top: var(--site-rule-strong); }
.sitecraft-catalog-card { display: grid; grid-template-columns: minmax(0, 11em) minmax(0, 1fr); gap: 16px; padding: 15px 0; border-radius: var(--site-card-radius); border-bottom: var(--site-rule); }
.sitecraft-catalog-card h3 { margin: 0; font-size: 16px; font-weight: 650; }
.sitecraft-catalog-card p { margin: 0; color: var(--site-muted); line-height: 1.55; }
/* Spec values: keep words and Chinese runs whole and break only at spaces and after / + – 、 (the
   bridge marks those points); a single piece wider than its cell still breaks rather than
   running out of it. The layouts that add values opt in with their own class. */
.sitecraft-nameplate-cell dd, .sitecraft-hero-spec dd, .sitecraft-product-key dd, .sitecraft-product-specs td { word-break: keep-all; overflow-wrap: anywhere; }
.sitecraft-compare-value, .sitecraft-compare-extra dd { word-break: keep-all; overflow-wrap: anywhere; }
`,
  narrow: `
.sitecraft-container { width: min(100% - var(--site-gutter-narrow), var(--site-container)); }
`,
  phone: `
.sitecraft-section, .sitecraft-pair { padding: var(--site-section-space-narrow) 0; }
.sitecraft-section-head { display: block; margin-bottom: 26px; }
.sitecraft-section-intro { margin-top: 10px; }
.sitecraft-catalog-card { grid-template-columns: 1fr; gap: 4px; }
`,
};
