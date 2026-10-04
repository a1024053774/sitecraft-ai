import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import test from "node:test";
import { composedPageForTemplate } from "../lib/blocks/compose.ts";
import { buildPreviewBridgeScript } from "../lib/template-adapters/preview-bridge.ts";
import { getTemplateAdapter } from "../lib/template-adapters/registry.ts";
import { applySiteOperations } from "../lib/site-operations.ts";
import { packDraft } from "./fixtures/pack-drafts.ts";
import { closeBrowser, openBrowser } from "./helpers/workspace-browser.ts";

// Failure modes: cards hide their pseudo-element, suppress/reset the counter incorrectly,
// or empty entries still occupy numbered boxes. Exercise actual compose + bridge + browser CSS.
test("cooperation cards and steps show a fresh counter on both looks, excluding gaps", async () => {
  const browser = await openBrowser();
  const out = `artifacts/t056/step-numbers-${Date.now()}`;
  mkdirSync(out, { recursive: true });
  const reports = [];
  try {
    for (const [templateId, briefId] of [["forge", "industrial"], ["screwfast", "engineering-industrial"]] as const) {
      const draft = applySiteOperations(packDraft("industrial"), [{ op: "set_visual_brief", briefId }], {
        templateIds: new Set(["forge", "screwfast"]), lastChange: "number-regression",
      }).draft;
      const gap = { zh: "待补充", en: "To be provided" };
      draft.content.services.items = [
        { id: "empty", title: gap, body: gap },
        ...["提交图纸", "确认规格", "批量交付"].map((title, i) => ({ id: `s${i}`, title: { zh: title, en: title }, body: gap })),
      ];
      for (const variant of ["cards", "steps"]) for (const width of [375, 768, 1440]) {
        const { targetId } = await browser.send("Target.createTarget", { url: "about:blank" }) as { targetId: string };
        const { sessionId } = await browser.send("Target.attachToTarget", { targetId, flatten: true }) as { sessionId: string };
        try {
          await browser.send("Page.enable", {}, sessionId);
          await browser.send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: false }, sessionId);
          const html = composedPageForTemplate(templateId)!.replace("</body>", `${buildPreviewBridgeScript(templateId, getTemplateAdapter(templateId))}</body>`);
          const tree = await browser.send("Page.getFrameTree", {}, sessionId) as { frameTree: { frame: { id: string } } };
          await browser.send("Page.setDocumentContent", { frameId: tree.frameTree.frame.id, html }, sessionId);
          await browser.eval(`window.__sitecraftApplyDeclared(${JSON.stringify({ ...draft, blockVariants: { services: variant } })}, "zh", [], "published")`, sessionId);
          const result = await browser.eval<{ reset: string; items: Array<{ title: string; display: string; content: string; increment: string }> }>(`(() => {
            const group = document.querySelector('[data-sc-block="services"] .sitecraft-process');
            return { reset: getComputedStyle(group).counterReset, items: [...group.children].filter(el => el.getBoundingClientRect().height > 0).map(el => ({ title: el.querySelector('h3').textContent, display: getComputedStyle(el, '::before').display, content: getComputedStyle(el, '::before').content, increment: getComputedStyle(el).counterIncrement })) };
          })()`, sessionId);
          reports.push({ templateId, variant, width, ...result });
          writeFileSync(`${out}/report.json`, JSON.stringify(reports, null, 2));
          const label = `${templateId}/${variant}/${width}`;
          assert.deepEqual(result.items.map(item => item.title), ["提交图纸", "确认规格", "批量交付"], label);
          assert.equal(result.reset, "step 0", `${label}: numbering starts again at 1`);
          for (const item of result.items) {
            assert.equal(item.display, "block", `${label}: visible step number`);
            assert.equal(item.content, "counter(step)", label);
            assert.equal(item.increment, "step 1", label);
          }
        } finally { await browser.send("Target.closeTarget", { targetId }); }
      }
    }
  } finally {
    await closeBrowser(browser);
  }
});
