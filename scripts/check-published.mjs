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
import { expectedFacts, missingFacts } from "./published-facts.mjs";
import { capturePublishedPage } from "./published-capture.mjs";

const BASE = process.env.SITECRAFT_BASE || "http://127.0.0.1:3034";
// Each run gets its own Chrome (port and profile), so parallel runs by different agents never
// share a browser and a restart here cannot kill someone else's.
const CDP_PORT = process.env.CDP_PORT || String(9400 + (process.pid % 500));
const CHROME = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PROFILE = `/tmp/sitecraft-published-check-${process.pid}`;
const WIDTHS = [1440, 768, 375];
const DEFAULT_SITES = ["overlay-p3i-thick-20260925", "overlay-p3e-thick-20260925", "overlay-sparse-20260924"];

// Copy that must never reach a visitor: the old demo draft text, meta copy about the
// materials, and the simulated-pack label. Taken from the requirement, not from the code.
const FORBIDDEN_TEXT = [
  "说说你的下一件事", "留下项目需求，我们会尽快与你联系", "需求与评估", "方案与实施", "交付与支持",
  "为下一代标准而造", "为复杂项目，提供确定答案", "Forge Industrial",
  "以下内容可通过表格批量导入", "仅列资料中的认证", "资料给出的主工序", "资料确认的工况入口", "只列资料给出的工序",
  "模拟设定", "simulated settings", "虚构",
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
    spawn(CHROME, [`--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${PROFILE}`, "--headless=new", "--no-first-run", "--no-default-browser-check", "--site-per-process", "--enable-features=IsolateSandboxedIframes", "about:blank"], { stdio: "ignore", detached: true }).unref();
    version = await waitFor(() => fetch(versionUrl).then((r) => r.json()).catch(() => null), "Chrome DevTools endpoint", 30000);
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

async function attachPreviewFrame(browser, hostTargetId) {
  const target = await waitFor(async () => {
    const { targetInfos } = await browser.send("Target.getTargets");
    return targetInfos.find((t) => t.type === "iframe" && t.parentId === hostTargetId && t.url.includes("/api/templates/"));
  }, "preview iframe target");
  const { sessionId } = await browser.send("Target.attachToTarget", { targetId: target.targetId, flatten: true });
  await browser.send("Runtime.enable", {}, sessionId);
  return sessionId;
}

// Finds text a visitor cannot read in full; kept in its own file so a probe runs the same code.
const TEXT_FIT_SCAN = fs.readFileSync(new URL("./visitor-text-fit-scan.js", import.meta.url), "utf8").trim();
const HERO_WORD_BREAK_SCAN = fs.readFileSync(new URL("./hero-word-break-scan.js", import.meta.url), "utf8").trim();
const VISITOR_LAYOUT_SCAN = fs.readFileSync(new URL("./visitor-layout-scan.js", import.meta.url), "utf8")
  .replace(/export default scanVisitorLayout;?/g, "")
  .replace(/export function scanVisitorLayout/g, "function scanVisitorLayout");
// The text a visitor can read, folded spec lists and answers opened; the draft's material facts are
// looked for in it (scripts/published-facts.mjs).
const READABLE_TEXT = fs.readFileSync(new URL("./visitor-readable-text.js", import.meta.url), "utf8").trim();
const TEXT_FIT_FAILURES = [
  ["overflow", "text runs out of its cell or card"],
  ["ellipsis", "text is cut off with an ellipsis or a line clamp"],
  ["clipped", "text is clipped by its container"],
  ["viewport", "text runs outside the viewport"],
  ["covered", "text is covered by another visible element"],
  ["narrow-body", "catalog card body is squeezed into a narrow column"],
  ["email", "an email address wraps at a hyphen or inside a name instead of at the @"],
];

const DEFAULT_BLOCK_ORDER = {
  forge: ["hero", "products", "commercialTerms", "equipment", "qualityProcess", "history", "industries", "capabilities", "services", "certifications", "faq", "contact"],
  screwfast: ["hero", "products", "commercialTerms", "equipment", "qualityProcess", "history", "industries", "capabilities", "services", "certifications", "faq", "contact"],
  landwind: ["hero", "products", "commercialTerms", "equipment", "qualityProcess", "history", "industries", "capabilities", "services", "certifications", "faq", "contact"],
  "tailwind-landing": ["hero", "products", "commercialTerms", "equipment", "qualityProcess", "history", "industries", "capabilities", "services", "contact", "certifications", "faq"],
};
const BLOCK_GROUPS = {
  forge: [],
  screwfast: [["industries", "capabilities"]],
  landwind: [["industries", "capabilities"]],
  "tailwind-landing": [],
};

function expectedBlockOrder(draft, templateId) {
  const main = [...(DEFAULT_BLOCK_ORDER[templateId] || DEFAULT_BLOCK_ORDER.forge)];
  const raw = Array.isArray(draft?.sectionOrder) ? draft.sectionOrder : [];
  if (!raw.length) return main;
  const requested = [...new Set(raw.filter((block) => main.includes(block)))];
  if (!requested.length) return main;
  const rank = new Map(requested.map((block, index) => [block, index]));
  const grouped = new Set();
  const units = [];
  for (const group of BLOCK_GROUPS[templateId] || []) {
    const members = group.filter((block) => main.includes(block) && !grouped.has(block));
    if (members.length < 2) continue;
    members.forEach((block) => grouped.add(block));
    units.push({ members, index: units.length });
  }
  for (const block of main) if (!grouped.has(block)) units.push({ members: [block], index: units.length });
  units.forEach((unit) => {
    const ranks = unit.members.map((block) => rank.get(block)).filter((value) => value !== undefined);
    unit.rank = ranks.length ? Math.min(...ranks) : requested.length + unit.index;
  });
  units.sort((a, b) => a.rank - b.rank || a.index - b.index);
  const result = units.flatMap((unit) => [...unit.members].sort((a, b) => (rank.get(a) ?? requested.length) - (rank.get(b) ?? requested.length)));
  const hero = main.indexOf("hero");
  if (hero >= 0) { result.splice(result.indexOf("hero"), 1); result.splice(hero, 0, "hero"); }
  return result;
}

// Runs inside the preview document and reports what a visitor would see.
const INSPECT = `(async (uploadedImages, draft) => {
  const visible = (el) => {
    if (!el) return false;
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
  };
  const text = document.body.innerText;
  const pageSectionOrder = [...document.querySelectorAll("main [data-sc-block]")].map((node) => node.getAttribute("data-sc-block"));
  const contact = document.querySelector('[data-sitecraft-section="contact"]');
  const form = contact && contact.querySelector("form");
  const cta = document.querySelector('[data-sitecraft-benchmark="hero-cta"]');
  const ctaTarget = cta && cta.getAttribute("href") && cta.getAttribute("href").startsWith("#") ? document.querySelector(cta.getAttribute("href")) : null;
  const settle = (img) => img.complete ? null : new Promise((done) => {
    img.addEventListener("load", done, { once: true });
    img.addEventListener("error", done, { once: true });
    setTimeout(done, 10000);
  });
  const photoVisible = (image) => {
    if (!visible(image)) return false;
    for (let node = image; node; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (node.hidden || style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false;
    }
    return true;
  };
  await Promise.all([...document.images].filter(photoVisible).map(settle));
  const images = [...document.images].filter(photoVisible);
  const decoded = new Map();
  await Promise.all(images.map(async (image) => {
    try { await image.decode(); decoded.set(image, image.naturalWidth > 0 && image.naturalHeight > 0); }
    catch { decoded.set(image, false); }
  }));
  const hidden = new Set(draft?.hiddenSections || []);
  const destinations = { product: "products", equipment: "equipment", facility: "hero", inspection: "capabilities" };
  const missingProductText = (value) => {
    const text = String(typeof value === "string" ? value : value?.[document.documentElement.lang] || "").trim();
    return ["", "待补充", "To be provided", "To be completed"].includes(text);
  };
  const offeredProducts = (draft?.products || []).filter(product => product && product.status !== "archived" && !(missingProductText(product.name) && missingProductText(product.summary)));
  const heroProduct = offeredProducts.find(product => typeof product.image?.url === "string" && product.image.url);
  const heroReference = draft?.content?.hero?.image || heroProduct?.image;
  const imageCoverage = {
    expectedCount: uploadedImages.length,
    inspectedCount: uploadedImages.length,
    images: uploadedImages.map((record) => {
      const sections = new Set();
      if (destinations[record.usageCategory]) sections.add(destinations[record.usageCategory]);
      const heroRef = heroReference?.imageId === record.imageId;
      if (heroRef) sections.add("hero");
      const productRef = offeredProducts.some(product => product.image?.imageId === record.imageId);
      if (productRef) sections.add("products");
      const expectedSections = [...sections];
      const exempt = expectedSections.length > 0 && expectedSections.every(section => hidden.has(section));
      const matches = [...document.images].filter(image => image.src === new URL(record.url, location.href).href).map(image => ({
        visible: photoVisible(image), decoded: decoded.get(image) === true,
        complete: image.complete, naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight,
        section: image.closest('[data-sitecraft-section]')?.getAttribute('data-sitecraft-section') || null,
        category: image.closest('[data-sitecraft-image-gallery]')?.getAttribute('data-sitecraft-image-gallery') || null,
        slot: image.getAttribute('data-sitecraft-slot'),
        explicitReference: (heroRef && image.matches('[data-sitecraft-benchmark="hero-image"]')) || (productRef && image.closest('[data-sitecraft-section="products"]') && !image.closest('[data-sitecraft-image-gallery]')),
      }));
      return {
        imageId: record.imageId, originalName: record.originalName, url: record.url,
        category: record.usageCategory, expectedSections, exempt,
        exemptionReason: exempt ? 'hiddenSections:' + expectedSections.join(',') : null, matches,
      };
    }),
  };
  const broken = images.filter((img) => !img.getAttribute("src") || !img.complete || img.naturalWidth === 0).map((img) => img.outerHTML.slice(0, 160));
  // Every loaded <img> is a photo; schematics are drawn with CSS and labelled 示意.
  const photos = images.filter((img) => img.naturalWidth > 0);
  // Follow the hero button the way a visitor would and see where the page lands.
  let ctaLandsOnForm = false;
  if (cta && form) {
    cta.click();
    // Smooth scrolling takes a variable time; poll for up to 5 s instead of guessing.
    await new Promise((resolve) => {
      const started = performance.now();
      const sample = () => {
        const rect = form.getBoundingClientRect();
        ctaLandsOnForm = rect.top < innerHeight && rect.bottom > 0;
        if (ctaLandsOnForm || performance.now() - started >= 5000) return resolve();
        requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
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
  const heroTitleScan = (${HERO_WORD_BREAK_SCAN})(document.querySelector(".sitecraft-hero h1"));
  const heroOrphan = heroTitleScan.heroOrphan;
  const heroTitleWordBreak = heroTitleScan.heroTitleWordBreak;
  const englishSpecValueHan = [...document.querySelectorAll(".sitecraft-product-key dd, .sitecraft-product-specs td, .sitecraft-compare-value, .sitecraft-hero-spec dd, .sitecraft-nameplate dd")]
    .filter(visible)
    .filter((el) => /[\u3400-\u9fff\u3000-\u303f\uff00-\uffef]/.test(el.textContent || ""))
    .map((el) => ({ element: el.tagName.toLowerCase(), text: (el.textContent || "").trim() }));
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
    // A company name may fit its box while still breaking between two characters of one word.
    // Treat that as the same visitor-facing brand failure as clipping.
    if (!brandClipped && brandNode) {
      const wordChar = (value) => /[\u4e00-\u9fffA-Za-z0-9]/.test(value);
      const range = document.createRange();
      for (let index = 0; index + 1 < brandValue.length; index += 1) {
        if (!wordChar(brandValue[index]) || !wordChar(brandValue[index + 1])) continue;
        range.setStart(brandNode, index); range.setEnd(brandNode, index + 1);
        const first = range.getBoundingClientRect();
        range.setStart(brandNode, index + 1); range.setEnd(brandNode, index + 2);
        const second = range.getBoundingClientRect();
        if (Math.abs(first.top - second.top) > 1) { brandClipped = true; break; }
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
  // Text a visitor cannot read in full: past its cell or card, behind an ellipsis, or clipped.
  const textFit = (${TEXT_FIT_SCAN})(document.body);
  const readable = (${READABLE_TEXT})(document.body);
  const layout = (() => { ${VISITOR_LAYOUT_SCAN}; return scanVisitorLayout(document); })();
  const duplicateBodyRows = [...document.querySelectorAll('.sitecraft-catalog-card, .sitecraft-quality-process-item')].filter(row => {
    const title = row.querySelector('h3'), body = row.querySelector('p:not(.sitecraft-cert-status)');
    const trim = value => String(value || '').trim().replace(/[。.]$/, '');
    return visible(row) && visible(body) && title && trim(title.textContent) && trim(title.textContent) === trim(body.textContent);
  }).map(row => row.innerText);
  const hosts = [...document.querySelectorAll('[data-sitecraft-image-credits]')];
  const credits = hosts.length === 1 ? hosts[0] : null;
  const creditItems = credits ? [...credits.querySelectorAll('li')] : [];
  const requiredCredits = uploadedImages.filter(image => image.credit?.[document.documentElement.lang] || image.attribution);
  const creditRecords = requiredCredits.map(image => {
    const credit = image.credit?.[document.documentElement.lang] || '', attribution = image.attribution || '';
    const hasLink = (item, url) => !url || Boolean(item && [...item.querySelectorAll('a')].some(link => link.getAttribute('href') === url && visible(link)));
    const item = creditItems.find(item => visible(item) && (!credit || item.innerText.includes(credit)) && (!attribution || item.innerText.includes(attribution)) && hasLink(item, image.sourceUrl) && hasLink(item, image.licenseUrl));
    return { imageId: image.imageId, credit, attribution, licenseUrl: image.licenseUrl || '', sourceUrl: image.sourceUrl || '', completeTextVisible: Boolean(item), licenseLinkVisible: hasLink(item, image.licenseUrl), sourceLinkVisible: hasLink(item, image.sourceUrl) };
  });
  const missingCredits = creditRecords.filter(record => !record.completeTextVisible || !record.licenseLinkVisible || !record.sourceLinkVisible).map(record => record.imageId);
  const imageCredits = { hostCount: hosts.length, required: requiredCredits.length, records: creditRecords, missing: missingCredits, independent: credits?.parentElement?.classList.contains('sitecraft-container') === true, width: credits?.getBoundingClientRect().width || 0, containerWidth: credits?.closest('.sitecraft-container')?.getBoundingClientRect().width || 0 };
  return {
    duplicateBodyRows,
    imageCredits,
    editorCursor: editableSlot ? getComputedStyle(editableSlot).cursor : "",
    editorHoverOutline: previewCss.includes("[data-sitecraft-slot]:hover{") && previewCss.includes("outline:"),
    horizontalScroll: document.documentElement.scrollWidth > innerWidth + 1,
    pageSectionOrder,
    cardOverflow: cardOverflow.length,
    cardOverflowSample: cardOverflow.slice(0, 6),
    textFit: textFit.slice(0, 40),
    textContrast: layout.textContrast || [],
    bodyLineLength: layout.bodyLineLength || [],
    lineLengthExemptions: layout.lineLengthExemptions || [],
    baselineAlignments: layout.baselineAlignments || [],
    semanticSpacing: layout.semanticSpacing || [],
    primaryButtons: layout.primaryButtons || null,
    undeclaredVariants: layout.undeclaredVariants || [],
    measurement: layout.measurement || null,
    heroOrphan,
    heroTitleWordBreak,
    englishSpecValueHan,
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
    imageCoverage,
    photoCount: photos.length,
    saysSchematicOnly: text.includes("非实拍"),
    text,
    readable,
  };
})`;

function judge(report, facts, locale = "zh", expectedOrder = null) {
  const failures = [...(report.captureFailures || [])];
  if (report.duplicateBodyRows?.length) failures.push(`repeated title/body copy visible (${report.duplicateBodyRows.length})`);
  if (report.imageCredits) {
    const credits = report.imageCredits;
    if (credits.hostCount !== 1) failures.push("image credits have no unique declared host");
    if (credits.required && (!credits.independent || credits.width < credits.containerWidth - 1)) failures.push("image credits are squeezed into a footer column");
    if (credits.missing.length) failures.push(`image author, licence or original source missing (${credits.missing.join(", ")})`);
  }
  const coverage = report.imageCoverage;
  if (!coverage || !Array.isArray(coverage.images) || coverage.expectedCount !== coverage.images.length || coverage.inspectedCount !== coverage.expectedCount) failures.push("image coverage incomplete: uploaded-image inventory was not fully inspected");
  else for (const image of coverage.images) {
    const visibleMatches = image.matches.filter(match => match.visible);
    if (image.exempt) {
      if (!image.exemptionReason?.startsWith("hiddenSections:")) failures.push(`image coverage incomplete: ${image.imageId} has no explicit hide reason`);
      if (visibleMatches.length) failures.push(`explicitly hidden image is visible: ${image.imageId} (${image.originalName})`);
      continue;
    }
    if (!image.expectedSections.length) failures.push(`image has no declared category or draft image reference: ${image.imageId} (${image.originalName})`);
    if (!visibleMatches.length) failures.push(`uploaded image is not visible: ${image.imageId} (${image.originalName})`);
    for (const match of visibleMatches) {
      if (!match.decoded) failures.push(`visible image did not decode: ${image.imageId} (${image.originalName})`);
      if (!image.expectedSections.includes(match.section) || (match.category !== image.category && !match.explicitReference)) failures.push(`image is in the wrong category destination: ${image.imageId} (${image.originalName})`);
    }
  }
  const measurement = report.measurement;
  if (!measurement) failures.push("measurement incomplete: visitor layout scanner returned no measurement metadata");
  else {
    const missingBlocks = measurement.visibleBlocks.filter((block) => !measurement.measuredBlocks.includes(block));
    if (missingBlocks.length) failures.push(`measurement incomplete: visible blocks not measured (${missingBlocks.join(", ")})`);
    if (measurement.textContrastEntries === 0) failures.push("measurement incomplete: no visible text contrast entries");
    if (measurement.bodyParagraphs === 0) failures.push("measurement incomplete: no visible body paragraphs");
  }
  if (expectedOrder && JSON.stringify(report.pageSectionOrder) !== JSON.stringify(expectedOrder)) failures.push(`区块顺序不一致（期望 ${expectedOrder.join("、")}，实际 ${(report.pageSectionOrder || []).join("、")}）`);
  if (report.editorCursor === "pointer") failures.push("visitor slot uses a pointer cursor");
  if (report.editorHoverOutline) failures.push("visitor slot shows an editor hover outline");
  if (report.horizontalScroll) failures.push("visitor page scrolls horizontally");
  if (report.cardOverflow) failures.push(`card content overflows its card (${report.cardOverflow}: ${(report.cardOverflowSample || []).join(", ")})`);
  for (const item of report.baselineAlignments || []) {
    if (item.status === "missing") failures.push(`基线声明落点缺失（${item.block}:${item.variant} ${item.id}）`);
    else if (item.pass === false) failures.push(`基线对齐失败（${item.block}:${item.variant} ${item.id}，差 ${item.delta}px，上限 ${item.threshold || 2}px）`);
  }
  for (const item of report.semanticSpacing || []) {
    if (item.status === "missing") failures.push(`语义组间距声明落点缺失（${item.block}:${item.variant} ${item.id}）`);
    else if (item.pass === false) failures.push(`组内间距不小于组间距（${item.block}:${item.variant} ${item.id}，组内 ${item.within}px，组间 ${item.between}px）`);
  }
  if (report.primaryButtons) {
    if (report.primaryButtons.missing?.length) failures.push(`primary 按钮声明落点缺失（${report.primaryButtons.missing.slice(0, 4).map((item) => `${item.block}:${item.variant} ${item.selector}`).join(", ")}）`);
    if (report.primaryButtons.visibleCount > (report.primaryButtons.max || 1)) failures.push(`每页可见 primary 按钮超过一个（${report.primaryButtons.visibleCount}）`);
    for (const item of report.primaryButtons.vague || []) failures.push(`primary 按钮文案空泛（${item.block}:${item.variant} "${item.text}"）`);
  }
  for (const item of report.textContrast || []) {
    if (!item.checkable) continue;
    if (item.status === "unmeasured") failures.push(`正文对比度未测（${item.reason || "图片背景"}）：${item.element} "${item.text}"`);
    else if (typeof item.ratio === "number" && item.ratio < item.threshold) failures.push(`正文对比度不足 ${item.threshold}:1：${item.element} ${item.ratio.toFixed(2)}:1`);
  }
  for (const item of report.bodyLineLength || []) {
    if (item.tooLong) failures.push(`正文行过长（${item.language === "zh" ? "中文" : "英文"} ${item.count} 字符，上限 ${item.max}）：${item.element} "${item.text}"`);
  }
  for (const [kind, message] of TEXT_FIT_FAILURES) {
    const items = (report.textFit || []).filter((item) => item.kind === kind);
    if (items.length) failures.push(`${message} (${items.length}: ${items.slice(0, 6).map((item) => `${item.element} "${item.text}"`).join(", ")})`);
  }
  if (report.heroOrphan) failures.push("hero title last line is a single character");
  if (report.heroTitleWordBreak) failures.push("hero title breaks inside a Chinese word");
  if (locale === "en" && report.englishSpecValueHan.length) failures.push(`English spec values contain Chinese (${report.englishSpecValueHan.slice(0, 6).map((item) => `${item.element} \"${item.text}\"`).join(", ")})`);
  if (report.brandClipped) failures.push("header company name is truncated");
  if (report.headerOverflow) failures.push("header overflows the viewport");
  if (report.headerControlStacked) failures.push("header control text wraps inside its button");
  if (report.heroPhotoCovered) failures.push("something is drawn on top of the hero photo");
  if (report.numbering) failures.push(`decorative section numbers visible (${report.numbering})`);
  if (!report.phoneNav) failures.push("no navigation or menu in the header at phone width");
  const missing = missingFacts(facts, report.readable);
  if (missing.length) failures.push(`material facts missing from the page (${missing.length} of ${facts.length}: ${missing.slice(0, 6).map((fact) => `${fact.kind} "${fact.text.slice(0, 40)}"`).join(", ")})`);
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

function screenshotFailures(geometry) {
  const failures = [];
  const dimensions = ["width", "pageHeight", "frameTop", "frameHeight", "frameDocumentHeight", "footerBottom", "pngWidth", "pngHeight"];
  if (!geometry || dimensions.some(key => !Number.isFinite(geometry[key])) || geometry.footerBottom <= 0) return ["screenshot incomplete: page, iframe or footer geometry was not measured"];
  if (geometry.pngWidth !== geometry.width || geometry.pngHeight < geometry.pageHeight || geometry.pngHeight + 1 < geometry.frameTop + geometry.footerBottom) failures.push("screenshot incomplete: the bitmap clips the page or footer");
  if (geometry.frameHeight + 1 < geometry.frameDocumentHeight || geometry.frameHeight + 1 < geometry.footerBottom) failures.push("screenshot incomplete: the iframe clips its document or footer");
  if (geometry.devIndicatorVisible) failures.push("development indicator visible in visitor screenshot");
  return failures;
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
  await waitFor(async () => browser.evaluate(`document.fonts?.status === "loaded" && document.documentElement.scrollHeight >= ${docHeight}`, sessionId), `${file} page height after form resize`, 10000);
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
  await waitFor(async () => browser.evaluate(`document.fonts?.status === "loaded" && document.querySelector("iframe.open-source-template-frame")?.getBoundingClientRect().height >= ${docHeight}`, sessionId), `${file} form scroll settle`, 10000);
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
  const count = await waitFor(async () => {
    const value = await leadCount(siteKey, marker);
    return value === 1 ? value : null;
  }, `${siteKey} stored inquiry`, 10000).catch(() => leadCount(siteKey, marker));
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
// The draft's material facts (products and specs, FAQ, steps, catalog entries and bodies, contact),
// read from the draft API, not from the page.
async function draftFacts(siteKey, locale = "zh") {
  const payload = await fetch(`${BASE}/api/sites/${siteKey}/draft`).then((r) => r.json()).catch(() => null);
  const draft = payload && (payload.draft || payload);
  return { draft, facts: draft && draft.content ? expectedFacts(draft, locale) : [] };
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
    const frame = await attachPreviewFrame(browser, targetId);
    const { draft, facts } = await draftFacts(siteKey, "zh");
    const imageResponse = await fetch(`${BASE}/api/sites/${siteKey}/images`);
    if (!imageResponse.ok) throw new Error(`uploaded-image inventory HTTP ${imageResponse.status}`);
    const imagePayload = await imageResponse.json();
    if (!Array.isArray(imagePayload.images)) throw new Error("uploaded-image inventory has no images list");
    const capture = async (locale) => {
      let last = 0;
      let stable = 0;
      await waitFor(async () => {
        const h = await browser.evaluate(`document.documentElement.scrollHeight`, frame);
        stable = Math.abs(h - last) < 8 && h > 600 ? stable + 1 : 0;
        last = h;
        return stable >= 4;
      }, `${siteKey} ${locale} height to settle`);
      // Decode images and exercise visitor interactions before preparing the final viewport.
      await browser.evaluate(`${INSPECT}(${JSON.stringify(imagePayload.images)}, ${JSON.stringify(draft)})`, frame);
      const file = path.join(outDir, `${siteKey}-${locale}-${width}.png`);
      const captured = await capturePublishedPage(browser, sessionId, frame, {
        width, file,
        inspect: () => browser.evaluate(`${INSPECT}(${JSON.stringify(imagePayload.images)}, ${JSON.stringify(draft)})`, frame),
      });
      captured.captureFailures.push(...screenshotFailures(captured.screenshotGeometry));
      return captured;
    };
    const expectedOrder = expectedBlockOrder(draft, draft?.templateId);
    const report = await capture("zh");
    const failures = judge(report, facts, "zh", expectedOrder);
    report.facts = { expected: facts.length, missing: missingFacts(facts, report.readable).length };
    if (submit) {
      const result = await checkSubmission(browser, sessionId, frame, siteKey, width);
      failures.push(...result.failures);
      report.inquiry = { success: result.success, failure: result.failure };
    }
    let english = null;
    if (draft?.englishReady === true) {
      await browser.evaluate(`document.querySelector('[data-sitecraft-locale="en"]')?.click()`, frame);
      await waitFor(() => browser.evaluate(`document.documentElement.lang === "en"`, frame), `${siteKey} English locale`);
      const enReport = await capture("en");
      const enFacts = expectedFacts(draft, "en");
      const enFailures = judge(enReport, enFacts, "en", expectedOrder);
      enReport.facts = { expected: enFacts.length, missing: missingFacts(enFacts, enReport.readable).length };
      delete enReport.text;
      delete enReport.readable;
      english = { ...enReport, failures: enFailures };
      failures.push(...enFailures.map((failure) => `English page: ${failure}`));
    }
    delete report.text;
    delete report.readable;
    return { siteKey, width, screenshot: report.screenshot, failures, ...report, english };
  } finally {
    await browser.send("Target.closeTarget", { targetId }).catch(() => {});
  }
}

let browser = await connectChrome();
const results = [];
for (const siteKey of siteKeys) {
  for (const width of WIDTHS) {
    const result = await checkOne(browser, siteKey, width).catch((error) => ({ siteKey, width, failures: [`check failed: ${error.message}`] }));
    results.push(result);
    console.log(`${result.failures.length ? "FAIL" : "ok  "} ${siteKey} @${width}${result.failures.map((f) => `\n     - ${f}`).join("")}`);
  }
}
fs.writeFileSync(path.join(outDir, "report.json"), JSON.stringify(results, null, 2));
console.log(`report: ${path.join(outDir, "report.json")}`);
browser.ws.close();
spawnSync("pkill", ["-f", `user-data-dir=${PROFILE}`]);
process.exit(results.some((r) => r.failures.length) ? 1 : 0);
