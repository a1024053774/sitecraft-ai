import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { paletteCatalogForVisualBrief } from "../lib/site-document.ts";
import { packDraft } from "./fixtures/pack-drafts.ts";
import { base, closeBrowser, openBrowser, waitForPreviewBridge } from "./helpers/workspace-browser.ts";

const scanSource = readFileSync(new URL("../scripts/visitor-layout-scan.js", import.meta.url), "utf8")
  .replace("export function", "function").replace("export default scanVisitorLayout;", "");
const looks = [
  ["industrial", "forge"], ["export-catalog", "landwind"],
  ["technical-product", "tailwind-landing"], ["engineering-industrial", "screwfast"],
] as const;
// A self-contained fixture image selects the photo hero and its separate parameter strip.
const images = [{ imageId: "img_t122_facility", usageCategory: "facility", license: "CC0", url: "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=" }];

test("T-122 rendered hero parameter labels meet 4.5:1 across looks, palettes, locales and widths", async () => {
  const browser = await openBrowser();
  const { targetId } = await browser.send("Target.createTarget", { url: "about:blank" }) as { targetId: string };
  const { sessionId } = await browser.send("Target.attachToTarget", { targetId, flatten: true }) as { sessionId: string };
  const failures: string[] = [];
  try {
    await browser.send("Page.enable", {}, sessionId);
    await browser.send("Runtime.enable", {}, sessionId);
    for (const [briefId, templateId] of looks) {
      await browser.send("Page.navigate", { url: `${base}/api/templates/${templateId}/preview` }, sessionId);
      await waitForPreviewBridge(browser, sessionId, 15000, "T-122 spec labels");
      for (const palette of paletteCatalogForVisualBrief(briefId)) {
        for (const width of [1440, 768, 375]) {
          await browser.send("Emulation.setDeviceMetricsOverride", { width, height: 1000, deviceScaleFactor: 1, mobile: width < 500 }, sessionId);
          for (const locale of ["zh", "en"]) {
            // Use each look's default split hero with a photo: the no-photo nameplate
            // has its own label colour and would hide the broken parameter strip.
            const draft = { ...packDraft("molding"), templateId, paletteId: palette.id, blockVariants: {} };
            await browser.eval(`window.__sitecraftApplyDeclared(${JSON.stringify(draft)}, ${JSON.stringify(locale)}, [], "published", null, true, ${JSON.stringify(images)})`, sessionId);
            assert.equal(await browser.eval(`document.querySelector('[data-sitecraft-section="hero"]').getAttribute('data-sitecraft-hero-mode')`, sessionId), "photo");
            const labels = await browser.eval<Array<{ text: string; ratio: number | null; status: string; checkable: boolean }>>(`(() => { ${scanSource}; return scanVisitorLayout(document).textContrast.filter(row => row.block === 'hero' && row.tag === 'dt'); })()`, sessionId);
            assert.equal(labels.length, 4, `${templateId}/${palette.id}/${locale}/${width}: four actual labels must be measured`);
            for (const label of labels) {
              if (!label.checkable || label.status !== "measured" || label.ratio === null || label.ratio < 4.5) {
                failures.push(`${templateId}/${palette.id}/${locale}/${width}: ${label.text} ${label.ratio?.toFixed(2)}:1 (${label.status})`);
              }
            }
          }
        }
      }
    }
    assert.deepEqual(failures, [], "parameter labels use the body contrast threshold without exemptions");
  } finally {
    await browser.send("Target.closeTarget", { targetId }).catch(() => {});
    await closeBrowser(browser);
  }
});
