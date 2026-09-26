#!/usr/bin/env node
/**
 * End-to-end check of published visitor pages in real Chrome.
 *
 * Opens /published/<siteKey> for each sample draft at 1440 / 768 / 375, waits for the
 * preview iframe to be ready and its height to settle, asserts visitor-page rules, and
 * saves a full-page screenshot plus report.json.
 *
 *   node scripts/check-published.mjs [--out artifacts/published-check/<label>] [siteKey ...]
 *
 * Needs the dev server on http://127.0.0.1:3034 and Google Chrome. Exit 1 on any failed rule.
 */
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const BASE = process.env.SITECRAFT_BASE || "http://127.0.0.1:3034";
const CDP_PORT = process.env.CDP_PORT || "9346";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PROFILE = "/tmp/sitecraft-published-check";
const WIDTHS = [1440, 768, 375];
const DEFAULT_SITES = ["overlay-p3i-thick-20260925", "overlay-p3e-thick-20260925", "overlay-sparse-20260924"];

// Copy that must never reach a visitor: the old demo draft text, meta copy about the
// materials, and the simulated-pack label. Taken from the requirement, not from the code.
const FORBIDDEN_TEXT = [
  "说说你的下一件事", "留下项目需求，我们会尽快与你联系", "需求与评估", "方案与实施", "交付与支持",
  "为下一代标准而造", "为复杂项目，提供确定答案", "Forge Industrial",
  "以下内容可通过表格批量导入", "仅列资料中的认证", "资料给出的主工序", "资料确认的工况入口", "只列资料给出的工序",
  "模拟设定", "simulated settings",
];

const args = process.argv.slice(2);
const outIndex = args.indexOf("--out");
const outDir = outIndex >= 0 ? args[outIndex + 1] : path.join("artifacts", "published-check", new Date().toISOString().replace(/[:.]/g, "-"));
const sites = args.filter((arg, i) => arg !== "--out" && i !== outIndex + 1);
const siteKeys = sites.length ? sites : DEFAULT_SITES;
fs.mkdirSync(outDir, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class Cdp {
  constructor(url) { this.url = url; this.nextId = 1; this.pending = new Map(); }
  async connect() {
    this.ws = new WebSocket(this.url);
    await new Promise((resolve, reject) => {
      this.ws.addEventListener("open", resolve, { once: true });
      this.ws.addEventListener("error", reject, { once: true });
    });
    this.ws.addEventListener("close", () => {
      for (const waiter of this.pending.values()) waiter.reject(new Error("DevTools connection closed"));
      this.pending.clear();
    });
    this.ws.addEventListener("message", (event) => {
      const msg = JSON.parse(event.data);
      const waiter = msg.id && this.pending.get(msg.id);
      if (!waiter) return;
      this.pending.delete(msg.id);
      if (msg.error) waiter.reject(new Error(JSON.stringify(msg.error)));
      else waiter.resolve(msg.result);
    });
  }
  send(method, params = {}, sessionId) {
    const id = this.nextId++;
    this.ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`${method} timed out`));
      }, 60000);
      this.pending.set(id, {
        resolve: (value) => { clearTimeout(timer); resolve(value); },
        reject: (error) => { clearTimeout(timer); reject(error); },
      });
    });
  }
  async evaluate(expression, sessionId) {
    const { result, exceptionDetails } = await this.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }, sessionId);
    if (exceptionDetails) throw new Error(exceptionDetails.exception?.description || exceptionDetails.text);
    return result.value;
  }
}

async function connectChrome() {
  const versionUrl = `http://127.0.0.1:${CDP_PORT}/json/version`;
  let version = await fetch(versionUrl).then((r) => r.json()).catch(() => null);
  if (!version) {
    spawn(CHROME, [`--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${PROFILE}`, "--headless=new", "--no-first-run", "--no-default-browser-check", "about:blank"], { stdio: "ignore", detached: true }).unref();
    for (let i = 0; i < 60 && !version; i++) {
      await sleep(250);
      version = await fetch(versionUrl).then((r) => r.json()).catch(() => null);
    }
  }
  if (!version?.webSocketDebuggerUrl) throw new Error("Chrome DevTools endpoint not available");
  const browser = new Cdp(version.webSocketDebuggerUrl);
  await browser.connect();
  return browser;
}

async function openPage(browser) {
  const { targetId } = await browser.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await browser.send("Target.attachToTarget", { targetId, flatten: true });
  await browser.send("Page.enable", {}, sessionId);
  await browser.send("Runtime.enable", {}, sessionId);
  return { targetId, sessionId };
}

async function waitFor(check, what, timeoutMs = 90000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const value = await check();
    if (value) return value;
    await sleep(250);
  }
  throw new Error(`timeout waiting for ${what}`);
}

async function attachPreviewFrame(browser) {
  const target = await waitFor(async () => {
    const { targetInfos } = await browser.send("Target.getTargets");
    return targetInfos.find((t) => t.type === "iframe" && t.url.includes("/api/templates/"));
  }, "preview iframe target");
  const { sessionId } = await browser.send("Target.attachToTarget", { targetId: target.targetId, flatten: true });
  await browser.send("Runtime.enable", {}, sessionId);
  return sessionId;
}

// Runs inside the preview document and reports what a visitor would see.
const INSPECT = `(async () => {
  const visible = (el) => {
    if (!el) return false;
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
  };
  const text = document.body.innerText;
  const contact = document.querySelector('[data-sitecraft-section="contact"]');
  const form = contact && contact.querySelector("form");
  const cta = document.querySelector('[data-sitecraft-benchmark="hero-cta"]');
  const ctaTarget = cta && cta.getAttribute("href") && cta.getAttribute("href").startsWith("#") ? document.querySelector(cta.getAttribute("href")) : null;
  const settle = (img) => img.complete ? null : new Promise((done) => {
    img.addEventListener("load", done, { once: true });
    img.addEventListener("error", done, { once: true });
    setTimeout(done, 10000);
  });
  await Promise.all([...document.images].filter(visible).map(settle));
  const images = [...document.images].filter(visible);
  const broken = images.filter((img) => !img.getAttribute("src") || !img.complete || img.naturalWidth === 0).map((img) => img.outerHTML.slice(0, 160));
  const photos = images.filter((img) => img.naturalWidth > 0 && !img.closest("[data-sitecraft-hero-schematic]"));
  return {
    height: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight),
    contactVisible: visible(contact),
    formVisible: visible(form),
    ctaHref: cta && cta.getAttribute("href"),
    ctaTargetVisible: visible(ctaTarget),
    broken,
    photoCount: photos.length,
    saysSchematicOnly: text.includes("非实拍"),
    text,
  };
})()`;

function judge(report) {
  const failures = [];
  if (!report.contactVisible || !report.formVisible) failures.push("inquiry section or form is not visible");
  if (!report.ctaTargetVisible) failures.push(`hero CTA ${report.ctaHref} does not lead to a visible section`);
  if (report.broken.length) failures.push(`broken images: ${report.broken.join(" | ")}`);
  if (report.photoCount > 0 && report.saysSchematicOnly) failures.push("page shows photos but still says illustrations are not real photos");
  for (const phrase of FORBIDDEN_TEXT) if (report.text.includes(phrase)) failures.push(`forbidden visitor text: ${phrase}`);
  return failures;
}

async function checkOne(browser, siteKey, width) {
  const { targetId, sessionId } = await openPage(browser);
  try {
    await browser.send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width < 500 }, sessionId);
    await browser.send("Page.navigate", { url: `${BASE}/published/${siteKey}` }, sessionId);
    await waitFor(async () => {
      const state = await browser.evaluate(`document.querySelector("[data-preview-state]")?.getAttribute("data-preview-state")`, sessionId);
      if (state === "error") throw new Error("preview reported error state");
      return state === "ready";
    }, `${siteKey} preview ready`);
    const frame = await attachPreviewFrame(browser);
    let last = 0;
    let stable = 0;
    await waitFor(async () => {
      const h = await browser.evaluate(`document.documentElement.scrollHeight`, frame);
      stable = Math.abs(h - last) < 8 && h > 600 ? stable + 1 : 0;
      last = h;
      return stable >= 4;
    }, `${siteKey} height to settle`);
    const report = await browser.evaluate(INSPECT, frame);
    await browser.send("Emulation.setDeviceMetricsOverride", { width, height: report.height, deviceScaleFactor: 1, mobile: width < 500 }, sessionId);
    await browser.evaluate(`(() => {
      for (const el of document.querySelectorAll(".published-template-shell, .published-template-stage, .open-source-template-frame-shell, iframe.open-source-template-frame")) {
        el.style.height = "${report.height}px"; el.style.minHeight = "${report.height}px"; el.style.overflow = "visible";
      }
    })()`, sessionId);
    await sleep(600);
    const shot = await browser.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: 0, y: 0, width, height: report.height, scale: 1 } }, sessionId);
    const file = path.join(outDir, `${siteKey}-${width}.png`);
    fs.writeFileSync(file, Buffer.from(shot.data, "base64"));
    const failures = judge(report);
    delete report.text;
    return { siteKey, width, screenshot: file, failures, ...report };
  } finally {
    await browser.send("Target.closeTarget", { targetId }).catch(() => {});
  }
}

const browser = await connectChrome();
const results = [];
for (const siteKey of siteKeys) {
  for (const width of WIDTHS) {
    const result = await checkOne(browser, siteKey, width).catch((error) => ({ siteKey, width, failures: [`check crashed: ${error.message}`] }));
    results.push(result);
    console.log(`${result.failures.length ? "FAIL" : "ok  "} ${siteKey} @${width}${result.failures.map((f) => `\n     - ${f}`).join("")}`);
  }
}
fs.writeFileSync(path.join(outDir, "report.json"), JSON.stringify(results, null, 2));
console.log(`report: ${path.join(outDir, "report.json")}`);
browser.ws.close();
process.exit(results.some((r) => r.failures.length) ? 1 : 0);
