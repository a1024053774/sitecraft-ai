#!/usr/bin/env node
/**
 * End-to-end check of published visitor pages in real Chrome.
 *
 * Opens /published/<siteKey> for each sample draft at 1440 / 768 / 375, waits for the
 * preview iframe to be ready and its height to settle, asserts visitor-page rules, and
 * saves a full-page screenshot plus report.json.
 *
 *   node scripts/check-published.mjs [--out artifacts/published-check/<label>] [--submit] [siteKey ...]
 *
 * --submit also sends one real inquiry per site at 1440 and 375 (it lands in that site's inbox),
 * double-clicks submit to check for duplicates, and sends an over-long message the API rejects to
 * check that the visitor sees the error next to the form with their input kept.
 *
 * Needs the dev server on http://127.0.0.1:3034 and Google Chrome. Exit 1 on any failed rule.
 */
import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";

const BASE = process.env.SITECRAFT_BASE || "http://127.0.0.1:3034";
// Each run gets its own Chrome (port and profile), so parallel runs by different agents never
// share a browser and a restart here cannot kill someone else's.
const CDP_PORT = process.env.CDP_PORT || String(9400 + (process.pid % 500));
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PROFILE = `/tmp/sitecraft-published-check-${process.pid}`;
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
const submit = args.includes("--submit");
const sites = args.filter((arg, i) => arg !== "--out" && arg !== "--submit" && (outIndex < 0 || i !== outIndex + 1));
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
  // Every loaded <img> is a photo; schematics are drawn with CSS and labelled 示意.
  const photos = images.filter((img) => img.naturalWidth > 0);
  // Follow the hero button the way a visitor would and see where the page lands.
  let ctaLandsOnForm = false;
  if (cta && form) {
    cta.click();
    // Smooth scrolling takes a variable time; poll for up to 5 s instead of guessing.
    for (let waited = 0; waited < 5000 && !ctaLandsOnForm; waited += 200) {
      await new Promise((done) => setTimeout(done, 200));
      const rect = form.getBoundingClientRect();
      ctaLandsOnForm = rect.top < innerHeight && rect.bottom > 0;
    }
    scrollTo({ top: 0, behavior: "instant" });
  }
  // Nothing may sit on top of a real hero photo (decorative rings, cards, labels).
  const heroImage = document.querySelector('[data-sitecraft-benchmark="hero-image"]');
  let heroPhotoCovered = false;
  if (heroImage && visible(heroImage) && heroImage.naturalWidth > 0) {
    heroImage.scrollIntoView({ block: "center" });
    const box = heroImage.getBoundingClientRect();
    for (const [fx, fy] of [[0.5, 0.5], [0.25, 0.25], [0.75, 0.75], [0.25, 0.75], [0.75, 0.25]]) {
      const hit = document.elementFromPoint(box.left + box.width * fx, box.top + box.height * fy);
      if (hit && hit !== heroImage) heroPhotoCovered = true;
    }
    scrollTo({ top: 0, behavior: "instant" });
  }
  // Decorative section numbers such as "01" / "02".
  const numbering = [...document.querySelectorAll("body *")].filter((el) => !el.children.length && visible(el) && /^0[1-9]$/.test(el.textContent.trim())).length;
  // On a phone the header must still offer navigation: a visible link or a menu toggle.
  const header = document.querySelector('[data-sitecraft-section="nav"]') || document.querySelector("header");
  const headerNav = header ? [...header.querySelectorAll("a[href^='#'], summary, button")].filter((el) => visible(el) && !el.closest("[data-sitecraft-locale-switch]") && el.getAttribute("href") !== "#top" && !el.closest(".sitecraft-brand")).length : 0;
  function textLines(el) {
    const node = el && [...el.childNodes].find((item) => item.nodeType === 3 && (item.textContent || "").trim());
    if (!node) return [];
    const value = node.textContent || "";
    const range = document.createRange();
    const lines = [];
    let line = "";
    let lastTop = null;
    for (let index = 0; index < value.length; index += 1) {
      range.setStart(node, index);
      range.setEnd(node, index + 1);
      const top = Math.round(range.getBoundingClientRect().top);
      if (lastTop !== null && Math.abs(top - lastTop) > 1) {
        lines.push(line);
        line = value[index];
      } else line += value[index];
      lastTop = top;
    }
    if (line) lines.push(line);
    return lines;
  }
  const heroLines = textLines(document.querySelector(".sitecraft-hero h1"));
  const heroLast = (heroLines[heroLines.length - 1] || "").split(" ").join("");
  const heroOrphan = heroLines.length > 1 && Array.from(heroLast).length < 2;
  const headerControls = header ? [...header.querySelectorAll(".sitecraft-nav-cta, summary")].filter((el) => visible(el)) : [];
  const headerControlStacked = headerControls.some((el) => textLines(el).length > 1);
  const brand = document.querySelector(".sitecraft-brand-name");
  // A squeezed flex parent can wrap the name inside the box, so scrollWidth stays
  // equal to clientWidth while a later line or the last glyph is clipped.
  let brandClipped = false;
  if (brand) {
    brandClipped = brand.scrollWidth > brand.clientWidth + 1 || brand.scrollHeight > brand.clientHeight + 1;
    const brandNode = [...brand.childNodes].find((item) => item.nodeType === 3 && (item.textContent || "").trim());
    const brandValue = brandNode ? brandNode.textContent || "" : "";
    const range = document.createRange();
    for (let index = 0; index < brandValue.length && !brandClipped; index += 1) {
      const character = brandValue[index];
      if (character.trim() === "") continue;
      range.setStart(brandNode, index);
      range.setEnd(brandNode, index + 1);
      const rect = range.getBoundingClientRect();
      if (rect.width < 0.5 || rect.height < 0.5 || rect.left < -1 || rect.right > innerWidth + 1) {
        brandClipped = true;
        break;
      }
      let parent = brand.parentElement;
      while (parent && !brandClipped) {
        const parentStyle = getComputedStyle(parent);
        const clipX = parentStyle.overflowX === "hidden" || parentStyle.overflowX === "clip";
        const clipY = parentStyle.overflowY === "hidden" || parentStyle.overflowY === "clip";
        if (clipX || clipY) {
          const bounds = parent.getBoundingClientRect();
          if ((clipX && (rect.left < bounds.left - 1 || rect.right > bounds.right + 1)) || (clipY && (rect.top < bounds.top - 1 || rect.bottom > bounds.bottom + 1))) brandClipped = true;
        }
        parent = parent.parentElement;
      }
    }
  }
  const siteHeader = document.querySelector(".sitecraft-nav") || document.querySelector("header");
  const headerOverflow = Boolean(siteHeader && (siteHeader.scrollWidth > siteHeader.clientWidth + 1 || siteHeader.getBoundingClientRect().right > innerWidth + 1));
  const editableSlot = [...document.querySelectorAll("[data-sitecraft-slot]")].find((el) => !el.closest("a, button, summary, label, input, select, textarea"));
  const previewCss = [...document.querySelectorAll("style")].map((node) => node.textContent || "").join("");
  const cardOverflow = [];
  for (const card of document.querySelectorAll(".sitecraft-product-card, .sitecraft-catalog-card")) {
    for (const el of card.querySelectorAll("*")) {
      if (!visible(el)) continue;
      let clipped = false;
      for (let parent = el.parentElement; parent && parent !== card; parent = parent.parentElement) {
        const overflowX = getComputedStyle(parent).overflowX;
        if (overflowX === "hidden" || overflowX === "clip") { clipped = true; break; }
      }
      if (clipped) continue;
      const box = el.getBoundingClientRect();
      const bounds = card.getBoundingClientRect();
      if (box.width > 2 && (box.right > bounds.right + 1 || box.left < bounds.left - 1)) cardOverflow.push(el.tagName.toLowerCase());
    }
  }
  return {
    editorCursor: editableSlot ? getComputedStyle(editableSlot).cursor : "",
    editorHoverOutline: previewCss.includes("[data-sitecraft-slot]:hover{") && previewCss.includes("outline:"),
    horizontalScroll: document.documentElement.scrollWidth > innerWidth + 1,
    cardOverflow: cardOverflow.length,
    cardOverflowSample: cardOverflow.slice(0, 6),
    heroOrphan,
    brandClipped,
    headerOverflow,
    headerControlStacked,
    heroPhotoCovered,
    numbering,
    phoneNav: innerWidth >= 500 || headerNav > 0,
    height: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight),
    contactVisible: visible(contact),
    formVisible: visible(form),
    ctaHref: cta && cta.getAttribute("href"),
    ctaTargetVisible: visible(ctaTarget),
    ctaLandsOnForm,
    broken,
    photoCount: photos.length,
    saysSchematicOnly: text.includes("非实拍"),
    text,
  };
})()`;

function judge(report, expectedText) {
  const failures = [];
  if (report.editorCursor === "pointer") failures.push("visitor slot uses a pointer cursor");
  if (report.editorHoverOutline) failures.push("visitor slot shows an editor hover outline");
  if (report.horizontalScroll) failures.push("visitor page scrolls horizontally");
  if (report.cardOverflow) failures.push(`card content overflows its card (${report.cardOverflow}: ${(report.cardOverflowSample || []).join(", ")})`);
  if (report.heroOrphan) failures.push("hero title last line is a single character");
  if (report.brandClipped) failures.push("header company name is truncated");
  if (report.headerOverflow) failures.push("header overflows the viewport");
  if (report.headerControlStacked) failures.push("header control text wraps inside its button");
  if (report.heroPhotoCovered) failures.push("something is drawn on top of the hero photo");
  if (report.numbering) failures.push(`decorative section numbers visible (${report.numbering})`);
  if (!report.phoneNav) failures.push("no navigation or menu in the header at phone width");
  for (const phrase of expectedText) if (!report.text.includes(phrase)) failures.push(`draft content missing from the page: ${phrase}`);
  if (!report.contactVisible || !report.formVisible) failures.push("inquiry section or form is not visible");
  if (!report.ctaTargetVisible) failures.push(`hero CTA ${report.ctaHref} does not lead to a visible section`);
  if (!report.ctaLandsOnForm) failures.push("clicking the hero CTA does not bring the inquiry form into view");
  if (report.broken.length) failures.push(`broken images: ${report.broken.join(" | ")}`);
  if (report.photoCount > 0 && report.saysSchematicOnly) failures.push("page shows photos but still says illustrations are not real photos");
  for (const phrase of FORBIDDEN_TEXT) if (report.text.includes(phrase)) failures.push(`forbidden visitor text: ${phrase}`);
  return failures;
}

const FORM = `document.querySelector('[data-sitecraft-inquiry="true"]')`;

async function fillForm(browser, frame, marker) {
  await browser.evaluate(`(() => {
    const form = ${FORM};
    const set = (name, value) => { const el = form.querySelector('[name="' + name + '"]'); el.value = value; el.dispatchEvent(new Event("input", { bubbles: true })); };
    set("name", "验收访客"); set("email", "visitor@example.test"); set("company", "验收公司"); set("message", ${JSON.stringify(marker)});
  })()`, frame);
}

async function readForm(browser, frame) {
  return browser.evaluate(`(() => {
    const form = ${FORM};
    const status = form && (form.querySelector("[data-sitecraft-inquiry-status]") || form.parentElement.querySelector("[data-sitecraft-inquiry-status]"));
    const visible = status && getComputedStyle(status).display !== "none" && status.getBoundingClientRect().height > 0;
    return { state: form.getAttribute("data-sitecraft-inquiry-state"), statusText: visible ? status.textContent.trim() : "", message: form.querySelector('[name="message"]').value };
  })()`, frame);
}

async function leadCount(siteKey, marker) {
  const payload = await fetch(`${BASE}/api/leads?site=${encodeURIComponent(siteKey)}`).then((r) => r.json());
  const leads = payload.leads || payload.items || [];
  return leads.filter((lead) => JSON.stringify(lead).includes(marker)).length;
}

function screenshotInk(file) {
  const probe = spawnSync("python3", ["-c", "from PIL import Image\nimport sys\nim=Image.open(sys.argv[1]).convert('L')\nvals=list(im.resize((48,48)).getdata())\nprint(sum(1 for v in vals if v < 245))\n", file], { encoding: "utf8" });
  const ink = Number((probe.stdout || "").trim());
  return Number.isFinite(ink) ? ink : 0;
}

async function shootForm(browser, sessionId, frame, width, file) {
  const docHeight = await browser.evaluate(`Math.max(document.documentElement.scrollHeight, document.body.scrollHeight)`, frame);
  await browser.evaluate(`(() => {
    const height = "${docHeight}px";
    for (const el of document.querySelectorAll("iframe.open-source-template-frame, .open-source-template-frame-shell, .published-template-stage, .published-template-shell")) {
      el.style.height = height;
      el.style.minHeight = height;
    }
  })()`, sessionId);
  await sleep(200);
  const localTop = await browser.evaluate(`(() => { const rect = ${FORM}.closest("section").getBoundingClientRect(); return rect.top + scrollY; })()`, frame);
  const page = await browser.evaluate(`(() => { const node = document.querySelector("iframe.open-source-template-frame"); const rect = node.getBoundingClientRect(); return { frameTop: rect.top + scrollY, pageHeight: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight) }; })()`, sessionId);
  const y = Math.max(0, Math.round(page.frameTop + localTop - 16));
  const full = `${file}.full.png`;
  const shot = await browser.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: 0, y: 0, width, height: page.pageHeight, scale: 1 } }, sessionId);
  fs.writeFileSync(full, Buffer.from(shot.data, "base64"));
  const cropped = `${file}.crop.png`;
  spawnSync("python3", ["-c", "from PIL import Image\nimport sys\nim=Image.open(sys.argv[1])\ny=max(0, min(int(sys.argv[2]), im.height - 1))\nh=max(1, min(int(sys.argv[3]), im.height - y))\nim.crop((0, y, im.width, y + h)).save(sys.argv[4])\n", full, String(y), "1000", cropped], { encoding: "utf8" });
  fs.rmSync(full, { force: true });
  await browser.send("Emulation.setDeviceMetricsOverride", { width, height: 1000, deviceScaleFactor: 1, mobile: width < 500 }, sessionId);
  await browser.evaluate(`scrollTo(0, ${y})`, sessionId);
  await sleep(800);
  const view = await browser.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false }, sessionId);
  const viewed = `${file}.view.png`;
  fs.writeFileSync(viewed, Buffer.from(view.data, "base64"));
  const cropInk = fs.existsSync(cropped) ? screenshotInk(cropped) : 0;
  const viewInk = screenshotInk(viewed);
  fs.copyFileSync(viewInk >= cropInk ? viewed : cropped, file);
  fs.rmSync(cropped, { force: true });
  fs.rmSync(viewed, { force: true });
  if (Math.max(cropInk, viewInk) < 24) return "inquiry screenshot is blank";
  return "";
}

async function checkSubmission(browser, sessionId, frame, siteKey, width) {
  const failures = [];
  const shotBase = path.join(outDir, `${siteKey}-${width}-inquiry`);
  const marker = `check-published ${siteKey} ${width} ${Date.now()}`;
  // Success path: double click must still create exactly one lead.
  await fillForm(browser, frame, marker);
  await browser.evaluate(`(() => { const b = ${FORM}.querySelector('[type="submit"]'); b.click(); b.click(); })()`, frame);
  const sent = await waitFor(async () => {
    const form = await readForm(browser, frame);
    return form.state === "sent" || form.state === "error" ? form : null;
  }, `${siteKey} inquiry result`, 20000).catch(() => null);
  if (!sent || sent.state !== "sent") failures.push(`inquiry success not shown at the form (state ${sent && sent.state})`);
  else {
    const sentBlank = await shootForm(browser, sessionId, frame, width, `${shotBase}-sent.png`);
    if (sentBlank) failures.push(sentBlank);
    if (!sent.statusText) failures.push("inquiry success has no visible status text");
    if (sent.message) failures.push("form was not cleared after success");
  }
  await sleep(800);
  const count = await leadCount(siteKey, marker);
  if (count !== 1) failures.push(`expected 1 stored lead for this submission, found ${count}`);
  // Failure path: a message longer than the server accepts is rejected by the real API (the
  // browser's maxlength does not apply to values set by script). The visitor must see why and keep
  // their text.
  const failMarker = `${marker} failure `.padEnd(4100, "x");
  await fillForm(browser, frame, failMarker);
  await browser.evaluate(`${FORM}.querySelector('[type="submit"]').click()`, frame);
  const failed = await waitFor(async () => {
    const form = await readForm(browser, frame);
    return form.state === "error" ? form : null;
  }, `${siteKey} inquiry error`, 15000).catch(() => null);
  if (!failed) failures.push("inquiry failure not shown at the form");
  else {
    const errorBlank = await shootForm(browser, sessionId, frame, width, `${shotBase}-error.png`);
    if (errorBlank) failures.push(errorBlank);
    if (!failed.statusText) failures.push("inquiry failure has no visible status text");
    if (failed.message !== failMarker) failures.push("visitor input was lost after a failed submission");
  }
  return { failures, success: sent, failure: failed };
}

// Catalog entries the draft actually provides must reach the visitor page (visitor-visible ones only).
async function expectedDraftText(siteKey) {
  const payload = await fetch(`${BASE}/api/sites/${siteKey}/draft`).then((r) => r.json()).catch(() => null);
  const draft = payload && (payload.draft || payload);
  const content = draft && draft.content;
  if (!content) return [];
  const gap = (v) => !v || /^(待补充|To be provided)$/.test(String(v).trim());
  const out = [];
  for (const key of ["industries", "capabilities", "certifications"]) {
    for (const item of (content[key] && content[key].items) || []) {
      const title = item.title && item.title.zh;
      if (gap(title)) continue;
      if (key === "certifications" && !(item.status === "已有" || item.status === "认证中")) continue;
      out.push(title);
    }
  }
  return out;
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
    const failures = judge(report, await expectedDraftText(siteKey));
    delete report.text;
    if (submit) {
      const result = await checkSubmission(browser, sessionId, frame, siteKey, width);
      failures.push(...result.failures);
      report.inquiry = { success: result.success, failure: result.failure };
    }
    return { siteKey, width, screenshot: file, failures, ...report };
  } finally {
    await browser.send("Target.closeTarget", { targetId }).catch(() => {});
  }
}

// Headless Chrome occasionally stops answering DevTools after a long run; restart it once per
// crashed page instead of reporting a page failure that is really a browser hang.
async function restartChrome(browser) {
  try { browser.ws.close(); } catch {}
  spawn("pkill", ["-f", `user-data-dir=${PROFILE}`]);
  await sleep(1500);
  return connectChrome();
}

let browser = await connectChrome();
const results = [];
for (const siteKey of siteKeys) {
  for (const width of WIDTHS) {
    let result = await checkOne(browser, siteKey, width).catch((error) => ({ crashed: error }));
    if (result.crashed) {
      console.log(`     (browser stopped responding: ${result.crashed.message}; restarting Chrome and retrying)`);
      browser = await restartChrome(browser);
      result = await checkOne(browser, siteKey, width).catch((error) => ({ siteKey, width, failures: [`check crashed: ${error.message}`] }));
    }
    results.push(result);
    console.log(`${result.failures.length ? "FAIL" : "ok  "} ${siteKey} @${width}${result.failures.map((f) => `\n     - ${f}`).join("")}`);
  }
}
fs.writeFileSync(path.join(outDir, "report.json"), JSON.stringify(results, null, 2));
console.log(`report: ${path.join(outDir, "report.json")}`);
browser.ws.close();
spawnSync("pkill", ["-f", `user-data-dir=${PROFILE}`]);
process.exit(results.some((r) => r.failures.length) ? 1 : 0);
