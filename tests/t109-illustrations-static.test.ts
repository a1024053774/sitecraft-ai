import assert from "node:assert/strict";
import test from "node:test";
import { closeBrowser, openBrowser, waitForPreviewBridge, base } from "./helpers/workspace-browser.ts";
import { packDraft } from "./fixtures/pack-drafts.ts";

/** T-109: accepted static detail surfaces must be visible in the real preview.
 * Equipment may use a schematic only when its own gallery is empty; the hero keeps the
 * ordinary nameplate/default treatment after the hero schematic candidate was rejected.
 */
test("T-109 keeps the equipment empty-media schematic and product rule, without a hero schematic", async () => {
  const browser = await openBrowser();
  const { targetId } = await browser.send("Target.createTarget", { url: "about:blank" }) as { targetId: string };
  const { sessionId } = await browser.send("Target.attachToTarget", { targetId, flatten: true }) as { sessionId: string };
  const draft = packDraft("molding");
  draft.content.equipment = [
    { id: "cnc", name: { zh: "高速 CNC 加工中心", en: "High-speed CNC machining center" }, quantity: 12, spec: { zh: "800 mm 行程", en: "800 mm travel" } },
    { id: "injection", name: { zh: "注塑机", en: "Injection machine" }, quantity: 42, spec: { zh: "90–800 t", en: "90–800 t" } },
  ];
  try {
    await browser.send("Page.enable", {}, sessionId);
    await browser.send("Runtime.enable", {}, sessionId);
    await browser.send("Page.navigate", { url: `${base}/api/templates/screwfast/preview?t109=${Date.now()}` }, sessionId);
    await waitForPreviewBridge(browser, sessionId, 30000, "T-109 illustration/static detail");
    for (const width of [1440, 768, 375]) {
      await browser.send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width < 500 }, sessionId);
      await browser.eval(`window.__sitecraftApplyDeclared(${JSON.stringify(draft)}, "zh", [], "published", null, false)`, sessionId);
      await browser.eval("new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))", sessionId);
      const result = await browser.eval<{
        width: number;
        heroMode: string | null;
        heroBefore: string;
        heroAfter: string;
        equipmentDisplay: string;
        equipmentLabel: string;
        equipmentSvgWidth: number;
        equipmentBoxWidth: number;
        equipmentSectionHidden: boolean;
        equipmentContainerWidth: number;
        equipmentSvgCssWidth: string;
        productShadow: string;
        horizontalOverflow: number;
      }>(`(() => {
        const hero = document.querySelector('[data-sitecraft-section="hero"]');
        const visual = hero?.querySelector('[data-sitecraft-hero-visual]');
        const equipment = document.querySelector('[data-sitecraft-section="equipment"]');
        const equipmentSchematic = equipment?.querySelector('[data-sitecraft-equipment-schematic]');
        const product = document.querySelector('[data-sc-block="products"] .sitecraft-product-card');
        const productStyle = product ? getComputedStyle(product) : null;
        return {
          width: window.innerWidth,
          heroMode: hero?.getAttribute('data-sitecraft-hero-mode') ?? null,
          heroBefore: visual ? getComputedStyle(visual, '::before').content : 'none',
          heroAfter: visual ? getComputedStyle(visual, '::after').content : 'none',
          equipmentDisplay: equipmentSchematic ? getComputedStyle(equipmentSchematic).display : 'none',
          equipmentLabel: equipmentSchematic?.querySelector('.sitecraft-equipment-schematic-label')?.textContent?.trim() || '',
          equipmentSvgWidth: equipmentSchematic?.querySelector('svg')?.getBoundingClientRect().width || 0,
          equipmentBoxWidth: equipmentSchematic?.getBoundingClientRect().width || 0,
          equipmentSectionHidden: Boolean(equipment?.hidden),
          equipmentContainerWidth: equipment?.querySelector('.sitecraft-container')?.getBoundingClientRect().width || 0,
          equipmentSvgCssWidth: equipmentSchematic ? getComputedStyle(equipmentSchematic.querySelector('svg')).width : 'none',
          productShadow: productStyle?.boxShadow || 'none',
          horizontalOverflow: document.documentElement.scrollWidth - window.innerWidth,
        };
      })()`, sessionId);
      assert.equal(result.width, width);
      assert.equal(result.heroMode, "nameplate", `${width}: no-image molding hero uses its default nameplate`);
      assert.equal(result.heroBefore, "none", `${width}: rejected hero schematic must have no label`);
      assert.equal(result.heroAfter, "none", `${width}: rejected hero schematic must have no pseudo-element`);
      assert.equal(result.equipmentDisplay, "block", `${width}: no-image equipment shows its schematic`);
      assert.equal(result.equipmentLabel, "示意", `${width}: equipment schematic is labelled as illustrative`);
      assert.ok(result.equipmentSvgWidth > 0, `${width}: equipment schematic has visible SVG geometry (${JSON.stringify(result)})`);
      assert.notEqual(result.productShadow, "none", `${width}: product cards keep their bottom rule`);
      assert.ok(result.horizontalOverflow <= 1, `${width}: page overflows horizontally by ${result.horizontalOverflow}px`);
    }
  } finally {
    await browser.send("Target.closeTarget", { targetId }).catch(() => {});
    await closeBrowser(browser);
  }
});
