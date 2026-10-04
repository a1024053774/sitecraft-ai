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
  const source = await readFile(new URL("../app/(workspace)/workspace/page.tsx", import.meta.url), "utf8");
  assert.match(source, /resolveWorkspaceEntry\(/);
  assert.match(source, /fetch\("\/api\/sites",\s*\{\s*method:\s*"POST"/);
  assert.match(source, /history\.replaceState\([^)]*workspaceUrlForSite\(/);
  // The old path switched the requested template onto whatever site was open (the shared demo).
  assert.doesNotMatch(source, /requestedTemplate/);
  // T-044: only look templates create a site; others are explained and nothing is created.
  assert.match(source, /resolveWorkspaceEntry\([\s\S]{0,160}visualBriefCatalog\.map\(\(brief\) => brief\.templateId\)\)/);
  assert.match(source, /entry\.kind === "refuse"[\s\S]{0,200}只作参考，不能直接生成网站/);
});

// grok-b's T-036 review: the in-flight creation was kept for the whole page session, so a second
// 新建站点 with the same template (client-side navigation, no reload) reopened the first site.
test("two effect runs of one entry share a single creation", async () => {
  const { createSiteOnce } = await import("../lib/workspace-entry.ts");
  let calls = 0;
  let release: (id: string) => void = () => {};
  const create = () => { calls += 1; return new Promise<string>((resolve) => { release = resolve; }); };
  const first = createSiteOnce("?template=landwind", create);
  const second = createSiteOnce("?template=landwind", create);
  release("site-a");
  assert.deepEqual(await Promise.all([first, second]), ["site-a", "site-a"]);
  assert.equal(calls, 1);
});

test("a later 新建站点 with the same template creates another site", async () => {
  const { createSiteOnce } = await import("../lib/workspace-entry.ts");
  let n = 0;
  const create = async () => `site-${++n}`;
  assert.equal(await createSiteOnce("?template=screwfast", create), "site-1");
  assert.equal(await createSiteOnce("?template=screwfast", create), "site-2");
});

test("a failed creation can be retried", async () => {
  const { createSiteOnce } = await import("../lib/workspace-entry.ts");
  await assert.rejects(createSiteOnce("?template=forge", async () => { throw new Error("down"); }));
  assert.equal(await createSiteOnce("?template=forge", async () => "site-ok"), "site-ok");
});

test("a template that is not behind one of the looks is refused, not created or opened", () => {
  const catalog = [...known, "astrogent", "atlas"];
  assert.deepEqual(resolveWorkspaceEntry("?template=astrogent", catalog, known), { kind: "refuse", templateId: "astrogent" });
  assert.deepEqual(resolveWorkspaceEntry("?template=screwfast", catalog, known), { kind: "create", templateId: "screwfast" });
  assert.deepEqual(resolveWorkspaceEntry("?template=not-a-template", catalog, known), { kind: "open", siteId: "demo" });
});
