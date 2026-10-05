import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { resolveWorkspaceEntry, workspaceUrlForSite } from "../lib/workspace-entry.ts";

// T-105: the only 新建站点 entry is /workspace?new=1; legacy template URLs must not create sites.

const known = ["forge", "screwfast", "landwind", "tailwind-landing"];

test("a legacy template URL refuses instead of creating a site", () => {
  assert.deepEqual(resolveWorkspaceEntry("?template=screwfast", known), { kind: "refuse", templateId: "screwfast" });
});

test("the explicit new-site entry creates the seed site", () => {
  assert.deepEqual(resolveWorkspaceEntry("?new=1", known), { kind: "create", templateId: "forge" });
});

test("an explicit site always opens that site, even with a template", () => {
  assert.deepEqual(resolveWorkspaceEntry("?site=abc-123&template=screwfast", known), { kind: "open", siteId: "abc-123" });
});

test("unknown legacy templates refuse, while bad site ids fall back to the default site", () => {
  assert.deepEqual(resolveWorkspaceEntry("?template=not-a-template", known), { kind: "refuse", templateId: "not-a-template" });
  assert.deepEqual(resolveWorkspaceEntry("?site=../etc/passwd", known), { kind: "open", siteId: "demo" });
  assert.deepEqual(resolveWorkspaceEntry("", known), { kind: "open", siteId: "demo" });
});

test("after creating, the URL names the new site so a refresh does not create another", () => {
  const url = workspaceUrlForSite("?new=1&page=home", "new-site-1");
  const params = new URL(url, "http://localhost").searchParams;
  assert.equal(params.get("site"), "new-site-1");
  assert.equal(params.get("new"), "1");
  assert.equal(params.get("page"), "home");
  assert.deepEqual(resolveWorkspaceEntry(new URL(url, "http://localhost").search, known), { kind: "open", siteId: "new-site-1" });
});

test("the workspace creates the site through POST /api/sites and never rewrites another site's template", async () => {
  const source = await readFile(new URL("../app/(workspace)/workspace/page.tsx", import.meta.url), "utf8");
  assert.match(source, /resolveWorkspaceEntry\(/);
  assert.match(source, /fetch\("\/api\/sites",\s*\{\s*method:\s*"POST"/);
  assert.match(source, /history\.replaceState\([^)]*workspaceUrlForSite\(/);
  // The old path switched the requested template onto whatever site was open (the shared demo).
  assert.doesNotMatch(source, /requestedTemplate/);
  // T-105: the explicit new-site entry is the only create path; legacy template URLs are explained.
  assert.match(source, /resolveWorkspaceEntry\([\s\S]{0,160}visualBriefCatalog\.map\(\(brief\) => brief\.templateId\)\)/);
  assert.match(source, /entry\.kind === "refuse"[\s\S]{0,220}旧模板建站入口已下线/);
});

// grok-b's T-036 review: the in-flight creation was kept for the whole page session, so a second
// 新建站点 with the same template (client-side navigation, no reload) reopened the first site.
test("two effect runs of one entry share a single creation", async () => {
  const { createSiteOnce } = await import("../lib/workspace-entry.ts");
  let calls = 0;
  let release: (id: string) => void = () => {};
  const create = () => { calls += 1; return new Promise<string>((resolve) => { release = resolve; }); };
  const first = createSiteOnce("?new=1", create);
  const second = createSiteOnce("?new=1", create);
  release("site-a");
  assert.deepEqual(await Promise.all([first, second]), ["site-a", "site-a"]);
  assert.equal(calls, 1);
});

test("a later 新建站点 with the same template creates another site", async () => {
  const { createSiteOnce } = await import("../lib/workspace-entry.ts");
  let n = 0;
  const create = async () => `site-${++n}`;
  assert.equal(await createSiteOnce("?new=1", create), "site-1");
  assert.equal(await createSiteOnce("?new=1", create), "site-2");
});

test("a failed creation can be retried", async () => {
  const { createSiteOnce } = await import("../lib/workspace-entry.ts");
  await assert.rejects(createSiteOnce("?new=1", async () => { throw new Error("down"); }));
  assert.equal(await createSiteOnce("?new=1", async () => "site-ok"), "site-ok");
});

test("a template that is not behind one of the looks is refused, not created or opened", () => {
  const catalog = [...known, "astrogent", "atlas"];
  assert.deepEqual(resolveWorkspaceEntry("?template=astrogent", catalog, known), { kind: "refuse", templateId: "astrogent" });
  assert.deepEqual(resolveWorkspaceEntry("?template=screwfast", catalog, known), { kind: "refuse", templateId: "screwfast" });
  assert.deepEqual(resolveWorkspaceEntry("?template=not-a-template", catalog, known), { kind: "refuse", templateId: "not-a-template" });
});
