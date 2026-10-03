import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, rm, utimes, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const LOCK_KEY = `t077-${process.pid}-${Date.now()}`;
const BASE = process.env.SITECRAFT_BASE || "http://127.0.0.1:3034";
const PORT_LOCK = path.join(os.tmpdir(), `sitecraft-workspace-browser-${LOCK_KEY}.lock`);
const LEGACY_LOCK = path.join(os.tmpdir(), "sitecraft-workspace-browser.lock");
const PROBE = fileURLToPath(new URL("./t077-browser-lock-probe.ts", import.meta.url));
const CHROME_PATH = process.env.CHROME_PATH || "/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell";

async function oldPath(file: string) {
  const old = new Date(Date.now() - 10_000);
  await utimes(file, old, old);
}

async function runProbe() {
  const child = spawn(process.execPath, ["--experimental-strip-types", PROBE], {
    env: { ...process.env, SITECRAFT_BASE: BASE, SITECRAFT_BROWSER_LOCK_KEY: LOCK_KEY, CHROME_PATH },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", (chunk) => { output += String(chunk); });
  child.stderr.on("data", (chunk) => { output += String(chunk); });
  const result = await new Promise<{ code: number | null; output: string }>((resolve) => {
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      resolve({ code: null, output });
    }, 5000);
    child.once("exit", (code) => { clearTimeout(timer); resolve({ code, output }); });
  });
  return result;
}

async function cleanLocks() {
  await rm(PORT_LOCK, { force: true });
  await rm(LEGACY_LOCK, { recursive: true, force: true });
}

test.afterEach(cleanLocks);

test("a crash before owner write is recoverable without an unbounded lock wait", { concurrency: false }, async () => {
  await cleanLocks();
  await mkdir(LEGACY_LOCK);
  // A process that dies while serializing its owner record can leave a partial JSON file.
  await writeFile(PORT_LOCK, "{\"pid\":", "utf8");
  await oldPath(PORT_LOCK);
  const result = await runProbe();
  assert.equal(result.code, 0, `probe stayed locked or failed: ${result.output}`);
});

test("a reused PID does not keep a stale browser lock alive", { concurrency: false }, async () => {
  await cleanLocks();
  await mkdir(LEGACY_LOCK);
  await writeFile(path.join(LEGACY_LOCK, "owner"), `${process.pid}\n`, "utf8");
  // PID 1 is stable and queryable on the test host; the deliberately wrong start token models
  // that the PID was recycled for another process.
  await writeFile(PORT_LOCK, JSON.stringify({ pid: 1, start: "pid-reuse-sentinel", acquiredAt: Date.now() - 10_000 }), "utf8");
  await oldPath(PORT_LOCK);
  const result = await runProbe();
  assert.equal(result.code, 0, `probe stayed locked or failed: ${result.output}`);
});
