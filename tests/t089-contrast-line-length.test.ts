import assert from "node:assert/strict";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import test from "node:test";
import { Cdp, openBrowser } from "./helpers/workspace-browser.ts";

const scanSource = readFileSync(new URL("../scripts/visitor-layout-scan.js", import.meta.url), "utf8")
  .replace("export function", "function")
  .replace("export default scanVisitorLayout;", "");

test("T-089 visitor scan enforces body contrast, image uncertainty, and paragraph line length", async () => {
  const browser = await openBrowser();
  const { targetId } = await browser.send("Target.createTarget", { url: "about:blank" }) as { targetId: string };
  const { sessionId } = await browser.send("Target.attachToTarget", { targetId, flatten: true }) as { sessionId: string };
  const html = `<!doctype html><html><body style="margin:0;background:#fff;color:#767676">
    <main data-sc-block="content">
      <p id="fail" style="color:#777">普通正文对比度四点四比一</p>
      <p id="pass" style="color:#767676">普通正文对比度四点六比一</p>
      <p id="large" style="font-size:24px;color:#8f8f8f">大号正文三点二比一</p>
      <div style="background-image:url(data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=)"><p id="photo-text">图片背景上的正文</p></div>
      <p id="zh-long" style="white-space:nowrap">中文正文一二三四五六七八九十一二三四五六七八九十一二三四五六七八九十一二三四五六七八九十一</p>
      <p id="en-long" style="white-space:nowrap">This English paragraph intentionally contains more than seventy five characters on one rendered line for the contrast gate fixture.</p>
      <table><tbody><tr><td><p id="table-long" style="white-space:nowrap">参数表中的型号和规格内容可以很长但不属于正文行长检查范围</p></td></tr></tbody></table>
    </main>
  </body></html>`;
  try {
    await browser.send("Runtime.enable", {}, sessionId);
    await browser.send("Page.enable", {}, sessionId);
    const frameId = (await browser.send("Page.getFrameTree", {}, sessionId) as { frameTree: { frame: { id: string } } }).frameTree.frame.id;
    await browser.send("Page.setDocumentContent", { frameId, html }, sessionId);
    const scan = await browser.eval<{
      textContrast: Array<{ element: string; ratio: number | null; status: string; large: boolean; checkable: boolean }>;
      bodyLineLength: Array<{ id: string; tooLong: boolean; count: number; language: string }>;
      lineLengthExemptions: Array<{ id: string; reason: string }>;
    }>(`(()=>{${scanSource};return scanVisitorLayout(document)})()`, sessionId);
    mkdirSync("artifacts/t089", { recursive: true });
    writeFileSync("artifacts/t089/contrast-line-length-fixture.json", JSON.stringify(scan, null, 2));
    const byId = (id: string) => (scan.textContrast ?? []).find((entry) => entry.element === id);
    assert.ok(byId("fail") && byId("fail")!.ratio! < 4.5, "4.4:1 body text must fail");
    assert.ok(byId("pass") && byId("pass")!.ratio! >= 4.5, "4.6:1 body text must pass");
    assert.ok(byId("large") && byId("large")!.large && byId("large")!.ratio! >= 3, "large text uses the 3:1 threshold");
    assert.equal(byId("photo-text")?.status, "unmeasured", "text over an image background must be reported as unmeasured");
    assert.ok((scan.bodyLineLength ?? []).some((line) => line.id === "zh-long" && line.tooLong), "long Chinese body line must fail");
    assert.ok((scan.bodyLineLength ?? []).some((line) => line.id === "en-long" && line.tooLong), "long English body line must fail");
    assert.ok((scan.lineLengthExemptions ?? []).some((entry) => entry.id === "table-long"), "parameter table text is exempt and listed");
  } finally {
    await browser.send("Target.closeTarget", { targetId }).catch(() => {});
    try { browser.ws.send(JSON.stringify({ id: browser.id++, method: "Browser.close", params: {} })); } catch {}
    browser.ws.close();
  }
});
