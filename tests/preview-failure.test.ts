import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const frameSource = readFileSync(new URL("../components/open-source-template-frame.tsx", import.meta.url), "utf8");
const qualitySource = readFileSync(new URL("../app/quality/quality-client.tsx", import.meta.url), "utf8");
const previewRouteSource = readFileSync(new URL("../app/api/templates/[templateId]/preview/route.ts", import.meta.url), "utf8");

test("template previews expose a bounded failure state and development previews are not cached", () => {
  assert.match(frameSource, /data-testid="preview-load-error"/);
  assert.match(frameSource, /重试/);
  assert.match(frameSource, /onLoadState/);
  assert.match(qualitySource, /previewState/);
  assert.match(qualitySource, /preview-load-error/);
  assert.match(previewRouteSource, /process\.env\.NODE_ENV/);
  assert.match(previewRouteSource, /no-store/);
});

test("preview timeout starts after the document loads and a failed document reports its own reason", () => {
  const mountEffect = frameSource.slice(
    frameSource.indexOf("useEffect(() => {"),
    frameSource.indexOf("const receiveMessage"),
  );
  assert.doesNotMatch(mountEffect, /PREVIEW_TIMEOUT_MS/);
  assert.match(frameSource, /onLoad=\{handleFrameLoad\}/);
  assert.match(frameSource, /handleFrameLoad[\s\S]*PREVIEW_TIMEOUT_MS/);
  const shown = [...frameSource.matchAll(/"([^"\n]*预览[^"\n]*)"/g)].map((match) => match[1]);
  assert.ok(shown.length > 0);
  for (const message of shown) {
    assert.doesNotMatch(message, /bridge|iframe/i);
  }
  assert.match(frameSource, /如果预览打不开，请用 Chrome 打开/);
  assert.match(frameSource, /data-testid="preview-load-progress"/);
  assert.match(frameSource, /data\?\.type === "sitecraft:error"/);
  assert.match(previewRouteSource, /type: "sitecraft:error"/);
  assert.match(previewRouteSource, /parent\.postMessage/);
});
