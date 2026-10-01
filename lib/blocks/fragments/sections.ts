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
.sitecraft-process-cards { gap: 16px; border-top: 0; counter-reset: none; }
.sitecraft-process-cards .sitecraft-process-card { padding: 20px; border: var(--site-rule); border-radius: var(--site-card-radius); }
.sitecraft-process-cards .sitecraft-process-card::before { display: none; }
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
.sitecraft-faq-answer p { margin: 0 0 16px; color: var(--site-muted); line-height: 1.6; }
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
  },
};
