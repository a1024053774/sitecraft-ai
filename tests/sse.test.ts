import assert from "node:assert/strict";
import test from "node:test";
import { consumeSseFrames } from "../lib/sse.ts";

test("SSE parser keeps incomplete frames and does not JSON.parse unfinished chunks", () => {
  const first = consumeSseFrames('data: {"type":"status","value":"ok"}\n\ndata: {"type":"done","status":"al');
  assert.equal(first.events.length, 1);
  assert.equal(first.events[0].type, "status");
  assert.equal(first.rest, 'data: {"type":"done","status":"al');
  assert.equal(first.rest.includes("\n\n"), false);

  const second = consumeSseFrames(`${first.rest}ignment"}\n\n`);
  assert.equal(second.events.length, 1);
  assert.equal(second.events[0].type, "done");
  assert.equal(second.events[0].status, "alignment");
  assert.equal(second.rest, "");
});
