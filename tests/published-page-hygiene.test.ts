import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const publishedSource = readFileSync(new URL("../app/published/[siteKey]/published-client.tsx", import.meta.url), "utf8");
const workspaceSource = readFileSync(new URL("../app/(workspace)/workspace/page.tsx", import.meta.url), "utf8");

test("published pages contain only the site while workspace owns page-plan diagnostics", () => {
  assert.equal(publishedSource.includes("pagePlanSourceLabel"), false);
  assert.equal(publishedSource.includes("site-page-source"), false);
  assert.equal(publishedSource.includes("site-page-unsupported"), false);
  assert.match(workspaceSource, /pagePlanSourceLabel/);
  assert.match(workspaceSource, /site-page-source/);
  assert.match(workspaceSource, /site-page-unsupported/);
});
