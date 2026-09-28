import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { registerHooks } from "node:module";
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

const { getTemplateStaticRoot, readTemplateStaticFile } = await import("../lib/template-static.ts");
const assetsRoute = await import("../app/api/templates/[templateId]/assets/[...assetPath]/route.ts");

function stylesheetHref(html: string) {
  const tags = html.match(/<link\b[^>]*>/gi) ?? [];
  const tag = tags.find((item) => /\brel=["'][^"']*\bstylesheet\b/i.test(item));
  const href = tag?.match(/\bhref=["']([^"']+)["']/i)?.[1];
  assert.ok(href, "snapshot index must link a local stylesheet");
  assert.equal(href.startsWith("/"), true);
  return href;
}

function findSnapshotFile(root: string, filename: string) {
  const matches: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      if (entry === "node_modules" || entry === ".git") continue;
      const full = path.join(dir, entry);
      const details = statSync(full);
      if (details.isDirectory()) walk(full);
      else if (entry === filename) matches.push(full);
    }
  };
  walk(root);
  assert.equal(matches.length, 1, `expected one ${filename} under ${root}`);
  return matches[0];
}

test("dashboard hero does not hardcode a date or version stamp", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /08\.21/);
  assert.doesNotMatch(source, /Site studio/);
  assert.doesNotMatch(source, /\b\d{2}\.\d{2}\b/);
});

test("powerai stylesheet requested with the GitHub Pages base is the built css", async () => {
  const root = getTemplateStaticRoot("powerai");
  assert.ok(root);
  const html = readFileSync(path.join(root, "index.html"), "utf8");
  const href = stylesheetHref(html);
  assert.match(href, /^\/astro-genai-startup-theme\/_astro\/.+\.css$/);
  const filename = path.basename(href);
  const built = readFileSync(findSnapshotFile(root, filename));
  const served = await readTemplateStaticFile("powerai", href.slice(1).split("/"));
  assert.ok(served, `missing snapshot asset for ${href}`);
  assert.equal(served.contentType.startsWith("text/css"), true);
  assert.equal(Buffer.compare(served.body, built), 0);
});

test("astro-starter css serves fonts from the template asset route", async () => {
  const root = getTemplateStaticRoot("astro-starter");
  assert.ok(root);
  const html = readFileSync(path.join(root, "index.html"), "utf8");
  const href = stylesheetHref(html);
  const filename = path.basename(href.split("?")[0]);
  const built = readFileSync(findSnapshotFile(root, filename), "utf8");
  const fontPath = "/_astro/inter-latin-400-normal.C38fXH4l.woff2";
  assert.match(built, new RegExp(`url\\(${fontPath.replaceAll(".", "\\.")}\\)`));
  const served = await readTemplateStaticFile("astro-starter", href.slice(1).split("/"));
  assert.ok(served);
  const css = served.body.toString("utf8");
  assert.doesNotMatch(css, /url\(\/_astro\//);
  assert.match(css, /url\(\/api\/templates\/astro-starter\/assets\/_astro\/inter-latin-400-normal\.C38fXH4l\.woff2\)/);
});

test("astro-starter stylesheet link is CORS-enabled for the sandboxed preview frame", async () => {
  const page = await readTemplateStaticFile("astro-starter", ["index.html"]);
  assert.ok(page);
  const html = page.body.toString("utf8");
  const tags = html.match(/<link\b[^>]*>/gi) ?? [];
  const stylesheets = tags.filter((tag) => /\brel=["'][^"']*\bstylesheet\b/i.test(tag));
  assert.ok(stylesheets.length > 0);
  for (const tag of stylesheets) {
    assert.match(tag, /\bcrossorigin=["']anonymous["']/);
  }
});

test("template asset responses allow sandboxed preview font loads", async () => {
  const response = await assetsRoute.GET(
    new Request("http://127.0.0.1/api/templates/astro-starter/assets/_astro/inter-latin-400-normal.C38fXH4l.woff2"),
    { params: Promise.resolve({ templateId: "astro-starter", assetPath: ["_astro", "inter-latin-400-normal.C38fXH4l.woff2"] }) },
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("access-control-allow-origin"), "*");
  assert.equal(response.headers.get("content-type"), "font/woff2");
});
