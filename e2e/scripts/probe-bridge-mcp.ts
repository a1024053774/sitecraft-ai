/** 一次性诊断工具 · 非门禁 · 无验收引用（2026-09-13 收编，用户裁决保留）。 */
/** 复刻 MCP 探针：只注入不交互，反复问同一个页面。 */
import { chromium } from "playwright";
const b = await chromium.launch();
const p = await b.newPage();
await p.goto("http://127.0.0.1:3210/api/templates/shadcn-landing2/preview");
const ask = (rev: number) => p.evaluate((r) => new Promise<Record<string, unknown>>((resolve) => {
  const t = setTimeout(() => resolve({ timeout: true }), 8000);
  const recv = (e: MessageEvent) => {
    if (e.data?.type !== "sitecraft:applied") return;
    clearTimeout(t); window.removeEventListener("message", recv);
    resolve({ revision: e.data.revision, incompatible: e.data.incompatible, missingSlots: e.data.missingSlots, visible: Object.keys(e.data.visibleTextsBySlot ?? {}) });
  };
  window.addEventListener("message", recv);
  window.postMessage({ type: "sitecraft:content", templateId: "shadcn-landing2", locale: "zh", variant: "preview",
    expectedTargets: ["heroTitle"],
    draft: { revision: r, siteName: { zh: "远航科技", en: "V" },
      content: { hero: { title: { zh: "让跨境团队更快交付产品网站", en: "R" }, subtitle: { zh: "s", en: "s" }, cta: { zh: "c", en: "c" } } }, products: [] } }, "*");
}), rev);
for (const rev of [101, 102, 103]) console.log("REPEAT", rev, JSON.stringify(await ask(rev)));
await b.close();
