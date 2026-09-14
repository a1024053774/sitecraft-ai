/**
 *
 * 一次性诊断工具 · 非门禁 · 无验收引用
 * T-14 门禁第 2 例**根因定位 · 第二轮**（2026-09-14）。
 *
 * 上一轮（`diag-snapshot-probe.mjs`）已证：清空后 300ms，装在同一节点的
 * `MutationObserver` **触发了**，DOM 有时已回到 834 个内容元素。
 * 但**真桥到底有没有执行 restore**，上一轮看不见——本轮补这个洞。
 *
 * ## 做法：`innerHTML` setter 金丝雀
 *
 * 桥的 `restore()` 最后一句一定是 `main.innerHTML = snapshot`。
 * 所以在页面加载**之前**（`addInitScript`，早于任何页面脚本）给
 * `Element.prototype.innerHTML` 装 setter 代理：
 * 每次写入都记下「时间 / 长度 / 目标 tagName / 有无 main / 是否 body」。
 *
 * 注：`replaceChildren` 不走 innerHTML，**只有桥的 restore 会写 innerHTML**
 * ——所以金丝雀命中的每一条都是**真桥在还原**，无噪声。
 *
 * ## 判据
 *
 * | 观察 | 结论 |
 * |---|---|
 * | 清空后金丝雀**从未命中** | 真桥没执行 restore → 断在**触发/条件** |
 * | 金丝雀命中、但写入长度**远小于** 272,458 | 桥还原的是**早期态快照**（采早了）→ 断在**捕获** |
 * | 金丝雀命中且长度正常、页面仍 0 | 还原被**后续清空**覆盖 → 断在**时序** |
 *
 * 用法：node e2e/scripts/diag-snapshot-canary.mjs 8
 */
import { chromium } from "playwright";

const N = Number(process.argv[2] ?? 8);
const URL = process.env.SITECRAFT_BASE_URL
  ? `${process.env.SITECRAFT_BASE_URL}/api/templates/shadcn-landing2/preview`
  : "http://127.0.0.1:3210/api/templates/shadcn-landing2/preview";

const browser = await chromium.launch();

for (let i = 1; i <= N; i += 1) {
  const ctx = await browser.newContext();

  // ⚠️ 必须在**任何页面脚本之前**装好（addInitScript 满足）
  await ctx.addInitScript(() => {
    window.__innerHTMLWrites = [];
    const proto = Element.prototype;
    const desc = Object.getOwnPropertyDescriptor(proto, "innerHTML");
    if (!desc) return;
    Object.defineProperty(proto, "innerHTML", {
      configurable: true,
      get() {
        return desc.get.call(this);
      },
      set(value) {
        try {
          window.__innerHTMLWrites.push({
            t: Math.round(performance.now()),
            len: typeof value === "string" ? value.length : -1,
            tag: this.tagName,
            isBody: this === document.body,
            hasMain: !!document.querySelector("main"),
          });
        } catch {
          /* 观测代码自身绝不能影响被测对象 */
        }
        return desc.set.call(this, value);
      },
    });
  });

  const page = await ctx.newPage();
  try {
    await page.goto(URL, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);

    const before = await page.evaluate(() => document.body.innerText.trim().length);
    const writesBeforeClear = await page.evaluate(() => window.__innerHTMLWrites.length);

    // 模拟门禁第 2 例的清空
    await page.evaluate(() => {
      const main = document.querySelector("main") ?? document.body;
      main.replaceChildren(
        document.createElement("script"),
        document.createElement("script"),
        document.createElement("style"),
      );
    });

    // 给桥充足时间（门禁用例给的是 5s）
    let after = "";
    for (let w = 0; w < 20; w += 1) {
      after = await page.evaluate(() => document.body.innerText.trim());
      if (after.length > 0) break;
      await page.waitForTimeout(250);
    }

    const writes = await page.evaluate(() => window.__innerHTMLWrites);
    const afterClear = writes.filter((w) => w.t > 0).slice(writesBeforeClear);
    const verdict = after.length > 0 ? "OK" : "FAIL";
    console.log(
      `#${String(i).padStart(2)} ${verdict}  before=${before} 清空后=${after.length}  ` +
        `清空前innerHTML写入=${writesBeforeClear}  清空后写入=${afterClear.length}` +
        (afterClear.length
          ? ` 最后一次写入={len=${afterClear[afterClear.length - 1].len} tag=${afterClear[afterClear.length - 1].tag} isBody=${afterClear[afterClear.length - 1].isBody}}`
          : ""),
    );
    if (afterClear.length && after.length === 0) {
      console.log(
        `      ⚠️ 桥写了 innerHTML（len=${afterClear[afterClear.length - 1].len}）但页面仍空 → 疑似被后续清空覆盖`,
      );
    }
  } catch (error) {
    console.log(`#${String(i).padStart(2)} ERROR ${error.message}`);
  } finally {
    await ctx.close();
  }
}

await browser.close();
