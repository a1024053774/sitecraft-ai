import assert from "node:assert/strict";
import test from "node:test";
import { defaultDraft } from "../lib/site-document.ts";
import { installPreviewBridge } from "../lib/template-adapters/preview-bridge.ts";
import { getTemplateAdapter } from "../lib/template-adapters/registry.ts";
import { parseHtmlDocument } from "./fixtures/html-dom.ts";
import { servedHomeHtml } from "./fixtures/look-pages.ts";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { openBrowser, closeBrowser, base, waitForPreviewBridge } from "./helpers/workspace-browser.ts";

// Failure cases: images under empty text sections; user-hidden sections reopened; stale text
// surviving a text→photo-only transition; empty media leaving a visible section shell.
for (const look of ["screwfast", "forge", "landwind", "tailwind-landing"]) {
  for (const locale of ["zh", "en"] as const) {
    test(`T-109 ${look} ${locale}: photo-only sections share the content visibility decision`, () => {
      const document = parseHtmlDocument(servedHomeHtml(look));
      const globalObject: Record<string, unknown> = { document, parent: { postMessage() {} }, addEventListener() {} };
      globalObject.window = globalObject;
      const api = installPreviewBridge(globalObject, look, getTemplateAdapter(look));
      const draft = structuredClone(defaultDraft);
      draft.templateId = look;
      draft.content.equipment = [];
      draft.content.capabilities = { title: { zh: "加工能力", en: "Capabilities" }, intro: { zh: "待补充", en: "To be provided" }, items: [] };
      const images = ["product", "equipment", "inspection"].map(category => ({
        imageId: `img_t109_${category}`, url: `/api/sites/site/images/img_t109_${category}`,
        usageCategory: category, license: "CC0",
      }));
      const apply = () => api.applyDeclaredContent(draft, locale, [], "published", undefined, false, images);
      apply();
      for (const section of ["products", "equipment", "capabilities"]) {
        assert.equal(document.querySelector(`[data-sitecraft-section="${section}"]`)?.hidden, false, `${section} photo-only section is visible`);
      }
      assert.equal(document.querySelector('[data-sitecraft-benchmark="capabilities-title"]')?.textContent, locale === "zh" ? "检测" : "Inspection");
      assert.equal(document.querySelector('[data-sitecraft-catalog-grid="capabilities"]')?.querySelectorAll("article").length, 0);
      draft.hiddenSections = ["products", "equipment", "capabilities"];
      apply();
      for (const section of draft.hiddenSections) {
        assert.equal(document.querySelector(`[data-sitecraft-section="${section}"]`)?.hidden, true, `explicit ${section} hide is respected`);
      }
      draft.hiddenSections = [];
      draft.content.capabilities.items = [{ id: "turning", title: { zh: "数控车削", en: "CNC turning" }, body: { zh: "数控车削", en: "CNC turning" } }];
      apply();
      assert.equal(document.querySelector('[data-sitecraft-benchmark="capabilities-title"]')?.textContent, locale === "zh" ? "加工能力" : "Capabilities", "supplied title returns when text returns");
      draft.content.capabilities.items = [];
      apply();
      assert.equal(document.querySelector('[data-sitecraft-catalog-grid="capabilities"]')?.querySelectorAll("article").length, 0, "previous text rows are removed");
      api.applyDeclaredContent(draft, locale, [], "published", undefined, false, []);
      for (const section of ["products", "equipment", "capabilities"]) {
        assert.equal(document.querySelector(`[data-sitecraft-section="${section}"]`)?.hidden, true, `${section} with no text or images is hidden`);
      }
    });
  }
}

test("T-109 removing and restoring the optional capabilities object has the same facts after locale changes and reload", async () => {
  const output = process.env.T109_EVIDENCE_DIR || `artifacts/t109/photo-state-${Date.now()}-${process.pid}`;
  mkdirSync(output, { recursive: true });
  const observations: unknown[] = [];
  const failures: string[] = [];
  const browser = await openBrowser();
  const { targetId } = await browser.send("Target.createTarget", { url: "about:blank" }) as { targetId: string };
  const { sessionId } = await browser.send("Target.attachToTarget", { targetId, flatten: true }) as { sessionId: string };
  const request = async (url: string, method: string, body?: unknown) => {
    const response = await fetch(`${base}${url}`, { method, ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}) });
    const payload = await response.json();
    assert.ok(response.ok, `${method} ${url}: ${response.status}`);
    return payload;
  };
  try {
    await browser.send("Page.enable", {}, sessionId);
    await browser.send("Runtime.enable", {}, sessionId);
    const manifest = JSON.parse(readFileSync("tests/fixtures/company-images/molding/manifest.json", "utf8"));
    const photo = manifest.images.find((image: { category: string }) => image.category === "inspection");
    for (const look of ["screwfast", "forge", "landwind", "tailwind-landing"]) {
      const reuseId = process.env.T109_CAPABILITIES_SITE;
      let created = reuseId
        ? { id: reuseId, ...await request(`/api/sites/${reuseId}/draft`, "GET") }
        : await request("/api/sites", "POST", { name: `T-109 optional capabilities regression ${look}`, templateId: look, locales: ["zh", "en"] });
      const siteId = created.id;
      if (created.draft.templateId !== look) created = { id: siteId, ...await request(`/api/sites/${siteId}/draft`, "PUT", { baseRevision: created.draft.revision, operations: [{ op: "set_template", templateId: look }], summary: "T-109 四样子复用同一回归站", source: "manual" }) };
      const form = new FormData();
      form.append("file", new Blob([new Uint8Array(readFileSync(`tests/fixtures/company-images/molding/${photo.file}`))], { type: "image/jpeg" }), photo.file);
      for (const [key, value] of Object.entries({ license: photo.apiLicense, sourceUrl: photo.sourceUrl, licenseUrl: photo.licenseUrl, author: photo.author, attribution: photo.attribution, usageScope: "current-site-only", usageCategory: "inspection", retrievedAt: photo.downloadedAt })) form.set(key, String(value));
      if (!reuseId) {
        const uploaded = await fetch(`${base}/api/sites/${siteId}/images`, { method: "POST", body: form });
        assert.equal(uploaded.status, 201);
      }
      const images = (await request(`/api/sites/${siteId}/images`, "GET")).images;
      assert.equal(images.length, 1);
      const section = {
        title: { zh: "加工能力", en: "Capabilities" },
        intro: { zh: "检测精度 0.02 mm", en: "Inspection accuracy 0.02 mm" },
        items: [{ id: "inspection", title: { zh: "尺寸检测", en: "Dimensional inspection" }, body: { zh: "三坐标检测", en: "Coordinate measurement" } }],
      };
      const update = async (value: unknown) => {
        const current = await request(`/api/sites/${siteId}/draft`, "GET");
        const applied = await request(`/api/sites/${siteId}/draft`, "PUT", { baseRevision: current.draft.revision, operations: [{ op: "set_catalog_section", section: "capabilities", value }], summary: "T-109 可选能力对象删除与恢复回归", source: "manual" });
        assert.ok(["applied", "no_change"].includes(applied.status), "preparing an already supplied section may be a no-op");
        assert.equal(applied.rejected?.length || 0, 0);
        if (value === null) assert.equal(applied.draft.content.capabilities, undefined, "the null operation removes the object");
        return applied;
      };
      const load = async () => {
        await browser.send("Page.navigate", { url: `${base}/api/templates/${look}/preview?t109-state=${Date.now()}` }, sessionId);
        await waitForPreviewBridge(browser, sessionId, 30000, `T-109 ${look} state regression`);
      };
      const observe = async (snapshot: { draft: unknown }, locale: string, stage: string) => {
        await browser.eval(`window.__sitecraftApplyDeclared(${JSON.stringify(snapshot.draft)},${JSON.stringify(locale)},[],"published",null,true,${JSON.stringify(images)})`, sessionId);
        const state = await browser.eval<{ intro: string; introVisible: boolean; title: string; photoVisible: boolean; decoded: boolean }>(`(async () => {
          const intro=document.querySelector('[data-sitecraft-benchmark="capabilities-intro"]');
          const title=document.querySelector('[data-sitecraft-benchmark="capabilities-title"]');
          const photo=document.querySelector('[data-sitecraft-image-gallery="inspection"] img');
          if(photo) await photo.decode();
          const visible=e=>!!e&&e.getBoundingClientRect().width>0&&e.getBoundingClientRect().height>0&&getComputedStyle(e).display!=="none";
          return {intro:intro?.textContent||"",introVisible:visible(intro),title:title?.textContent||"",photoVisible:visible(photo),decoded:!!photo&&photo.naturalWidth>0};
        })()`, sessionId);
        observations.push({ siteId, look, locale, stage, state });
        return state;
      };
      const supplied = await update(section);
      await load();
      await observe(supplied, "zh", "supplied");
      const deleted = await update(null);
      for (const locale of ["en", "zh"]) {
        const reused = await observe(deleted, locale, "deleted-reused");
        if (reused.intro || reused.introVisible) failures.push(`${look} ${locale}: removed intro remains on reused iframe`);
        if (reused.title !== (locale === "en" ? "Inspection" : "检测") || !reused.photoVisible || !reused.decoded) failures.push(`${look} ${locale}: photo-only category is not intact`);
      }
      await load();
      const fresh = await observe(deleted, "en", "deleted-reloaded");
      if (fresh.intro || fresh.introVisible) failures.push(`${look}: removed intro remains after reload`);
      const restored = await request(`/api/sites/${siteId}/history/undo`, "POST");
      for (const locale of ["zh", "en"]) {
        const state = await observe(restored, locale, "restored-by-undo");
        if (state.intro !== section.intro[locale as "zh" | "en"] || !state.introVisible) failures.push(`${look} ${locale}: undo did not restore the supplied intro`);
      }
      const removedAgain = await request(`/api/sites/${siteId}/history/redo`, "POST");
      const repeated = await observe(removedAgain, "en", "deleted-by-redo");
      if (repeated.intro || repeated.introVisible) failures.push(`${look}: redo retained a removed intro`);
    }
  } finally {
    writeFileSync(path.join(output, "optional-capabilities-observations.json"), JSON.stringify({ observations, failures }, null, 2) + "\n", { flag: "wx" });
    await browser.send("Target.closeTarget", { targetId }).catch(() => {});
    await closeBrowser(browser);
  }
  assert.deepEqual(failures, [], "removed optional content must not survive on a reused iframe");
});
