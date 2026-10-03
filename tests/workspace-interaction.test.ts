import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import test from "node:test";
import {
  base,
  clickExpression,
  closeBrowser,
  closeModalExpression,
  closePage,
  createSite,
  openBrowser,
  openWorkspace,
  sendChatExpression,
  sleep,
  startAlignmentCard,
  waitFor,
  type Cdp,
  type WorkspacePage,
  failChatRequests,
} from "./helpers/workspace-browser.ts";

// T-052: the action row sits above the chat box with 36 px (44 px on phones) buttons, 需求对齐
// is a visible switch in that row, no developer test sentences or English labels show, and the
// motion is 150–300 ms of transform/opacity that disappears under prefers-reduced-motion.
const out = new URL("../artifacts/t052/", import.meta.url);

type Geometry = {
  row: { top: number; bottom: number } | null;
  input: { top: number } | null;
  buttons: Array<{ text: string; height: number }>;
  toggle: { inRow: boolean; role: string | null; checked: string | null; text: string } | null;
  plusMenu: boolean;
  menuCheckbox: boolean;
  groups: Array<{ name: string | null; buttons: string[]; left: number; right: number; top: number; secondary: boolean }>;
  placeholder: { text: string; clipped: boolean } | null;
};

const geometryExpression = `(() => {
  const box = (el) => el ? el.getBoundingClientRect() : null;
  const row = document.querySelector("[data-testid=chat-actions]");
  const toggle = document.querySelector("[data-testid=alignment-toggle]");
  return {
    row: row && row.getClientRects().length ? { top: box(row).top, bottom: box(row).bottom } : null,
    input: document.querySelector(".chat-input") ? { top: box(document.querySelector(".chat-input")).top } : null,
    buttons: row ? [...row.querySelectorAll("button")].map((item) => ({ text: item.textContent.trim(), height: box(item).height })) : [],
    toggle: toggle ? { inRow: Boolean(row && row.contains(toggle)), role: toggle.getAttribute("role"), checked: toggle.getAttribute("aria-checked"), text: toggle.innerText } : null,
    groups: row ? [...row.querySelectorAll("[data-group]")].map((group) => { const r = box(group); return { name: group.getAttribute("data-group"), buttons: [...group.querySelectorAll("button")].map((item) => item.textContent.trim()), left: r.left, right: r.right, top: r.top, secondary: group.classList.contains("secondary") }; }) : [],
    placeholder: (() => { const area = document.querySelector(".chat-input textarea"); if (!area) return null; const probe = document.createElement("div"); const style = getComputedStyle(area); probe.style.cssText = "position:absolute;visibility:hidden;white-space:nowrap;font:" + style.font + ";letter-spacing:" + style.letterSpacing; probe.textContent = area.placeholder; document.body.appendChild(probe); const need = probe.getBoundingClientRect().width; probe.remove(); const room = area.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight); return { text: area.placeholder, clipped: need > room }; })(),
    plusMenu: Boolean(document.querySelector(".chat-plus-button, .chat-plus-menu")),
    menuCheckbox: [...document.querySelectorAll("label")].some((label) => label.textContent.includes("需求对齐") && label.querySelector("input[type=checkbox]")),
  };
})()`;

const visibleWords = `(() => {
  const words = new Set();
  const walker = document.createTreeWalker(document.querySelector(".builder-shell"), NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const el = node.parentElement;
    if (!el || !el.getClientRects().length || getComputedStyle(el).visibility === "hidden" || el.closest("script, style, textarea, option")) continue;
    for (const word of node.textContent.replace(/#[0-9a-f]{3,8}(?![0-9a-z])|[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}/gi, "").match(/[A-Za-z]{2,}/g) || []) words.add(word);
  }
  // Accessible names and tooltips count too; color values (#1f5aa6) and site ids are not words.
  for (const el of document.querySelectorAll(".builder-shell [aria-label], .builder-shell [title]")) {
    for (const word of ((el.getAttribute("aria-label") || "") + " " + (el.getAttribute("title") || "")).replace(/#[0-9a-f]{3,8}(?![0-9a-z])|[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}/gi, "").match(/[A-Za-z]{2,}/g) || []) words.add(word);
  }
  return [...words];
})()`;

// Language switch, product and file-format names are words a user reads as they are.
const allowedWords = new Set(["EN", "AI", "Logo", "CSV", "XLSX", "PNG", "JPEG", "WebP", "MB", "SKU"]);
// The old hint buttons under the chat box were developer test prompts.
const devButtons = ["额外页面", "未指定页面", "修改服务"];
const devSentences = ["智能产线集成", "Look board"];

const recorderExpression = `(() => {
  window.__motion = [];
  const seen = new Set();
  const record = () => {
    for (const animation of document.getAnimations()) {
      const timing = animation.effect?.getTiming?.() || {};
      const name = animation.animationName || animation.transitionProperty || "?";
      const properties = animation.transitionProperty ? [animation.transitionProperty] : [...new Set((animation.effect?.getKeyframes?.() || []).flatMap((frame) => Object.keys(frame)).filter((key) => !["offset", "computedOffset", "easing", "composite"].includes(key)))];
      const target = animation.effect?.target;
      const label = String(target?.getAttribute?.("class") || target?.tagName || "").slice(0, 60);
      const key = name + "|" + label;
      if (seen.has(key)) continue;
      seen.add(key);
      window.__motion.push({ kind: animation.constructor.name, name, properties, duration: Number(timing.duration) || 0, infinite: timing.iterations === Infinity, target: label });
    }
  };
  clearInterval(window.__motionTimer);
  window.__motionTimer = setInterval(record, 20);
  return true;
})()`;

type Motion = { kind: string; name: string; properties: string[]; duration: number; infinite: boolean; target: string };

async function geometry(browser: Cdp, page: WorkspacePage) {
  return browser.eval<Geometry>(geometryExpression, page.sessionId);
}

async function showPane(browser: Cdp, page: WorkspacePage, pane: "chat" | "preview") {
  const label = pane === "chat" ? "对话" : "预览";
  await browser.eval(`[...document.querySelectorAll(".builder-mobile-tabs button")].find((item) => item.textContent.includes(${JSON.stringify(label)}))?.click()`, page.sessionId);
  await sleep(400);
}

test("the action row sits above the chat box, 需求对齐 is a visible switch, and no dev labels show", { timeout: 300000 }, async () => {
  mkdirSync(out, { recursive: true });
  const browser = await openBrowser();
  const report: unknown[] = [];
  try {
    for (const width of [1440, 768, 375]) {
      const page = await openWorkspace(browser, { siteId: await createSite(`T052 版式 ${width}`), width, theme: "light" });
      if (width <= 900) await showPane(browser, page, "chat");
      const before = await geometry(browser, page);
      report.push({ width, before });
      assert.ok(before.row, `${width}: the action row is missing`);
      assert.ok(before.input && before.row.bottom <= before.input.top + 1, `${width}: the action row must sit above the chat box`);
      const minimum = width <= 600 ? 44 : 36;
      for (const button of before.buttons) assert.ok(button.height >= minimum, `${width}: 「${button.text}」 is ${button.height}px, needs ${minimum}px`);
      assert.equal(before.plusMenu, false, `${width}: the + menu is gone`);
      assert.equal(before.menuCheckbox, false, `${width}: 需求对齐 is not a checkbox in a menu`);
      assert.deepEqual(before.groups.map((group) => [group.name, group.buttons.map((text) => text.replace(/\s*(开|关)$/, ""))]), [["alignment", ["需求对齐"]], ["look", ["样子", "配色"]], ["materials", ["公司资料", "上传产品图", "商品表格"]]], `${width}: the action row is grouped alignment / look / materials`);
      assert.equal(before.groups[2].secondary, true, `${width}: the materials group is secondary`);
      assert.equal(before.groups[1].secondary, false);
      assert.ok(before.placeholder && !before.placeholder.clipped, `${width}: the placeholder 「${before.placeholder?.text}」 fits without an ellipsis`);
      assert.ok(before.toggle?.inRow, `${width}: 需求对齐 switch sits in the action row`);
      assert.equal(before.toggle.role, "switch");
      // A site that was never generated starts with 需求对齐 on.
      assert.equal(before.toggle.checked, "true");
      assert.match(before.toggle.text, /开/);
      await browser.eval(clickExpression("alignment-toggle"), page.sessionId);
      await waitFor(browser, page.sessionId, `document.querySelector("[data-testid=alignment-toggle]")?.getAttribute("aria-checked") === "false"`);
      const off = await geometry(browser, page);
      assert.equal(off.toggle?.checked, "false", `${width}: the switch turns off`);
      assert.match(off.toggle!.text, /关/);
      await browser.eval(clickExpression("alignment-toggle"), page.sessionId);
      assert.ok(await waitFor(browser, page.sessionId, `document.querySelector("[data-testid=alignment-toggle]")?.getAttribute("aria-checked") === "true"`), `${width}: the switch turns back on`);

      const words = new Set<string>();
      const text: string[] = [];
      const buttons: string[] = [];
      const collect = async () => {
        for (const word of await browser.eval<string[]>(visibleWords, page.sessionId)) words.add(word);
        text.push(await browser.eval<string>(`document.querySelector(".builder-shell").innerText`, page.sessionId));
        buttons.push(...await browser.eval<string[]>(`[...document.querySelectorAll(".builder-shell button")].map((item) => item.textContent.trim())`, page.sessionId));
      };
      await collect();
      for (const [id, label] of [["open-look-panel", "样子"], ["open-color-panel", "配色"], ["history-toggle", "历史"]]) {
        await browser.eval(clickExpression(id, label), page.sessionId);
        await sleep(350);
        await collect();
        await browser.eval(clickExpression(id, label), page.sessionId);
        await sleep(300);
      }
      for (const [id, label] of [["open-materials", "提供公司资料"], ["open-image-library", "上传产品图"], ["open-product-import", "上传商品表格"]]) {
        await browser.eval(clickExpression(id, label), page.sessionId);
        await sleep(350);
        await collect();
        await browser.eval(closeModalExpression, page.sessionId);
        await sleep(300);
      }
      if (width <= 900) await showPane(browser, page, "preview");
      await browser.eval(clickExpression("toolbar-delete-site"), page.sessionId);
      await sleep(350);
      await collect();
      await browser.eval(closeModalExpression, page.sessionId);
      const english = [...words].filter((word) => !allowedWords.has(word));
      report.push({ width, words: [...words] });
      assert.deepEqual(english, [], `${width}: English labels on screen`);
      for (const sentence of devSentences) assert.ok(!text.some((item) => item.includes(sentence)), `${width}: 「${sentence}」 is a developer test sentence`);
      for (const label of devButtons) assert.ok(!buttons.includes(label), `${width}: 「${label}」 is a developer test button`);
      await closePage(browser, page);
    }
  } finally {
    await closeBrowser(browser);
    writeFileSync(new URL("interaction-report.json", out), JSON.stringify(report, null, 2));
  }
});

async function exerciseMotion(browser: Cdp, width: number, reducedMotion: boolean) {
  const siteId = await createSite(`T052 动画 ${width}`);
  const conversationId = await startAlignmentCard(siteId);
  const page = await openWorkspace(browser, { siteId, width, theme: "dark", conversationId, reducedMotion });
  const steps: Record<string, unknown> = {};
  await browser.eval(recorderExpression, page.sessionId);
  if (width <= 900) {
    // Tablet and phone: the chat opens and closes over the preview.
    await showPane(browser, page, "preview");
    await showPane(browser, page, "chat");
  }
  assert.ok(await waitFor(browser, page.sessionId, `Boolean(document.querySelector(".alignment-panel .alignment-card"))`, 15000), "the round-one card appears");
  // Pick an option in each question; on phones walk the drawer with 下一题.
  for (let index = 0; index < 4; index += 1) {
    const target = width <= 600 ? 0 : index;
    const picked = await browser.eval<boolean>(`(() => { const question = document.querySelectorAll(".alignment-panel [data-testid=alignment-card-question]")[${target}]; const option = question?.querySelector(".alignment-card:not(.selected)"); if (!option) return false; option.click(); return true; })()`, page.sessionId);
    if (!picked) break;
    await sleep(350);
    if (width <= 600) {
      if (!await browser.eval<boolean>(clickExpression("alignment-next"), page.sessionId)) break;
      await sleep(350);
    }
  }
  await sleep(300);
  steps.submitReady = await waitFor(browser, page.sessionId, `document.querySelector("[data-testid=alignment-submit]") && !document.querySelector("[data-testid=alignment-submit]").disabled`, 5000);
  await browser.eval(clickExpression("alignment-submit"), page.sessionId);
  steps.submitted = await waitFor(browser, page.sessionId, `!document.querySelector("[data-testid=alignment-submit]") && !document.querySelector("[data-testid=chat-progress]")`, 15000);

  // A request that fails (the server's no-model 503, answered here so it does not depend on
  // the machine having a model key), slowed so the progress block is seen.
  if (width <= 600) await showPane(browser, page, "chat");
  const stopFailing = await failChatRequests(browser, page.sessionId);
  await browser.send("Network.enable", {}, page.sessionId);
  await browser.send("Network.emulateNetworkConditions", { offline: false, latency: 1200, downloadThroughput: -1, uploadThroughput: -1 }, page.sessionId);
  await browser.eval(sendChatExpression("首屏标题写成按图加工的重载减速机"), page.sessionId);
  await browser.eval(clickExpression("chat-send", "发送"), page.sessionId);
  steps.progressShown = await waitFor(browser, page.sessionId, `Boolean(document.querySelector("[data-testid=chat-progress] [data-step-state=current]"))`, 5000);
  steps.progress = await browser.eval(`[...document.querySelectorAll("[data-testid=chat-progress] [data-step]")].map((item) => item.dataset.stepState + ":" + item.textContent.trim())`, page.sessionId);
  steps.progressClosed = await waitFor(browser, page.sessionId, `!document.querySelector("[data-testid=chat-progress]") && Boolean(document.querySelector(".message.error"))`, 20000);
  await stopFailing();
  await browser.send("Network.emulateNetworkConditions", { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 }, page.sessionId);

  // A palette change is written to the draft; the preview updates without a full cover.
  if (width <= 600) await showPane(browser, page, "chat");
  await browser.eval(clickExpression("open-color-panel", "配色"), page.sessionId);
  await sleep(350);
  const revision = await browser.eval<string>(`document.querySelector("[data-testid=workspace-draft-revision]").textContent`, page.sessionId);
  await browser.eval(`document.querySelector(".palette-card:not(.selected)")?.click()`, page.sessionId);
  if (width <= 600) await showPane(browser, page, "preview");
  const covered: string[] = [];
  const started = Date.now();
  while (Date.now() - started < 6000) {
    const cover = await browser.eval<string | null>(`(() => { const layer = document.querySelector("[data-testid=preview-load-progress]"); if (!layer) return null; const rect = layer.getBoundingClientRect(); const style = getComputedStyle(layer); return rect.height > 8 && (style.backgroundColor !== "rgba(0, 0, 0, 0)" || style.backgroundImage !== "none") ? rect.height + "px " + style.backgroundColor : null; })()`, page.sessionId);
    if (cover) covered.push(cover);
    const changed = await browser.eval<boolean>(`document.querySelector("[data-testid=workspace-draft-revision]").textContent !== ${JSON.stringify(revision)} && document.querySelector("[data-testid=open-source-template-frame]")?.dataset.previewHydrated === "true"`, page.sessionId);
    if (changed) break;
    await sleep(40);
  }
  steps.previewCovered = covered;
  await sleep(400);
  const motion = await browser.eval<Motion[]>(`window.__motion`, page.sessionId);
  await closePage(browser, page);
  return { steps, motion };
}

test("workspace motion is 150–300 ms of transform/opacity and stops under prefers-reduced-motion", { timeout: 300000 }, async () => {
  mkdirSync(out, { recursive: true });
  const browser = await openBrowser();
  const report: Record<string, unknown> = {};
  try {
    for (const width of [1440, 768, 375]) {
      const normal = await exerciseMotion(browser, width, false);
      const reduced = await exerciseMotion(browser, width, true);
      report[width] = { normal, reduced };
      for (const run of [normal, reduced]) {
        assert.equal(run.steps.submitReady, true, `${width}: the card can be submitted`);
        assert.equal(run.steps.submitted, true, `${width}: the card collapses after submit`);
        assert.equal(run.steps.progressShown, true, `${width}: the chat shows the step in progress`);
        assert.ok((run.steps.progress as string[]).length >= 2, `${width}: the progress lists its steps`);
        assert.equal(run.steps.progressClosed, true, `${width}: the progress closes on failure and the error shows`);
        assert.deepEqual(run.steps.previewCovered, [], `${width}: the preview refresh must not cover the page`);
      }
      const finite = normal.motion.filter((item) => !item.infinite);
      assert.ok(finite.length >= 3, `${width}: expected transitions for the card, progress and panels, saw ${JSON.stringify(normal.motion)}`);
      for (const item of normal.motion) {
        assert.ok(item.properties.every((property) => ["transform", "opacity", "visibility"].includes(property)), `${width}: ${item.name} on ${item.target} animates ${item.properties.join(",")}`);
        if (item.infinite) assert.ok(["sitecraft-spin", "preview-load-bar"].includes(item.name), `${width}: ${item.name} loops`);
        else if (item.properties.some((property) => property !== "visibility")) assert.ok(item.duration >= 150 && item.duration <= 300, `${width}: ${item.name} on ${item.target} lasts ${item.duration}ms`);
      }
      assert.deepEqual(reduced.motion, [], `${width}: nothing moves under prefers-reduced-motion`);
    }
  } finally {
    await closeBrowser(browser);
    writeFileSync(new URL("motion-report.json", out), JSON.stringify(report, null, 2));
  }
});

// The server is the authority: every step is read back from GET /api/sites/<id>/draft, and
// the page is reloaded at the end, so a UI that only updates React state fails here.
test("look, color, undo and redo still write the draft from the new controls", { timeout: 240000 }, async () => {
  const browser = await openBrowser();
  try {
    for (const width of [1440, 375]) {
      const siteId = await createSite(`T052 修改 ${width}`);
      const page = await openWorkspace(browser, { siteId, width, theme: "dark" });
      const server = async () => {
        const response = await fetch(`${base}/api/sites/${siteId}/draft`, { cache: "no-store" });
        const body = await response.json() as { draft: { revision: number; visualBrief: { id: string; label: string }; paletteId: string } };
        return { revision: body.draft.revision, brief: body.draft.visualBrief.id, palette: body.draft.paletteId };
      };
      const state = () => browser.eval<{ revision: string; look: string }>(`({ revision: document.querySelector("[data-testid=workspace-draft-revision]").textContent, look: document.querySelector(".builder-template-name").textContent })`, page.sessionId);
      const shows = (revision: number) => waitFor(browser, page.sessionId, `document.querySelector("[data-testid=workspace-draft-revision]").textContent.includes("v${revision}")`, 10000);
      if (width <= 600) await showPane(browser, page, "chat");
      const start = await server();
      const startUi = await state();

      await browser.eval(clickExpression("open-color-panel"), page.sessionId);
      await sleep(300);
      await browser.eval(`document.querySelector(".palette-card:not(.selected)").click()`, page.sessionId);
      const colored = await (async () => { for (let i = 0; i < 60; i += 1) { const now = await server(); if (now.revision > start.revision) return now; await sleep(150); } return await server(); })();
      assert.equal(colored.revision, start.revision + 1, `${width}: the server saved the color set as a new revision`);
      assert.equal(colored.brief, start.brief, `${width}: a color set keeps the look`);
      assert.notEqual(colored.palette, start.palette, `${width}: the server holds the new palette`);
      assert.ok(await shows(colored.revision), `${width}: the page shows the server revision ${colored.revision}`);
      const coloredUi = await state();
      assert.notEqual(coloredUi.look, startUi.look, `${width}: the page names the new palette`);

      await browser.eval(clickExpression("open-look-panel"), page.sessionId);
      await sleep(300);
      await browser.eval(`document.querySelector("[data-testid=visual-brief-card]:not(.selected)").click()`, page.sessionId);
      const looked = await (async () => { for (let i = 0; i < 60; i += 1) { const now = await server(); if (now.revision > colored.revision) return now; await sleep(150); } return await server(); })();
      assert.equal(looked.revision, colored.revision + 1, `${width}: the server saved the look as a new revision`);
      assert.notEqual(looked.brief, colored.brief, `${width}: the server holds the new look`);
      assert.ok(await shows(looked.revision));
      const lookedUi = await state();

      if (width <= 600) await showPane(browser, page, "preview");
      await browser.eval(clickExpression("undo", "撤销"), page.sessionId);
      assert.ok(await waitFor(browser, page.sessionId, `document.querySelector(".builder-template-name").textContent === ${JSON.stringify(coloredUi.look)}`, 10000), `${width}: undo brings the previous look back`);
      const undone = await server();
      assert.equal(undone.brief, colored.brief, `${width}: the server undid the look`);
      assert.equal(undone.palette, colored.palette, `${width}: the server undid the palette with it`);
      assert.ok(undone.revision > looked.revision, `${width}: undo is a new revision, not a rewrite of history`);
      assert.ok(await shows(undone.revision));

      await browser.eval(clickExpression("redo", "重做"), page.sessionId);
      assert.ok(await waitFor(browser, page.sessionId, `document.querySelector(".builder-template-name").textContent === ${JSON.stringify(lookedUi.look)}`, 10000), `${width}: redo applies the look again`);
      const redone = await server();
      assert.equal(redone.brief, looked.brief, `${width}: the server redid the look`);
      assert.equal(redone.palette, looked.palette);
      assert.ok(await shows(redone.revision));

      // Reload: what the UI shows now must be what the server restores.
      await browser.send("Page.reload", {}, page.sessionId);
      assert.ok(await waitFor(browser, page.sessionId, `Boolean(document.querySelector("[data-testid=workspace-draft-revision]")) && Boolean(document.querySelector("[data-testid=open-source-template-frame]"))`, 20000), `${width}: the workspace reloads`);
      assert.ok(await shows(redone.revision), `${width}: after a reload the page shows revision ${redone.revision}`);
      const reloaded = await state();
      assert.equal(reloaded.look, lookedUi.look, `${width}: after a reload the look and palette are the same`);
      assert.deepEqual(await server(), redone, `${width}: reloading changed nothing on the server`);
      await closePage(browser, page);
    }
  } finally {
    await closeBrowser(browser);
  }
});

// Blind review of T-052: the round-one card first showed its middle. Its title and the
// first question must be inside the chat viewport when the card opens, and choosing an
// option must not move the panel.
test("the alignment card opens at its top and choosing an option does not scroll the chat", { timeout: 180000 }, async () => {
  const browser = await openBrowser();
  try {
    for (const width of [1440, 768]) {
      const siteId = await createSite(`T052 卡片顶部 ${width}`);
      const conversationId = await startAlignmentCard(siteId);
      const page = await openWorkspace(browser, { siteId, width, theme: "dark", conversationId });
      if (width <= 900) await showPane(browser, page, "chat");
      assert.ok(await waitFor(browser, page.sessionId, `Boolean(document.querySelector(".alignment-panel .alignment-card"))`, 15000), `${width}: the card appears`);
      await sleep(900);
      const inView = `(() => {
        const box = document.querySelector(".chat-messages").getBoundingClientRect();
        const inside = (el) => { if (!el) return "missing"; const r = el.getBoundingClientRect(); return r.top >= box.top - 1 && r.bottom <= box.bottom + 1 ? "yes" : "no:" + Math.round(r.top - box.top) + "," + Math.round(r.bottom - box.bottom); };
        return { head: inside(document.querySelector(".alignment-panel .alignment-head")), question: inside(document.querySelector(".alignment-panel .alignment-q-head")), scrollTop: document.querySelector(".chat-messages").scrollTop };
      })()`;
      const opened = await browser.eval<{ head: string; question: string; scrollTop: number }>(inView, page.sessionId);
      assert.equal(opened.head, "yes", `${width}: the card title is in the chat viewport (${opened.head})`);
      assert.equal(opened.question, "yes", `${width}: question 1 is in the chat viewport (${opened.question})`);
      // A stale scroll position must not survive: scroll far down, reload the chat, look again.
      await browser.eval(`(() => { document.querySelector(".chat-messages").scrollTop = 99999; })()`, page.sessionId);
      await browser.eval(`document.querySelector(".alignment-panel .alignment-card:not(.selected)")?.click()`, page.sessionId);
      const scrolled = await browser.eval<number>(`document.querySelector(".chat-messages").scrollTop`, page.sessionId);
      await sleep(600);
      const after = await browser.eval<number>(`document.querySelector(".chat-messages").scrollTop`, page.sessionId);
      assert.equal(after, scrolled, `${width}: choosing an option does not move the chat`);
      await closePage(browser, page);
    }
  } finally {
    await closeBrowser(browser);
  }
});

test("a failed request shows one error message and one plain retry line, not two red boxes", { timeout: 180000 }, async () => {
  const browser = await openBrowser();
  try {
    for (const width of [1440, 375]) {
      const page = await openWorkspace(browser, { siteId: await createSite(`T052 错误 ${width}`), width, theme: "light" });
      if (width <= 600) await showPane(browser, page, "chat");
      const stop = await failChatRequests(browser, page.sessionId);
      await browser.eval(sendChatExpression("把首屏标题写成按图加工的重载减速机"), page.sessionId);
      await browser.eval(clickExpression("chat-send", "发送"), page.sessionId);
      assert.ok(await waitFor(browser, page.sessionId, `Boolean(document.querySelector(".message.error .message-bubble"))`, 15000), `${width}: the error shows`);
      await stop();
      const seen = await browser.eval<{ boxes: number; note: string; text: string }>(`(() => { const message = document.querySelector(".message.error"); return { boxes: message.querySelectorAll(".change-summary").length, note: message.querySelector(".error-note")?.textContent ?? "", text: message.innerText }; })()`, page.sessionId);
      assert.equal(seen.boxes, 0, `${width}: only the main message is boxed`);
      assert.equal(seen.note, "已保存的草稿没有变化，可以直接重试。");
      assert.ok(!/服务器|恢复状态|注意：/.test(seen.text), `${width}: no developer wording in ${seen.text}`);
      await closePage(browser, page);
    }
  } finally {
    await closeBrowser(browser);
  }
});
