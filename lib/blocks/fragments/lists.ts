import type { BlockFragment } from "./types.ts";

// 应用行业 and 加工能力 are title + intro + rows. The row styles are shared and live in base; the
// look places the two lists side by side.
const list = (key: "industries" | "capabilities", title: string) => `<section id="${key}" class="sitecraft-list" data-sitecraft-section="${key}" data-sc-block="${key}" data-sc-variant="list">
              <h2 data-sitecraft-benchmark="${key}-title" data-sc-part="title">${title}</h2>
              <p class="sitecraft-section-intro" data-sitecraft-benchmark="${key}-intro" hidden></p>
              <div class="sitecraft-catalog-grid" data-sitecraft-catalog-grid="${key}" data-sc-part="list"></div>
            </section>`;

export const industriesFragment: BlockFragment = {
  css: "",
  variants: { list: list("industries", "应用行业") },
};

export const capabilitiesFragment: BlockFragment = {
  css: "",
  variants: { list: list("capabilities", "加工能力") },
};
