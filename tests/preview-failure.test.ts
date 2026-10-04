import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const frameSource = readFileSync(new URL("../components/open-source-template-frame.tsx", import.meta.url), "utf8");
const qualitySource = readFileSync(new URL("../app/(workspace)/quality/quality-client.tsx", import.meta.url), "utf8");
const previewRouteSource = readFileSync(new URL("../app/api/templates/[templateId]/preview/route.ts", import.meta.url), "utf8");
const timingSource = readFileSync(new URL("../lib/preview-load-timing.ts", import.meta.url), "utf8");

test("template previews expose a bounded failure state and development previews are not cached", () => {
  assert.match(frameSource, /data-testid="preview-load-error"/);
  assert.match(frameSource, /重试/);
  assert.match(frameSource, /onLoadState/);
  assert.match(qualitySource, /previewState/);
  assert.match(qualitySource, /preview-load-error/);
  assert.match(previewRouteSource, /process\.env\.NODE_ENV/);
  assert.match(previewRouteSource, /no-store/);
});

test("preview timeout arms without waiting for onLoad, but thumbnails wait for visibility", () => {
  assert.match(frameSource, /createPreviewLoadController/);
  assert.match(frameSource, /armDocumentWait/);
  assert.match(frameSource, /IntersectionObserver/);
  assert.match(frameSource, /markVisible/);
  assert.match(frameSource, /markDocumentLoaded/);
  assert.match(frameSource, /variant !== "thumbnail"/);
  assert.match(timingSource, /armDocumentWait/);
  assert.match(timingSource, /markVisible/);
  const shown = [...frameSource.matchAll(/`([^`]*预览[^`]*)`/g), ...frameSource.matchAll(/"([^"\n]*预览[^"\n]*)"/g)].map((match) => match[1]);
  assert.ok(shown.length > 0);
  for (const message of shown) {
    assert.doesNotMatch(message, /bridge|iframe/i);
  }
  assert.match(timingSource, /如果预览打不开，请用 Chrome 打开/);
  assert.match(frameSource, /PREVIEW_CHROME_HINT/);
  assert.match(frameSource, /data-testid="preview-load-progress"/);
  assert.match(frameSource, /data\?\.type === "sitecraft:error"/);
  assert.match(frameSource, /mapPreviewUpstreamReason/);
  assert.match(previewRouteSource, /type: "sitecraft:error"/);
  assert.match(previewRouteSource, /mapPreviewUpstreamReason/);
  assert.match(previewRouteSource, /parent\.postMessage/);
});
