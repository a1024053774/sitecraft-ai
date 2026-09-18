import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  NORDIC_STORE_LOCAL_PATH,
  NORDIC_STORE_REPO,
  NORDIC_STORE_SHA,
  applyAdmittedKitFragments,
  composeKitModules,
  extractNordicProductGrid,
  getTemplateAdapter,
  injectProductGrid,
  restyleAdmittedCatalogGrid,
  selectedKitParts,
  sameFamilyTokens,
} from "../lib/template-adapters/index.ts";

const nordicHtml = readFileSync(new URL("../vendor/open-source-templates/nordic-store/index.html", import.meta.url), "utf8");
const nordicLicense = readFileSync(new URL("../vendor/open-source-templates/nordic-store/LICENSE", import.meta.url), "utf8");
const landwindHtml = readFileSync(new URL("../vendor/open-source-templates/landwind/index.html", import.meta.url), "utf8");

test("nordic-store is MIT at the pinned SHA and is a usable static snapshot", () => {
  assert.equal(NORDIC_STORE_SHA, "b64edb872ec70d40297eb3aacb1fb4dfbb3a68c3");
  assert.equal(NORDIC_STORE_REPO, "https://github.com/tailwindtoolbox/Nordic-Store");
  assert.equal(NORDIC_STORE_LOCAL_PATH, "vendor/open-source-templates/nordic-store");
  assert.match(nordicLicense, /MIT License/);
  assert.match(nordicLicense, /Copyright \(c\) 2019 Tailwind Toolbox/);
  assert.match(nordicHtml, /<!DOCTYPE html>/i);
  assert.equal(nordicHtml.includes('id="root"') && nordicHtml.includes('id="app"'), false);
  assert.match(nordicHtml, /id="store"/);
  assert.match(nordicHtml, /https:\/\/images\.unsplash\.com/);
  assert.match(nordicHtml, /fonts\.googleapis\.com/);
  assert.match(nordicHtml, /£9\.99/);
});

test("admitted nordic product grid drops Unsplash and retail prices then mounts on landwind", () => {
  const grid = extractNordicProductGrid(nordicHtml);
  assert.ok(grid);
  assert.match(grid, /id="store"/);
  assert.equal(grid.includes("Savoy Theme"), false);

  const restyled = restyleAdmittedCatalogGrid(grid);
  assert.match(restyled, /data-sitecraft-kit="product-grid"/);
  assert.match(restyled, /data-sitecraft-family="export-catalog"/);
  assert.equal(restyled.includes("https://images.unsplash.com"), false);
  assert.equal(restyled.includes("£9.99"), false);
  assert.match(restyled, /sitecraft-catalog-card/);
  assert.equal((restyled.match(/src="" data-sitecraft-stock="unsplash"/g) ?? []).length, 8);

  const composed = injectProductGrid(landwindHtml, restyled);
  assert.equal((composed.match(/<section data-sitecraft-kit="product-grid"/g) ?? []).length, 1);
  assert.ok(composed.indexOf("<section data-sitecraft-kit=\"product-grid\"") < composed.search(/<footer\b/i));
  assert.equal(injectProductGrid(composed, restyled), composed);
  assert.equal(landwindHtml.includes("data-sitecraft-kit=\"product-grid\""), false);
});

test("preview apply injects the grid onto landwind and not onto screwfast", () => {
  const landwind = applyAdmittedKitFragments(landwindHtml, "landwind");
  assert.equal((landwind.match(/<section data-sitecraft-kit="product-grid"/g) ?? []).length, 1);
  assert.equal(landwind.includes("https://images.unsplash.com"), false);
  const screwfast = applyAdmittedKitFragments("<footer></footer>", "screwfast");
  assert.equal(screwfast.includes("product-grid"), false);
});

test("nordic-store restyles to export-catalog host tokens and does not open a new look", () => {
  const host = getTemplateAdapter("landwind")?.kit;
  const guest = getTemplateAdapter("nordic-store")?.kit;
  assert.ok(host && guest);
  assert.equal(host.familyId, "export-catalog");
  assert.equal(guest.familyId, "export-catalog");
  assert.equal(sameFamilyTokens(host.tokens, guest.tokens), true);
  const products = host.modules.find((module) => module.key === "products");
  assert.equal(products?.sourceTemplateId, "nordic-store");
  const composed = composeKitModules({ host, parts: selectedKitParts(guest) });
  assert.equal(composed.ok, true);
  if (composed.ok) {
    assert.equal(composed.familyId, "export-catalog");
    assert.deepEqual(composed.selected, ["products"]);
  }
});
