import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import test from "node:test";
import {
  clickExpression,
  closeModalExpression,
  closePage,
  contrastScan,
  closeBrowser,
  createSite,
  openBrowser,
  openWorkspace,
  screenshot,
  sendChatExpression,
  sleep,
  startAlignmentCard,
  waitFor,
  type Cdp,
  type WorkspacePage,
  failChatRequests,
} from "./helpers/workspace-browser.ts";

// T-043 measured seven selectors, then every text node on one screen. T-052: every workspace
// surface — chat, error, 需求对齐 card and drawer, look and color panels, history, the three
// upload dialogs, the delete dialog, the preview toolbar — in both themes at 1440, 768 and 375.
const out = new URL("../artifacts/t052/", import.meta.url);
type Scan = { checked: number; lowCount: number; low: string[]; unmeasured: string[] };
type Step = { name: string; action?: string; ready?: string; after?: string; shot?: boolean };

const chatSteps: Step[] = [
  { name: "chat" },
  {
    name: "error",
    action: sendChatExpression("首屏标题写成按图加工的重载减速机"),
    after: clickExpression("chat-send", "发送"),
    ready: `Boolean(document.querySelector(".message.error")) && !document.querySelector("[data-testid=chat-progress]")`,
    shot: true,
  },
  { name: "look", action: clickExpression("open-look-panel", "样子"), ready: `Boolean(document.querySelector("[data-testid=visual-brief-card]")?.getClientRects().length)` },
  { name: "color", action: clickExpression("open-color-panel", "配色"), ready: `Boolean(document.querySelector("[data-testid=custom-palette-panel]")?.getClientRects().length)` },
  { name: "history", action: clickExpression("history-toggle", "历史"), ready: `Boolean(document.querySelector(".draft-history"))` },
  { name: "materials", action: clickExpression("open-materials", "提供公司资料"), ready: `Boolean(document.querySelector("#company-materials"))`, after: closeModalExpression },
  { name: "images", action: clickExpression("open-image-library", "上传产品图"), ready: `Boolean(document.querySelector("[data-testid=image-library-modal]"))`, after: closeModalExpression },
  { name: "import", action: clickExpression("open-product-import", "上传商品表格"), ready: `Boolean(document.querySelector(".upload-zone"))`, after: closeModalExpression },
];
const previewSteps: Step[] = [
  { name: "preview", shot: true },
  { name: "delete", action: clickExpression("toolbar-delete-site"), ready: `Boolean(document.querySelector("[data-testid=site-delete-dialog]"))`, after: closeModalExpression },
];

// Measure settled screens: wait for finite animations and transitions to finish (spinners loop).
const settled = `document.getAnimations().every((item) => item.effect?.getTiming?.().iterations === Infinity || item.playState !== "running")`;

async function scan(browser: Cdp, page: WorkspacePage, label: string, report: unknown[]) {
  await sleep(150);
  await waitFor(browser, page.sessionId, settled, 5000);
  const measured = await browser.eval<Scan>(`(${contrastScan})(".builder-shell")`, page.sessionId);
  report.push({ label, checked: measured.checked, lowCount: measured.lowCount, low: measured.low, unmeasured: measured.unmeasured });
  return measured;
}

async function runSteps(browser: Cdp, page: WorkspacePage, prefix: string, steps: Step[], report: unknown[], failures: string[]) {
  for (const step of steps) {
    if (step.action) {
      const acted = await browser.eval<boolean>(step.action, page.sessionId);
      if (!acted) { failures.push(`${prefix} ${step.name}: control not found`); continue; }
      // The error state is made by a failed chat request, answered here with the server's
      // no-model 503 so it does not depend on the machine having a model key.
      const stopFailing = step.name === "error" ? await failChatRequests(browser, page.sessionId) : null;
      if (step.name === "error") await browser.eval(step.after!, page.sessionId);
      const ready = step.ready ? await waitFor(browser, page.sessionId, step.ready, 15000) : true;
      if (stopFailing) await stopFailing();
      if (!ready) { failures.push(`${prefix} ${step.name}: state did not appear`); continue; }
    }
    const measured = await scan(browser, page, `${prefix} ${step.name}`, report);
    if (measured.checked === 0) failures.push(`${prefix} ${step.name}: no text measured`);
    if (measured.lowCount) failures.push(`${prefix} ${step.name}: ${measured.low.join("; ")}`);
    if (measured.unmeasured.length) failures.push(`${prefix} ${step.name}: unmeasured ${measured.unmeasured.join("; ")}`);
    if (step.shot) writeFileSync(new URL(`workspace-${prefix.replace(/ /g, "-")}-${step.name}.png`, out), await screenshot(browser, page.sessionId));
    if (step.after && step.name !== "error") {
      await browser.eval(step.after, page.sessionId);
      await sleep(300);
    }
    // Panels toggle; close them again so the next step starts from the chat.
    if (step.name === "look" || step.name === "color" || step.name === "history") {
      await browser.eval(step.action!, page.sessionId);
      await sleep(300);
    }
  }
}

async function showPane(browser: Cdp, page: WorkspacePage, pane: "chat" | "preview") {
  const label = pane === "chat" ? "对话" : "预览";
  await browser.eval(`[...document.querySelectorAll(".builder-mobile-tabs button")].find((item) => item.textContent.includes(${JSON.stringify(label)}))?.click()`, page.sessionId);
  await sleep(400);
}

test("every workspace surface keeps text at 4.5:1 or above in dark and light, at 1440, 768 and 375", { timeout: 600000 }, async () => {
  mkdirSync(out, { recursive: true });
  const siteId = await createSite("T052 对比度检查");
  const conversationId = await startAlignmentCard(siteId);
  const browser = await openBrowser();
  const report: unknown[] = [];
  const failures: string[] = [];
  try {
    for (const theme of ["dark", "light"] as const) {
      for (const width of [1440, 768, 375]) {
        const prefix = `${theme} ${width}`;
        // A site that has never been generated, with no saved conversation.
        const page = await openWorkspace(browser, { siteId: await createSite(`T052 ${prefix}`), width, theme });
        if (width <= 900) await showPane(browser, page, "chat");
        await runSteps(browser, page, prefix, chatSteps, report, failures);
        if (width <= 900) await showPane(browser, page, "preview");
        await runSteps(browser, page, prefix, width <= 900 ? previewSteps : previewSteps.slice(1), report, failures);
        if (width > 900) writeFileSync(new URL(`workspace-${theme}-${width}-preview.png`, out), await screenshot(browser, page.sessionId));
        await closePage(browser, page);

        // The same site with a live round-one 需求对齐 card (the drawer at 375), one option picked.
        const aligned = await openWorkspace(browser, { siteId, width, theme, conversationId });
        if (width <= 900) await showPane(browser, aligned, "chat");
        const card = await waitFor(browser, aligned.sessionId, `Boolean(document.querySelector(".alignment-panel .alignment-card"))`, 15000);
        if (!card) failures.push(`${prefix} alignment: card did not appear`);
        else {
          await browser.eval(`document.querySelector(".alignment-panel .alignment-card:not(.selected)")?.click()`, aligned.sessionId);
          await runSteps(browser, aligned, `${prefix} alignment`, [{ name: "card", shot: true }], report, failures);
        }
        await closePage(browser, aligned);
      }
    }
    // Every workspace accent, on the card where the accent carries text and the primary button.
    for (const theme of ["dark", "light"] as const) {
      for (const accent of ["porcelain", "graphite", "warm-orange", "patina", "turquoise", "morandi"]) {
        const page = await openWorkspace(browser, { siteId, width: 1440, theme, conversationId, accent });
        if (await waitFor(browser, page.sessionId, `Boolean(document.querySelector(".alignment-panel .alignment-card"))`, 15000)) {
          await browser.eval(`document.querySelector(".alignment-panel .alignment-card:not(.selected)")?.click()`, page.sessionId);
          await runSteps(browser, page, `${theme} accent-${accent}`, [{ name: "card" }], report, failures);
        } else failures.push(`${theme} accent-${accent}: card did not appear`);
        await closePage(browser, page);
      }
    }
  } finally {
    await closeBrowser(browser);
    writeFileSync(new URL("contrast-report.json", out), JSON.stringify(report, null, 2));
  }
  assert.deepEqual(failures, []);
});
