import assert from "node:assert/strict";
import test from "node:test";
import { installPreviewBridge } from "../lib/template-adapters/preview-bridge.ts";
import { getTemplateAdapter } from "../lib/template-adapters/registry.ts";
import { parseHtmlDocument, visibleText } from "./fixtures/html-dom.ts";
import { servedHomeHtml } from "./fixtures/look-pages.ts";
import { packDraft } from "./fixtures/pack-drafts.ts";

type ImageView = {
  imageId: string;
  url: string;
  usageCategory: "product" | "equipment" | "facility" | "inspection";
  license: string;
  sha256?: string;
  credit?: { zh: string; en: string };
};

function render(images: ImageView[]) {
  const adapter = getTemplateAdapter("screwfast");
  assert.ok(adapter);
  const document = parseHtmlDocument(servedHomeHtml("screwfast"));
  const globalObject: Record<string, unknown> = { document, parent: { postMessage() {} }, addEventListener() {} };
  globalObject.window = globalObject;
  const api = installPreviewBridge(globalObject, "screwfast", adapter);
  const report = api.applyDeclaredContent(packDraft("industrial"), "zh", [], "published", undefined, false, images);
  (document as unknown as { __t107Report?: unknown }).__t107Report = report;
  return document;
}

test("usage categories route uploaded images to declared section galleries and show required credit", () => {
  const document = render([
    { imageId: "img_product_107", url: "/api/sites/site/images/img_product_107", usageCategory: "product", license: "CC0" },
    { imageId: "img_equipment_107", url: "/api/sites/site/images/img_equipment_107", usageCategory: "equipment", license: "CC BY", credit: { zh: "作者甲 / CC BY", en: "Author A / CC BY" } },
    { imageId: "img_facility_107", url: "/api/sites/site/images/img_facility_107", usageCategory: "facility", license: "CC BY-SA", credit: { zh: "作者乙 / CC BY-SA", en: "Author B / CC BY-SA" } },
    { imageId: "img_inspection_107", url: "/api/sites/site/images/img_inspection_107", usageCategory: "inspection", license: "Public Domain" },
  ]);
  for (const category of ["product", "equipment", "facility", "inspection"]) {
    assert.equal(document.querySelectorAll(`[data-sitecraft-image-gallery="${category}"]`).length, 1, `${category} has one gallery node`);
    const gallery = document.querySelector(`[data-sitecraft-image-gallery="${category}"]`);
    assert.ok(gallery, `${category} gallery is declared`);
    assert.equal(gallery?.querySelectorAll("img").length, 1, `${category} image is mounted by category`);
  }
  assert.match(visibleText(document.documentElement), /作者乙 \/ CC BY-SA/);
  assert.equal(document.querySelectorAll("[data-sitecraft-image-gallery] figcaption").length, 0, "credits are not repeated under every thumbnail");
  assert.equal(document.querySelectorAll("[data-sitecraft-image-credits]").length, 1, "credits use one footer source note");
});

test("without uploaded images, image galleries stay hidden and do not leave empty frames", () => {
  const document = render([]);
  for (const category of ["product", "equipment", "facility", "inspection"]) {
    assert.equal(document.querySelectorAll(`[data-sitecraft-image-gallery="${category}"]`).length, 1, `${category} has one gallery node`);
    const gallery = document.querySelector(`[data-sitecraft-image-gallery="${category}"]`);
    assert.ok(gallery, `${category} gallery is declared`);
    assert.equal(gallery?.hidden, true, `${category} gallery is hidden without images`);
    assert.equal(gallery?.querySelectorAll("img").length, 0);
  }
});

test("a facility image activates the photo hero without forcing narrow spec values onto one line", () => {
  const document = render([
    { imageId: "img_facility_hero_107", url: "/api/sites/site/images/img_facility_hero_107", usageCategory: "facility", license: "CC0" },
  ]);
  assert.equal(document.querySelector('[data-sitecraft-section="hero"]')?.getAttribute("data-sitecraft-hero-mode"), "photo");
  assert.match(document.querySelector('[data-sitecraft-image-gallery="facility"] img')?.getAttribute("src") ?? "", /img_facility_hero_107/);
});

test("duplicate uploaded records with the same sha256 render one image across the page", () => {
  const document = render([
    { imageId: "img_same_a", url: "/api/sites/site/images/img_same_a", usageCategory: "facility", license: "CC BY", credit: { zh: "作者 / CC BY", en: "Author / CC BY" }, sha256: "same-image-hash" },
    { imageId: "img_same_b", url: "/api/sites/site/images/img_same_b", usageCategory: "product", license: "CC BY", credit: { zh: "作者 / CC BY", en: "Author / CC BY" }, sha256: "same-image-hash" },
  ]);
  const images = [...document.querySelectorAll("[data-sitecraft-image-gallery] img")];
  assert.equal(images.length, 0, "conflicting same-content records are not guessed by input order");
  const reportDocument = render([
    { imageId: "img_same_a", url: "/api/sites/site/images/img_same_a", usageCategory: "facility", license: "CC BY", credit: { zh: "作者 / CC BY", en: "Author / CC BY" }, sha256: "same-image-hash" },
    { imageId: "img_same_b", url: "/api/sites/site/images/img_same_b", usageCategory: "product", license: "CC BY", credit: { zh: "作者 / CC BY", en: "Author / CC BY" }, sha256: "same-image-hash" },
  ]);
  const report = (reportDocument as unknown as { __t107Report?: { missingSlots?: string[] } }).__t107Report;
  assert.ok(report?.missingSlots?.some((slot) => slot.startsWith("images.conflict.same-image-hash")), "same-content conflict is explicit");
});
