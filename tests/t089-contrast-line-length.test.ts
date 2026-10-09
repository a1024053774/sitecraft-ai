import assert from "node:assert/strict";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import test from "node:test";
import { codeCheckBrowser } from "../lib/code-site-browser.ts";

const scanSource = readFileSync(new URL("../scripts/visitor-layout-scan.js", import.meta.url), "utf8")
  .replace("export function", "function")
  .replace("export default scanVisitorLayout;", "");

test("T-089 visitor scan enforces body contrast, image uncertainty, and paragraph line length", async () => {
  const browser = await codeCheckBrowser();
  const html = `<!doctype html><html><body style="margin:0;background:#fff;color:#767676">
    <main data-sc-block="content">
      <p id="fail" style="color:#777">普通正文对比度四点四比一</p>
      <p id="pass" style="color:#767676">普通正文对比度四点六比一</p>
      <p id="large" style="font-size:24px;color:#8f8f8f">大号正文三点二比一</p>
      <p id="large-bold" style="font-size:18.66px;font-weight:700;color:#8f8f8f">大号粗体三点二比一</p>
      <p id="large-semibold" style="font-size:18.66px;font-weight:600;color:#8f8f8f">半粗体仍按普通正文门槛</p>
      <div style="background-image:url(data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=)"><p id="photo-text">图片背景上的正文</p></div>
      <div id="gradient" style="background-image:linear-gradient(rgb(255,255,255),rgba(238,238,238,.8))"><p id="gradient-text">纯色渐变背景上的正文</p></div>
      <div id="gradient-invalid" style="background-image:linear-gradient(rgb(255,255,255),color-mix(in srgb, red 50%, blue))"><p id="gradient-invalid-text">含无法解析色标的渐变正文</p></div>
      <div style="opacity:.5"><p id="opacity-text" style="color:#000">半透明祖先上的正文</p></div>
      <p id="zh-long" style="white-space:nowrap">中文正文一二三四五六七八九十一二三四五六七八九十一二三四五六七八九十一二三四五六七八九十一</p>
      <p id="en-long" style="white-space:nowrap">This English paragraph intentionally contains more than seventy five characters on one rendered line for the contrast gate fixture.</p>
      <p id="span-long" style="white-space:nowrap"><span>这是一个被 span 包裹但仍然超过四十字的中文正文行用于测试跨后代 Range 统计并继续加长</span></p>
      <header><p id="header-long" style="white-space:nowrap">这是 header 里的普通正文，不应因为容器是 header 就自动豁免正文行长并继续加长</p></header>
      <p id="link-long" style="white-space:nowrap"><a href="#">This ordinary paragraph link contains more than seventy five characters and remains body copy.</a></p>
      <table><tbody><tr><td><p id="table-long" style="white-space:nowrap">参数表中的型号和规格内容可以很长但不属于正文行长检查范围</p></td></tr></tbody></table>
    </main>
  </body></html>`;
  try {
    await browser.send("Runtime.enable", {});
    await browser.send("Page.enable", {});
    const frameId = (await browser.send("Page.getFrameTree", {}) as { frameTree: { frame: { id: string } } }).frameTree.frame.id;
    await browser.send("Page.setDocumentContent", { frameId, html });
    const scan = await browser.evaluate<{
      textContrast: Array<{ element: string; ratio: number | null; status: string; large: boolean; threshold: number; reason?: string; checkable: boolean }>;
      bodyLineLength: Array<{ id: string; tooLong: boolean; count: number; language: string }>;
      lineLengthExemptions: Array<{ id: string; reason: string }>;
    }>(`(()=>{${scanSource};return scanVisitorLayout(document)})()`);
    mkdirSync("artifacts/t089", { recursive: true });
    writeFileSync("artifacts/t089/contrast-line-length-fixture.json", JSON.stringify(scan, null, 2));
    const byId = (id: string) => (scan.textContrast ?? []).find((entry) => entry.element === id);
    assert.ok(byId("fail") && byId("fail")!.ratio! < 4.5, "4.4:1 body text must fail");
    assert.ok(byId("pass") && byId("pass")!.ratio! >= 4.5, "4.6:1 body text must pass");
    assert.ok(byId("large") && byId("large")!.large && byId("large")!.ratio! >= 3, "large text uses the 3:1 threshold");
    assert.ok(byId("large-bold") && byId("large-bold")!.large && byId("large-bold")!.threshold === 3, "18.66px bold text uses the 3:1 threshold");
    assert.ok(byId("large-semibold") && !byId("large-semibold")!.large && byId("large-semibold")!.threshold === 4.5, "18.66px semibold text keeps the normal threshold");
    assert.equal(byId("photo-text")?.status, "unmeasured", "text over an image background must be reported as unmeasured");
    assert.equal(byId("gradient-text")?.status, "measured", "a pure-color gradient must be measurable");
    assert.equal(byId("gradient-invalid-text")?.status, "unmeasured", "a gradient with one unknown stop must be unmeasured");
    assert.match(byId("gradient-invalid-text")?.reason ?? "", /渐变.*色标|背景/, "unknown gradient stop names the unmeasured layer");
    assert.ok(byId("opacity-text") && byId("opacity-text")!.ratio! < 4.5, "ancestor opacity must lower the effective contrast");
    assert.ok((scan.bodyLineLength ?? []).some((line) => line.id === "zh-long" && line.tooLong), "long Chinese body line must fail");
    assert.ok((scan.bodyLineLength ?? []).some((line) => line.id === "en-long" && line.tooLong), "long English body line must fail");
    assert.ok((scan.bodyLineLength ?? []).some((line) => line.id === "span-long" && line.tooLong), "nested span text must be counted as paragraph body");
    assert.ok((scan.bodyLineLength ?? []).some((line) => line.id === "header-long" && line.tooLong), "ordinary header paragraph must remain body copy");
    assert.ok((scan.bodyLineLength ?? []).some((line) => line.id === "link-long" && line.tooLong), "ordinary paragraph link must remain body copy");
    assert.ok((scan.lineLengthExemptions ?? []).some((entry) => entry.id === "table-long"), "parameter table text is exempt and listed");
    assert.ok(!(scan.lineLengthExemptions ?? []).some((entry) => ["span-long", "header-long", "link-long"].includes(entry.id)), "ordinary body paragraphs are not exempt");
  } finally { await browser.close(); }
});
