import assert from "node:assert/strict";
import test from "node:test";
import { closeBrowser, openBrowser, previewRefreshCoverHistoryExpression } from "./helpers/workspace-browser.ts";

test("preview cover history catches an overlay that disappears before hydration", async () => {
  const browser = await openBrowser();
  const { targetId } = await browser.send("Target.createTarget", { url: "about:blank" }) as { targetId: string };
  const { sessionId } = await browser.send("Target.attachToTarget", { targetId, flatten: true }) as { sessionId: string };
  try {
    await browser.send("Page.enable", {}, sessionId);
    await browser.send("Runtime.enable", {}, sessionId);
    await browser.send("Page.setDocumentContent", { frameId: (await browser.send("Page.getFrameTree", {}, sessionId) as { frameTree: { frame: { id: string } } }).frameTree.frame.id, html: `<body><div data-testid="workspace-draft-revision">v1</div><div data-testid="open-source-template-frame"></div><div data-testid="preview-load-progress" style="height:760px;background:#23272b"></div></body>` }, sessionId);
    await browser.eval(`setTimeout(() => { document.querySelector('[data-testid=preview-load-progress]').remove(); document.querySelector('[data-testid=workspace-draft-revision]').textContent = 'v2'; document.querySelector('[data-testid=open-source-template-frame]').dataset.previewHydrated = 'true'; }, 200); true`, sessionId);
    const result = await browser.eval<{ covered: string[]; changed: boolean }>(previewRefreshCoverHistoryExpression("v1", 2000), sessionId);
    assert.equal(result.changed, true);
    assert.ok(result.covered.length > 0, "the transient overlay must remain observable in history");
  } finally {
    await browser.send("Target.closeTarget", { targetId }).catch(() => {});
    await closeBrowser(browser);
  }
});
