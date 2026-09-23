import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const frameSource = readFileSync(new URL("../components/open-source-template-frame.tsx", import.meta.url), "utf8");
const qualitySource = readFileSync(new URL("../app/quality/quality-client.tsx", import.meta.url), "utf8");
const previewRouteSource = readFileSync(new URL("../app/api/templates/[templateId]/preview/route.ts", import.meta.url), "utf8");

test("template previews expose a bounded failure state and development previews are not cached", () => {
  assert.match(frameSource, /data-testid="preview-load-error"/);
  assert.match(frameSource, /载入超时/);
  assert.match(frameSource, /重试/);
  assert.match(frameSource, /onLoadState/);
  assert.match(qualitySource, /previewState/);
  assert.match(qualitySource, /preview-load-error/);
  assert.match(previewRouteSource, /process\.env\.NODE_ENV/);
  assert.match(previewRouteSource, /no-store/);
});
