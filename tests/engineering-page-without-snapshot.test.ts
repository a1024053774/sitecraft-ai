import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { registerHooks } from "node:module";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

// T-053 step 5: the engineering look's page is composed from lib/blocks, so it needs nothing from the
// vendor ScrewFast snapshot (vendor/open-source-templates/screwfast/dist, a build output inside the
// submodule). Without that snapshot the preview route still serves the page and the look can still
// start a site; the snapshot's own pages and assets are not served for this look. The old screwfast
// overlay is deleted and nothing refers to it. The submodule and the template's reference entry stay.

const REPO_ROOT = process.cwd();
const OVERLAY_ROOT = path.join(REPO_ROOT, "lib", "template-adapters", "overlays");
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (!specifier.startsWith("@/")) return nextResolve(specifier, context);
    const abs = path.join(REPO_ROOT, specifier.slice(2));
    let file = abs;
    if (existsSync(`${abs}.ts`)) file = `${abs}.ts`;
    else if (existsSync(path.join(abs, "index.ts"))) file = path.join(abs, "index.ts");
    return nextResolve(pathToFileURL(file).href, context);
  },
});
const { getTemplateStaticRoot, readTemplateStaticFile } = await import("../lib/template-static.ts");
const { getTemplateReadiness } = await import("../lib/template-readiness.ts");
const { composedPageForTemplate } = await import("../lib/blocks/compose.ts");
const { getTemplate } = await import("../lib/site-model.ts");
const previewRoute = await import(pathToFileURL(path.join(REPO_ROOT, "app/api/templates/[templateId]/preview/route.ts")).href) as {
  GET: (request: Request, context: { params: Promise<{ templateId: string }> }) => Promise<Response>;
};

// Runs with the working directory at an empty folder: no vendor snapshots, no overlays.
async function withoutSnapshots(run: () => Promise<void>) {
  const tempRoot = mkdtempSync(path.join(REPO_ROOT, "artifacts", "t053-no-snapshot-"));
  const previous = process.cwd();
  try {
    process.chdir(tempRoot);
    await run();
  } finally {
    process.chdir(previous);
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

test("without the vendor snapshot the engineering page is still served and can start a site", async () => {
  await withoutSnapshots(async () => {
    assert.equal(getTemplateStaticRoot("screwfast"), null, "no snapshot in this folder");
    const composed = composedPageForTemplate("screwfast");
    assert.ok(composed);
    for (const segments of [[], ["index.html"]]) {
      const served = await readTemplateStaticFile("screwfast", segments);
      assert.ok(served, `root index ${JSON.stringify(segments)} is served`);
      assert.equal(served.contentType, "text/html; charset=utf-8");
      assert.equal(served.body.toString("utf8"), composed);
    }
    const readiness = getTemplateReadiness("screwfast");
    assert.equal(readiness.canEnterEditPreview, true, "the look can start a site");
    assert.equal(readiness.hasLocalSnapshot, true, "the gallery shows its local page");
    const response = await previewRoute.GET(new Request("http://sitecraft.test/api/templates/screwfast/preview"), { params: Promise.resolve({ templateId: "screwfast" }) });
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /data-sc-block="hero"/);
    assert.match(html, /__sitecraftApplyDeclared/);
    const bright = composedPageForTemplate("forge");
    assert.ok(bright, "the bright look is also composed");
    const brightServed = await readTemplateStaticFile("forge", []);
    assert.ok(brightServed);
    assert.match(brightServed.body.toString("utf8"), /data-sc-block="hero"/);
    assert.equal(getTemplateReadiness("forge").canEnterEditPreview, true);
  });
});

test("the bright product page no longer ships the retired forge overlay", () => {
  assert.equal(existsSync(path.join(OVERLAY_ROOT, "forge.index.html")), false);
});

test("the blue-white catalog page no longer ships the retired landwind overlay", () => {
  assert.equal(existsSync(path.join(OVERLAY_ROOT, "landwind.index.html")), false);
});

test("the grey short-path page no longer ships or references an overlay", () => {
  assert.equal(existsSync(path.join(OVERLAY_ROOT, "tailwind-landing.index.html")), false);
  const sources: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const file = path.join(dir, name);
      if (statSync(file).isDirectory()) walk(file);
      else if (/\.(ts|tsx|mjs|js|html)$/.test(name)) sources.push(file);
    }
  };
  for (const dir of ["lib", "app", "components", "scripts"]) walk(path.join(REPO_ROOT, dir));
  for (const file of [...sources, path.join(REPO_ROOT, "Dockerfile")]) {
    assert.equal(readFileSync(file, "utf8").includes(["overlays", "tailwind-landing"].join("/")), false, path.relative(REPO_ROOT, file));
  }
});

test("the snapshot's own pages and assets are not served for the engineering look", async () => {
  const root = getTemplateStaticRoot("screwfast");
  if (root) {
    // In this workspace the snapshot is built: its subpages and files exist, and are not served.
    const subpage = readdirSync(root).find((name) => statSync(path.join(root, name)).isDirectory() && existsSync(path.join(root, name, "index.html")));
    assert.ok(subpage, "the snapshot has a subpage");
    assert.equal(await readTemplateStaticFile("screwfast", [subpage]), null, `snapshot page ${subpage}`);
    assert.ok(existsSync(path.join(root, "favicon.ico")));
    assert.equal(await readTemplateStaticFile("screwfast", ["favicon.ico"]), null, "snapshot asset");
  }
  await withoutSnapshots(async () => {
    assert.equal(await readTemplateStaticFile("screwfast", ["products"]), null);
  });
});

test("the old screwfast overlay is gone and nothing refers to it; the submodule and the reference entry stay", () => {
  assert.equal(existsSync(path.join(OVERLAY_ROOT, "screwfast.index.html")), false);
  const sources: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const file = path.join(dir, name);
      if (statSync(file).isDirectory()) walk(file);
      else if (/\.(ts|tsx|mjs|js|html)$/.test(name)) sources.push(file);
    }
  };
  for (const dir of ["lib", "app", "components", "scripts"]) walk(path.join(REPO_ROOT, dir));
  for (const file of [...sources, path.join(REPO_ROOT, "Dockerfile")]) {
    assert.equal(readFileSync(file, "utf8").includes(["overlays", "screwfast"].join("/")), false, path.relative(REPO_ROOT, file));
  }
  const template = getTemplate("screwfast");
  assert.equal(template.id, "screwfast", "the template entry stays");
  assert.equal(template.source.localPath, "vendor/open-source-templates/screwfast");
  assert.match(readFileSync(path.join(REPO_ROOT, ".gitmodules"), "utf8"), /vendor\/open-source-templates\/screwfast/, "the submodule stays");
});
