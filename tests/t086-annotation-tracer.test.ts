import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const bridgeSource = readFileSync(new URL("../lib/template-adapters/preview-bridge.ts", import.meta.url), "utf8");
const frameSource = readFileSync(new URL("../components/open-source-template-frame.tsx", import.meta.url), "utf8");

test("a selected product slot keeps its stable target after products are reordered", () => {
  assert.match(bridgeSource, /sitecraft:annotation-candidate/, "annotation mode must emit a candidate instead of a generic select");
  assert.match(bridgeSource, /data-sitecraft-slot/, "candidate must use the stable slot after product reorder");
  assert.match(bridgeSource, /productId/, "candidate must retain the stable product id");
});

test("a missing slot has an explicit stale state and cannot reach commit", () => {
  assert.match(bridgeSource, /sitecraft:annotation-(?:candidate|state)/, "bridge must define an annotation message contract");
  assert.match(bridgeSource, /stale/, "a disappeared slot must be marked stale");
  assert.match(bridgeSource, /commitOperations|annotationContext|annotationId/, "stale annotation must not be submitted as an edit");
});

test("a multi-slot region without a primary slot is refused as ambiguous", () => {
  assert.match(bridgeSource, /primarySlot/, "region candidates must carry an explicit primary slot");
  assert.match(bridgeSource, /ambiguous/, "multiple matching slots must be marked ambiguous");
  assert.match(bridgeSource, /clarify|拒绝|不允许/, "ambiguous annotations must be refused before model commit");
});

test("annotation iframe messages are session-bound and versioned", () => {
  assert.match(bridgeSource, /typeVersion: PREVIEW_MESSAGE_TYPE_VERSION/);
  assert.match(bridgeSource, /sessionId: annotationSessionId/);
  assert.match(bridgeSource, /data\.typeVersion !== PREVIEW_MESSAGE_TYPE_VERSION/);
  assert.match(frameSource, /PREVIEW_MESSAGE_TYPE_VERSION = 1/);
  assert.match(frameSource, /data\.sessionId !== sessionIdRef\.current/);
  assert.match(frameSource, /sendAnnotationMode\(\)/);
});
