import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { registerHooks } from "node:module";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

const REPO_ROOT = process.cwd();

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

const { getTemplateStaticRoot, isSpaShellHtml, isUsableStaticHtml } = await import("../lib/template-static.ts");
const { getTemplate } = await import("../lib/site-model.ts");

type SnapshotHtmlOracle = {
  isSpaShellHtml: (html: string) => boolean;
  isUsableStaticHtml: (html: string) => boolean;
};

// CLI script has no .d.ts; keep the runtime import so loader and snapshot builder stay aligned.
// @ts-expect-error no declaration file for the snapshot CLI .mjs
const snapshotScript = (await import("../scripts/build-template-snapshots.mjs")) as SnapshotHtmlOracle;

const spaShell = `<!doctype html>
<html>
  <head><title>SPA</title></head>
  <body>
    <div id="root"></div>
    <script type="module" src="/assets/index-abc.js"></script>
  </body>
</html>`;

const renderedPage = `<!doctype html>
<html>
  <head>
    <title>Factory</title>
    <link rel="stylesheet" href="/assets/app.css">
  </head>
  <body>
    <h1>Precision fasteners for export</h1>
    <p>A fully rendered static snapshot with real content for local preview.</p>
  </body>
</html>`;

const titleOnly = `<!doctype html>
<html>
  <head><title>A reasonably long document title that must not count as a rendered page</title></head>
  <body></body>
</html>`;

const commentedHeading = `<!doctype html>
<html>
  <head><title>SPA</title></head>
  <body>
    <!-- <h1>Precision fasteners for export</h1>
         <p>A fully rendered static snapshot with real content for local preview.</p> -->
    <div id="root"></div>
    <script type="module" src="/assets/index-abc.js"></script>
  </body>
</html>`;

function localPath(id: string) {
  const template = getTemplate(id);
  assert.equal(template.id, id, `catalog must resolve ${id}`);
  return template.source.localPath;
}

function writeIndex(tempRoot: string, id: string, rel: string, html: string) {
  const file = path.join(tempRoot, localPath(id), rel);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, html);
}

function withTempCwd(setup: (tempRoot: string) => void, run: (tempRoot: string) => void) {
  const tempRoot = mkdtempSync(path.join(os.tmpdir(), "sitecraft-static-"));
  const previous = process.cwd();
  try {
    setup(tempRoot);
    process.chdir(tempRoot);
    run(tempRoot);
  } finally {
    process.chdir(previous);
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

function legacyDistFirstRoot(sourceRoot: string) {
  const distRoot = path.join(sourceRoot, "dist");
  if (existsSync(path.join(distRoot, "index.html"))) return distRoot;
  if (existsSync(path.join(sourceRoot, "index.html"))) return sourceRoot;
  return null;
}

test("SPA shell, title-only, and commented HTML are not usable snapshots", () => {
  assert.equal(isSpaShellHtml(spaShell), true);
  assert.equal(isUsableStaticHtml(spaShell), false);
  assert.equal(isUsableStaticHtml(titleOnly), false);
  assert.equal(isUsableStaticHtml(commentedHeading), false);
  assert.equal(isSpaShellHtml(renderedPage), false);
  assert.equal(isUsableStaticHtml(renderedPage), true);
});

test("loader and snapshot script agree on usable-html decisions", () => {
  for (const html of [spaShell, renderedPage, titleOnly, commentedHeading]) {
    assert.equal(snapshotScript.isSpaShellHtml(html), isSpaShellHtml(html));
    assert.equal(snapshotScript.isUsableStaticHtml(html), isUsableStaticHtml(html));
  }
});

test("isolated fixture: SPA dist shell is rejected by loader; legacy dist-first would accept it", () => {
  withTempCwd(
    (tempRoot) => {
      writeIndex(tempRoot, "shadcn-landing", path.join("dist", "index.html"), spaShell);
    },
    () => {
      const source = path.resolve(localPath("shadcn-landing"));
      const dist = path.join(source, "dist");
      assert.equal(legacyDistFirstRoot(source), dist);
      assert.equal(getTemplateStaticRoot("shadcn-landing"), null);
    },
  );
});

test("isolated fixture: usable fully rendered dist is recognized for spa-bundle id", () => {
  withTempCwd(
    (tempRoot) => {
      writeIndex(tempRoot, "shadcn-landing", path.join("dist", "index.html"), renderedPage);
    },
    () => {
      assert.equal(getTemplateStaticRoot("shadcn-landing"), path.resolve(localPath("shadcn-landing"), "dist"));
    },
  );
});

test("isolated fixture: rendered out/index.html is recognized; legacy dist-first misses it", () => {
  withTempCwd(
    (tempRoot) => {
      writeIndex(tempRoot, "nextjs-landing", path.join("out", "index.html"), renderedPage);
    },
    () => {
      const source = path.resolve(localPath("nextjs-landing"));
      const out = path.join(source, "out");
      assert.equal(legacyDistFirstRoot(source), null);
      assert.equal(getTemplateStaticRoot("nextjs-landing"), out);
    },
  );
});

test("isolated fixture: rendered source HTML is a static snapshot", () => {
  withTempCwd(
    (tempRoot) => {
      writeIndex(tempRoot, "tailwind-landing", "index.html", renderedPage);
    },
    () => {
      assert.equal(getTemplateStaticRoot("tailwind-landing"), path.resolve(localPath("tailwind-landing")));
    },
  );
});

test("isolated fixture: spa-bundle without rendered snapshot is not readable", () => {
  withTempCwd(
    (tempRoot) => {
      mkdirSync(path.join(tempRoot, localPath("shadcn-landing")), { recursive: true });
    },
    () => {
      assert.equal(getTemplateStaticRoot("shadcn-landing"), null);
    },
  );
});
