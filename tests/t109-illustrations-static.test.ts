import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { closeBrowser, openBrowser, waitForPreviewBridge, base } from "./helpers/workspace-browser.ts";
import { packDraft } from "./fixtures/pack-drafts.ts";

const templateIds = ["screwfast", "forge", "landwind", "tailwind-landing"] as const;
const widths = [1440, 768, 375] as const;
const equipmentImage = {
  imageId: "img_equipment_t109",
  url: `data:image/jpeg;base64,${readFileSync(new URL("./fixtures/company-images/molding/equipment-1300-ton-machine.jpg", import.meta.url)).toString("base64")}`,
  originalName: "equipment-1300-ton-machine.jpg",
  usageCategory: "equipment",
};
const equipmentItems = [
  { id: "cnc", name: { zh: "高速 CNC 加工中心", en: "High-speed CNC machining center" }, quantity: 12, spec: { zh: "800 mm 行程", en: "800 mm travel" } },
  { id: "injection", name: { zh: "注塑机", en: "Injection machine" }, quantity: 42, spec: { zh: "90–800 t", en: "90–800 t" } },
  { id: "cmm", name: { zh: "三坐标测量机", en: "Coordinate measuring machine" }, quantity: null, spec: null },
  { id: "humidity", name: { zh: "恒温恒湿箱", en: "Constant temperature and humidity chamber" }, quantity: null, spec: null },
];

type PreviewResult = {
  width: number;
  heroMode: string | null;
  heroNameplateDisplay: string;
  heroNameplateHidden: boolean;
  heroBefore: string;
  heroAfter: string;
  productCardCount: number;
  productShadow: string;
  equipmentVariant: string | null;
  equipmentSvgCount: number;
  equipmentPlaceholderCount: number;
  equipmentText: string;
  equipmentParts: string[];
  equipmentRows: Array<{ name: string; quantity: string | null; unit: string | null; spec: string | null }>;
  equipmentGalleryHidden: boolean;
  equipmentImageCount: number;
  equipmentImageSrc: string | null;
  equipmentImageDecoded: boolean;
  equipmentImageVisible: boolean;
  equipmentSectionHidden: boolean;
  horizontalOverflow: number;
};

// Failure modes: a hidden SVG/label/frame survives removal; a variant remount or locale change
// restores it; names/counts/specs change; category photos stop decoding; empty or user-hidden
// equipment opens a shell; photo-only equipment loses its gallery; accepted hero/card details change.
async function checkEquipmentContract(tracerOnly: boolean) {
  const browser = await openBrowser();
  const { targetId } = await browser.send("Target.createTarget", { url: "about:blank" }) as { targetId: string };
  const { sessionId } = await browser.send("Target.attachToTarget", { targetId, flatten: true }) as { sessionId: string };
  let checked = 0;
  try {
    await browser.send("Page.enable", {}, sessionId);
    await browser.send("Runtime.enable", {}, sessionId);
    for (const templateId of tracerOnly ? ["screwfast"] : templateIds) {
      await browser.send("Page.navigate", { url: `${base}/api/templates/${templateId}/preview?t109=${Date.now()}-${templateId}` }, sessionId);
      await waitForPreviewBridge(browser, sessionId, 30000, `T-109 ${templateId}`);
      await browser.eval("document.fonts.ready", sessionId);
      for (const equipmentVariant of tracerOnly ? ["rows"] : ["rows", "band", "compact"]) {
        // Reuse the live bridge across media removal, locale changes and variant remounts.
        for (const locale of tracerOnly ? ["zh"] as const : ["zh", "en", "zh"] as const) {
          for (const width of tracerOnly ? [1440] : widths) {
            await browser.send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width < 500 }, sessionId);
            for (const scenario of tracerOnly ? ["no-image"] : ["no-image", "with-image", "photo-only", "empty", "hidden-photo", "no-image-restored"]) {
              const draft = packDraft("molding");
              draft.templateId = templateId;
              draft.blockVariants.equipment = equipmentVariant;
              const hasText = scenario !== "photo-only" && scenario !== "empty";
              const withImage = ["with-image", "photo-only", "hidden-photo"].includes(scenario);
              draft.content.equipment = hasText ? equipmentItems : [];
              if (scenario === "hidden-photo") draft.hiddenSections.push("equipment");
              const images = withImage ? [equipmentImage] : [];
              await browser.eval(
                `window.__sitecraftApplyDeclared(${JSON.stringify(draft)}, ${JSON.stringify(locale)}, [], "published", null, false, ${JSON.stringify(images)})`,
                sessionId,
              );
              await browser.eval("Promise.all([...document.querySelectorAll('[data-sitecraft-image-gallery=equipment] img')].map(image => image.decode()))", sessionId);
              await browser.eval("new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))", sessionId);
              const result = await browser.eval<PreviewResult>(`(() => {
                const hero = document.querySelector('[data-sitecraft-section="hero"]');
                const heroVisual = hero?.querySelector('[data-sitecraft-hero-visual]');
                const heroNameplate = hero?.querySelector('[data-sitecraft-hero-nameplate]');
                const productCards = document.querySelectorAll('[data-sc-block="products"] .sitecraft-product-card');
                const equipment = document.querySelector('[data-sitecraft-section="equipment"]');
                const container = equipment?.querySelector('.sitecraft-container');
                const gallery = equipment?.querySelector('[data-sitecraft-image-gallery="equipment"]');
                const image = gallery?.querySelector('img');
                const clean = node => node ? node.textContent.replace(/\\s+/g, ' ').trim() : null;
                return {
                  width: window.innerWidth,
                  heroMode: hero?.getAttribute('data-sitecraft-hero-mode') ?? null,
                  heroNameplateDisplay: heroNameplate ? getComputedStyle(heroNameplate).display : "none",
                  heroNameplateHidden: Boolean(heroNameplate?.hidden),
                  heroBefore: heroVisual ? getComputedStyle(heroVisual, '::before').content : 'none',
                  heroAfter: heroVisual ? getComputedStyle(heroVisual, '::after').content : 'none',
                  productCardCount: productCards.length,
                  productShadow: productCards[0] ? getComputedStyle(productCards[0]).boxShadow : "none",
                  equipmentVariant: equipment?.getAttribute('data-sc-variant') ?? null,
                  equipmentSvgCount: equipment?.querySelectorAll('svg').length ?? -1,
                  equipmentPlaceholderCount: equipment?.querySelectorAll('[data-sitecraft-equipment-schematic], [class*="schematic"], [class*="placeholder"]').length ?? -1,
                  equipmentText: clean(equipment) || "",
                  equipmentParts: [...(container?.children || [])].map(node => node.hasAttribute('data-sitecraft-image-gallery') ? 'gallery' : node.getAttribute('data-sc-part') || node.tagName),
                  equipmentRows: [...(equipment?.querySelectorAll('.sitecraft-equipment-item') || [])].map(row => ({
                    name: clean(row.querySelector('h3')),
                    quantity: clean(row.querySelector('.sitecraft-equipment-quantity-number')),
                    unit: clean(row.querySelector('.sitecraft-equipment-quantity-unit')),
                    spec: clean(row.querySelector('[data-sitecraft-equipment-spec]')),
                  })),
                  equipmentGalleryHidden: gallery?.hasAttribute("hidden") ?? true,
                  equipmentImageCount: gallery?.querySelectorAll('img').length || 0,
                  equipmentImageSrc: image?.getAttribute("src") ?? null,
                  equipmentImageDecoded: Boolean(image?.complete && image.naturalWidth > 0),
                  equipmentImageVisible: Boolean(image?.getClientRects().length && getComputedStyle(image).visibility !== 'hidden'),
                  equipmentSectionHidden: Boolean(equipment?.hidden),
                  horizontalOverflow: document.documentElement.scrollWidth - window.innerWidth,
                };
              })()`, sessionId);
              const where = `${templateId}/${equipmentVariant}/${locale}/${scenario} @${width}`;
              assert.equal(result.equipmentSvgCount, 0, `${where}: rejected equipment SVG must be absent from the DOM`);
              assert.equal(result.equipmentPlaceholderCount, 0, `${where}: no schematic label or placeholder frame survives, even hidden`);
              assert.doesNotMatch(result.equipmentText, /示意|Schematic/i, `${where}: no schematic copy survives`);
              assert.deepEqual(result.equipmentParts, ["head", "list", "gallery"], `${where}: equipment contains only its heading, actual list and category gallery`);
              assert.equal(result.width, width, where);
              assert.equal(result.equipmentVariant, equipmentVariant, where);
              assert.equal(result.equipmentSectionHidden, scenario === "empty" || scenario === "hidden-photo", `${where}: existing visibility semantics`);
              assert.deepEqual(result.equipmentRows, hasText && scenario !== "hidden-photo" ? equipmentItems.map(item => ({
                name: item.name[locale],
                quantity: item.quantity === null ? null : String(item.quantity),
                unit: item.quantity === null ? null : locale === "en" ? "units" : "台",
                spec: item.spec?.[locale] ?? null,
              })) : [], `${where}: actual names, quantities and specs are unchanged`);
              assert.equal(result.equipmentGalleryHidden, !withImage, `${where}: category gallery follows supplied equipment images`);
              assert.equal(result.equipmentImageCount, withImage ? 1 : 0, `${where}: supplied image count is unchanged`);
              assert.equal(result.equipmentImageSrc, withImage ? equipmentImage.url : null, `${where}: source URL is unchanged`);
              if (withImage) {
                assert.equal(result.equipmentImageDecoded, true, `${where}: supplied bitmap decodes`);
                assert.equal(result.equipmentImageVisible, scenario !== "hidden-photo", `${where}: photo-only content stays visible and explicit hiding wins`);
              }
              assert.ok(result.horizontalOverflow <= 1, `${where}: page overflows horizontally by ${result.horizontalOverflow}px`);
              assert.equal(result.heroMode, "nameplate", `${where}: equipment media must not replace the default hero nameplate`);
              assert.notEqual(result.heroNameplateDisplay, "none", `${where}: default hero nameplate remains visible`);
              assert.equal(result.heroNameplateHidden, false, `${where}: default hero nameplate is not hidden`);
              assert.equal(result.heroBefore, "none", `${where}: no hero schematic label or decoration is present`);
              assert.equal(result.heroAfter, "none", `${where}: no hero schematic pseudo-element is present`);
              assert.ok(result.productCardCount > 0, `${where}: product cards are rendered`);
              assert.notEqual(result.productShadow, "none", `${where}: product cards keep the accepted bottom rule`);
              checked += 1;
            }
          }
        }
      }
    }
    return checked;
  } finally {
    await browser.send("Target.closeTarget", { targetId }).catch(() => {});
    await closeBrowser(browser);
  }
}

test("T-109 Tracer bullet: no-image equipment renders the actual list without rejected media", async () => {
  assert.equal(await checkEquipmentContract(true), 1);
});

test("T-109 four looks and three equipment layouts preserve facts, category photos and visibility", async () => {
  assert.equal(await checkEquipmentContract(false), 648);
});
