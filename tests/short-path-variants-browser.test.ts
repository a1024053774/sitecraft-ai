import assert from "node:assert/strict";
import test from "node:test";
import { packDraft } from "./fixtures/pack-drafts.ts";
import { closeBrowser, base as sitecraftBase, openBrowser } from "./helpers/workspace-browser.ts";

test("灰底短路径 mounts its short nav, certification cards, side FAQ, and line footer", async () => {
  const browser = await openBrowser();
  const { targetId } = await browser.send("Target.createTarget", { url: "about:blank" }) as { targetId: string };
  const { sessionId } = await browser.send("Target.attachToTarget", { targetId, flatten: true }) as { sessionId: string };
  try {
    await browser.send("Page.enable", {}, sessionId);
    await browser.send("Runtime.enable", {}, sessionId);
    await browser.send("Page.navigate", { url: `${sitecraftBase}/api/templates/tailwind-landing/preview?short-path-variants=${Date.now()}` }, sessionId);
    for (let waited = 0; waited < 15000; waited += 100) {
      if (await browser.eval<boolean>("document.readyState === 'complete' && typeof window.__sitecraftApplyDeclared === 'function'", sessionId).catch(() => false)) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    const base = packDraft("export");
    const draft = { ...base, templateId: "tailwind-landing", blockVariants: { nav: "short", certifications: "cards", faq: "side", footer: "line" }, content: { ...base.content, commercialTerms: [{ id: "moq", kind: "moq", value: { zh: "100 件", en: "100 pcs" } }], certifications: { title: { zh: "认证", en: "Certifications" }, intro: { zh: "", en: "" }, items: [{ id: "iso", title: { zh: "ISO 9001", en: "ISO 9001" }, body: { zh: "认证中", en: "In progress" }, status: "认证中" }] } } };
    for (const width of [1440, 768, 375]) {
      await browser.send("Emulation.setDeviceMetricsOverride", { width, height: 1000, deviceScaleFactor: 1, mobile: width < 500 }, sessionId);
      await browser.eval(`window.__sitecraftApplyDeclared(${JSON.stringify(draft)}, "zh", [], "published", null, false)`, sessionId);
      const result = await browser.eval<{ variants: Record<string, string>; order: string[]; visibleOrder: string[]; certBody: string; commercialTermsText: string; phoneHidden: boolean }>(`(() => ({
        variants: Object.fromEntries([...document.querySelectorAll('[data-sc-block]')].map((node) => [node.getAttribute('data-sc-block'), node.getAttribute('data-sc-variant')])),
        order: [...document.querySelectorAll('[data-sitecraft-section]')].map((node) => node.getAttribute('data-sitecraft-section')).filter(Boolean),
        visibleOrder: [...document.querySelectorAll('[data-sitecraft-section]')].filter((node) => !node.hidden && getComputedStyle(node).display !== 'none').map((node) => node.getAttribute('data-sitecraft-section')).filter(Boolean),
        certBody: [...document.querySelectorAll('[data-sitecraft-section="certifications"] p')].map((node) => node.textContent).find((text) => text === "认证中") || "",
        commercialTermsText: [...document.querySelectorAll('[data-sitecraft-section="commercialTerms"] p')].map((node) => node.textContent).find((text) => text === "100 件") || "",
        phoneHidden: Boolean(document.querySelector('[data-sitecraft-contact="footer-phone"]')?.closest('[data-sitecraft-line]')?.hasAttribute('hidden')),
      }))()`, sessionId);
      assert.equal(result.variants.nav, "short");
      assert.equal(result.variants.certifications, "cards");
      assert.equal(result.variants.faq, "side");
      assert.equal(result.variants.footer, "line");
      // T-079 adds commercialTerms to the short-path skeleton. Check the full declared order and
      // the painted order separately so a hidden empty terms block cannot hide a real certification.
      assert.deepEqual(result.order.slice(0, 12), ["nav", "hero", "products", "commercialTerms", "equipment", "qualityProcess", "history", "industries", "capabilities", "services", "contact", "certifications"]);
      assert.ok(result.visibleOrder.includes("commercialTerms"), `${width}: commercial terms with source data stay visible`);
      assert.ok(result.visibleOrder.includes("certifications"), `${width}: certifications stay visible after commercial terms are mounted`);
      assert.equal(result.certBody, "认证中");
      assert.equal(result.commercialTermsText, "100 件");
      assert.equal(result.phoneHidden, true);
      await browser.eval(`window.__sitecraftApplyDeclared(${JSON.stringify(draft)}, "en", [], "published", null, true)`, sessionId);
      assert.equal(await browser.eval<string>(`[...document.querySelectorAll('[data-sitecraft-section="certifications"] p')].map((node) => node.textContent).find((text) => text === "In progress") || ""`, sessionId), "In progress");
    }
  } finally {
    await browser.send("Target.closeTarget", { targetId }).catch(() => {});
    await closeBrowser(browser);
  }
});
