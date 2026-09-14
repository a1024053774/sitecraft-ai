/**
 *
 * 一次性诊断工具 · 非门禁 · 无验收引用
 * T-14 门禁第 2 例**根因定位 · 第三轮**（2026-09-14）。
 *
 * 前两轮已定位到：**桥在页面加载早期就把自己烧掉了**——
 * 在某次"内容元素数 > 0"的中间态（DOM 只到一半）里 `capture()` 采了一个
 * **残缺快照**，紧接着同一次 `restore()` 判定"塌缩到 0"成立，
 * 把那个残缺快照写了回去，并 `restored = true` **永久关闸**。
 *
 * 本轮量三件事：
 *   1. **capture 发生在什么时刻**（相对 DOMContentLoaded / load）；
 *   2. 那一刻采到的快照**有多大**（是否残缺）；
 *   3. 究竟哪一步"内容元素数 = 0"让 restore 通过了。
 *
 * 做法：`innerHTML` setter 代理 + 同一时刻记录 DOM 状态与计时基准。
 *
 * 用法：node e2e/scripts/diag-snapshot-timing.mjs 8
 */
import { chromium } from "playwright";

const N = Number(process.argv[2] ?? 8);
const URL = process.env.SITECRAFT_BASE_URL
  ? `${process.env.SITECRAFT_BASE_URL}/api/templates/shadcn-landing2/preview`
  : "http://127.0.0.1:3210/api/templates/shadcn-landing2/preview";

const browser = await chromium.launch();

for (let i = 1; i <= N; i += 1) {
  const ctx = await browser.newContext();

  await ctx.addInitScript(() => {
    const NON_CONTENT = ["SCRIPT", "STYLE", "LINK", "META", "TEMPLATE"];
    const contentEls = (node) =>
      !node
        ? 0
        : Array.prototype.filter.call(node.querySelectorAll("*"), (el) => NON_CONTENT.indexOf(el.tagName) === -1).length;

    window.__ev = [];
    window.__t0 = performance.now();

    // 记录生命周期基准点
    document.addEventListener("DOMContentLoaded", () => window.__ev.push({ t: Math.round(performance.now()), k: "DOMContentLoaded" }));
    window.addEventListener("load", () => window.__ev.push({ t: Math.round(performance.now()), k: "load" }));

    // innerHTML 写入金丝雀（capture 独有的写入路径）
    const proto = Element.prototype;
    const desc = Object.getOwnPropertyDescriptor(proto, "innerHTML");
    if (desc) {
      Object.defineProperty(proto, "innerHTML", {
        configurable: true,
        get() {
          return desc.get.call(this);
        },
        set(value) {
          try {
            const root = document.querySelector("main") || document.body;
            window.__ev.push({
              t: Math.round(performance.now()),
              k: "innerHTML写入",
              len: typeof value === "string" ? value.length : -1,
              tag: this.tagName,
              contentElsAtThisMoment: contentEls(root),
              bodyInnerTextLen: document.body.innerText.trim().length,
            });
          } catch {
            /* 观测代码不得影响被测对象 */
          }
          return desc.set.call(this, value);
        },
      });
    }

    // 同时跟一条"内容元素数塌缩"的轨迹：只在数量归零/回升时记点
    let last = -1;
    const track = () => {
      try {
        const root = document.querySelector("main") || document.body;
        const n = contentEls(root);
        if (n !== last) {
          window.__ev.push({ t: Math.round(performance.now()), k: "contentEls变化", n });
          last = n;
        }
      } catch {
        /* 同上 */
      }
      if (window.__ev.length < 400) requestAnimationFrame(track);
    };
    requestAnimationFrame(track);
  });

  const page = await ctx.newPage();
  try {
    await page.goto(URL, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    const before = await page.evaluate(() => document.body.innerText.trim().length);

    await page.evaluate(() => {
      const main = document.querySelector("main") ?? document.body;
      main.replaceChildren(
        document.createElement("script"),
        document.createElement("script"),
        document.createElement("style"),
      );
    });

    let after = "";
    for (let w = 0; w < 20; w += 1) {
      after = await page.evaluate(() => document.body.innerText.trim());
      if (after.length > 0) break;
      await page.waitForTimeout(250);
    }

    const ev = await page.evaluate(() => window.__ev);
    const writes = ev.filter((e) => e.k === "innerHTML写入");
    const lifecycle = ev.filter((e) => e.k === "DOMContentLoaded" || e.k === "load");
    const collapse = ev.filter((e) => e.k === "contentEls变化" && e.n === 0);

    console.log(`\n#${String(i).padStart(2)} ${after.length > 0 ? "OK  " : "FAIL"}  before=${before} 清空后=${after.length}`);
    console.log(`   生命周期: ${lifecycle.map((l) => `${l.k}@${l.t}ms`).join(" ") || "（无）"}`);
    console.log(`   innerHTML写入: ${writes.length} 次`);
    writes.forEach((w) =>
      console.log(
        `     @${String(w.t).padStart(5)}ms len=${String(w.len).padStart(7)} tag=${w.tag} ` +
          `写入时contentEls=${w.contentElsAtThisMoment} 写入时bodyText=${w.bodyInnerTextLen}`,
      ),
    );
    console.log(`   contentEls 归零时刻: ${collapse.length ? collapse.map((c) => `${c.t}ms`).join(", ") : "（无）"}`);
  } catch (error) {
    console.log(`#${String(i).padStart(2)} ERROR ${error.message}`);
  } finally {
    await ctx.close();
  }
}

await browser.close();
