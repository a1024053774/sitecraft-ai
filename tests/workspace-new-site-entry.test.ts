import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { resolveWorkspaceEntry, workspaceUrlForSite } from "../lib/workspace-entry.ts";

// T-036: the 新建站点 entry (/workspace?template=X) creates a new site instead of opening the shared
// demo site and switching its template.

const known = ["forge", "screwfast", "landwind", "tailwind-landing"];

test("a template without a site creates a new site", () => {
  assert.deepEqual(resolveWorkspaceEntry("?template=screwfast", known), { kind: "create", templateId: "screwfast" });
});

test("an explicit site always opens that site, even with a template", () => {
  assert.deepEqual(resolveWorkspaceEntry("?site=abc-123&template=screwfast", known), { kind: "open", siteId: "abc-123" });
});

test("unknown templates and bad site ids fall back to the default site", () => {
  assert.deepEqual(resolveWorkspaceEntry("?template=not-a-template", known), { kind: "open", siteId: "demo" });
  assert.deepEqual(resolveWorkspaceEntry("?site=../etc/passwd", known), { kind: "open", siteId: "demo" });
  assert.deepEqual(resolveWorkspaceEntry("", known), { kind: "open", siteId: "demo" });
});

test("after creating, the URL names the new site so a refresh does not create another", () => {
  const url = workspaceUrlForSite("?template=screwfast&page=home", "new-site-1");
  const params = new URL(url, "http://localhost").searchParams;
  assert.equal(params.get("site"), "new-site-1");
  assert.equal(params.get("template"), null);
  assert.equal(params.get("page"), "home");
  assert.deepEqual(resolveWorkspaceEntry(new URL(url, "http://localhost").search, known), { kind: "open", siteId: "new-site-1" });
});

test("the workspace creates the site through POST /api/sites and never rewrites another site's template", async () => {
  const source = await readFile(new URL("../app/workspace/page.tsx", import.meta.url), "utf8");
  assert.match(source, /resolveWorkspaceEntry\(/);
  assert.match(source, /fetch\("\/api\/sites",\s*\{\s*method:\s*"POST"/);
  assert.match(source, /history\.replaceState\([^)]*workspaceUrlForSite\(/);
  // The old path switched the requested template onto whatever site was open (the shared demo).
  assert.doesNotMatch(source, /requestedTemplate/);
});
