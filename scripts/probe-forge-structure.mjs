#!/usr/bin/env node
/**
 * forbid 结构探针（T-21 取证，2026-09-14）。
 *
 * ## 为什么要先跑探针，而不是直接写 e2e 断言
 *
 * T-21 的归因里有一条**我推出来的、没验证过的**结论：「forge 只给 hero 段打 scope，
 * 服务卡带未打 scope → 通用注入给它叠出一个兜底板块」。
 *
 * 但我同时读到 `servicesScope` 用的是**通用 `scopeBy` 正则**（`/service|solution|…/`），
 * 而 forge 的 `.h-96` 卡带里就有 "Services" 文案 —— 按正则它同样会被命中。
 * 也就是说：**bridge 很可能往「同一个」原生 section 注入，而不是新建一个**。
 * 两种结论对应的断言语义相反（数 section 个数 vs 数区里的卡片），
 * 谁的断言落错，谁就把门禁做成假门禁（附则 A1/A4）。
 *
 * 所以先用本探针打印**注入后的真实 DOM 结构**，再据此写断言。
 *
 * 用法：node --experimental-strip-types scripts/probe-forge-structure.mjs
 * 自起 `next dev -p 3211`（避开 e2e 的 3210），跑完关掉。
 */
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";
import net from "node:net";

const root = path.resolve(import.meta.dirname, "..");
const PORT = Number(process.env.PROBE_PORT || 3211);
const BASE = `http://127.0.0.1:${PORT}`;
const templateId = process.argv[2] || "forge";

const { cloneDraft, defaultDraft } = await import("../lib/site-document.ts");

/** 两种草稿：空（新站初始态）与有产品图 —— 差异只该在产品卡上。 */
function emptyDraft() {
  const draft = cloneDraft(defaultDraft);
  draft.templateId = templateId;
  draft.revision = 101;
  draft.companyName = "启衡工业";
  draft.siteName = "启衡工业";
  return draft;
}
function draftWithProducts() {
  const draft = emptyDraft();
  draft.revision = 102;
  draft.products = [
    { sku: "QH-100", name: { zh: "高稳定连接组件", en: "Stable connector assembly" }, summary: { zh: "面向高频振动工况。", en: "For high-vibration environments." }, category: "精密组件", status: "published", imageColor: "#d7e7d1", image: "/api/product-images/probe-1.jpg" },
    { sku: "QH-200", name: { zh: "精密传动部件", en: "Precision drive part" }, summary: { zh: "适用于高负载场景。", en: "For high-load scenarios." }, category: "精密组件", status: "published", imageColor: "#cfe0ee" },
  ];
  return draft;
}

function waitPort(port, timeoutMs = 120_000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      const socket = net.createConnection({ host: "127.0.0.1", port });
      socket.setTimeout(800);
      socket.once("connect", () => { socket.destroy(); resolve(); });
      socket.once("timeout", () => { socket.destroy(); retry(); });
      socket.once("error", () => { socket.destroy(); retry(); });
    };
    const retry = () => (Date.now() - start > timeoutMs ? reject(new Error("server_timeout")) : setTimeout(tick, 700));
    tick();
  });
}

/**
 * ⚠️ **用 `next start`（生产构建），不用 `next dev`。**
 *
 * 两个原因，都在本轮踩过：
 *  1. dev 模式有单例锁：`next dev -p 3211` 起来后会报
 *     `Another next dev server is already running`（本机 3000 上有开发服务器），
 *     然后**自己退出**——探针等着一个已死的端口，报 `ERR_CONNECTION_RESET`。
 *  2. 更重要的是附则 A3：e2e 跑的是生产构建。探针若跑 dev，
 *     拿到的 DOM 与线上不是同一个东西，据此写的断言又会是假门禁。
 *
 * `serve.mjs` 会在 `.next/BUILD_ID` 早于源码时自动重建；直接用 `next start`
 * 会**静默跑过期构建**，所以这里先查新鲜度，过期就先 build。
 */
const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");

function runNode(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { cwd: root, stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code) => (code === 0 ? resolve() : reject(new Error(`command exited with ${code}`))));
  });
}

async function needsBuild() {
  const { access, readdir, stat } = await import("node:fs/promises");
  const buildId = path.join(root, ".next", "BUILD_ID");
  async function newest(dir) {
    let newestMs = 0;
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if ([".git", ".next", "node_modules", "playwright-report", "test-results"].includes(entry.name)) continue;
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) newestMs = Math.max(newestMs, await newest(file));
      else if (/\.(?:ts|tsx|js|mjs|css|json)$/.test(entry.name)) newestMs = Math.max(newestMs, (await stat(file)).mtimeMs);
    }
    return newestMs;
  }
  try {
    await access(buildId);
    return (await stat(buildId)).mtimeMs < (await newest(root));
  } catch {
    return true;
  }
}

if (await needsBuild()) {
  console.log("[probe] 构建过期，先 next build …");
  await runNode([nextBin, "build"]);
}

const server = spawn(process.execPath, [nextBin, "start", "-p", String(PORT)], {
  cwd: root,
  env: { ...process.env, PORT: String(PORT) },
  stdio: ["ignore", "pipe", "pipe"],
});
let serverLog = "";
server.stdout.on("data", (d) => { serverLog += d.toString(); });
server.stderr.on("data", (d) => { serverLog += d.toString(); });

let browser;
try {
  await waitPort(PORT);
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const response = await page.goto(`${BASE}/api/templates/${templateId}/preview`);
  if (!response || response.status() !== 200) throw new Error(`preview_http_${response?.status()}`);

  for (const [label, draft] of [["空草稿", emptyDraft()], ["有产品图", draftWithProducts()]]) {
    const report = await page.evaluate(({ tid, d }) => new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error("bridge_apply_timeout")), 15_000);
      const receive = (event) => {
        if (event.data?.type !== "sitecraft:applied" || event.data.revision !== d.revision) return;
        window.clearTimeout(timeout);
        window.removeEventListener("message", receive);
        resolve({
          generatedContentSections: event.data.generatedContentSections,
          assetReport: event.data.assetReport,
          missingSlots: event.data.missingSlots,
        });
      };
      window.addEventListener("message", receive);
      window.postMessage({ type: "sitecraft:content", templateId: tid, siteKey: "probe", draft: d, locale: d.locale, variant: "preview" }, "*");
    }), { tid: templateId, d: draft });

    // 注入后按**可渲染 DOM** 取证（附则 A2：数节点必须用解析器，不能 grep 字符串载荷）
    const dom = await page.evaluate(() => {
      const heroImg = document.querySelector('[data-testid="hero-img"], img[src*="heroimg"], img[data-sitecraft-asset="hero.image"]');
      const heroSection = document.querySelector('main > section');
      const cta = document.querySelector('body > section');
      const generatedProducts = document.querySelectorAll('[data-sitecraft-generated-products]');
      const generatedContent = Array.from(document.querySelectorAll('[data-sitecraft-generated-content]')).map((n) => n.dataset.sitecraftGeneratedContent);
      const serviceBand = Array.from(document.querySelectorAll('main > section')).find((s) => s.querySelector('.h-96'));
      const servicesScope = document.querySelector('[data-sitecraft-scope="services"]');
      const servicesScopeCardCount = servicesScope ? servicesScope.querySelectorAll('article, .h-96').length : -1;
      const allSections = Array.from(document.querySelectorAll('main > section')).map((s) => ({
        id: s.id || null,
        scope: s.dataset.sitecraftScope || null,
        section: s.dataset.sitecraftSection || null,
        classes: (s.className || "").slice(0, 90),
        hasH96: Boolean(s.querySelector('.h-96')),
        articleCount: s.querySelectorAll('article').length,
        imgCount: s.querySelectorAll('img').length,
      }));
      const ctaStyle = cta ? window.getComputedStyle(cta) : null;
      return {
        heroImgPresent: Boolean(heroImg),
        heroImgSrc: heroImg ? heroImg.getAttribute('src') : null,
        heroSectionId: heroSection ? (heroSection.id || null) : null,
        ctaPresent: Boolean(cta),
        ctaClass: cta ? (cta.getAttribute('class') || "") : null,
        ctaId: cta ? (cta.id || null) : null,
        ctaBackgroundImage: ctaStyle ? ctaStyle.backgroundImage : null,
        ctaHasCtabg: cta ? (cta.outerHTML.includes('CTAbg') || (ctaStyle?.backgroundImage || "").includes('CTAbg')) : false,
        generatedProductsCount: generatedProducts.length,
        generatedProductsImgCount: generatedProducts[0] ? generatedProducts[0].querySelectorAll('img').length : -1,
        generatedProductsCardCount: generatedProducts[0] ? generatedProducts[0].querySelectorAll('article').length : -1,
        generatedContent,
        serviceBandPresent: Boolean(serviceBand),
        serviceBandHasServicesScope: Boolean(servicesScope && serviceBand && servicesScope === serviceBand),
        servicesScopePresent: Boolean(servicesScope),
        servicesScopeCardCount,
        allSections,
      };
    });

    console.log(`\n================ ${label}（revision=${draft.revision}） ================`);
    console.log("bridge 报告 generatedContentSections :", JSON.stringify(report.generatedContentSections));
    console.log("bridge 报告 assetReport              :", JSON.stringify(report.assetReport));
    console.log("bridge 报告 missingSlots             :", JSON.stringify(report.missingSlots));
    console.log("hero 图存在                          :", dom.heroImgPresent, "src =", dom.heroImgSrc);
    console.log("hero 段 id                           :", dom.heroSectionId);
    console.log("CTA(body > section) 存在             :", dom.ctaPresent, " id =", dom.ctaId,
      "\n  class                              :", dom.ctaClass,
      "\n  computed background-image          :", dom.ctaBackgroundImage,
      "\n  含 CTAbg（属性或计算样式）          :", dom.ctaHasCtabg);
    console.log("生成产品区 个数                       :", dom.generatedProductsCount,
      "（卡片=", dom.generatedProductsCardCount, " 图=", dom.generatedProductsImgCount, "）");
    console.log("服务卡带 存在 / 就是 servicesScope    :", dom.serviceBandPresent, "/", dom.serviceBandHasServicesScope);
    console.log("servicesScope 存在 / 其中卡片数       :", dom.servicesScopePresent, "/", dom.servicesScopeCardCount);
    console.log("main > section 全览                   :");
    for (const s of dom.allSections) console.log("   ", JSON.stringify(s));
  }
} catch (error) {
  console.error("\n[probe] 失败：", error?.message || error);
  console.error("[probe] 服务日志尾部：\n", serverLog.split("\n").slice(-25).join("\n"));
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  server.kill("SIGTERM");
}
