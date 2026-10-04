import assert from "node:assert/strict";
import test from "node:test";
import { packDraft } from "./fixtures/pack-drafts.ts";
import { closeBrowser, base as sitecraftBase, openBrowser } from "./helpers/workspace-browser.ts";

const LOOKS = [
  ["screwfast", ["Geist", "Geist Mono"]],
  ["landwind", ["Manrope", "JetBrains Mono"]],
  ["forge", ["Sora", "JetBrains Mono"]],
  ["tailwind-landing", ["Geist", "Geist Mono"]],
] as const;

test("all four looks keep bilingual hero titles inside every acceptance viewport", { concurrency: false }, async () => {
  const browser = await openBrowser();
  try {
    for (const [templateId, [headingFamily, dataFamily]] of LOOKS) {
      const { targetId } = await browser.send("Target.createTarget", { url: "about:blank" }) as { targetId: string };
      const { sessionId } = await browser.send("Target.attachToTarget", { targetId, flatten: true }) as { sessionId: string };
      try {
        await browser.send("Page.enable", {}, sessionId);
        await browser.send("Runtime.enable", {}, sessionId);
        await browser.send("Page.navigate", { url: `${sitecraftBase}/api/templates/${templateId}/preview?t087-title-matrix=${Date.now()}` }, sessionId);
        for (let waited = 0; waited < 15000; waited += 100) {
          if (await browser.eval<boolean>("document.readyState === 'complete' && typeof window.__sitecraftApplyDeclared === 'function'", sessionId).catch(() => false)) break;
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        const draft = { ...packDraft("molding"), templateId };
        for (const width of [1440, 768, 375]) for (const locale of ["zh", "en"] as const) {
          await browser.send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width === 375 }, sessionId);
          await browser.eval(`window.__sitecraftApplyDeclared(${JSON.stringify(draft)}, ${JSON.stringify(locale)}, [], "published", null, true); document.fonts.ready`, sessionId);
          await browser.eval(`Promise.all([document.fonts.load('700 32px ${JSON.stringify(headingFamily)}'), document.fonts.load('400 14px ${JSON.stringify(dataFamily)}')]); document.fonts.ready`, sessionId);
          const result = await browser.eval<{ lines: number; overflow: boolean; clipped: boolean; wordBreak: string; fontStatus: string; headingLoaded: boolean; dataLoaded: boolean }>(`(() => {
            const title = document.querySelector('[data-sitecraft-benchmark="hero-title"]') || document.querySelector('.sitecraft-hero h1');
            if (!title) return { lines: 0, overflow: true, clipped: true, wordBreak: "missing", fontStatus: document.fonts.status, headingLoaded: false, dataLoaded: false };
            const range = document.createRange(); range.selectNodeContents(title);
            const rects = [...range.getClientRects()];
            const box = title.getBoundingClientRect();
            const overflow = rects.some((rect) => rect.left < -1 || rect.right > innerWidth + 1);
            let clipped = false;
            for (let parent = title.parentElement; parent; parent = parent.parentElement) {
              const style = getComputedStyle(parent); const edge = parent.getBoundingClientRect();
              if ((style.overflowX === 'hidden' || style.overflowX === 'clip') && rects.some((rect) => rect.left < edge.left - 1 || rect.right > edge.right + 1)) clipped = true;
              if ((style.overflowY === 'hidden' || style.overflowY === 'clip') && rects.some((rect) => rect.top < edge.top - 1 || rect.bottom > edge.bottom + 1)) clipped = true;
            }
            return {
              lines: new Set(rects.map((rect) => Math.round(rect.top))).size,
              overflow,
              clipped,
              wordBreak: getComputedStyle(title).wordBreak,
              fontStatus: document.fonts.status,
              headingLoaded: document.fonts.check('700 32px ${headingFamily}'),
              dataLoaded: document.fonts.check('400 14px ${dataFamily}'),
              boxWidth: box.width,
            };
          })()`, sessionId);
          assert.equal(result.fontStatus, "loaded", `${templateId} ${locale} @${width}: font set`);
          assert.equal(result.headingLoaded, true, `${templateId} ${locale} @${width}: heading font`);
          assert.equal(result.dataLoaded, true, `${templateId} ${locale} @${width}: data font`);
          assert.ok(result.lines >= 1, `${templateId} ${locale} @${width}: title has no line boxes`);
          assert.equal(result.overflow, false, `${templateId} ${locale} @${width}: title leaves viewport`);
          assert.equal(result.clipped, false, `${templateId} ${locale} @${width}: title is clipped`);
          assert.notEqual(result.wordBreak, "break-all", `${templateId} ${locale} @${width}: title splits words`);
        }
      } finally {
        await browser.send("Target.closeTarget", { targetId }).catch(() => {});
      }
    }
  } finally {
    await closeBrowser(browser);
  }
});
