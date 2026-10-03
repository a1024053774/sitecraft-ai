// Render one block-library layout candidate on real drafts and scan it.
//
//   CHROME_PATH=… SITECRAFT_BASE=http://127.0.0.1:3035 \
//   node scripts/render-block.mjs --block products --variant index --name product-index-table
//
// Needs a dev server (SITE_STORE=fs PORT=3035 npm run dev) serving this worktree. For every case and
// width (1440 / 768 / 375) it writes, into artifacts/blocks-pool/<name>/:
//   crops/<case>-<width>-candidate.png   the block alone with the candidate layout
//   crops/<case>-<width>-default.png     the same block with the look's default layout
//   context/<case>-1440-page.png         the whole page at 1440 with the candidate mounted
//   scan.json / scan.md                  horizontal overflow, clipped text, text-over-text overlap
// Cases read drafts from .sitecraft-data/sites/. A case may carry `borrow: { from: <siteId>, paths: ["products"] }`
// (take those top-level draft fields from another draft: a stress test for a layout whose materials
// the company's own draft does not meet), `patch: { "content.services.items": [...] }` (set a dotted
// path to a value), and `template` + `brief` (mount the draft on another look). Borrowed and patched
// cases are not real configurations: say so in `note` and in the candidate's candidate.md.
// Pass a JSON array of cases with --cases <file>; --only <caseId> renders one. Use --out to keep a
// partial re-render from overwriting an earlier scan. Exit 1 when any scan finds overflow or overlap.
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const option = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const BASE = process.env.SITECRAFT_BASE || "http://127.0.0.1:3035";
const CHROME = process.env.CHROME_PATH;
if (!CHROME) throw new Error("set CHROME_PATH");
const BLOCK = option("--block", "products");
const VARIANT = option("--variant");
if (!VARIANT) throw new Error("pass --variant <id>");
const NAME = option("--name", `${BLOCK}-${VARIANT}`);
const OUT = path.resolve(option("--out", path.join("artifacts", "blocks-pool", NAME)));
const SITES = path.resolve(".sitecraft-data", "sites");
const WIDTHS = [1440, 768, 375];

// 工业 / 外贸 / 注塑: each company's last draft (the expert version), then the molding draft on the
// two other block-library looks to check the CSS against every look's tokens.
const DEFAULT_CASES = [
  { id: "industrial", site: "5233c15c-966e-4716-aa6d-7168773df13e", note: "工业（重载减速机）" },
  { id: "export", site: "04d99180-2831-4147-96cf-95eae3913b27", note: "外贸（流体接头）" },
  { id: "molding", site: "82976660-1768-4c3f-8986-509e2a0e45c1", note: "注塑（精密注塑模具）" },
  { id: "molding-forge", site: "82976660-1768-4c3f-8986-509e2a0e45c1", template: "forge", brief: "industrial", note: "注塑草稿换到 forge 样子（跨样子检查，非真实配置）" },
  { id: "molding-short", site: "82976660-1768-4c3f-8986-509e2a0e45c1", template: "tailwind-landing", brief: "technical-product", note: "注塑草稿换到 tailwind-landing 样子（跨样子检查，非真实配置）" },
];
const casesFile = option("--cases");
const CASES = casesFile ? JSON.parse(fs.readFileSync(casesFile, "utf8")) : DEFAULT_CASES;
const only = option("--only");

// Turbopack (dev and build) refuses a node_modules symlink that points outside the worktree.
if (fs.lstatSync("node_modules", { throwIfNoEntry: false })?.isSymbolicLink()) {
  console.warn("warning: node_modules is a symlink; Turbopack will not start. Clone it instead: rm node_modules && cp -cR <main>/node_modules node_modules");
}
const { blockCatalog } = await import(path.resolve("lib/blocks/catalog.ts"));
const { blockLookForTemplate } = await import(path.resolve("lib/blocks/looks/index.ts"));
const { checkVariantRequirements } = await import(path.resolve("lib/blocks/requirements.ts"));
if (!blockCatalog[BLOCK]?.variants[VARIANT]) throw new Error(`catalog has no ${BLOCK}:${VARIANT}`);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const readDraft = (site) => JSON.parse(fs.readFileSync(path.join(SITES, `${site}.json`), "utf8")).draft;

class Cdp {
  constructor(url) { this.url = url; this.id = 1; this.pending = new Map(); }
  async connect() {
    this.ws = new WebSocket(this.url);
    await new Promise((resolve, reject) => { this.ws.addEventListener("open", resolve, { once: true }); this.ws.addEventListener("error", reject, { once: true }); });
    this.ws.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      const waiter = message.id && this.pending.get(message.id);
      if (!waiter) return;
      this.pending.delete(message.id);
      message.error ? waiter.reject(new Error(JSON.stringify(message.error))) : waiter.resolve(message.result);
    });
  }
  send(method, params = {}, sessionId) {
    const id = this.id++;
    this.ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`${method} timeout`)); }, 60000);
      this.pending.set(id, { resolve: (v) => { clearTimeout(timer); resolve(v); }, reject: (e) => { clearTimeout(timer); reject(e); } });
    });
  }
  async eval(expression, sessionId) {
    const { result, exceptionDetails } = await this.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }, sessionId);
    if (exceptionDetails) throw new Error(exceptionDetails.exception?.description || exceptionDetails.text);
    return result.value;
  }
}

async function launchChrome() {
  const port = 20000 + Math.floor(Math.random() * 20000);
  const profile = fs.mkdtempSync(path.join(OUT, "chrome-profile-"));
  const chrome = spawn(CHROME, [`--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--headless", "--no-first-run", "--hide-scrollbars", "about:blank"], { stdio: "ignore" });
  let version = null;
  for (let i = 0; i < 80 && !version; i++) {
    await sleep(250);
    version = await fetch(`http://127.0.0.1:${port}/json/version`).then((r) => r.json()).catch(() => null);
  }
  if (!version?.webSocketDebuggerUrl) throw new Error("Chrome endpoint unavailable");
  const browser = new Cdp(version.webSocketDebuggerUrl);
  await browser.connect();
  return { browser, chrome, profile };
}

// Runs inside the page, after the draft is mounted: sizes of the block, and the three scans.
const SCAN = `(() => {
  const block = document.querySelector('[data-sc-block="${BLOCK}"]');
  if (!block) return { error: "block not on page" };
  const vw = window.innerWidth;
  const box = block.getBoundingClientRect();
  const result = { variant: block.getAttribute("data-sc-variant"), box: { x: box.x + scrollX, y: box.y + scrollY, width: box.width, height: box.height }, pageHeight: document.documentElement.scrollHeight, pageScrollWidth: document.documentElement.scrollWidth, viewport: vw, overflow: [], clipped: [], overlaps: [] };
  if (document.documentElement.scrollWidth > vw + 1) result.overflow.push({ kind: "page", scrollWidth: document.documentElement.scrollWidth });
  const describe = (el) => (el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\\s+/)[0] : el.tagName.toLowerCase()) + ":" + (el.textContent || "").trim().slice(0, 24);
  for (const el of block.querySelectorAll("*")) {
    const r = el.getBoundingClientRect();
    if (r.width <= 1 || r.height <= 1) continue; // empty, or a visually hidden label
    if (r.right > vw + 1 || r.left < -1) result.overflow.push({ kind: "outside-viewport", el: describe(el), left: Math.round(r.left), right: Math.round(r.right) });
    const style = getComputedStyle(el);
    if (el !== block && el.scrollWidth > el.clientWidth + 1 && style.display !== "inline" && style.overflowX !== "visible") result.clipped.push({ kind: "x-clipped", el: describe(el) });
    if (style.webkitLineClamp && style.webkitLineClamp !== "none" && el.scrollHeight > el.clientHeight + 1) result.clipped.push({ kind: "line-clamp", el: describe(el), lines: style.webkitLineClamp });
  }
  // Text-over-text: client rects of text nodes, clipped by overflow:hidden ancestors, compared pairwise.
  const clipOf = (node) => {
    let clip = null;
    for (let el = node.parentElement; el && el !== block.parentElement; el = el.parentElement) {
      const s = getComputedStyle(el);
      if (s.overflowX !== "visible" || s.overflowY !== "visible") {
        const b = el.getBoundingClientRect();
        clip = clip ? { l: Math.max(clip.l, b.left), t: Math.max(clip.t, b.top), r: Math.min(clip.r, b.right), b: Math.min(clip.b, b.bottom) } : { l: b.left, t: b.top, r: b.right, b: b.bottom };
      }
    }
    return clip;
  };
  const pieces = [];
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.textContent.trim()) continue;
    const parent = node.parentElement;
    if (!parent || parent.closest("[hidden],details:not([open]) > :not(summary)") || getComputedStyle(parent).visibility === "hidden") continue;
    const clip = clipOf(node);
    const range = document.createRange();
    range.selectNodeContents(node);
    for (const rect of range.getClientRects()) {
      let l = rect.left, t = rect.top, r = rect.right, b = rect.bottom;
      if (clip) { l = Math.max(l, clip.l); t = Math.max(t, clip.t); r = Math.min(r, clip.r); b = Math.min(b, clip.b); }
      if (r - l < 1 || b - t < 1) continue;
      pieces.push({ l, t, r, b, text: node.textContent.trim().slice(0, 24) });
    }
  }
  for (let i = 0; i < pieces.length; i++) for (let j = i + 1; j < pieces.length; j++) {
    const a = pieces[i], c = pieces[j];
    const w = Math.min(a.r, c.r) - Math.max(a.l, c.l), h = Math.min(a.b, c.b) - Math.max(a.t, c.t);
    if (w > 2 && h > 3) result.overlaps.push({ a: a.text, b: c.text, w: Math.round(w), h: Math.round(h) });
  }
  result.textPieces = pieces.length;
  return result;
})()`;

async function openCase(browser, draft, width) {
  const { targetId } = await browser.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await browser.send("Target.attachToTarget", { targetId, flatten: true });
  await browser.send("Page.enable", {}, sessionId);
  await browser.send("Runtime.enable", {}, sessionId);
  await browser.send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width < 500 }, sessionId);
  await browser.send("Page.navigate", { url: `${BASE}/api/templates/${draft.templateId}/preview` }, sessionId);
  for (let i = 0; i < 300; i++) {
    if (await browser.eval("document.readyState === 'complete' && typeof window.__sitecraftApplyDeclared === 'function'", sessionId).catch(() => false)) break;
    await sleep(100);
  }
  return { targetId, sessionId };
}

async function mount(browser, sessionId, draft) {
  await browser.eval(`window.__sitecraftApplyDeclared(${JSON.stringify(draft)}, "zh", [], "published", null, false)`, sessionId);
  await browser.eval("new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))", sessionId);
  // Wait for the page height to stop changing (fonts, images) before measuring.
  let last = -1;
  for (let i = 0; i < 30; i++) {
    const height = await browser.eval("document.documentElement.scrollHeight", sessionId);
    if (height === last) break;
    last = height;
    await sleep(150);
  }
}

async function shoot(browser, sessionId, file, clip) {
  const params = { format: "png", captureBeyondViewport: true };
  if (clip) params.clip = { x: clip.x, y: clip.y, width: clip.width, height: clip.height, scale: 1 };
  const shot = await browser.send("Page.captureScreenshot", params, sessionId);
  fs.writeFileSync(file, Buffer.from(shot.data, "base64"));
}

fs.mkdirSync(path.join(OUT, "crops"), { recursive: true });
fs.mkdirSync(path.join(OUT, "context"), { recursive: true });
const health = await fetch(`${BASE}/api/templates/screwfast/preview`).then((r) => r.status).catch(() => 0);
if (health !== 200) throw new Error(`dev server not answering at ${BASE} (preview returned ${health})`);

const { browser, chrome, profile } = await launchChrome();
const rows = [];
try {
  for (const item of CASES.filter((c) => !only || c.id === only)) {
    const base = readDraft(item.site);
    const own = { ...base, blockVariants: { ...base.blockVariants } };
    if (item.borrow) {
      const from = readDraft(item.borrow.from);
      for (const key of item.borrow.paths) own[key] = structuredClone(from[key]);
    }
    for (const [dotted, value] of Object.entries(item.patch || {})) {
      const keys = dotted.split(".");
      let node = own;
      for (const key of keys.slice(0, -1)) node = node[key] = Array.isArray(node[key]) ? [...node[key]] : { ...node[key] };
      node[keys.at(-1)] = structuredClone(value);
    }
    if (item.template) {
      own.templateId = item.template;
      own.visualBrief = { ...own.visualBrief, templateId: item.template, id: item.brief };
    }
    const look = blockLookForTemplate(own.templateId);
    const defaultVariant = look.defaults[BLOCK];
    const requirement = checkVariantRequirements(own, BLOCK, VARIANT);
    const candidateDraft = { ...own, blockVariants: { ...own.blockVariants, [BLOCK]: VARIANT } };
    const defaultDraft = { ...own, blockVariants: { ...own.blockVariants } };
    delete defaultDraft.blockVariants[BLOCK];
    for (const width of WIDTHS) {
      const row = { case: item.id, note: item.note, template: own.templateId, palette: own.paletteId, width, productCount: own.products.length, requirement: { ok: requirement.ok, failures: requirement.failures.map((f) => f.message) } };
      for (const [kind, draft] of [["candidate", candidateDraft], ["default", defaultDraft]]) {
        const tab = await openCase(browser, draft, width);
        try {
          await mount(browser, tab.sessionId, draft);
          const scan = await browser.eval(SCAN, tab.sessionId);
          if (scan.error) throw new Error(`${item.id}/${width}/${kind}: ${scan.error}`);
          if (!scan.box.width || !scan.box.height) throw new Error(`${item.id}/${width}/${kind}: the block is on the page but not shown (hidden section? box ${JSON.stringify(scan.box)})`);
          if (scan.variant !== (kind === "candidate" ? VARIANT : defaultVariant)) throw new Error(`${item.id}/${width}/${kind}: block shows variant ${scan.variant}`);
          const file = path.join("crops", `${item.id}-${width}-${kind}.png`);
          await shoot(browser, tab.sessionId, path.join(OUT, file), scan.box);
          row[kind] = { file, variant: scan.variant, box: scan.box, overflow: scan.overflow, clipped: scan.clipped, overlaps: scan.overlaps, textPieces: scan.textPieces };
          if (kind === "candidate" && width === 1440) {
            const context = path.join("context", `${item.id}-1440-page.png`);
            await shoot(browser, tab.sessionId, path.join(OUT, context), null);
            row.context = { file: context, pageHeight: scan.pageHeight };
          }
        } finally {
          await browser.send("Target.closeTarget", { targetId: tab.targetId }).catch(() => {});
        }
      }
      rows.push(row);
      const c = row.candidate;
      console.log(`${item.id} ${width}: ${c.box.width}x${Math.round(c.box.height)} overflow=${c.overflow.length} overlaps=${c.overlaps.length} clipped=${c.clipped.length} requirement=${requirement.ok ? "ok" : "unmet"}`);
    }
  }
} finally {
  browser.send("Browser.close").catch(() => {});
  chrome.kill();
  fs.rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}

const failing = rows.filter((row) => row.candidate.overflow.length || row.candidate.overlaps.length);
fs.writeFileSync(path.join(OUT, "scan.json"), JSON.stringify({ block: BLOCK, variant: VARIANT, base: BASE, rows }, null, 2));
const md = [`# ${NAME}: ${BLOCK}:${VARIANT} scan`, "", "| case | width | products | requirement | overflow | overlaps | clipped (info) |", "| --- | --- | --- | --- | --- | --- | --- |",
  ...rows.map((r) => `| ${r.case} | ${r.width} | ${r.productCount} | ${r.requirement.ok ? "ok" : "unmet"} | ${r.candidate.overflow.length} | ${r.candidate.overlaps.length} | ${r.candidate.clipped.map((c) => c.kind).join(", ") || "-"} |`), ""].join("\n");
fs.writeFileSync(path.join(OUT, "scan.md"), md);
console.log(`\n${rows.length} rows; ${failing.length} with overflow or overlap`);
process.exitCode = failing.length ? 1 : 0;
