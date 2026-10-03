import assert from "node:assert/strict";
import test from "node:test";
import { packDraft } from "./fixtures/pack-drafts.ts";
import { base as sitecraftBase, openBrowser } from "./helpers/workspace-browser.ts";

test("short-path hero title stays inside the viewport and clear of the visual panel", async () => {
  const browser = await openBrowser();
  const { targetId } = await browser.send("Target.createTarget", { url: "about:blank" }) as { targetId: string };
  const { sessionId } = await browser.send("Target.attachToTarget", { targetId, flatten: true }) as { sessionId: string };
  try {
    await browser.send("Page.enable", {}, sessionId);
    await browser.send("Runtime.enable", {}, sessionId);
    const draft = { ...packDraft("molding"), templateId: "tailwind-landing", visualBrief: { ...packDraft("molding").visualBrief, id: "technical-product", templateId: "tailwind-landing" }, blockVariants: { nav: "short", certifications: "cards", faq: "side", footer: "line" } };
    for (const width of [1440, 375]) {
      await browser.send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width < 500 }, sessionId);
      await browser.send("Page.navigate", { url: `${sitecraftBase}/api/templates/tailwind-landing/preview?hero-fit=${Date.now()}-${width}` }, sessionId);
      for (let waited = 0; waited < 15000; waited += 100) {
        if (await browser.eval<boolean>("document.readyState === 'complete' && typeof window.__sitecraftApplyDeclared === 'function'", sessionId).catch(() => false)) break;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      await browser.eval(`window.__sitecraftApplyDeclared(${JSON.stringify(draft)}, "zh", [], "published", null, false)`, sessionId);
      const result = await browser.eval<{ viewport: boolean; clipped: boolean; covered: boolean }>(`(() => {
        const title = document.querySelector('[data-sitecraft-benchmark="hero-title"]');
        if (!title) return { viewport: false, clipped: true, covered: false };
        const range = document.createRange(); range.selectNodeContents(title);
        const rects = [...range.getClientRects()]; const box = title.getBoundingClientRect();
        const viewport = rects.length > 0 && rects.every((rect) => rect.left >= -1 && rect.right <= innerWidth + 1 && rect.top >= -1 && rect.bottom <= innerHeight + 1);
        let clipped = false;
        for (let parent = title.parentElement; parent; parent = parent.parentElement) {
          const style = getComputedStyle(parent); const edge = parent.getBoundingClientRect();
          if ((style.overflowX === 'hidden' || style.overflowX === 'clip') && rects.some((rect) => rect.left < edge.left - 1 || rect.right > edge.right + 1)) clipped = true;
          if ((style.overflowY === 'hidden' || style.overflowY === 'clip') && rects.some((rect) => rect.top < edge.top - 1 || rect.bottom > edge.bottom + 1)) clipped = true;
        }
        const visual = document.querySelector('[data-sitecraft-hero-visual]')?.getBoundingClientRect();
        const overlap = visual && Math.max(0, Math.min(box.right, visual.right) - Math.max(box.left, visual.left)) * Math.max(0, Math.min(box.bottom, visual.bottom) - Math.max(box.top, visual.top));
        const covered = Boolean(visual && overlap > 1);
        return { viewport, clipped, covered };
      })()`, sessionId);
      assert.equal(result.viewport, true, `${width}: hero text stays inside viewport`);
      assert.equal(result.clipped, false, `${width}: hero text is not clipped by an ancestor`);
      assert.equal(result.covered, false, `${width}: hero title does not overlap the visual panel`);
    }
  } finally {
    await browser.send("Target.closeTarget", { targetId }).catch(() => {});
    try { browser.ws.send(JSON.stringify({ id: browser.id++, method: "Browser.close" })); } catch {}
    browser.ws.close();
  }
});
