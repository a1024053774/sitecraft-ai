import assert from "node:assert/strict";
import test from "node:test";
import { closeBrowser, openBrowser, waitForPreviewBridge, base } from "./helpers/workspace-browser.ts";
import { packDraft } from "./fixtures/pack-drafts.ts";

const templateIds = ["screwfast", "forge", "landwind", "tailwind-landing"] as const;
const widths = [1440, 768, 375] as const;
const schematicCopy = { zh: "示意", en: "Schematic" } as const;
const equipmentImage = {
  imageId: "img_equipment_t109",
  url: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='320' height='200'%3E%3Crect width='320' height='200' fill='%23dceaf5'/%3E%3C/svg%3E",
  originalName: "equipment-photo.svg",
  usageCategory: "equipment",
};

type PreviewResult = {
  width: number;
  heroMode: string | null;
  heroNameplateDisplay: string;
  heroNameplateHidden: boolean;
  heroBefore: string;
  heroAfter: string;
  productCardCount: number;
  productShadow: string;
  equipmentDisplay: string;
  equipmentLabel: string;
  equipmentAriaLabel: string | null;
  equipmentColor: string;
  equipmentBackgroundColor: string;
  equipmentBorderTopWidth: string;
  equipmentSvgWidth: number;
  equipmentGalleryHidden: boolean;
  equipmentImageCount: number;
  equipmentImageSrc: string | null;
  equipmentSectionHidden: boolean;
  horizontalOverflow: number;
};

/**
 * T-109: the shared preview bridge owns both the locale copy and the media decision for the
 * equipment block. Every production look is exercised at the three supported browser widths.
 */
test("T-109 localizes equipment schematics and switches to supplied equipment images", async () => {
  const browser = await openBrowser();
  const { targetId } = await browser.send("Target.createTarget", { url: "about:blank" }) as { targetId: string };
  const { sessionId } = await browser.send("Target.attachToTarget", { targetId, flatten: true }) as { sessionId: string };
  try {
    await browser.send("Page.enable", {}, sessionId);
    await browser.send("Runtime.enable", {}, sessionId);
    for (const templateId of templateIds) {
      await browser.send("Page.navigate", { url: `${base}/api/templates/${templateId}/preview?t109=${Date.now()}-${templateId}` }, sessionId);
      await waitForPreviewBridge(browser, sessionId, 30000, `T-109 ${templateId}`);
      for (const locale of ["zh", "en"] as const) {
        const draft = packDraft("molding");
        draft.templateId = templateId;
        draft.content.equipment = [
          { id: "cnc", name: { zh: "高速 CNC 加工中心", en: "High-speed CNC machining center" }, quantity: 12, spec: { zh: "800 mm 行程", en: "800 mm travel" } },
          { id: "injection", name: { zh: "注塑机", en: "Injection machine" }, quantity: 42, spec: { zh: "90–800 t", en: "90–800 t" } },
        ];
        for (const withImage of [false, true]) {
          for (const width of widths) {
            await browser.send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width < 500 }, sessionId);
            const images = withImage ? [equipmentImage] : [];
            await browser.eval(
              `window.__sitecraftApplyDeclared(${JSON.stringify(draft)}, ${JSON.stringify(locale)}, [], "published", null, false, ${JSON.stringify(images)})`,
              sessionId,
            );
            await browser.eval("new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))", sessionId);
            const result = await browser.eval<PreviewResult>(`(() => {
              const hero = document.querySelector('[data-sitecraft-section="hero"]');
              const heroVisual = hero?.querySelector('[data-sitecraft-hero-visual]');
              const heroNameplate = hero?.querySelector('[data-sitecraft-hero-nameplate]');
              const productCards = document.querySelectorAll('[data-sc-block="products"] .sitecraft-product-card');
              const product = productCards[0];
              const equipment = document.querySelector('[data-sitecraft-section="equipment"]');
              const schematic = equipment?.querySelector('[data-sitecraft-equipment-schematic]');
              const gallery = equipment?.querySelector('[data-sitecraft-image-gallery="equipment"]');
              const image = gallery?.querySelector('img');
              return {
                width: window.innerWidth,
                heroMode: hero?.getAttribute('data-sitecraft-hero-mode') ?? null,
                heroNameplateDisplay: heroNameplate ? getComputedStyle(heroNameplate).display : "none",
                heroNameplateHidden: Boolean(heroNameplate?.hidden),
                heroBefore: heroVisual ? getComputedStyle(heroVisual, '::before').content : 'none',
                heroAfter: heroVisual ? getComputedStyle(heroVisual, '::after').content : 'none',
                productCardCount: productCards.length,
                productShadow: product ? getComputedStyle(product).boxShadow : "none",
                equipmentDisplay: schematic ? getComputedStyle(schematic).display : "none",
                equipmentLabel: schematic?.querySelector('.sitecraft-equipment-schematic-label')?.textContent?.trim() || "",
                equipmentAriaLabel: schematic?.getAttribute("aria-label") ?? null,
                equipmentColor: schematic ? getComputedStyle(schematic).color : "",
                equipmentBackgroundColor: schematic ? getComputedStyle(schematic).backgroundColor : "",
                equipmentBorderTopWidth: schematic ? getComputedStyle(schematic).borderTopWidth : "0px",
                equipmentSvgWidth: schematic?.querySelector('svg')?.getBoundingClientRect().width || 0,
                equipmentGalleryHidden: gallery?.hasAttribute("hidden") ?? true,
                equipmentImageCount: gallery?.querySelectorAll('img').length || 0,
                equipmentImageSrc: image?.getAttribute("src") ?? null,
                equipmentSectionHidden: Boolean(equipment?.hidden),
                horizontalOverflow: document.documentElement.scrollWidth - window.innerWidth,
              };
            })()`, sessionId);
            const where = `${templateId}/${locale}/${withImage ? "with-image" : "no-image"} @${width}`;
            assert.equal(result.width, width, where);
            assert.equal(result.equipmentSectionHidden, false, `${where}: equipment content stays visible`);
            assert.ok(result.horizontalOverflow <= 1, `${where}: page overflows horizontally by ${result.horizontalOverflow}px`);
            assert.equal(result.heroMode, "nameplate", `${where}: equipment media must not replace the default hero nameplate`);
            assert.notEqual(result.heroNameplateDisplay, "none", `${where}: default hero nameplate remains visible`);
            assert.equal(result.heroNameplateHidden, false, `${where}: default hero nameplate is not hidden`);
            assert.equal(result.heroBefore, "none", `${where}: no hero schematic label or decoration is present`);
            assert.equal(result.heroAfter, "none", `${where}: no hero schematic pseudo-element is present`);
            assert.ok(result.productCardCount > 0, `${where}: product cards are rendered`);
            assert.notEqual(result.productShadow, "none", `${where}: product cards keep the accepted bottom rule`);
            if (withImage) {
              assert.equal(result.equipmentGalleryHidden, false, `${where}: supplied image gallery is visible`);
              assert.equal(result.equipmentImageCount, 1, `${where}: supplied equipment image is rendered`);
              assert.equal(result.equipmentImageSrc, equipmentImage.url, `${where}: rendered image keeps its source URL`);
              assert.equal(result.equipmentDisplay, "none", `${where}: supplied image hides the schematic`);
            } else {
              assert.equal(result.equipmentGalleryHidden, true, `${where}: empty equipment gallery is hidden`);
              assert.equal(result.equipmentImageCount, 0, `${where}: no equipment image is rendered`);
              assert.equal(result.equipmentDisplay, "block", `${where}: no-image equipment shows its schematic`);
              assert.equal(result.equipmentLabel, schematicCopy[locale], `${where}: schematic label follows locale`);
              assert.equal(result.equipmentAriaLabel, schematicCopy[locale], `${where}: schematic aria-label follows locale`);
              assert.notEqual(result.equipmentColor, "rgba(0, 0, 0, 0)", `${where}: schematic line color comes from the look token`);
              assert.notEqual(result.equipmentBackgroundColor, "rgba(0, 0, 0, 0)", `${where}: schematic surface comes from the look token`);
              assert.notEqual(result.equipmentBorderTopWidth, "0px", `${where}: schematic surface keeps the look rule`);
              assert.ok(result.equipmentSvgWidth > 0, `${where}: schematic has visible SVG geometry`);
            }
          }
        }
      }
    }
  } finally {
    await browser.send("Target.closeTarget", { targetId }).catch(() => {});
    await closeBrowser(browser);
  }
});
