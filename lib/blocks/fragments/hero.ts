import type { BlockFragment } from "./types.ts";

// Hero: one statement, one action, then a photo, or a nameplate of key specs, or nothing.
export const heroFragment: BlockFragment = {
  css: `
.sitecraft-hero { background: var(--site-surface); border-bottom: var(--site-rule); }
.sitecraft-hero-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.05fr); gap: 56px; align-items: center; padding: 64px 0 72px; }
.sitecraft-hero[data-sitecraft-hero-mode="none"] .sitecraft-hero-grid { grid-template-columns: minmax(0, 1fr); }
.sitecraft-eyebrow { margin: 0 0 18px; font-size: 13px; color: var(--site-muted); letter-spacing: 0.02em; }
.sitecraft-hero h1 { margin: 0; max-width: 16em; font-size: var(--site-h1); line-height: 1.1; letter-spacing: -0.03em; font-weight: 750; text-wrap: balance; overflow-wrap: anywhere; }
.sitecraft-hero-copy { margin: 22px 0 0; max-width: 34em; font-size: 18px; line-height: 1.6; color: var(--site-muted); }
.sitecraft-hero-actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 32px; }
.sitecraft-hero-visual { margin: 0; }
.sitecraft-hero-photo { width: 100%; aspect-ratio: 4 / 3; object-fit: cover; background: var(--site-diagram); }
.sitecraft-hero-credit { margin: 8px 0 0; font-size: 12px; color: var(--site-muted); }
.sitecraft-nameplate { margin: 0; padding: 32px 34px; display: grid; grid-template-columns: 1fr 1fr; gap: 24px 28px; background: var(--site-ink); color: #fff; }
.sitecraft-nameplate-cell dt { font-size: 13px; color: rgba(255, 255, 255, 0.66); }
.sitecraft-nameplate-cell dd { margin: 6px 0 0; font-size: 26px; font-weight: 700; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
.sitecraft-hero-specs { background: var(--site-ink); color: #fff; border-top: 3px solid var(--site-accent); }
.sitecraft-hero-specs dl { margin: 0 auto; display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); }
.sitecraft-hero-spec { padding: 18px 22px; border-left: 1px solid rgba(255, 255, 255, 0.14); }
.sitecraft-hero-spec:last-child { border-right: 1px solid rgba(255, 255, 255, 0.14); }
.sitecraft-hero-spec dt { font-size: 12px; color: rgba(255, 255, 255, 0.62); }
.sitecraft-hero-spec dd { margin: 5px 0 0; font-size: 20px; font-weight: 700; font-variant-numeric: tabular-nums; }
`,
  narrow: `
.sitecraft-hero-grid { grid-template-columns: 1fr; gap: 32px; padding: 40px 0 48px; }
.sitecraft-hero-copy { font-size: 16px; }
.sitecraft-nameplate { padding: 22px; }
.sitecraft-nameplate-cell dd { font-size: 20px; }
.sitecraft-hero-specs dl { grid-auto-flow: row; grid-template-columns: 1fr 1fr; }
.sitecraft-hero-spec { border-left: 0; border-right: 0 !important; border-bottom: 1px solid rgba(255, 255, 255, 0.14); padding: 14px 16px; }
.sitecraft-hero-spec dd { font-size: 17px; }
`,
  phone: `
/* Series-prefixed labels like「直角减速机 · 额定输出扭矩」need the full width on phones. */
.sitecraft-hero-specs dl { grid-template-columns: 1fr; }
.sitecraft-hero-spec { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
.sitecraft-hero-spec dd { margin: 0; white-space: nowrap; }
`,
  variants: {
    split: `<div data-sc-block="hero" data-sc-variant="split">
        <section class="sitecraft-hero" data-sitecraft-section="hero" data-sitecraft-benchmark="hero" data-sc-part="band">
          <div class="sitecraft-container sitecraft-hero-grid">
            <div data-sc-part="copy">
              <p class="sitecraft-eyebrow" data-sitecraft-optional="industry" hidden></p>
              <h1 data-sitecraft-benchmark="hero-title"></h1>
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
  },
};
