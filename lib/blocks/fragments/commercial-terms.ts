import type { BlockFragment } from "./types.ts";

/** 商业条款: fixed bilingual kind labels plus material-backed values. */
export const commercialTermsFragment: BlockFragment = {
  css: `
.sitecraft-commercial-terms-list { border-top: 2px solid var(--site-line); }
.sitecraft-commercial-term { display: grid; grid-template-columns: minmax(0, 11em) minmax(0, 1fr); gap: 16px; align-items: baseline; padding: 16px 0; border-bottom: 1px solid var(--site-line); }
.sitecraft-commercial-term h3 { margin: 0; font-size: 15px; font-weight: 650; }
.sitecraft-commercial-term p { margin: 0; color: var(--site-value-ink, var(--site-ink)); line-height: 1.55; overflow-wrap: anywhere; }
/* 条款带: one cell per term in a band (name small above, value large below), a hairline between
   cells and above/below the band. The columns follow the term count (the bridge writes it). */
.sitecraft-terms-strip { display: grid; grid-template-columns: minmax(0, 1fr); border-top: var(--site-index-top, var(--site-rule-strong)); border-bottom: var(--site-index-row, var(--site-rule)); }
.sitecraft-terms-strip .sitecraft-commercial-term { display: flex; flex-direction: column; gap: 8px; padding: 22px 24px 24px; border: 0; }
.sitecraft-terms-strip .sitecraft-commercial-term h3 { font-size: 13px; color: var(--site-muted); }
.sitecraft-terms-strip .sitecraft-commercial-term p { font-size: 18px; font-weight: 650; line-height: 1.4; }
.sitecraft-terms-strip[data-sitecraft-entry-count="2"] { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.sitecraft-terms-strip[data-sitecraft-entry-count="3"], .sitecraft-terms-strip[data-sitecraft-entry-count="5"], .sitecraft-terms-strip[data-sitecraft-entry-count="6"] { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.sitecraft-terms-strip[data-sitecraft-entry-count="4"] { grid-template-columns: repeat(4, minmax(0, 1fr)); }
.sitecraft-terms-strip .sitecraft-commercial-term { padding-left: 24px; border-left: var(--site-index-row, var(--site-rule)); }
.sitecraft-terms-strip[data-sitecraft-entry-count="2"] .sitecraft-commercial-term:nth-child(2n+1), .sitecraft-terms-strip[data-sitecraft-entry-count="3"] .sitecraft-commercial-term:nth-child(3n+1), .sitecraft-terms-strip[data-sitecraft-entry-count="5"] .sitecraft-commercial-term:nth-child(3n+1), .sitecraft-terms-strip[data-sitecraft-entry-count="6"] .sitecraft-commercial-term:nth-child(3n+1), .sitecraft-terms-strip[data-sitecraft-entry-count="4"] .sitecraft-commercial-term:nth-child(4n+1), .sitecraft-terms-strip .sitecraft-commercial-term:first-child { padding-left: 0; border-left: 0; }
.sitecraft-terms-strip[data-sitecraft-entry-count="5"] .sitecraft-commercial-term:nth-child(n+4), .sitecraft-terms-strip[data-sitecraft-entry-count="6"] .sitecraft-commercial-term:nth-child(n+4) { border-top: var(--site-index-row, var(--site-rule)); }
.sitecraft-terms-strip .sitecraft-commercial-term:only-child { max-width: 40em; padding: 26px 0 28px; }
.sitecraft-terms-strip .sitecraft-commercial-term:only-child p { font-size: clamp(22px, 3vw, 32px); line-height: 1.3; letter-spacing: -0.01em; }
/* 左右条款: the block title in a left column, the terms stacked in the right one (name small above,
   value below, a hairline between). */
.sitecraft-terms-side-layout { display: grid; grid-template-columns: minmax(0, 0.7fr) minmax(0, 1.3fr); gap: 56px; align-items: start; }
.sitecraft-terms-side-layout .sitecraft-section-head { display: block; margin: 0; padding: 0; border: 0; }
.sitecraft-terms-side { border-top: var(--site-index-top, var(--site-rule-strong)); }
.sitecraft-terms-side .sitecraft-commercial-term { display: block; padding: 18px 0 20px; border-bottom: var(--site-index-row, var(--site-rule)); }
.sitecraft-terms-side .sitecraft-commercial-term h3 { margin: 0 0 6px; font-size: 13px; color: var(--site-muted); }
.sitecraft-terms-side .sitecraft-commercial-term p { font-size: 17px; line-height: 1.55; }
.sitecraft-terms-side .sitecraft-commercial-term:only-child { padding: 24px 0 26px; }
.sitecraft-terms-side .sitecraft-commercial-term:only-child p { font-size: 22px; line-height: 1.45; font-weight: 600; }
`,
  narrow: `
.sitecraft-commercial-term { grid-template-columns: minmax(0, 9em) minmax(0, 1fr); gap: 12px; }
.sitecraft-terms-strip[data-sitecraft-entry-count] { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.sitecraft-terms-strip[data-sitecraft-entry-count="1"] { grid-template-columns: minmax(0, 1fr); }
.sitecraft-terms-strip .sitecraft-commercial-term, .sitecraft-terms-strip[data-sitecraft-entry-count] .sitecraft-commercial-term { padding: 20px 20px 22px; border-top: 0; border-left: var(--site-index-row, var(--site-rule)); }
.sitecraft-terms-strip[data-sitecraft-entry-count] .sitecraft-commercial-term:nth-child(2n+1) { padding-left: 0; border-left: 0; }
.sitecraft-terms-strip[data-sitecraft-entry-count] .sitecraft-commercial-term:nth-child(2n) { padding-left: 20px; border-left: var(--site-index-row, var(--site-rule)); }
.sitecraft-terms-strip[data-sitecraft-entry-count] .sitecraft-commercial-term:nth-child(n+3) { border-top: var(--site-index-row, var(--site-rule)); }
.sitecraft-terms-strip .sitecraft-commercial-term:only-child { padding: 24px 0 26px; border: 0; }
.sitecraft-terms-side-layout { grid-template-columns: minmax(0, 1fr); gap: 24px; }
`,
  phone: `
.sitecraft-commercial-term { grid-template-columns: 1fr; gap: 5px; padding: 14px 0; }
.sitecraft-commercial-term h3 { font-size: 14px; }
.sitecraft-terms-strip[data-sitecraft-entry-count] { grid-template-columns: minmax(0, 1fr); }
.sitecraft-terms-strip[data-sitecraft-entry-count] .sitecraft-commercial-term, .sitecraft-terms-strip[data-sitecraft-entry-count] .sitecraft-commercial-term:nth-child(2n+1) { padding: 16px 0 18px; border-left: 0; border-top: var(--site-index-row, var(--site-rule)); }
.sitecraft-terms-strip[data-sitecraft-entry-count] .sitecraft-commercial-term:nth-child(n) { padding: 16px 0 18px; border-left: 0; border-top: var(--site-index-row, var(--site-rule)); }
.sitecraft-terms-strip[data-sitecraft-entry-count] .sitecraft-commercial-term:first-child { border-top: 0; }
.sitecraft-terms-strip .sitecraft-commercial-term p { font-size: 17px; }
.sitecraft-terms-strip .sitecraft-commercial-term:only-child p { font-size: 22px; }
.sitecraft-terms-side .sitecraft-commercial-term p { font-size: 16px; }
.sitecraft-terms-side .sitecraft-commercial-term:only-child p { font-size: 20px; }
`,
  variants: {
    strip: `<section id="commercial-terms" class="sitecraft-section" data-sitecraft-section="commercialTerms" data-sc-block="commercialTerms" data-sc-variant="strip">
          <div class="sitecraft-container">
            <div class="sitecraft-section-head" data-sc-part="head">
              <h2 data-sitecraft-ui="commercialTerms" data-sc-part="title">商业条款</h2>
            </div>
            <div class="sitecraft-terms-strip" data-sitecraft-commercial-terms-grid data-sc-part="list"></div>
          </div>
        </section>`,
    side: `<section id="commercial-terms" class="sitecraft-section" data-sitecraft-section="commercialTerms" data-sc-block="commercialTerms" data-sc-variant="side">
          <div class="sitecraft-container sitecraft-terms-side-layout">
            <div class="sitecraft-section-head" data-sc-part="head">
              <h2 data-sitecraft-ui="commercialTerms" data-sc-part="title">商业条款</h2>
            </div>
            <div class="sitecraft-terms-side" data-sitecraft-commercial-terms-grid data-sc-part="list"></div>
          </div>
        </section>`,
    rows: `<section id="commercial-terms" class="sitecraft-section" data-sitecraft-section="commercialTerms" data-sc-block="commercialTerms" data-sc-variant="rows">
          <div class="sitecraft-container">
            <div class="sitecraft-section-head" data-sc-part="head">
              <h2 data-sitecraft-ui="commercialTerms" data-sc-part="title">商业条款</h2>
            </div>
            <div class="sitecraft-commercial-terms-list" data-sitecraft-commercial-terms-grid data-sc-part="list"></div>
          </div>
        </section>`,
  },
};
