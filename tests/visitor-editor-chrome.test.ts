import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const routeSource = readFileSync(new URL("../app/api/templates/[templateId]/preview/route.ts", import.meta.url), "utf8");
const frameSource = readFileSync(new URL("../components/open-source-template-frame.tsx", import.meta.url), "utf8");
const checkSource = readFileSync(new URL("../scripts/check-published.mjs", import.meta.url), "utf8");

test("editor hover outline is not injected into the shared visitor preview", () => {
  const injectionStart = routeSource.indexOf("const injection");
  const injectionEnd = routeSource.indexOf("const finalStateStyle");
  assert.ok(injectionStart >= 0 && injectionEnd > injectionStart);
  const sharedInjection = routeSource.slice(injectionStart, injectionEnd);
  assert.doesNotMatch(sharedInjection, /data-sitecraft-slot/);
  assert.match(routeSource, /searchParams\.get\("editor"\) === "1"/);
  assert.match(routeSource, /\[data-sitecraft-slot\]:hover\{outline:2px solid rgba\(46,107,79,\.45\);outline-offset:3px\}/);
  assert.match(frameSource, /variant === "workspace"[\s\S]{0,180}editor/);
  assert.match(checkSource, /visitor slot uses a pointer cursor/);
  assert.match(checkSource, /visitor slot shows an editor hover outline/);
});
