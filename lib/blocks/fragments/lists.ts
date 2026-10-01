import type { BlockFragment } from "./types.ts";

// 应用行业 and 加工能力 are title + intro + rows. The row styles are shared and live in base; the
// look places the two lists side by side.
const list = (key: "industries" | "capabilities", title: string) => `<section id="${key}" class="sitecraft-list" data-sitecraft-section="${key}" data-sc-block="${key}" data-sc-variant="list">
              <h2 data-sitecraft-benchmark="${key}-title" data-sc-part="title">${title}</h2>
              <p class="sitecraft-section-intro" data-sitecraft-benchmark="${key}-intro" hidden></p>
              <div class="sitecraft-catalog-grid" data-sitecraft-catalog-grid="${key}" data-sc-part="list"></div>
            </section>`;
const cards = (key: "industries" | "capabilities", title: string) => `<section id="${key}" class="sitecraft-section sitecraft-catalog-cards-section" data-sitecraft-section="${key}" data-sc-block="${key}" data-sc-variant="cards">
          <div class="sitecraft-container">
            <div class="sitecraft-section-head" data-sc-part="head">
              <h2 data-sitecraft-benchmark="${key}-title" data-sc-part="title">${title}</h2>
              <p class="sitecraft-section-intro" data-sitecraft-benchmark="${key}-intro" hidden></p>
            </div>
            <div class="sitecraft-catalog-grid sitecraft-catalog-cards" data-sitecraft-catalog-grid="${key}" data-sc-part="list"></div>
          </div>
        </section>`;

export const industriesFragment: BlockFragment = {
  css: `.sitecraft-catalog-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr)); gap: 16px; border-top: 0; }
.sitecraft-catalog-cards .sitecraft-catalog-card { min-width: 0; padding: 20px; background: var(--site-key-bg); border: var(--site-rule); border-radius: var(--site-tile-radius); }`,
  variants: { list: list("industries", "应用行业"), cards: cards("industries", "应用行业") },
};

export const capabilitiesFragment: BlockFragment = {
  css: industriesFragment.css,
  variants: { list: list("capabilities", "加工能力"), cards: cards("capabilities", "加工能力") },
};
