#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import { mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";

const base = process.env.SITECRAFT_BASE || "http://127.0.0.1:3034";
const out = process.argv[2] || `artifacts/t026-back-office-${Date.now()}`;
await mkdir(out, { recursive: true });
const port = 9353;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
class Cdp {
  constructor(url) { this.url = url; this.id = 1; this.pending = new Map(); }
  async connect() { this.ws = new WebSocket(this.url); await new Promise((resolve, reject) => { this.ws.addEventListener("open", resolve, { once: true }); this.ws.addEventListener("error", reject, { once: true }); }); this.ws.addEventListener("message", (event) => { const message = JSON.parse(event.data); const pending = this.pending.get(message.id); if (!pending) return; this.pending.delete(message.id); message.error ? pending.reject(new Error(JSON.stringify(message.error))) : pending.resolve(message.result); }); }
  send(method, params = {}, sessionId) { const id = this.id++; this.ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })); return new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error(`${method} timeout`)), 30000); this.pending.set(id, { resolve: (value) => { clearTimeout(timer); resolve(value); }, reject: (error) => { clearTimeout(timer); reject(error); } }); }); }
  async eval(expression, sessionId) { const result = await this.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }, sessionId); if (result.exceptionDetails) throw new Error(result.exceptionDetails.text); return result.result.value; }
}
let version = await fetch(`http://127.0.0.1:${port}/json/version`).then((response) => response.json()).catch(() => null);
if (!version) { spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", [`--remote-debugging-port=${port}`, `--user-data-dir=/tmp/sitecraft-t026-${Date.now()}`, "--headless=new", "--no-first-run", "--disable-gpu", "about:blank"], { stdio: "ignore", detached: true }).unref(); for (let attempt = 0; attempt < 40 && !version; attempt += 1) { await sleep(250); version = await fetch(`http://127.0.0.1:${port}/json/version`).then((response) => response.json()).catch(() => null); } }
if (!version) throw new Error("Chrome unavailable");
const browser = new Cdp(version.webSocketDebuggerUrl); await browser.connect();
const report = { ticket: "T-026", base, pages: [] };
for (const path of ["/", "/templates", "/quality?blind=1"]) {
  const { targetId } = await browser.send("Target.createTarget", { url: `${base}${path}` });
  const { sessionId } = await browser.send("Target.attachToTarget", { targetId, flatten: true });
  await browser.send("Page.enable", {}, sessionId); await browser.send("Runtime.enable", {}, sessionId); await browser.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false }, sessionId); await sleep(2500);
  const view = await browser.eval(`(()=>{const text=document.body.innerText;return {text,frames:document.querySelectorAll('.template-cover .open-source-template-frame').length,unavailable:document.querySelectorAll('.template-cover-unavailable').length,activities:document.querySelectorAll('.activity-row').length}})()`, sessionId);
  if (path === "/") { assert.equal(view.text.includes("Forge Industrial"), false); }
  if (path === "/templates") { assert.equal(view.frames > 0, true); assert.equal(view.unavailable > 0, true); }
  if (path.startsWith("/quality")) { assert.match(view.text, /盲评模式/); assert.equal(view.text.includes("核验记号"), false); assert.equal(view.text.includes("冻结 HEAD"), false); }
  const screenshot = await browser.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true }, sessionId); const screenshotPath = `${out}/${path === "/" ? "dashboard" : path.startsWith("/templates") ? "templates" : "quality-blind"}.png`; fs.writeFileSync(screenshotPath, Buffer.from(screenshot.data, "base64")); report.pages.push({ path, view: { frames: view.frames, unavailable: view.unavailable, activities: view.activities }, screenshot: screenshotPath }); await browser.send("Target.closeTarget", { targetId }).catch(() => {});
}
report.result = "PASS"; fs.writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2)); console.log(JSON.stringify({ result: report.result, artifact: `${out}/report.json` })); browser.ws.close();
