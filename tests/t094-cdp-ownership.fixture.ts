import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const childScript = new URL("./t094-cdp-ownership-child.ts", import.meta.url);
const chromePath = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const base = process.env.SITECRAFT_BASE || "http://127.0.0.1:3034";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

test("openBrowser does not attach to a foreign CDP endpoint on its old computed port", async () => {
  const work = `/tmp/sitecraft-t094-cdp-${process.pid}`;
  const gate = path.join(work, "gate");
  const info = path.join(work, "foreign.json");
  const foreignDir = `/tmp/t094-foreign-cdp-${process.pid}`;
  await mkdir(work, { recursive: true });
  await writeFile(gate, "", "utf8");
  const child = spawn(process.execPath, ["--experimental-strip-types", childScript.pathname], {
    cwd: process.cwd(),
    env: { ...process.env, SITECRAFT_BASE: base, CHROME_PATH: chromePath, T094_CDP_GATE: gate, T094_CDP_INFO: info },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", (chunk) => { output += String(chunk); });
  child.stderr.on("data", (chunk) => { output += String(chunk); });
  const childReady = await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`child did not start: ${output}`)), 30_000);
    child.stdout.on("data", () => {
      if (!output.includes(`READY ${child.pid}`)) return;
      clearTimeout(timer);
      resolve();
    });
  });
  void childReady;
  const port = 10_000 + ((child.pid ?? 0) % 50_000);
  const foreignChrome = spawn(chromePath, [`--remote-debugging-port=${port}`, `--user-data-dir=${foreignDir}`, "--headless=new", "--no-first-run", "about:blank"], { stdio: "ignore", detached: true });
  foreignChrome.unref();
  let version: { webSocketDebuggerUrl?: string } | null = null;
  try {
    for (let attempt = 0; attempt < 80 && !version; attempt += 1) {
      version = await fetch(`http://127.0.0.1:${port}/json/version`).then((response) => response.json()).catch(() => null);
      if (!version) await sleep(100);
    }
    assert.ok(version?.webSocketDebuggerUrl, "foreign Chrome must be ready");
    await writeFile(info, JSON.stringify({ webSocketDebuggerUrl: version.webSocketDebuggerUrl }), "utf8");
    await writeFile(gate, "go", "utf8");
    const result = await new Promise<{ code: number | null }>((resolve) => child.once("exit", (code) => resolve({ code })));
    const same = output.match(/RESULT (\{.*\})/)?.[1];
    assert.equal(result.code, 0, output);
    assert.ok(same, output);
    assert.equal((JSON.parse(same) as { sameEndpoint: boolean }).sameEndpoint, false, `openBrowser reused a foreign CDP endpoint: ${output}`);
    assert.ok(await fetch(`http://127.0.0.1:${port}/json/version`).then((response) => response.ok).catch(() => false), "foreign Chrome must remain available");
  } finally {
    child.kill("SIGKILL");
    foreignChrome.kill("SIGKILL");
    await rm(work, { recursive: true, force: true });
    await rm(foreignDir, { recursive: true, force: true });
  }
});
