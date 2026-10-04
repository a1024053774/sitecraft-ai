import assert from "node:assert/strict";
import test from "node:test";
import type { SiteDraft } from "../lib/site-document.ts";
import { packDraft } from "./fixtures/pack-drafts.ts";
import { closeBrowser, waitForPreviewBridge, waitForSettled, base as sitecraftBase, openBrowser } from "./helpers/workspace-browser.ts";

const templates = ["screwfast", "forge", "landwind"] as const;

async function render(browser: Awaited<ReturnType<typeof openBrowser>>, templateId: string, draft: unknown, width: number, suffix: string) {
  const { targetId } = await browser.send("Target.createTarget", { url: "about:blank" }) as { targetId: string };
  const { sessionId } = await browser.send("Target.attachToTarget", { targetId, flatten: true }) as { sessionId: string };
  try {
    await browser.send("Page.enable", {}, sessionId);
    await browser.send("Runtime.enable", {}, sessionId);
    await browser.send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width < 500 }, sessionId);
    await browser.send("Page.navigate", { url: `${sitecraftBase}/api/templates/${templateId}/preview?layout-rules=${suffix}-${width}` }, sessionId);
    await waitForPreviewBridge(browser, sessionId, 15000, 'catalog-layout-rules-browser.test');
    await browser.eval(`window.__sitecraftApplyDeclared(${JSON.stringify(draft)}, "zh", [], "published", null, false)`, sessionId);
    await waitForSettled(browser, sessionId, "catalog layout rules");
    return { sessionId, targetId };
  } catch (error) {
    await browser.send("Target.closeTarget", { targetId }).catch(() => {});
    throw error;
  }
}

test("paired industries and capabilities resolve to one layout on every look", { concurrency: false }, async () => {
  const browser = await openBrowser();
  try {
    for (const templateId of templates) {
      const draft = packDraft("export") as SiteDraft & { templateId: string; blockVariants: Record<string, string> };
      draft.templateId = templateId;
      draft.blockVariants = { industries: "cards", capabilities: "list" };
      const page = await render(browser, templateId, draft, 1440, `paired-${templateId}`);
      try {
        const result = await browser.eval<{ industries: string | null; capabilities: string | null; sideBySide: boolean }>(`(() => {
          const industries = document.querySelector('[data-sitecraft-section="industries"]');
          const capabilities = document.querySelector('[data-sitecraft-section="capabilities"]');
          if (!industries || !capabilities) return { industries: null, capabilities: null, sideBySide: false };
          const a = industries.getBoundingClientRect();
          const b = capabilities.getBoundingClientRect();
          return { industries: industries.dataset.scVariant || null, capabilities: capabilities.dataset.scVariant || null, sideBySide: Math.abs(a.top - b.top) < 8 };
        })()`, page.sessionId);
        assert.equal(result.industries, result.capabilities, `${templateId}: paired blocks must use one variant`);
        assert.equal(result.sideBySide && result.industries !== result.capabilities, false, `${templateId}: mismatched pair must not sit side by side`);
      } finally {
        await browser.send("Target.closeTarget", { targetId: page.targetId }).catch(() => {});
      }
    }
  } finally {
    await closeBrowser(browser);
  }
});

test("steps balance four, five, and six entries at desktop and narrow widths", { concurrency: false }, async () => {
  const browser = await openBrowser();
  try {
    for (const templateId of templates) for (const count of [4, 5, 6]) {
      const draft = packDraft("export") as SiteDraft & { templateId: string; blockVariants: Record<string, string> };
      draft.templateId = templateId;
      draft.content.services.items = Array.from({ length: 6 }, (_, index) => index < count
        ? { id: `step-${index + 1}`, title: { zh: `步骤${index + 1}`, en: `Step ${index + 1}` }, body: { zh: `说明${index + 1}`, en: `Body ${index + 1}` } }
        : { id: `step-${index + 1}`, title: { zh: "待补充", en: "To be provided" }, body: { zh: "待补充", en: "To be provided" } });
      for (const width of [1440, 768, 375]) {
        const page = await render(browser, templateId, draft, width, `steps-${templateId}-${count}`);
        try {
          const result = await browser.eval<{ visible: number; columns: number; lastWidth: number; gridWidth: number }>(`(() => {
            const grid = document.querySelector('.sitecraft-process');
            const cards = [...document.querySelectorAll('.sitecraft-process > .sitecraft-process-card')].filter((node) => !node.hidden && getComputedStyle(node).display !== 'none');
            const lefts = new Set(cards.map((node) => Math.round(node.getBoundingClientRect().left)));
            const last = cards.at(-1)?.getBoundingClientRect();
            const box = grid?.getBoundingClientRect();
            return { visible: cards.length, columns: lefts.size, lastWidth: last?.width || 0, gridWidth: box?.width || 0 };
          })()`, page.sessionId);
          assert.equal(result.visible, count, `${templateId} ${count} steps at ${width}`);
          if (width >= 901) {
            assert.equal(result.columns, count === 4 ? 4 : 3, `${templateId} ${count} steps at ${width}: balanced desktop columns`);
          } else if (width > 480) {
            assert.equal(result.columns, 2, `${templateId} ${count} steps at ${width}: two narrow columns`);
            if (count === 5) assert.ok(result.lastWidth >= result.gridWidth - 2, `${templateId} five steps at ${width}: the final step spans the row`);
          } else {
            assert.equal(result.columns, 1, `${templateId} ${count} steps at ${width}: one phone column`);
          }
        } finally {
          await browser.send("Target.closeTarget", { targetId: page.targetId }).catch(() => {});
        }
      }
    }
  } finally {
    await closeBrowser(browser);
  }
});
