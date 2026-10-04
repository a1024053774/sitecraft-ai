import type { BlockFragment } from "./types.ts";

const serviceItem = (index: number) =>
  `<article class="sitecraft-process-card" data-sc-part="item"><h3 data-sitecraft-benchmark="services-item-${index}-title"></h3><p data-sitecraft-benchmark="services-item-${index}-body"></p></article>`;

// How we work: short numbered steps only when the draft provides them.
export const servicesFragment: BlockFragment = {
  css: `
.sitecraft-process { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr)); gap: 0; border-top: var(--site-rule-strong); counter-reset: step; }
.sitecraft-process-card { counter-increment: step; padding: 18px 20px 20px 0; border-bottom: var(--site-rule); }
.sitecraft-process-card::before { content: counter(step); display: block; margin-bottom: 10px; font-size: 13px; font-weight: 700; color: var(--site-accent-strong); }
.sitecraft-process-card h3 { margin: 0 0 6px; font-size: 17px; }
.sitecraft-process-card p { margin: 0; color: var(--site-muted); line-height: 1.55; }
.sitecraft-process[data-sitecraft-entry-count="4"] { grid-template-columns: repeat(4, minmax(0, 1fr)); }
.sitecraft-process[data-sitecraft-entry-count="5"], .sitecraft-process[data-sitecraft-entry-count="6"] { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.sitecraft-process-cards { gap: 16px; border-top: 0; }
.sitecraft-process-cards .sitecraft-process-card { padding: 20px; border: var(--site-rule); border-radius: var(--site-card-radius); }
/* 纵向流程: one full-width row per step (big number | title | description), read top to bottom. */
.sitecraft-process.sitecraft-process-vertical[data-sc-part] { display: block; border-top: var(--site-index-top, var(--site-rule-strong)); }
.sitecraft-process-vertical .sitecraft-process-card { display: grid; grid-template-columns: 72px minmax(0, 28%) minmax(0, 1fr); gap: 0 24px; align-items: baseline; padding: 24px 0; border-bottom: var(--site-index-row, var(--site-rule)); }
.sitecraft-process-vertical .sitecraft-process-card::before { margin: 0; font-size: 32px; font-weight: 700; line-height: 1; font-variant-numeric: tabular-nums; color: var(--site-accent-strong); }
.sitecraft-process-vertical .sitecraft-process-card h3 { grid-column: 2; margin: 0; font-size: 20px; line-height: 1.3; letter-spacing: -0.01em; overflow-wrap: anywhere; }
.sitecraft-process-vertical .sitecraft-process-card p { grid-column: 3; margin: 0; font-size: 16px; line-height: 1.6; overflow-wrap: anywhere; }
`,
  narrow: `
.sitecraft-process[data-sitecraft-entry-count="4"], .sitecraft-process[data-sitecraft-entry-count="5"], .sitecraft-process[data-sitecraft-entry-count="6"] { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.sitecraft-process[data-sitecraft-entry-count="5"] > .sitecraft-process-card[data-sitecraft-last-visible="true"] { grid-column: 1 / -1; }
.sitecraft-process-vertical .sitecraft-process-card { grid-template-columns: 56px minmax(0, 1fr); gap: 0 16px; align-items: start; padding: 20px 0; }
.sitecraft-process-vertical .sitecraft-process-card::before { grid-column: 1; grid-row: 1 / span 2; font-size: 28px; }
.sitecraft-process-vertical .sitecraft-process-card h3 { grid-column: 2; grid-row: 1; }
.sitecraft-process-vertical .sitecraft-process-card p { grid-column: 2; grid-row: 2; margin-top: 6px; }
`,
  phone: `
.sitecraft-process[data-sitecraft-entry-count="4"], .sitecraft-process[data-sitecraft-entry-count="5"], .sitecraft-process[data-sitecraft-entry-count="6"] { grid-template-columns: 1fr; }
.sitecraft-process[data-sitecraft-entry-count="5"] > .sitecraft-process-card[data-sitecraft-last-visible="true"] { grid-column: auto; }
.sitecraft-process-vertical .sitecraft-process-card { grid-template-columns: 36px minmax(0, 1fr); gap: 0 12px; padding: 18px 0; }
.sitecraft-process-vertical .sitecraft-process-card::before { grid-row: 1; font-size: 22px; }
.sitecraft-process-vertical .sitecraft-process-card p { grid-column: 1 / -1; grid-row: 2; margin-top: 8px; }
`,
  variants: {
    steps: `<section id="process" class="sitecraft-section" data-sitecraft-section="services" data-sc-block="services" data-sc-variant="steps">
          <div class="sitecraft-container">
            <div class="sitecraft-section-head" data-sc-part="head">
              <h2 data-sitecraft-benchmark="services-title" data-sc-part="title">合作方式</h2>
              <p class="sitecraft-section-intro" data-sitecraft-benchmark="services-intro" hidden></p>
            </div>
            <div class="sitecraft-process" data-sc-part="steps">
              ${[0, 1, 2, 3, 4, 5].map(serviceItem).join("\n              ")}
            </div>
          </div>
        </section>`,
    vertical: `<section id="process" class="sitecraft-section" data-sitecraft-section="services" data-sc-block="services" data-sc-variant="vertical">
          <div class="sitecraft-container">
            <div class="sitecraft-section-head" data-sc-part="head">
              <h2 data-sitecraft-benchmark="services-title" data-sc-part="title">合作方式</h2>
              <p class="sitecraft-section-intro" data-sitecraft-benchmark="services-intro" hidden></p>
            </div>
            <div class="sitecraft-process sitecraft-process-vertical" data-sc-part="steps">
              ${[0, 1, 2, 3, 4, 5].map(serviceItem).join("\n              ")}
            </div>
          </div>
        </section>`,
    cards: `<section id="process" class="sitecraft-section" data-sitecraft-section="services" data-sc-block="services" data-sc-variant="cards">
          <div class="sitecraft-container">
            <div class="sitecraft-section-head" data-sc-part="head">
              <h2 data-sitecraft-benchmark="services-title" data-sc-part="title">合作方式</h2>
              <p class="sitecraft-section-intro" data-sitecraft-benchmark="services-intro" hidden></p>
            </div>
            <div class="sitecraft-process sitecraft-process-cards" data-sc-part="steps">
              ${[0, 1, 2, 3, 4, 5].map(serviceItem).join("\n              ")}
            </div>
          </div>
        </section>`,
  },
};

export const certificationsFragment: BlockFragment = {
  css: `
.sitecraft-cert-grid { display: flex; flex-wrap: wrap; gap: 12px; border-top: 0; }
.sitecraft-cert-grid .sitecraft-catalog-card { display: flex; align-items: center; gap: 14px; padding: 14px 18px; background: var(--site-surface); border: var(--site-rule); }
.sitecraft-cert-grid .sitecraft-catalog-card p:not(.sitecraft-cert-status) { display: none; }
.sitecraft-cert-status { padding: 3px 8px; border: 1px solid currentColor; font-size: 12px; color: var(--site-accent-strong); }
.sitecraft-cert-cards { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; border-top: 0; }
.sitecraft-cert-cards .sitecraft-catalog-card { display: block; min-width: 0; padding: 20px; background: var(--site-surface); border: var(--site-rule); border-radius: var(--site-tile-radius); }
.sitecraft-cert-cards .sitecraft-catalog-card p:not(.sitecraft-cert-status) { display: block; margin-top: 8px; }
.sitecraft-cert-cards .sitecraft-cert-status { display: inline-block; margin-top: 12px; }
/* 证书状态表: one ledger row per certificate (name | status | description) between hairlines; the
   status is plain text in its own column so rows can be compared down the page. */
.sitecraft-cert-table { border-top: var(--site-index-top, var(--site-rule-strong)); }
.sitecraft-cert-table .sitecraft-catalog-card { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 9em) minmax(0, 1.6fr); gap: 0 24px; align-items: baseline; padding: 18px 0; border-radius: 0; border-bottom: var(--site-index-row, var(--site-rule)); }
.sitecraft-cert-table .sitecraft-catalog-card h3 { grid-column: 1; font-size: 18px; line-height: 1.35; overflow-wrap: anywhere; }
.sitecraft-cert-table .sitecraft-cert-status { grid-column: 2; margin: 0; padding: 0; border: 0; font-size: 14px; font-weight: 650; color: var(--site-accent-strong); }
.sitecraft-cert-table .sitecraft-catalog-card p:not(.sitecraft-cert-status) { grid-column: 3; margin: 0; overflow-wrap: anywhere; }
`,
  narrow: `
.sitecraft-cert-table .sitecraft-catalog-card { grid-template-columns: minmax(0, 1fr) auto; gap: 4px 16px; padding: 16px 0; }
.sitecraft-cert-table .sitecraft-cert-status { grid-column: 2; grid-row: 1; text-align: right; }
.sitecraft-cert-table .sitecraft-catalog-card h3 { grid-row: 1; }
.sitecraft-cert-table .sitecraft-catalog-card p:not(.sitecraft-cert-status) { grid-column: 1 / -1; grid-row: 2; }
`,
  phone: `
.sitecraft-cert-cards { grid-template-columns: 1fr; }
`,
  variants: {
    badges: `<section id="certifications" class="sitecraft-section" data-sitecraft-section="certifications" data-sc-block="certifications" data-sc-variant="badges">
          <div class="sitecraft-container">
            <div class="sitecraft-section-head" data-sc-part="head">
              <h2 data-sitecraft-benchmark="certifications-title" data-sc-part="title">认证</h2>
              <p class="sitecraft-section-intro" data-sitecraft-benchmark="certifications-intro" hidden></p>
            </div>
            <div class="sitecraft-catalog-grid sitecraft-cert-grid" data-sitecraft-catalog-grid="certifications" data-sc-part="badges"></div>
          </div>
        </section>`,
    table: `<section id="certifications" class="sitecraft-section" data-sitecraft-section="certifications" data-sc-block="certifications" data-sc-variant="table">
          <div class="sitecraft-container">
            <div class="sitecraft-section-head" data-sc-part="head">
              <h2 data-sitecraft-benchmark="certifications-title" data-sc-part="title">认证</h2>
              <p class="sitecraft-section-intro" data-sitecraft-benchmark="certifications-intro" hidden></p>
            </div>
            <div class="sitecraft-catalog-grid sitecraft-cert-table" data-sitecraft-catalog-grid="certifications" data-sc-part="list"></div>
          </div>
        </section>`,
    cards: `<section id="certifications" class="sitecraft-section" data-sitecraft-section="certifications" data-sc-block="certifications" data-sc-variant="cards">
          <div class="sitecraft-container">
            <div class="sitecraft-section-head" data-sc-part="head">
              <h2 data-sitecraft-benchmark="certifications-title" data-sc-part="title">认证</h2>
              <p class="sitecraft-section-intro" data-sitecraft-benchmark="certifications-intro" hidden></p>
            </div>
            <div class="sitecraft-catalog-grid sitecraft-cert-cards" data-sitecraft-catalog-grid="certifications" data-sc-part="list"></div>
          </div>
        </section>`,
  },
};

const faqItem = (index: number) =>
  `<article class="sitecraft-faq-item" data-sc-part="item"><details><summary data-sitecraft-benchmark="faq-item-${index}-title"></summary><div class="sitecraft-faq-answer"><p data-sitecraft-benchmark="faq-item-${index}-body"></p></div></details></article>`;
const openFaqItem = (index: number) =>
  `<article class="sitecraft-faq-item" data-sc-part="item"><details open><summary data-sitecraft-benchmark="faq-item-${index}-title"></summary><div class="sitecraft-faq-answer"><p data-sitecraft-benchmark="faq-item-${index}-body"></p></div></details></article>`;

export const faqFragment: BlockFragment = {
  css: `
.sitecraft-faq-list { border-top: var(--site-rule-strong); }
.sitecraft-faq-item { border-bottom: var(--site-rule); }
.sitecraft-faq-item summary { cursor: pointer; padding: 16px 0; font-weight: 650; list-style: none; }
.sitecraft-faq-item summary::-webkit-details-marker { display: none; }
.sitecraft-faq-answer p { margin: 0 0 16px; color: var(--site-muted); line-height: 1.6; max-inline-size: 33em; overflow-wrap: anywhere; text-wrap: pretty; }
.sitecraft-faq-side { display: grid; grid-template-columns: minmax(0, .7fr) minmax(0, 1.3fr); gap: 56px; }
.sitecraft-faq-side .sitecraft-section-head { display: block; margin: 0; padding: 0; border: 0; }
.sitecraft-faq-side .sitecraft-faq-list { border-top: var(--site-rule-strong); }
.sitecraft-faq-side .sitecraft-faq-item { padding: 14px 0; }
.sitecraft-faq-side .sitecraft-faq-item summary { padding: 0 0 8px; }
.sitecraft-faq-side .sitecraft-faq-answer p { margin: 0; }
`,
  narrow: `
.sitecraft-faq-side { grid-template-columns: 1fr; gap: 28px; }
`,
  variants: {
    accordion: `<section id="faq" class="sitecraft-section" data-sitecraft-section="faq" data-sc-block="faq" data-sc-variant="accordion">
          <div class="sitecraft-container">
            <div class="sitecraft-section-head" data-sc-part="head">
              <h2 data-sitecraft-benchmark="faq-title" data-sc-part="title">常见问题</h2>
              <p class="sitecraft-section-intro" data-sitecraft-benchmark="faq-intro" hidden></p>
            </div>
            <div class="sitecraft-faq-list" data-sc-part="list">
              ${[0, 1, 2, 3, 4, 5].map(faqItem).join("\n              ")}
            </div>
          </div>
        </section>`,
    open: `<section id="faq" class="sitecraft-section" data-sitecraft-section="faq" data-sc-block="faq" data-sc-variant="open">
          <div class="sitecraft-container">
            <div class="sitecraft-section-head" data-sc-part="head">
              <h2 data-sitecraft-benchmark="faq-title" data-sc-part="title">常见问题</h2>
              <p class="sitecraft-section-intro" data-sitecraft-benchmark="faq-intro" hidden></p>
            </div>
            <div class="sitecraft-faq-list" data-sc-part="list">
              ${[0, 1, 2, 3, 4, 5].map(openFaqItem).join("\n              ")}
            </div>
          </div>
        </section>`,
    side: `<section id="faq" class="sitecraft-section sitecraft-faq-side" data-sitecraft-section="faq" data-sc-block="faq" data-sc-variant="side">
          <div class="sitecraft-container sitecraft-faq-side-head" data-sc-part="head">
            <div class="sitecraft-section-head">
              <h2 data-sitecraft-benchmark="faq-title" data-sc-part="title">常见问题</h2>
              <p class="sitecraft-section-intro" data-sitecraft-benchmark="faq-intro" hidden></p>
            </div>
          </div>
          <div class="sitecraft-faq-list" data-sc-part="list">
            ${[0, 1, 2, 3, 4, 5].map((index) => `<article class="sitecraft-faq-item" data-sc-part="item"><h3 data-sitecraft-benchmark="faq-item-${index}-title"></h3><div class="sitecraft-faq-answer"><p data-sitecraft-benchmark="faq-item-${index}-body"></p></div></article>`).join("\n              ")}
          </div>
        </section>`,
  },
};
