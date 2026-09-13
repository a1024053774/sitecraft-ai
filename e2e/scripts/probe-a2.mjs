/** 一次性诊断工具 · 非门禁 · 无验收引用（2026-09-13 收编，用户裁决保留）。 */
/**
 * A2 解析器口径对照（复审方，2026-09-13）：
 * 同一 URL 连续两次「全新 page + goto」，各等 3s 稳定，用**解析器**（非正则）数：
 *   - 服务端 HTML 里（剔除 script 后）的真内容
 *   - 稳定后可渲染 DOM 的内容
 * 附则 A2 的核心问题：内容是"从一开始就不在可渲染 DOM"，还是"先有后被删"？
 */
import { chromium } from "playwright";

const URL = "http://127.0.0.1:3210/api/templates/shadcn-landing2/preview";
const b = await chromium.launch();

for (let i = 1; i <= 2; i++) {
  const ctx = await b.newContext();
  const p = await ctx.newPage();
  let violations = 0;
  p.on("console", (m) => { if (m.type() === "error" && /Content Security Policy/i.test(m.text())) violations++; });
  const resp = await p.goto(URL);
  const htmlAtLoad = await resp.text();               // 原始响应体
  await p.waitForTimeout(3000);                       // 稳定态
  const dom = await p.evaluate(() => {
    const clone = document.documentElement.cloneNode(true);
    clone.querySelectorAll("script").forEach((s) => s.remove());
    return {
      bodyTextLen: document.body.innerText.trim().length,
      bodyHead: document.body.innerText.trim().slice(0, 50),
      h1WithText: [...document.querySelectorAll("h1")].filter((el) => el.innerText?.trim()).length,
      sections: document.querySelectorAll("section").length,
      htmlWithoutScriptsLen: clone.innerHTML.length,
      h1InNoScriptHtml: clone.querySelectorAll("h1").length,
      sectionsInNoScriptHtml: clone.querySelectorAll("section").length,
    };
  });
  const noScriptResponse = htmlAtLoad.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
  console.log(`RUN ${i}`, JSON.stringify({
    httpStatus: resp.status(), violations,
    responseRawBytes: htmlAtLoad.length,
    responseNoScriptBytes: noScriptResponse.length,
    responseH1: (noScriptResponse.match(/<h1/g) || []).length,
    responseSections: (noScriptResponse.match(/<section/g) || []).length,
    ...dom,
  }));
  await ctx.close();
}
await b.close();
