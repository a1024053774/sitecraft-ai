import assert from "node:assert/strict";
import test from "node:test";
import { base } from "./helpers/workspace-browser.ts";

test("browser base serves the current workspace", async () => {
  const response = await fetch(`${base}/api/health`, { cache: "no-store" });
  const body = await response.json() as { testIdentity?: { cwd?: unknown } };
  const servedCwd = body.testIdentity?.cwd;
  assert.equal(
    typeof servedCwd,
    "string",
    `SITECRAFT_BASE ${base} does not expose a development workspace identity; refusing to test an unknown server`,
  );
  assert.equal(
    servedCwd,
    process.cwd(),
    `SITECRAFT_BASE ${base} serves ${String(servedCwd)}, but tests run from ${process.cwd()}`,
  );
});
