import assert from "node:assert/strict";
import test from "node:test";
import { packDraft } from "./fixtures/pack-drafts.ts";
import { openBrowser } from "./helpers/workspace-browser.ts";

test("灰底短路径 mounts its short nav, certification cards, side FAQ, and line footer", async () => {
  const browser = await openBrowser();
  const { targetId } = await browser.send("Target.createTarget", { url: "about:blank" }) as { targetId: string };
  const { sessionId } = await browser.send("Target.attachToTarget", { targetId, flatten: true }) as { sessionId: string };
  try {
    await browser.send("Page.enable", {}, sessionId);
    await browser.send("Runtime.enable", {}, sessionId);
    await browser.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false }, sessionId);
    await browser.send("Page.navigate", { url: `http://127.0.0.1:3034/api/templates/tailwind-landing/preview?short-path-variants=${Date.now()}` }, sessionId);
    for (let waited = 0; waited < 15000; waited += 100) {
      if (await browser.eval<boolean>("document.readyState === 'complete' && typeof window.__sitecraftApplyDeclared === 'function'", sessionId).catch(() => false)) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    const draft = { ...packDraft("export"), templateId: "tailwind-landing", blockVariants: { nav: "short", certifications: "cards", faq: "side", footer: "line" } };
    await browser.eval(`window.__sitecraftApplyDeclared(${JSON.stringify(draft)}, "zh", [], "published", null, false)`, sessionId);
    const result = await browser.eval<{ variants: Record<string, string>; order: string[] }>(`(() => ({
      variants: Object.fromEntries([...document.querySelectorAll('[data-sc-block]')].map((node) => [node.getAttribute('data-sc-block'), node.getAttribute('data-sc-variant')])),
      order: [...document.querySelectorAll('[data-sitecraft-section]')].map((node) => node.getAttribute('data-sitecraft-section')).filter(Boolean),
    }))()`, sessionId);
    assert.equal(result.variants.nav, "short");
    assert.equal(result.variants.certifications, "cards");
    assert.equal(result.variants.faq, "side");
    assert.equal(result.variants.footer, "line");
    assert.deepEqual(result.order.slice(0, 8), ["nav", "hero", "products", "industries", "capabilities", "services", "contact", "certifications"]);
  } finally {
    await browser.send("Target.closeTarget", { targetId }).catch(() => {});
    try { browser.ws.send(JSON.stringify({ id: browser.id++, method: "Browser.close" })); } catch {}
    browser.ws.close();
  }
});
