import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import test from "node:test";

const childScript = new URL("./t094-chrome-lifecycle-child.ts", import.meta.url);
const chromePath = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const base = process.env.SITECRAFT_BASE || "http://127.0.0.1:3034";

type Ready = { ownerPid: number; port: number; dataDir: string };

function psRows() {
  const result = spawnSync("ps", ["-axo", "pid=,ppid=,command="], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(`ps failed: ${result.stderr}`);
  return result.stdout.split("\n").map((line) => line.trim()).filter(Boolean);
}

function chromePids(dataDir: string) {
  const needle = `--user-data-dir=${dataDir}`;
  return psRows().flatMap((line) => {
    if (!line.includes("chrome-headless-shell") || !line.includes(needle)) return [];
    const pid = Number.parseInt(line.split(/\s+/, 1)[0] ?? "", 10);
    return Number.isInteger(pid) ? [pid] : [];
  });
}

function sleep(ms: number) { return new Promise((resolve) => setTimeout(resolve, ms)); }

async function runChild(mode: string, killSignal?: NodeJS.Signals) {
  const child = spawn(process.execPath, ["--experimental-strip-types", childScript.pathname, mode], {
    cwd: process.cwd(),
    env: { ...process.env, SITECRAFT_BASE: base, CHROME_PATH: chromePath, SITECRAFT_BROWSER_LOCK_KEY: `t094-${process.pid}-${mode}-${Date.now()}` },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", (chunk) => { output += String(chunk); });
  child.stderr.on("data", (chunk) => { output += String(chunk); });
  const ready = await new Promise<Ready>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`child did not open Chrome: ${output}`)), 30_000);
    child.stdout.on("data", (chunk) => {
      const line = String(chunk).split("\n").find((item) => item.startsWith("READY "));
      if (!line) return;
      clearTimeout(timer);
      resolve(JSON.parse(line.slice(6)) as Ready);
    });
    child.once("error", reject);
  });
  if (killSignal) child.kill(killSignal);
  const result = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve) => child.once("exit", (code, signal) => resolve({ code, signal })));
  await sleep(300);
  return { ready, result, output };
}

test("openBrowser owns Chrome through normal, thrown, and SIGTERM exits", async () => {
  for (const mode of ["normal", "throw", "term"]) {
    const run = await runChild(mode);
    assert.equal(chromePids(run.ready.dataDir).length, 0, `${mode} left Chrome alive: ${run.output}`);
  }
});

test("SIGKILL recovery removes only an orphan without an established debugger connection", async () => {
  const crashed = await runChild("hold", "SIGKILL");
  assert.equal(crashed.result.signal, "SIGKILL");
  assert.ok(chromePids(crashed.ready.dataDir).length > 0, "SIGKILL fixture must leave an orphan for recovery");

  const protectedOwner = spawn(process.execPath, ["-e", "setTimeout(() => {}, 60000)"], { stdio: "ignore" });
  await new Promise<void>((resolve) => protectedOwner.once("spawn", () => resolve()));
  protectedOwner.kill("SIGKILL");
  await new Promise<void>((resolve) => protectedOwner.once("exit", () => resolve()));
  const protectedPid = protectedOwner.pid;
  assert.ok(protectedPid);
  const protectedPort = 52_000 + (process.pid % 1000);
  const protectedDir = `/tmp/sitecraft-workspace-${protectedPid}`;
  const protectedChrome = spawn(chromePath, [`--remote-debugging-port=${protectedPort}`, `--user-data-dir=${protectedDir}`, "--headless=new", "--no-first-run", "about:blank"], { stdio: "ignore", detached: true });
  protectedChrome.unref();
  let ws: WebSocket | undefined;
  try {
    let version: { webSocketDebuggerUrl?: string } | null = null;
    for (let attempt = 0; attempt < 80 && !version; attempt += 1) {
      version = await fetch(`http://127.0.0.1:${protectedPort}/json/version`).then((response) => response.json()).catch(() => null);
      if (!version) await sleep(100);
    }
    assert.ok(version?.webSocketDebuggerUrl, "protected Chrome must expose CDP");
    ws = new WebSocket(version.webSocketDebuggerUrl);
    await new Promise<void>((resolve, reject) => {
      ws!.addEventListener("open", () => resolve(), { once: true });
      ws!.addEventListener("error", () => reject(new Error("protected Chrome CDP connection failed")), { once: true });
    });
    const recovery = await runChild("normal");
    assert.equal(chromePids(crashed.ready.dataDir).length, 0, `orphan survived recovery: ${recovery.output}`);
    assert.ok(chromePids(protectedDir).length > 0, "Chrome with an established debugger connection was reaped");
  } finally {
    ws?.close();
    protectedChrome.kill("SIGKILL");
    for (let attempt = 0; attempt < 20 && chromePids(protectedDir).length; attempt += 1) {
      for (const pid of chromePids(protectedDir)) {
        try { process.kill(pid, "SIGKILL"); } catch { /* already exited */ }
      }
      await sleep(50);
    }
  }
});
