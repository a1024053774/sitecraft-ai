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
const { prepareHtml } = await import("../app/api/templates/[templateId]/preview/route.ts");

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
  const source = await readFile(new URL("../app/(workspace)/page.tsx", import.meta.url), "utf8");
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

test("local preview rewrites every srcset candidate, inline image, and inline font onto the asset route", () => {
  const html = [
    '<img src="/_astro/hero-image.DwIC_L_T_Z1bMl6O.webp" srcset="/_astro/hero-image.DwIC_L_T_Hcxl8.webp 400w, /_astro/hero-image.DwIC_L_T_1xrKIH.webp 768w">',
    '<source srcset="/assets/images/home/screenshots/landing-1.webp" type="image/webp">',
    '<img src="/_astro/astronaut.B8IC2jL3_jwrcE.webp" srcset="/_astro/astronaut.B8IC2jL3_ZmKNbP.webp 450w, /_astro/astronaut.B8IC2jL3_Z1pTs8N.webp 900w">',
    '<div style="background-image: url(/assets/stack/astro.jpg)"></div>',
    '<div style="background-image:url(/_astro/cta-dark-bg.h-w07icx.webp)"></div>',
    '<div style="background-image:url(/_astro/testimonial-bg-01.CofysqBI.webp)"></div>',
    '<style>@font-face{font-family:Heebo;src:url("/_astro/fonts/3827da0b0bf6b4db.woff2") format("woff2")}</style>',
    '<style>@font-face{font-family:Signika;src:url("/_astro/fonts/aef5e683e5734387.woff2") format("woff2")}</style>',
    '<style>@font-face{font-family:Inter;src:url("/_astro/fonts/5288773a5a229461.woff2") format("woff2")}</style>',
    '<link rel="preload" href="/_astro/fonts/5288773a5a229461.woff2" as="font" type="font/woff2" crossorigin>',
  ].join("");
  const preview = prepareHtml(html, "https://example.test/", "lonestone", true);
  assert.equal(preview.includes("/_astro/api/templates/"), false);
  assert.equal(preview.includes("/screenshots/api/templates/"), false);
  for (const path of [
    "_astro/hero-image.DwIC_L_T_Hcxl8.webp",
    "_astro/hero-image.DwIC_L_T_1xrKIH.webp",
    "assets/images/home/screenshots/landing-1.webp",
    "_astro/astronaut.B8IC2jL3_ZmKNbP.webp",
    "_astro/astronaut.B8IC2jL3_Z1pTs8N.webp",
    "assets/stack/astro.jpg",
    "_astro/cta-dark-bg.h-w07icx.webp",
    "_astro/testimonial-bg-01.CofysqBI.webp",
    "_astro/fonts/3827da0b0bf6b4db.woff2",
    "_astro/fonts/aef5e683e5734387.woff2",
    "_astro/fonts/5288773a5a229461.woff2",
  ]) {
    assert.equal(preview.includes(`/api/templates/lonestone/assets/${path}`), true, path);
    assert.equal(preview.includes(`"${path}"`) || preview.includes(`/${path}`) && !preview.includes(`/api/templates/lonestone/assets/${path}`), false);
  }
  assert.equal(preview.includes('url("/_astro/fonts/'), false);
  assert.equal(preview.includes("url(/assets/stack/"), false);
  assert.equal(preview.includes("url(/_astro/cta-dark-bg"), false);
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
