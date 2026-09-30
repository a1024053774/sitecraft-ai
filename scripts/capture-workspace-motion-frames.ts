// T-052 motion evidence for a reviewer who cannot watch a recording: short frame sequences of
// each transition, at 1440 / 768 / 375, with and without prefers-reduced-motion.
//
//   CHROME_PATH=... node --experimental-strip-types scripts/capture-workspace-motion-frames.ts
//
// Needs the dev server on SITECRAFT_BASE (default http://127.0.0.1:3034). Frames are real
// screenshots taken back to back right after the trigger; the index lists the time each one
// was taken. Output: artifacts/t052/frames/<scene>-<width>-<frame>.png and index.md.
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import {
  clickExpression,
  closePage,
  createSite,
  failChatRequests,
  openBrowser,
  openWorkspace,
  screenshot,
  sendChatExpression,
  sleep,
  startAlignmentCard,
  waitFor,
  type Cdp,
  type WorkspacePage,
} from "../tests/helpers/workspace-browser.ts";

const outDir = new URL("../artifacts/t052/frames/", import.meta.url);
const FRAMES = 5;
const WIDTHS = [1440, 768, 375];

type Shot = { scene: string; width: number; files: string[]; times: number[]; distinct: number; note?: string };
const shots: Shot[] = [];

function fileName(scene: string, width: number, frame: number) {
  return `${scene}-${width}-${frame}.png`;
}

// Takes FRAMES screenshots back to back, starting at t0 (the moment of the trigger).
async function frames(browser: Cdp, page: WorkspacePage, scene: string, width: number, t0: number, note?: string) {
  const files: string[] = [];
  const times: number[] = [];
  const seen = new Set<string>();
  for (let frame = 0; frame < FRAMES; frame += 1) {
    const image = await screenshot(browser, page.sessionId);
    times.push(Date.now() - t0);
    const name = fileName(scene, width, frame);
    writeFileSync(new URL(name, outDir), image);
    files.push(name);
    seen.add(image.toString("base64"));
  }
  shots.push({ scene, width, files, times, distinct: seen.size, note });
}

const alignmentReady = `Boolean(document.querySelector(".alignment-panel .alignment-card"))`;

async function showChat(browser: Cdp, page: WorkspacePage, width: number) {
  if (width > 900) return;
  await browser.eval(`[...document.querySelectorAll(".builder-mobile-tabs button")].find((item) => item.textContent.includes("对话"))?.click()`, page.sessionId);
  await sleep(450);
}

async function showPreview(browser: Cdp, page: WorkspacePage, width: number) {
  if (width > 900) return;
  await browser.eval(`[...document.querySelectorAll(".builder-mobile-tabs button")].find((item) => item.textContent.includes("预览"))?.click()`, page.sessionId);
  await sleep(450);
}

async function runScenes(browser: Cdp, width: number, reduced: boolean) {
  const prefix = reduced ? "reduced-" : "";
  const siteId = await createSite(`T052 帧 ${width}${reduced ? " 减少动态" : ""}`);
  const conversationId = await startAlignmentCard(siteId);
  const page = await openWorkspace(browser, { siteId, width, theme: "dark", conversationId, reducedMotion: reduced });
  const phone = width <= 600;
  try {
    await showChat(browser, page, width);
    if (!await waitFor(browser, page.sessionId, alignmentReady, 15000)) throw new Error(`${width}: no alignment card`);
    await sleep(600);

    // Scene: the card (a bottom drawer on phones) opening, captured from a reload.
    let t0 = Date.now();
    await browser.send("Page.reload", {}, page.sessionId);
    const selector = phone ? `.alignment-panel[data-mobile-drawer]` : `.alignment-panel`;
    for (let attempt = 0; attempt < 400; attempt += 1) {
      if (await browser.eval<boolean>(`Boolean(document.querySelector(${JSON.stringify(selector)}))`, page.sessionId).catch(() => false)) break;
      await sleep(10);
    }
    t0 = Date.now();
    await frames(browser, page, `${prefix}card-open`, width, t0, phone ? "the bottom drawer sliding in" : "the card fading in");
    await showChat(browser, page, width);
    await sleep(700);

    // Scene: choosing an option.
    t0 = Date.now();
    await browser.eval(`(() => { const option = document.querySelector(".alignment-panel .alignment-card:not(.selected)"); option?.click(); return Boolean(option); })()`, page.sessionId);
    await frames(browser, page, `${prefix}option-select`, width, t0);
    await sleep(300);

    // Scene: moving to the next question (phones show one question at a time).
    if (phone) {
      await waitFor(browser, page.sessionId, `document.querySelector("[data-testid=alignment-next]") && !document.querySelector("[data-testid=alignment-next]").disabled`, 5000);
      t0 = Date.now();
      await browser.eval(clickExpression("alignment-next"), page.sessionId);
      await frames(browser, page, `${prefix}next-question`, width, t0);
    } else {
      shots.push({ scene: `${prefix}next-question`, width, files: [], times: [], distinct: 0, note: "not applicable: all questions are visible at once above 600 px" });
    }

    // Answer everything that is left, then submit.
    for (let index = 0; index < 5; index += 1) {
      await browser.eval(`(() => { const question = [...document.querySelectorAll(".alignment-panel [data-testid=alignment-card-question]")].find((item) => !item.querySelector(".alignment-card.selected")); question?.querySelector(".alignment-card")?.click(); })()`, page.sessionId);
      await sleep(350);
      if (phone) {
        const advanced = await browser.eval<boolean>(clickExpression("alignment-next"), page.sessionId);
        if (!advanced) break;
        await sleep(400);
      }
    }
    await waitFor(browser, page.sessionId, `document.querySelector("[data-testid=alignment-submit]") && !document.querySelector("[data-testid=alignment-submit]").disabled`, 8000);
    t0 = Date.now();
    await browser.eval(clickExpression("alignment-submit"), page.sessionId);
    await frames(browser, page, `${prefix}submit-collapse`, width, t0, phone ? "submitting closes the bottom drawer" : "submitting collapses the card");
    await waitFor(browser, page.sessionId, `!document.querySelector("[data-testid=alignment-submit]") && !document.querySelector("[data-testid=chat-progress]")`, 15000);
    await sleep(500);

    // Scenes: the progress card appearing, then closing when the request fails.
    await showChat(browser, page, width);
    const stopFailing = await failChatRequests(browser, page.sessionId, 1500);
    await browser.send("Network.enable", {}, page.sessionId);
    await browser.send("Network.emulateNetworkConditions", { offline: false, latency: 1200, downloadThroughput: -1, uploadThroughput: -1 }, page.sessionId);
    await browser.eval(sendChatExpression("首屏标题写成按图加工的重载减速机"), page.sessionId);
    t0 = Date.now();
    await browser.eval(clickExpression("chat-send", "发送"), page.sessionId);
    await frames(browser, page, `${prefix}progress-open`, width, t0, "the step card appearing while the request is pending");
    for (let attempt = 0; attempt < 800; attempt += 1) {
      if (await browser.eval<boolean>(`Boolean(document.querySelector(".chat-progress.is-closing"))`, page.sessionId).catch(() => false)) break;
      await sleep(5);
    }
    t0 = Date.now();
    await frames(browser, page, `${prefix}progress-close`, width, t0, "the step card closing when the request fails");
    await stopFailing();
    await browser.send("Network.emulateNetworkConditions", { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 }, page.sessionId);
    await sleep(500);

    // Scene: the preview after a palette change.
    await showChat(browser, page, width);
    await browser.eval(clickExpression("open-color-panel", "配色"), page.sessionId);
    await sleep(400);
    if (phone) await browser.eval(`document.querySelector(".palette-card:not(.selected)")?.scrollIntoView({ block: "center" })`, page.sessionId);
    t0 = Date.now();
    await browser.eval(`document.querySelector(".palette-card:not(.selected)")?.click()`, page.sessionId);
    if (phone) await showPreview(browser, page, width);
    await frames(browser, page, `${prefix}preview-refresh`, width, t0, phone ? "taken after switching to the preview tab, so it shows the tail of the refresh" : "the canvas while the new palette is written and applied");
  } finally {
    await closePage(browser, page);
  }
}

async function main() {
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  const browser = await openBrowser();
  try {
    for (const width of WIDTHS) {
      await runScenes(browser, width, false);
      await runScenes(browser, width, true);
    }
  } finally {
    browser.ws.close();
    const lines = [
      "# T-052 motion frames",
      "",
      `Regenerate: CHROME_PATH=... node --experimental-strip-types scripts/capture-workspace-motion-frames.ts`,
      "",
      `${FRAMES} screenshots per scene, taken back to back right after the trigger. \`t\` is the milliseconds after the trigger at which each frame was taken. Scenes prefixed \`reduced-\` ran under prefers-reduced-motion. \`distinct\` counts different images among the frames.`,
      "",
    ];
    for (const item of shots) {
      lines.push(`- ${item.scene} | ${item.width} px | distinct ${item.distinct}${item.note ? ` | ${item.note}` : ""}`);
      if (item.files.length) lines.push(`  ${item.files.map((file, index) => `${file} (t=${item.times[index]}ms)`).join(", ")}`);
    }
    writeFileSync(new URL("index.md", outDir), lines.join("\n") + "\n");
  }
}

await main();
