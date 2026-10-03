import assert from "node:assert/strict";
import test from "node:test";
import { applySiteOperations } from "../lib/site-operations.ts";
import { packDraft } from "./fixtures/pack-drafts.ts";
import { base as sitecraftBase, openBrowser } from "./helpers/workspace-browser.ts";

test("directory rows stay one column and readable with one, two, or five products", async () => {
  const browser = await openBrowser();
  const image = { imageId: "img_1234567890abcdef", url: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='320' height='200'%3E%3Crect width='320' height='200' fill='%23dceaf5'/%3E%3C/svg%3E", alt: { zh: "示意", en: "Schematic" } };
  try {
    for (const count of [1, 2, 5]) for (const width of [1440, 768, 375]) {
      const draft = packDraft("molding");
      draft.templateId = "screwfast";
      draft.products = draft.products.slice(0, count);
      if (count > 1) draft.products[0] = { ...draft.products[0], image };
      draft.blockVariants = { products: "rows" };
      const { targetId } = await browser.send("Target.createTarget", { url: "about:blank" }) as { targetId: string };
      const { sessionId } = await browser.send("Target.attachToTarget", { targetId, flatten: true }) as { sessionId: string };
      try {
        await browser.send("Page.enable", {}, sessionId);
        await browser.send("Runtime.enable", {}, sessionId);
        await browser.send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width < 500 }, sessionId);
        await browser.send("Page.navigate", { url: `${sitecraftBase}/api/templates/screwfast/preview?rows=${count}-${width}` }, sessionId);
        for (let waited = 0; waited < 10000; waited += 100) {
          if (await browser.eval<boolean>("document.readyState === 'complete' && typeof window.__sitecraftApplyDeclared === 'function'", sessionId).catch(() => false)) break;
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        await browser.eval(`window.__sitecraftApplyDeclared(${JSON.stringify(draft)}, "zh", [], "published", null, false)`, sessionId);
        const result = await browser.eval<{ cards: number; columns: number; overflow: boolean; image: boolean }>(`(() => {
          const cards = [...document.querySelectorAll('.sitecraft-product-rows > .sitecraft-product-card')];
          const lefts = new Set(cards.map((card) => Math.round(card.getBoundingClientRect().left)));
          const overflow = cards.some((card) => [...card.querySelectorAll('*')].some((node) => node.scrollWidth > node.clientWidth + 1));
          return { cards: cards.length, columns: lefts.size, overflow, image: Boolean(document.querySelector('.sitecraft-product-rows .sitecraft-product-media')) };
        })()`, sessionId);
        assert.equal(result.cards, count, `${count} products at ${width}`);
        assert.equal(result.columns, 1, `${count} products at ${width} must be one directory column`);
        assert.equal(result.overflow, false, `${count} products at ${width} must not overflow`);
        assert.equal(result.image, count > 1, `${count} products at ${width} photo path`);
      } finally { await browser.send("Target.closeTarget", { targetId }).catch(() => {}); }
    }
  } finally {
    try { browser.ws.send(JSON.stringify({ id: browser.id++, method: "Browser.close" })); } catch {}
    browser.ws.close();
  }
});
