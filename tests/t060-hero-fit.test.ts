import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { packDraft } from "./fixtures/pack-drafts.ts";
import { openBrowser } from "./helpers/workspace-browser.ts";

const textFit = readFileSync("scripts/visitor-text-fit-scan.js", "utf8");
const wordScan = readFileSync("scripts/hero-word-break-scan.js", "utf8");

test("engineering generated titles and the Chinese company name fit both locales at all three widths", async () => {
  const browser = await openBrowser();
  const { targetId } = await browser.send("Target.createTarget", { url: "http://127.0.0.1:3034/api/templates/screwfast/preview?t060=fit" }) as { targetId: string };
  const { sessionId } = await browser.send("Target.attachToTarget", { targetId, flatten: true }) as { sessionId: string };
  try {
    await browser.send("Runtime.enable", {}, sessionId);
    for (let i = 0; i < 150; i++) {
      if (await browser.eval("typeof window.__sitecraftApplyDeclared === 'function'", sessionId).catch(() => false)) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    for (const [pack, title, english] of [
      ["export", "不锈钢快换接头与卡套接头", "Stainless Steel Quick-Connect and Ferrule Fittings"],
      ["molding", "精密注塑模具与注塑件", "Precision injection molds and molded parts"],
    ] as const) {
      const draft = packDraft(pack);
      draft.content.hero.title = { zh: title, en: english };
      if (pack === "export") draft.blockVariants.hero = "statement";
      for (const width of [375, 768, 1440]) for (const locale of ["zh", "en"]) {
        await browser.send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width === 375 }, sessionId);
        await browser.eval(`window.__sitecraftApplyDeclared(${JSON.stringify(draft)}, '${locale}', [], 'published', null, true); document.fonts.ready`, sessionId);
        const result = await browser.eval<{ title: string; failures: unknown[]; split: boolean; brandOverflow: boolean; brandRows: number }>(`(() => {
          const h = document.querySelector('.sitecraft-hero h1'), b = document.querySelector('.sitecraft-brand-name');
          const failures = (${textFit})(document.body).filter(x => x.element === 'h1' || x.element.includes('brand'));
          const scan = (${wordScan})(h);
          const r = document.createRange(); r.selectNodeContents(b);
          return {title:h.textContent, failures, split:scan.heroTitleWordBreak,
            brandOverflow:b.scrollWidth > b.clientWidth + 1 || b.scrollHeight > b.clientHeight + 1,
            brandRows:new Set([...r.getClientRects()].map(x => Math.round(x.top))).size};
        })()`, sessionId);
        const label = `${pack} ${locale} ${width}: ${JSON.stringify(result)}`;
        assert.equal(result.title, locale === "zh" ? title : english, label);
        assert.deepEqual(result.failures, [], label);
        assert.equal(result.split, false, label);
        assert.equal(result.brandOverflow, false, label);
        assert.equal(result.brandRows, 1, label);
      }
    }
  } finally {
    await browser.send("Target.closeTarget", { targetId });
    browser.ws.close();
  }
});
