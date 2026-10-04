import assert from "node:assert/strict";
import { readFileSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";

const SITE = "t097-real-936749b-molding";
const CHROME = "/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell";

test("T-103 real molding pages keep FAQ lines, product specs, and the narrow header intact", () => {
  const out = path.resolve(process.env.T103_CHECK_OUT || "artifacts/t103/focused-check");
  mkdirSync(out, { recursive: true });
  const result = spawnSync(process.execPath, ["scripts/check-published.mjs", "--out", out, SITE], {
    cwd: process.cwd(),
    env: { ...process.env, SITECRAFT_BASE: process.env.SITECRAFT_BASE || "http://127.0.0.1:3035", CHROME_PATH: process.env.CHROME_PATH || CHROME },
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
  });
  process.stdout.write(result.stdout || "");
  process.stderr.write(result.stderr || "");
  assert.equal(result.error, undefined, result.error?.message);
  const report = JSON.parse(readFileSync(path.join(out, "report.json"), "utf8")) as Array<{ failures?: string[]; english?: { failures?: string[] } }>;
  const failures = report.flatMap((row) => [...(row.failures || []), ...(row.english?.failures || [])]);
  assert.equal(result.status, 0, failures.join("\n"));
  assert.deepEqual(failures, []);
});
