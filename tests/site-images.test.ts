import assert from "node:assert/strict";
import { readFile, rm } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  IMAGE_ID_PATTERN,
  inspectSiteImage,
  isOwnedSiteImageUrl,
  isTemplateStockUrl,
  listSiteImages,
  publicImagePayload,
  readSiteImage,
  saveSiteImage,
  SiteImageError,
  validateImageProvenance,
} from "../lib/site-images.ts";
import { imageFactsSchema, MISSING_FACT, parseImageFacts } from "../lib/image-facts.ts";

const ONE_BY_ONE_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=",
  "base64",
);

function pngWithSize(width: number, height: number, byteLength = 24) {
  const bytes = Buffer.alloc(Math.max(24, byteLength));
  bytes[0] = 0x89;
  bytes[1] = 0x50;
  bytes[2] = 0x4e;
  bytes[3] = 0x47;
  bytes[4] = 0x0d;
  bytes[5] = 0x0a;
  bytes[6] = 0x1a;
  bytes[7] = 0x0a;
  bytes.writeUInt32BE(13, 8);
  bytes.write("IHDR", 12);
  bytes.writeUInt32BE(width, 16);
  bytes.writeUInt32BE(height, 20);
  return bytes;
}

function jpegWithSize(width: number, height: number, byteLength = 32) {
  const bytes = Buffer.alloc(Math.max(20, byteLength));
  bytes[0] = 0xff;
  bytes[1] = 0xd8;
  bytes[2] = 0xff;
  bytes[3] = 0xc0;
  bytes.writeUInt16BE(11, 4);
  bytes[6] = 8;
  bytes.writeUInt16BE(height, 7);
  bytes.writeUInt16BE(width, 9);
  bytes[11] = 1;
  bytes[bytes.length - 2] = 0xff;
  bytes[bytes.length - 1] = 0xd9;
  return bytes;
}

const ownedId = "img_testownedimage0001";
const siteA = "p3img-a";
const siteB = "p3img-b";
const siteD = "p3img-dedupe";
const templateIds = new Set(["forge", "landwind", "screwfast"]);

test.after(async () => {
  await Promise.all([
    rm(path.join(process.cwd(), ".sitecraft-data", "uploads", process.env.DEFAULT_WORKSPACE_ID || "demo", siteA), { recursive: true, force: true }),
    rm(path.join(process.cwd(), ".sitecraft-data", "uploads", process.env.DEFAULT_WORKSPACE_ID || "demo", siteB), { recursive: true, force: true }),
    rm(path.join(process.cwd(), ".sitecraft-data", "uploads", process.env.DEFAULT_WORKSPACE_ID || "demo", siteD), { recursive: true, force: true }),
  ]);
});

test("magic bytes reject 1×1, HTML, and GIF; JPEG/PNG headers are enough to read size", () => {
  assert.throws(() => inspectSiteImage(ONE_BY_ONE_PNG, "upload"), (error: unknown) => {
    assert.equal(error instanceof SiteImageError, true);
    assert.equal(error instanceof SiteImageError && error.code, "too_small");
    assert.equal(error instanceof Error && error.message.includes("1×1"), true);
    return true;
  });
  assert.throws(() => inspectSiteImage(pngWithSize(1, 1, 400), "analyze"), (error: unknown) => {
    assert.equal(error instanceof Error && error.message.includes("1×1"), true);
    return true;
  });
  assert.throws(() => inspectSiteImage(Buffer.from("<html><img></html>"), "upload"), (error: unknown) => {
    assert.equal(error instanceof SiteImageError && error.code, "unsupported");
    return true;
  });
  assert.throws(() => inspectSiteImage(Buffer.from("GIF89a"), "upload"), (error: unknown) => {
    assert.equal(error instanceof SiteImageError && error.code, "unsupported");
    return true;
  });
  const jpeg = inspectSiteImage(jpegWithSize(640, 480, 1200), "upload");
  assert.equal(jpeg.mime, "image/jpeg");
  assert.equal(jpeg.width, 640);
  assert.equal(jpeg.height, 480);
  const png = inspectSiteImage(pngWithSize(96, 96, 200), "upload");
  assert.equal(png.mime, "image/png");
  assert.equal(png.width, 96);
});

test("template stock URLs cannot masquerade as customer images", () => {
  assert.equal(isTemplateStockUrl("./images/hero.png"), true);
  assert.equal(isTemplateStockUrl("/api/templates/landwind/assets/images/hero.png"), true);
  assert.equal(isTemplateStockUrl("/_astro/hero-image.DRPoHq2O_hcNvw.avif"), true);
  assert.equal(isTemplateStockUrl("https://flowbite.s3.amazonaws.com/blocks/marketing-ui/avatars/michael-gouch.png"), true);
  assert.equal(isTemplateStockUrl("/api/sites/p3img-a/images/img_testownedimage0001"), false);
  assert.equal(isOwnedSiteImageUrl("/api/sites/p3img-a/images/img_testownedimage0001", ownedId, siteA), true);
  assert.equal(isOwnedSiteImageUrl("/api/sites/p3img-b/images/img_testownedimage0001", ownedId, siteA), false);
  assert.equal(IMAGE_ID_PATTERN.test(ownedId), true);
  assert.equal(isOwnedSiteImageUrl("/api/templates/forge/assets/heroimg.webp", ownedId, siteA), false);
});

test("saved images are owned by site/workspace and cannot be read across sites", async () => {
  const saved = await saveSiteImage({
    siteId: siteA,
    bytes: pngWithSize(128, 96, 400),
    originalName: "gearbox-sim.png",
  });
  assert.equal(saved.siteId, siteA);
  assert.equal(saved.source, "user-upload");
  assert.equal(saved.license, "user-provided");
  assert.match(saved.sourceUrl, /^user-upload:\/\//);
  assert.equal(saved.licenseUrl, null);
  assert.equal(saved.author, "用户提供");
  assert.equal(saved.attribution, "用户提供；仅当前站点使用");
  assert.equal(saved.usageScope, "current-site-only");
  assert.match(saved.retrievedAt, /^20/);
  assert.match(saved.sha256, /^[a-f0-9]{64}$/);
  assert.equal(saved.width, 128);
  const listed = await listSiteImages(siteA);
  assert.equal(listed.some((item) => item.imageId === saved.imageId), true);
  const loaded = await readSiteImage(siteA, saved.imageId);
  assert.ok(loaded);
  assert.equal(loaded?.record.imageId, saved.imageId);
  const savedMetadata = JSON.parse(await readFile(path.join(process.cwd(), ".sitecraft-data", "uploads", process.env.DEFAULT_WORKSPACE_ID || "demo", siteA, `${saved.imageId}.json`), "utf8")) as Record<string, unknown>;
  assert.equal(savedMetadata.sha256, saved.sha256);
  assert.equal(await readSiteImage(siteB, saved.imageId), null);
  const payload = publicImagePayload(saved);
  assert.equal(payload.url, `/api/sites/${siteA}/images/${saved.imageId}`);
  assert.equal(payload.url.includes("vendor/"), false);
  assert.equal(payload.sha256, saved.sha256);
  assert.equal(payload.attribution, saved.attribution);
});

test("public-material provenance is mandatory before a non-user image can enter a customer site", async () => {
  const incomplete = {
    imageId: ownedId,
    siteId: siteA,
    workspaceId: process.env.DEFAULT_WORKSPACE_ID || "demo",
    mime: "image/png" as const,
    byteLength: 400,
    width: 128,
    height: 96,
    originalName: "public.png",
    source: "user-upload" as const,
    sourceUrl: "https://example.test/public.png",
    license: "CC BY" as const,
    licenseUrl: null,
    author: "",
    attribution: "",
    usageScope: "generated-sites" as const,
    retrievedAt: new Date().toISOString(),
    sha256: "0".repeat(64),
    createdAt: new Date().toISOString(),
  };
  assert.throws(() => validateImageProvenance(incomplete), /来源|licenseUrl|署名/);
  const saved = await saveSiteImage({
    siteId: siteA,
    bytes: pngWithSize(128, 96, 401),
    originalName: "cc0-product.png",
    provenance: {
      sourceUrl: "https://assets.example.test/cc0-product.png",
      license: "CC0",
      licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
      author: "Example Archive",
      attribution: "Example Archive / CC0",
      usageScope: "generated-sites",
      retrievedAt: "2026-09-22T00:00:00.000Z",
    },
  });
  assert.equal(saved.source, "public-material");
  assert.equal(saved.usageScope, "generated-sites");
  assert.equal(publicImagePayload(saved).licenseUrl, "https://creativecommons.org/publicdomain/zero/1.0/");
  await assert.rejects(
    () => saveSiteImage({
      siteId: siteA,
      bytes: pngWithSize(128, 96, 402),
      originalName: "code-license.png",
      provenance: {
        sourceUrl: "https://assets.example.test/code-license.png",
        license: "MIT",
        licenseUrl: "https://opensource.org/license/mit/",
        author: "Example",
        attribution: "Example / MIT",
        usageScope: "generated-sites",
        retrievedAt: "2026-09-22T00:00:00.000Z",
      },
    }),
    /SVG/
  );
});

test("public image records retain the manifest usage category for the preview bridge", async () => {
  const saved = await saveSiteImage({
    siteId: siteB,
    bytes: jpegWithSize(640, 480, 1200),
    originalName: "facility.jpg",
    provenance: {
      sourceUrl: "https://example.test/facility.jpg",
      license: "CC BY",
      licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
      author: "Example Author",
      attribution: "Example Author / CC BY",
      usageScope: "current-site-only",
      usageCategory: "facility",
      retrievedAt: "2026-10-04T00:00:00.000Z",
    },
  });
  assert.equal(saved.usageCategory, "facility");
  assert.equal(publicImagePayload(saved).usageCategory, "facility");
});

test("same-content uploads reuse the image id and update the latest usage category", async () => {
  const bytes = jpegWithSize(640, 480, 1200);
  const first = await saveSiteImage({ siteId: siteD, bytes, originalName: "facility.jpg", provenance: {
    sourceUrl: "https://example.test/facility.jpg", license: "CC0", licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/", author: "Example", attribution: "Example / CC0", usageScope: "current-site-only", usageCategory: "facility", retrievedAt: "2026-10-04T00:00:00.000Z",
  } });
  const second = await saveSiteImage({ siteId: siteD, bytes, originalName: "product.jpg", provenance: {
    sourceUrl: "https://example.test/product.jpg", license: "CC0", licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/", author: "Example", attribution: "Example / CC0", usageScope: "current-site-only", usageCategory: "product", retrievedAt: "2026-10-04T00:00:01.000Z",
  } });
  assert.equal(second.imageId, first.imageId);
  assert.equal(second.usageCategory, "product");
  assert.equal((await listSiteImages(siteD)).length, 1);
});

test("image facts schema keeps 待补充, drops CSS/HTML/operations, and is not an edit intent", () => {
  const parsed = imageFactsSchema.safeParse({
    type: "image_facts",
    visibleText: ["P3IMG-HX4K"],
    name: { zh: MISSING_FACT, en: MISSING_FACT },
    sellingPoints: { zh: [], en: [] },
    category: MISSING_FACT,
    alt: { zh: "灰色金属壳体", en: "Gray metal housing" },
    missingFacts: ["价格", "认证", "产能"],
    operations: [{ op: "set_html", value: "<img>" }],
    css: "body{display:none}",
  });
  assert.equal(parsed.success, true);
  if (!parsed.success) throw new Error("expected facts");
  assert.equal(parsed.data.name.zh, MISSING_FACT);
  assert.deepEqual(parsed.data.missingFacts, ["价格", "认证", "产能"]);
  assert.equal("operations" in parsed.data, false);
  assert.equal("css" in parsed.data, false);
  assert.equal(parseImageFacts(JSON.stringify({
    type: "edit",
    summary: "改草稿",
    operations: [{ op: "set_text", target: "hero.title", locale: "zh", value: "x" }],
  })).data, null);
});
