import assert from "node:assert/strict";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { openBrowser, closeBrowser, base, waitForPreviewBridge } from "./helpers/workspace-browser.ts";

const source = readFileSync("scripts/check-published.mjs", "utf8");
const start = source.indexOf("function judge(");
const end = source.indexOf("\n  return failures;\n}", start) + "\n  return failures;\n}".length;
assert.ok(start >= 0 && end > start);
const judge = new Function("missingFacts", "TEXT_FIT_FAILURES", "FORBIDDEN_TEXT", `${source.slice(start, end)}; return judge;`)(() => [], [], []);
const report = () => ({
  measurement: { visibleBlocks: ["hero"], measuredBlocks: ["hero"], textContrastEntries: 2, bodyParagraphs: 1 },
  editorCursor: "", editorHoverOutline: false, horizontalScroll: false, cardOverflow: 0,
  heroOrphan: false, heroTitleWordBreak: false, englishSpecValueHan: [], numbering: 0, phoneNav: true,
  contactVisible: true, formVisible: true, ctaTargetVisible: true, ctaLandsOnForm: true,
  broken: [], photoCount: 5, saysSchematicOnly: false, text: "", readable: "",
});
const image = (extra = {}) => ({ imageId: "img_inspection", originalName: "inspection.jpg", category: "inspection", expectedSections: ["capabilities"], exempt: false, matches: [], ...extra });
const coverage = (images: unknown[]) => ({ expectedCount: images.length, inspectedCount: images.length, images });

test("T-109 published check fails without a verifiable uploaded-image coverage report", () => {
  assert.ok(judge(report(), []).some((x: string) => x.includes("image coverage incomplete")));
});

test("T-109 published check rejects an invisible uploaded photo even when photoCount is positive", () => {
  const failures = judge({ ...report(), imageCoverage: coverage([image({ matches: [{visible:false,decoded:true,section:"capabilities",category:"inspection"}] })]) }, []);
  assert.ok(failures.some((x: string) => x.includes("img_inspection") && x.includes("visible")), failures.join("; "));
});

test("T-109 published check requires decode and the declared category destination", () => {
  for (const match of [
    {visible:true,decoded:false,section:"capabilities",category:"inspection"},
    {visible:true,decoded:true,section:"products",category:"product"},
  ]) {
    const failures = judge({ ...report(), imageCoverage: coverage([image({matches:[match]})]) }, []);
    assert.ok(failures.some((x: string) => x.includes("img_inspection")), failures.join("; "));
  }
});

test("T-109 published check exempts user-hidden images but rejects visible photos in that exemption", () => {
  const hidden = image({exempt:true,exemptionReason:"hiddenSections:capabilities",matches:[]});
  assert.deepEqual(judge({ ...report(), imageCoverage: coverage([hidden]) }, []), []);
  const leaked = {...hidden,matches:[{visible:true,decoded:true,section:"capabilities",category:"inspection"}]};
  assert.ok(judge({ ...report(), imageCoverage: coverage([leaked]) }, []).some((x: string) => x.includes("explicitly hidden")));
});

test("T-109 real published collector exempts only actual hidden product placements and detects a real decode failure", async () => {
  const scans = ["visitor-text-fit-scan.js", "hero-word-break-scan.js", "visitor-layout-scan.js", "visitor-readable-text.js"].map(file => readFileSync(`scripts/${file}`, "utf8").replace(/export default scanVisitorLayout;?/g, "").replace(/export function scanVisitorLayout/g, "function scanVisitorLayout"));
  const inspect = new Function("TEXT_FIT_SCAN", "HERO_WORD_BREAK_SCAN", "VISITOR_LAYOUT_SCAN", "READABLE_TEXT", source.slice(source.indexOf("const INSPECT ="), source.indexOf("\nfunction judge(")) + ";return INSPECT;")(...scans);
  const output = process.env.T109_EVIDENCE_DIR || `artifacts/t109/image-collector-${Date.now()}-${process.pid}`;
  mkdirSync(output, { recursive: true });
  const observations: unknown[] = [];
  const browser = await openBrowser();
  const { targetId } = await browser.send("Target.createTarget", { url: "about:blank" }) as { targetId: string };
  const { sessionId } = await browser.send("Target.attachToTarget", { targetId, flatten: true }) as { sessionId: string };
  const request = async (url: string, method: string, body?: unknown) => {
    const response = await fetch(`${base}${url}`, { method, ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}) });
    assert.ok(response.ok, `${method} ${url}: ${response.status}`);
    return response.json();
  };
  try {
    await browser.send("Page.enable", {}, sessionId);
    await browser.send("Runtime.enable", {}, sessionId);
    const reuseId = process.env.T109_COLLECTOR_SITE;
    const created = reuseId
      ? { id: reuseId, ...await request(`/api/sites/${reuseId}/draft`, "GET") }
      : await request("/api/sites", "POST", { name: "T-109 real collector product references", templateId: "screwfast", locales: ["zh", "en"] });
    const siteId = created.id;
    const manifest = JSON.parse(readFileSync("tests/fixtures/company-images/molding/manifest.json", "utf8"));
    // This scenario uses the original two photos to distinguish hero and product
    // placements; a growing materials catalog must not add scenario inputs.
    const photos = ["product-injection-molded-parts.jpg", "product-injection-mold.jpg"].map(file => {
      const photo = manifest.images.find((image: { file: string }) => image.file === file);
      assert.ok(photo, `missing collector scenario photo: ${file}`);
      return photo;
    });
    const images: Array<{ imageId: string; url: string; originalName: string; credit?: { zh: string; en: string } }> = reuseId ? (await request(`/api/sites/${siteId}/images`, "GET")).images.sort((a: { originalName: string }, b: { originalName: string }) => photos.findIndex((photo: { file: string }) => photo.file === a.originalName) - photos.findIndex((photo: { file: string }) => photo.file === b.originalName)) : [];
    for (const photo of reuseId ? [] : photos) {
      const form = new FormData();
      form.append("file", new Blob([new Uint8Array(readFileSync(`tests/fixtures/company-images/molding/${photo.file}`))], { type: "image/jpeg" }), photo.file);
      for (const [key, value] of Object.entries({ license: photo.apiLicense, sourceUrl: photo.sourceUrl, licenseUrl: photo.licenseUrl, author: photo.author, attribution: photo.attribution, usageScope: "current-site-only", usageCategory: "product", retrievedAt: photo.downloadedAt })) form.set(key, String(value));
      const response = await fetch(`${base}/api/sites/${siteId}/images`, { method: "POST", body: form });
      assert.equal(response.status, 201);
      images.push((await response.json()).image);
    }
    assert.equal(images.length, 2, "the scenario supplies two distinct product photos");
    const products = images.map((image, index) => ({ id: `part-${index}`, sku: `PART-${index}`, name: { zh: `工件 ${index + 1}`, en: `Part ${index + 1}` }, summary: { zh: "按图加工", en: "Machined to drawing" }, category: { zh: "工件", en: "Parts" }, status: "published", imageColor: "#e6e1cf", specs: [] }));
    let current = await request(`/api/sites/${siteId}/draft`, "PUT", {
      baseRevision: created.draft.revision,
      operations: [{ op: "set_section_visibility", section: "products", visible: true }, { op: "replace_products", products }, ...images.map((image, index) => ({ op: "set_product_image", productId: products[index].id, imageId: image.imageId, url: image.url, alt: { zh: "工件照片", en: "Part photo" }, credit: image.credit }))],
      summary: "T-109 两张产品引用与显式隐藏回归", source: "manual",
    });
    assert.ok(["applied", "no_change"].includes(current.status), "preparing an already supplied scenario may be a no-op");
    assert.equal(current.rejected?.length || 0, 0);
    assert.equal(current.draft.hiddenSections.includes("products"), false);
    await browser.send("Page.navigate", { url: `${base}/api/templates/screwfast/preview?t109-collector=${Date.now()}` }, sessionId);
    await waitForPreviewBridge(browser, sessionId, 30000, "T-109 real image collector");
    const collect = async (stage: string, inventory = images) => {
      await browser.eval(`window.__sitecraftApplyDeclared(${JSON.stringify(current.draft)},"en",[],"published",null,true,${JSON.stringify(images)})`, sessionId);
      if (stage === "invalid-decode") {
        await browser.eval(`document.querySelector('[data-sitecraft-slot="products.part-1.image"]').src=${JSON.stringify(inventory[1].url)}`, sessionId);
      }
      const observed = await browser.eval<{ imageCoverage: { images: Array<{ imageId: string; expectedSections: string[]; exempt: boolean; matches: Array<{ visible: boolean; decoded: boolean }> }> } }>(`${inspect}(${JSON.stringify(inventory)},${JSON.stringify(current.draft)})`, sessionId);
      const failures = judge(observed, []).filter((failure: string) => /image|photo/.test(failure));
      observations.push({ siteId, stage, report: observed, failures });
      return { observed, failures };
    };
    assert.deepEqual((await collect("shown")).failures, []);
    current = await request(`/api/sites/${siteId}/draft`, "PUT", { baseRevision: current.draft.revision, operations: [{ op: "set_section_visibility", section: "products", visible: false }], summary: "T-109 用户隐藏产品区块", source: "manual" });
    assert.equal(current.status, "applied");
    const hidden = await collect("products-hidden");
    const first = hidden.observed.imageCoverage.images.find(image => image.imageId === images[0].imageId);
    const second = hidden.observed.imageCoverage.images.find(image => image.imageId === images[1].imageId);
    assert.ok(first?.expectedSections.includes("hero") && first.exempt === false && first.matches.some(match => match.visible && match.decoded), "the first product image is genuinely used by the hero");
    assert.deepEqual(second?.expectedSections, ["products"], "the second product image has no applicable hero reference");
    assert.equal(second?.exempt, true, "the user's hidden products exempt the second photo");
    assert.deepEqual(hidden.failures, [], "valid user hiding must pass the real collector and judge");
    current = await request(`/api/sites/${siteId}/history/undo`, "POST");
    assert.deepEqual((await collect("restored-by-undo")).failures, []);
    const invalid = "data:image/png;base64,bm90LWEtcG5n";
    const broken = await collect("invalid-decode", images.map((image, index) => index === 1 ? { ...image, url: invalid } : image));
    assert.ok(broken.failures.some((failure: string) => failure.includes("visible image did not decode") && failure.includes(images[1].imageId)), "the real HTMLImageElement.decode failure is rejected");
  } finally {
    writeFileSync(path.join(output, "real-collector-observations.json"), JSON.stringify(observations, null, 2) + "\n", { flag: "wx" });
    await browser.send("Target.closeTarget", { targetId }).catch(() => {});
    await closeBrowser(browser);
  }
});
