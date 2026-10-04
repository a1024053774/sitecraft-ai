import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const runSource = readFileSync(new URL("../lib/quality-run.ts", import.meta.url), "utf8");
const routeSource = readFileSync(new URL("../app/api/quality/cells/route.ts", import.meta.url), "utf8");
const matrixSource = readFileSync(new URL("../lib/quality-matrix.ts", import.meta.url), "utf8");
const clientSource = readFileSync(new URL("../app/(workspace)/quality/quality-client.tsx", import.meta.url), "utf8");

test("quality failures keep a diagnostic code, map to Chinese, and never render an old draft", () => {
  assert.match(runSource, /errorCode/);
  assert.match(runSource, /userFacingError/);
  assert.match(routeSource, /userFacingError/);
  assert.match(routeSource, /code: result\.errorCode/);
  assert.match(matrixSource, /saved\?\.ok/);
  assert.match(clientSource, /previewDraft && cell\.draft\.nonceVisible && cell\.result\?\.ok/);
  assert.match(clientSource, /重试/);
  assert.match(clientSource, /userFacingError/);
});
