import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("shared site preview uses the row gap, a short delay, and tap when hover is unavailable", () => {
  const shared = readFileSync(new URL("../components/site-preview-pop.tsx", import.meta.url), "utf8");
  assert.match(shared, /createPortal/);
  assert.match(shared, /hover: hover/);
  assert.match(shared, /pointer: fine/);
  assert.match(shared, /data-preview-label/);
  assert.match(shared, /data-preview-actions/);
  assert.match(shared, /PREVIEW_DELAY_MS = 50/);
  assert.match(shared, /pointerType === "touch"/);
  assert.equal(shared.includes("400"), false);
  assert.equal(shared.includes("setInterval"), false);
});

test("all-sites and delete lists reuse the shared preview instead of reserving a blank column", () => {
  const table = readFileSync(new URL("../components/sites-table.tsx", import.meta.url), "utf8");
  const page = readFileSync(new URL("../app/sites/page.tsx", import.meta.url), "utf8");
  const panel = readFileSync(new URL("../components/site-delete-panel.tsx", import.meta.url), "utf8");
  assert.match(page, /listExistingSites/);
  assert.equal(page.includes("getSite("), false);
  assert.match(page, /SitesTable/);
  assert.match(table, /useSitePreview/);
  assert.match(panel, /useSitePreview/);
  assert.equal(panel.includes("delete-site-board"), false);
});
