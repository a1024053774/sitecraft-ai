import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { resolveWorkspaceEntry } from "../lib/workspace-entry.ts";

const repo = resolve(new URL("..", import.meta.url).pathname);
const lookTemplates = ["forge", "screwfast", "landwind", "tailwind-landing"];
const knownTemplates = [...lookTemplates, "fresh"];

test("AI 建站 opens the explicit new-site workspace flow", () => {
  assert.deepEqual(resolveWorkspaceEntry("?new=1", knownTemplates, lookTemplates), {
    kind: "create",
    templateId: "forge",
  });
  const sidebar = readFileSync(resolve(repo, "components/app-sidebar.tsx"), "utf8");
  assert.match(sidebar, /href: \"\/workspace\?new=1\"/);
  assert.doesNotMatch(sidebar, /href: \"\/templates\"/);
  const dashboard = readFileSync(resolve(repo, "app/(workspace)/page.tsx"), "utf8");
  assert.match(dashboard, /href=\"\/workspace\?new=1\"/);
  assert.doesNotMatch(dashboard, /href=\"\/templates\"/);
});

test("template gallery entry pages are retired while preview engine stays", () => {
  assert.equal(existsSync(resolve(repo, "app/(workspace)/templates/page.tsx")), false);
  assert.equal(existsSync(resolve(repo, "components/template-gallery.tsx")), false);
  assert.equal(existsSync(resolve(repo, "app/templates/[templateId]/preview/page.tsx")), false);
  assert.equal(existsSync(resolve(repo, "app/api/templates/[templateId]/preview/route.ts")), true);
  const frame = readFileSync(resolve(repo, "components/open-source-template-frame.tsx"), "utf8");
  assert.match(frame, /\/api\/templates\/\$\{encodeURIComponent\(templateId\)\}\/preview/);
});
