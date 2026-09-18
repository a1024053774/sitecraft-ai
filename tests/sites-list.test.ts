import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("dashboard 查看全部 goes to the saved-site list instead of a same-page hash", () => {
  const dashboard = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(dashboard, /查看全部/);
  assert.match(dashboard, /href=\{?"\/sites"/);
  assert.equal(dashboard.includes("#recent-sites"), false);
});

test("the all-sites page lists existing records and does not create drafts", () => {
  const page = readFileSync(new URL("../app/sites/page.tsx", import.meta.url), "utf8");
  assert.match(page, /listExistingSites/);
  assert.equal(page.includes("getSite("), false);
});
