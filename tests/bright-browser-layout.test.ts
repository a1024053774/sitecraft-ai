import assert from "node:assert/strict";
import test from "node:test";
import { applySiteOperations } from "../lib/site-operations.ts";
import { installPreviewBridge } from "../lib/template-adapters/preview-bridge.ts";
import { getTemplateAdapter } from "../lib/template-adapters/registry.ts";
import { packDraft } from "./fixtures/pack-drafts.ts";
import { closeBrowser, base as sitecraftBase, openBrowser } from "./helpers/workspace-browser.ts";

test("bright product cards are one column with name/value rows at 375 and 768", async () => {
  const browser = await openBrowser();
  const adapter = getTemplateAdapter("forge");
  assert.ok(adapter);
  const draft = applySiteOperations(packDraft("molding"), [{ op: "set_visual_brief", briefId: "industrial" }], {
    templateIds: new Set(["forge", "screwfast", "landwind", "tailwind-landing"]),
    lastChange: "bright-browser-layout",
  }).draft;
  draft.blockVariants = { products: "cards" };
  const { targetId } = await browser.send("Target.createTarget", { url: "about:blank" }) as { targetId: string };
  const { sessionId } = await browser.send("Target.attachToTarget", { targetId, flatten: true }) as { sessionId: string };
  try {
    await browser.send("Page.enable", {}, sessionId);
    await browser.send("Runtime.enable", {}, sessionId);
    for (const width of [375, 768, 1440]) {
      await browser.send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width < 500 }, sessionId);
      await browser.send("Page.navigate", { url: `${sitecraftBase}/api/templates/forge/preview?bright-layout=${Date.now()}-${width}` }, sessionId);
      for (let waited = 0; waited < 10000; waited += 100) {
        if (await browser.eval<boolean>("document.readyState === 'complete' && typeof window.__sitecraftApplyDeclared === 'function'", sessionId).catch(() => false)) break;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      await browser.eval(`window.__sitecraftApplyDeclared(${JSON.stringify(draft)}, "zh", [], "published", null, false)`, sessionId);
      const result = await browser.eval<{ columns: number; rowStyle: string; rowCount: number; cards: number }>(`(() => {
        const grid = document.querySelector("[data-sitecraft-product-grid]");
        const cards = [...document.querySelectorAll("[data-sitecraft-product-grid] > .sitecraft-product-card")];
        const lefts = new Set(cards.map((card) => Math.round(card.getBoundingClientRect().left)));
        const key = document.querySelector(".sitecraft-product-card .sitecraft-product-key");
        return { columns: lefts.size, rowStyle: key ? getComputedStyle(key).display : "", rowCount: key ? getComputedStyle(key.parentElement).gridTemplateColumns.split(" ").length : 0, cards: cards.length };
      })()`, sessionId);
      assert.equal(result.cards, 5);
      if (width <= 768) {
        assert.equal(result.columns, 1, `${width}px product grid`);
        assert.equal(result.rowStyle, "flex", `${width}px metric rows`);
        assert.equal(result.rowCount, 1, `${width}px metric strip`);
      } else {
        assert.ok(result.columns >= 2, "desktop keeps a multi-column product grid");
      }
    }
  } finally {
    await browser.send("Target.closeTarget", { targetId }).catch(() => {});
    await closeBrowser(browser);
  }
});
