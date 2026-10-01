import type { BlockFragment } from "./types.ts";

// Hero: one statement, one action, then a photo, or a nameplate of key specs, or nothing.
export const heroFragment: BlockFragment = {
  css: `
.sitecraft-hero { background: var(--site-hero-bg); border-bottom: var(--site-rule); }
.sitecraft-hero-grid { display: grid; grid-template-columns: var(--site-hero-columns, minmax(0, 1fr) minmax(0, 1.05fr)); gap: 56px; align-items: center; padding: 64px 0 72px; }
.sitecraft-hero-grid > [data-sc-part="copy"] { min-width: 0; }
.sitecraft-hero[data-sitecraft-hero-mode="none"] .sitecraft-hero-grid { grid-template-columns: minmax(0, 1fr); }
.sitecraft-eyebrow { margin: 0 0 18px; padding: var(--site-eyebrow-pad); background: var(--site-eyebrow-bg); font-size: 13px; color: var(--site-eyebrow); letter-spacing: 0.02em; }
.sitecraft-hero h1 { margin: 0; max-width: var(--site-heading-max); font-size: var(--site-h1); line-height: var(--site-h1-leading); letter-spacing: var(--site-h1-tracking); font-weight: 750; text-wrap: var(--site-heading-text-wrap); word-break: var(--site-heading-break); overflow-wrap: var(--site-heading-wrap); }
.sitecraft-look-engineering-industrial .sitecraft-hero h1:has(> [data-sitecraft-hero-word]) { text-wrap: pretty; }
.sitecraft-hero-copy { margin: 22px 0 0; max-width: 34em; font-size: 18px; line-height: 1.6; color: var(--site-muted); }
.sitecraft-hero-actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 32px; }
.sitecraft-hero-visual { margin: 0; }
.sitecraft-hero-photo { width: 100%; aspect-ratio: 4 / 3; object-fit: cover; background: var(--site-diagram); }
.sitecraft-hero-credit { margin: 8px 0 0; font-size: 12px; color: var(--site-muted); }
.sitecraft-nameplate { margin: 0; padding: 32px 34px; display: grid; grid-template-columns: 1fr 1fr; gap: 24px 28px; border-radius: var(--site-media-radius); background: var(--site-plate-bg); color: var(--site-plate-ink); }
.sitecraft-nameplate-cell dt { font-size: 13px; color: var(--site-plate-muted); }
.sitecraft-nameplate-cell dd { margin: 6px 0 0; font-size: 26px; font-weight: 700; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
.sitecraft-hero-specs { background: var(--site-plate-bg); color: var(--site-plate-ink); border-top: var(--site-specs-top); }
.sitecraft-hero-specs dl { margin: 0 auto; display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); }
.sitecraft-hero-spec { padding: 18px 22px; background: var(--site-spec-cell-bg); border-left: 1px solid rgba(255, 255, 255, 0.14); }
.sitecraft-hero-spec:last-child { border-right: 1px solid rgba(255, 255, 255, 0.14); }
.sitecraft-hero-spec dt { font-size: 12px; color: rgba(255, 255, 255, 0.62); }
.sitecraft-hero-spec dd { margin: 5px 0 0; font-size: 20px; font-weight: 700; font-variant-numeric: tabular-nums; }
/* 大标题加参数条: title, button row and key specs are one group in the content container. The specs
   are a light panel about 32px under the buttons, left-aligned with the title (surface colour, 1px
   border, a 2px accent line on top), shown with or without a photo; small muted labels, bold values
   that wrap instead of running out of their cell. */
.sitecraft-statement { padding: 72px 0 60px; }
.sitecraft-statement h1 { max-width: 18em; font-size: var(--site-h1-display); line-height: 1.06; letter-spacing: -0.03em; }
.sitecraft-statement-foot { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 24px 56px; align-items: end; margin-top: 28px; }
.sitecraft-statement .sitecraft-hero-copy { margin: 0; max-width: 40em; text-wrap: pretty; }
.sitecraft-statement .sitecraft-hero-actions { margin-top: 0; justify-content: flex-end; }
.sitecraft-statement-foot:has(> .sitecraft-hero-copy[hidden]) .sitecraft-hero-actions { justify-content: flex-start; }
.sitecraft-statement-specs { margin-top: 32px; background: var(--site-surface); border: var(--site-rule); border-top: 2px solid var(--site-accent); }
.sitecraft-statement-specs dl { margin: 0; display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); }
.sitecraft-statement-specs .sitecraft-hero-spec { padding: 20px 22px 22px; border: 0; }
.sitecraft-statement-specs .sitecraft-hero-spec:not(:first-child) { border-left: var(--site-rule); }
.sitecraft-statement-specs .sitecraft-hero-spec dt { font-size: 12px; line-height: 1.4; color: var(--site-muted); word-break: keep-all; overflow-wrap: anywhere; }
.sitecraft-statement-specs .sitecraft-hero-spec dd { margin: 8px 0 0; font-size: 24px; font-weight: 700; line-height: 1.2; letter-spacing: -0.015em; color: var(--site-ink); overflow-wrap: anywhere; text-wrap: balance; }
`,
  narrow: `
.sitecraft-hero-grid { grid-template-columns: 1fr; gap: 32px; padding: 40px 0 48px; }
.sitecraft-hero-copy { font-size: 16px; }
.sitecraft-nameplate { padding: 22px; }
.sitecraft-nameplate-cell dd { font-size: 20px; }
.sitecraft-hero-specs dl { grid-auto-flow: row; grid-template-columns: 1fr 1fr; }
.sitecraft-hero-spec { border-left: 0; border-right: 0 !important; border-bottom: 1px solid rgba(255, 255, 255, 0.14); padding: 14px 16px; }
.sitecraft-hero-spec dd { font-size: 17px; }
.sitecraft-statement { padding: 44px 0 40px; }
.sitecraft-statement-foot { grid-template-columns: 1fr; gap: 20px; margin-top: 20px; }
.sitecraft-statement .sitecraft-hero-actions { justify-content: flex-start; }
.sitecraft-statement-specs { margin-top: 28px; }
.sitecraft-statement-specs dl { grid-auto-flow: row; grid-template-columns: repeat(2, minmax(0, 1fr)); }
.sitecraft-statement-specs .sitecraft-hero-spec { padding: 16px 18px 18px; border: 0; }
.sitecraft-statement-specs .sitecraft-hero-spec:not(:first-child) { border-left: 0; }
.sitecraft-statement-specs .sitecraft-hero-spec:nth-child(2n) { border-left: var(--site-rule); }
.sitecraft-statement-specs .sitecraft-hero-spec:nth-child(n+3) { border-top: var(--site-rule); }
.sitecraft-statement-specs .sitecraft-hero-spec dd { font-size: 21px; }
`,
  phone: `
.sitecraft-hero h1 { font-size: var(--site-h1-narrow, var(--site-h1)); }
/* Series-prefixed labels like「直角减速机 · 额定输出扭矩」need the full width on phones. */
.sitecraft-hero-specs dl { grid-template-columns: 1fr; }
.sitecraft-hero-spec { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
.sitecraft-hero-spec dd { margin: 0; white-space: nowrap; }
.sitecraft-statement-specs { margin-top: 24px; }
.sitecraft-statement-specs .sitecraft-hero-spec { display: block; padding: 12px 14px 14px; }
.sitecraft-statement-specs .sitecraft-hero-spec dd { margin: 6px 0 0; font-size: 17px; white-space: normal; }
`,
  variants: {
    split: `<div data-sc-block="hero" data-sc-variant="split">
        <section class="sitecraft-hero" data-sitecraft-section="hero" data-sitecraft-benchmark="hero" data-sc-part="band">
          <div class="sitecraft-container sitecraft-hero-grid">
            <div data-sc-part="copy">
              <p class="sitecraft-eyebrow" data-sitecraft-optional="industry" hidden></p>
              <h1 data-sitecraft-benchmark="hero-title" data-sc-part="title"></h1>
              <p class="sitecraft-hero-copy" data-sitecraft-benchmark="hero-subtitle" hidden></p>
              <div class="sitecraft-hero-actions" data-sc-part="actions">
                <a class="sitecraft-btn sitecraft-primary" data-sitecraft-benchmark="hero-cta" href="#inquiry">提交询盘</a>
                <a class="sitecraft-btn sitecraft-secondary" href="#products" data-sitecraft-ui="viewProducts">看产品系列</a>
              </div>
            </div>
            <figure class="sitecraft-hero-visual" data-sitecraft-hero-visual hidden data-sc-part="visual">
              <img class="sitecraft-hero-photo" data-sitecraft-benchmark="hero-image" alt="" hidden>
              <figcaption class="sitecraft-hero-credit" data-sitecraft-hero-credit hidden></figcaption>
              <dl class="sitecraft-nameplate" data-sitecraft-hero-nameplate hidden></dl>
            </figure>
          </div>
        </section>
        <div class="sitecraft-hero-specs" data-sitecraft-hero-specs hidden data-sc-part="specs"><dl class="sitecraft-container"></dl></div>
      </div>`,
    statement: `<div data-sc-block="hero" data-sc-variant="statement">
        <section class="sitecraft-hero" data-sitecraft-section="hero" data-sitecraft-benchmark="hero" data-sc-part="band">
          <div class="sitecraft-container sitecraft-statement" data-sc-part="copy">
            <p class="sitecraft-eyebrow" data-sitecraft-optional="industry" hidden></p>
            <h1 data-sitecraft-benchmark="hero-title" data-sc-part="title"></h1>
            <div class="sitecraft-statement-foot">
              <p class="sitecraft-hero-copy" data-sitecraft-benchmark="hero-subtitle" hidden></p>
              <div class="sitecraft-hero-actions" data-sc-part="actions">
                <a class="sitecraft-btn sitecraft-primary" data-sitecraft-benchmark="hero-cta" href="#inquiry">提交询盘</a>
                <a class="sitecraft-btn sitecraft-secondary" href="#products" data-sitecraft-ui="viewProducts">看产品系列</a>
              </div>
            </div>
            <div class="sitecraft-statement-specs" data-sitecraft-hero-specs hidden data-sc-part="specs"><dl></dl></div>
          </div>
        </section>
      </div>`,
  },
};
