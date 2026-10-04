#!/usr/bin/env node
import fs from "node:fs";
import { closeBrowser, closePage, openBrowser, openWorkspace, screenshot, waitFor } from "../tests/helpers/workspace-browser.ts";

const base = process.env.SITECRAFT_BASE || "http://127.0.0.1:3070";
const siteId = process.argv[2];
const out = process.argv[3] || "artifacts/t086";
if (!siteId) throw new Error("usage: check-t086-annotation.mjs <siteId> [out]");
fs.mkdirSync(out, { recursive: true });

async function frameTarget(browser, page) {
  const tree = await browser.send("Page.getFrameTree", {}, page.sessionId);
  return tree.frameTree.childFrames?.find((item) => String(item.frame?.url || "").includes("/api/templates/"))?.frame;
}

async function readProductRect(browser, page, frameId) {
  const world = await browser.send("Page.createIsolatedWorld", { frameId, worldName: "t086-read-only" }, page.sessionId);
  const result = await browser.send("Runtime.evaluate", {
    contextId: world.executionContextId,
    expression: `(() => {
      const node = document.querySelector("[data-sitecraft-product-id]");
      if (!node) return null;
      node.scrollIntoView({ block: "center", inline: "center" });
      const rect = node.getBoundingClientRect();
      return { productId: node.getAttribute("data-sitecraft-product-id"), slot: node.getAttribute("data-sitecraft-slot"), rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height } };
    })()`,
    returnByValue: true,
  }, page.sessionId);
  return result.result?.value || null;
}

async function clickProductWithPointer(browser, page) {
  const frame = await frameTarget(browser, page);
  if (!frame?.id) throw new Error("preview iframe frame was not found");
  let product = await readProductRect(browser, page, frame.id);
  if (!product) throw new Error("product card was not rendered");
  const iframe = await browser.eval(`(() => { const rect = document.querySelector("[data-testid=open-source-template-frame]").getBoundingClientRect(); return { left: rect.left, top: rect.top, width: rect.width, height: rect.height }; })()`, page.sessionId);
  const viewportHeight = await browser.eval("innerHeight", page.sessionId);
  for (let attempt = 0; attempt < 4 && (product.rect.top < 0 || product.rect.top + product.rect.height > viewportHeight); attempt += 1) {
    await browser.send("Input.dispatchMouseEvent", { type: "mouseWheel", x: iframe.left + iframe.width / 2, y: iframe.top + iframe.height / 2, deltaX: 0, deltaY: 600 }, page.sessionId);
    await new Promise((resolve) => setTimeout(resolve, 250));
    product = await readProductRect(browser, page, frame.id);
    if (!product) throw new Error("product card disappeared while scrolling");
  }
  let x = iframe.left + product.rect.left + Math.max(4, product.rect.width / 2);
  const pageWidth = await browser.eval("innerWidth", page.sessionId);
  const y = iframe.top + product.rect.top + (pageWidth <= 375 ? 8 : Math.max(4, product.rect.height * 0.25));
  const chat = await browser.eval(`(() => { const rect = document.querySelector(".builder-chat")?.getBoundingClientRect(); return rect ? { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height } : null; })()`, page.sessionId);
  if (chat && chat.width > 0 && x >= chat.left && x <= chat.right && y >= chat.top && y <= chat.bottom) {
    x = iframe.left + product.rect.left + Math.min(product.rect.width * 0.25, Math.max(4, chat.left - iframe.left - product.rect.left - 8));
  }
  await browser.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 }, page.sessionId);
  await browser.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 }, page.sessionId);
  return { productId: product.productId, slot: product.slot, rect: product.rect, iframe, viewportHeight, chat, click: { x, y } };
}

const browser = await openBrowser();
const report = { ticket: "T-086", base, siteId, widths: [], startedAt: new Date().toISOString() };
try {
  for (const width of [1440, 768, 375]) {
    const page = await openWorkspace(browser, { siteId, width, theme: "dark", height: width < 800 ? 812 : 1000 });
    await waitFor(browser, page.sessionId, `document.querySelector("[data-testid=open-source-template-frame]")?.dataset.previewHydrated === "true"`, 20000);
    if (width === 375) {
      await browser.eval(`(() => { [...document.querySelectorAll(".builder-mobile-tabs button")].find((item) => item.textContent.includes("预览"))?.click(); return true; })()`, page.sessionId);
      await waitFor(browser, page.sessionId, `document.querySelector("[data-testid=open-source-template-frame]")?.dataset.previewHydrated === "true"`, 10000);
    }
    const candidate = await clickProductWithPointer(browser, page);
    const attached = await waitFor(browser, page.sessionId, `document.querySelector("[data-testid=annotation-current]")?.className.includes("attached")`, 10000);
    const state = await browser.eval(`(() => ({
      activeTab: document.querySelector(".builder-mobile-tabs button.active")?.textContent || "",
      previewState: document.querySelector(".open-source-template-frame-shell")?.dataset.previewState || "",
      currentClass: document.querySelector("[data-testid=annotation-current]")?.className || "",
      current: document.querySelector("[data-testid=annotation-current]")?.textContent || "",
      chat: document.querySelector(".builder-chat")?.getBoundingClientRect().toJSON(),
      preview: document.querySelector(".preview-shell")?.getBoundingClientRect().toJSON(),
    }))()`, page.sessionId);
    const shot = `${out}/annotation-pointer-${width}.png`;
    fs.writeFileSync(shot, await screenshot(browser, page.sessionId));
    report.widths.push({ width, candidate, attached, state, screenshot: shot });
    await closePage(browser, page);
  }
} finally {
  await closeBrowser(browser);
}
report.finishedAt = new Date().toISOString();
report.result = report.widths.every((item) => item.attached && item.candidate.slot === "products.ra-gearbox");
const reportPath = `${out}/annotation-check-pointer.json`;
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ result: report.result ? "PASS" : "FAIL", report: reportPath }));
if (!report.result) process.exitCode = 1;
