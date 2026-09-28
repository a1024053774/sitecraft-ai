import assert from "node:assert/strict";
import test from "node:test";
import {
  PREVIEW_CHROME_HINT,
  PREVIEW_TIMEOUT_MS,
  createPreviewLoadController,
  mapPreviewUpstreamReason,
} from "../lib/preview-load-timing.ts";

type FakeTimer = { id: number; due: number; fn: () => void };

function createFakeTimers() {
  let now = 0;
  let nextId = 1;
  const pending: FakeTimer[] = [];
  return {
    now: () => now,
    setTimeout(fn: () => void, ms: number) {
      const id = nextId++;
      pending.push({ id, due: now + ms, fn });
      return id;
    },
    clearTimeout(id: unknown) {
      const index = pending.findIndex((item) => item.id === id);
      if (index >= 0) pending.splice(index, 1);
    },
    advance(ms: number) {
      now += ms;
      const due = pending.filter((item) => item.due <= now).sort((a, b) => a.due - b.due);
      for (const item of due) {
        const index = pending.indexOf(item);
        if (index < 0) continue;
        pending.splice(index, 1);
        item.fn();
      }
    },
    pendingCount: () => pending.length,
  };
}

test("non-thumbnail enters error when onLoad never fires", () => {
  const timers = createFakeTimers();
  const failures: string[] = [];
  const controller = createPreviewLoadController({
    variant: "preview",
    onTimeout: (message) => failures.push(message),
    setTimeout: timers.setTimeout,
    clearTimeout: timers.clearTimeout,
  });

  controller.armDocumentWait();
  timers.advance(PREVIEW_TIMEOUT_MS - 1);
  assert.equal(failures.length, 0, "must not fail before the timeout window");
  timers.advance(1);
  assert.equal(failures.length, 1, "blocked iframe (no onLoad) must surface the failure state");
  assert.match(failures[0]!, /Chrome/);
  assert.match(failures[0]!, /预览没有载入|请重试/);
  assert.doesNotMatch(failures[0]!, /bridge|iframe/i);
  assert.ok(failures[0]!.includes(PREVIEW_CHROME_HINT));
});

test("thumbnail does not start the failure timer until it is near the viewport", () => {
  const timers = createFakeTimers();
  const failures: string[] = [];
  const controller = createPreviewLoadController({
    variant: "thumbnail",
    onTimeout: (message) => failures.push(message),
    setTimeout: timers.setTimeout,
    clearTimeout: timers.clearTimeout,
  });

  controller.armDocumentWait();
  timers.advance(PREVIEW_TIMEOUT_MS * 3);
  assert.equal(failures.length, 0, "off-screen thumbnails must not fail early");

  controller.markVisible();
  timers.advance(PREVIEW_TIMEOUT_MS - 1);
  assert.equal(failures.length, 0);
  timers.advance(1);
  assert.equal(failures.length, 1);
  assert.match(failures[0]!, /Chrome/);
});

test("after onLoad the timer only covers the missing applied acknowledgement", () => {
  const timers = createFakeTimers();
  const failures: string[] = [];
  const controller = createPreviewLoadController({
    variant: "workspace",
    onTimeout: (message) => failures.push(message),
    setTimeout: timers.setTimeout,
    clearTimeout: timers.clearTimeout,
  });

  controller.armDocumentWait();
  timers.advance(PREVIEW_TIMEOUT_MS / 2);
  controller.markDocumentLoaded();
  timers.advance(PREVIEW_TIMEOUT_MS - 1);
  assert.equal(failures.length, 0);
  timers.advance(1);
  assert.equal(failures.length, 1);
  assert.match(failures[0]!, /页面已经打开/);
  assert.match(failures[0]!, /Chrome/);
});

test("a hidden workspace preview does not enter the error state", () => {
  const timers = createFakeTimers();
  const failures: string[] = [];
  const controller = createPreviewLoadController({
    variant: "workspace",
    onTimeout: (message) => failures.push(message),
    setTimeout: timers.setTimeout,
    clearTimeout: timers.clearTimeout,
  });

  controller.armDocumentWait();
  controller.hold();
  timers.advance(PREVIEW_TIMEOUT_MS * 3);
  assert.equal(failures.length, 0, "a preview behind the chat tab must not time out");
  controller.markDocumentLoaded();
  timers.advance(PREVIEW_TIMEOUT_MS * 3);
  assert.equal(failures.length, 0, "the bridge wait must also stay paused while hidden");
  controller.release();
  timers.advance(PREVIEW_TIMEOUT_MS - 1);
  assert.equal(failures.length, 0);
  timers.advance(1);
  assert.equal(failures.length, 1);
});

test("upstream English preview reasons map to Chinese without leaking raw status text", () => {
  assert.match(mapPreviewUpstreamReason("upstream status 502"), /上游|重试/);
  assert.doesNotMatch(mapPreviewUpstreamReason("upstream status 502"), /upstream|502/i);
  assert.match(mapPreviewUpstreamReason("The operation was aborted due to timeout"), /超时|重试/);
  assert.doesNotMatch(mapPreviewUpstreamReason("AbortError: signal is aborted"), /AbortError/i);
  assert.match(mapPreviewUpstreamReason("upstream did not return HTML"), /页面|重试/);
  assert.match(mapPreviewUpstreamReason("模板预览暂时无法加载"), /模板预览暂时无法加载/);
});
