import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { copyFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import { registerHooks } from "node:module";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

const repoRoot = process.cwd();

function sitePath(siteId: string) {
  return path.join(process.cwd(), ".sitecraft-data", "sites", `${siteId}.json`);
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (!specifier.startsWith("@/")) return nextResolve(specifier, context);
    const abs = path.join(repoRoot, specifier.slice(2));
    const file = existsSync(`${abs}.ts`) ? `${abs}.ts` : path.join(abs, "index.ts");
    return nextResolve(pathToFileURL(file).href, context);
  },
});

const draftRoute = await import(pathToFileURL(path.join(process.cwd(), "app/api/sites/[siteId]/draft/route.ts")).href);
const chatRoute = await import(pathToFileURL(path.join(process.cwd(), "app/api/sites/[siteId]/chat/route.ts")).href);
const sitesRoute = await import(pathToFileURL(path.join(repoRoot, "app/api/sites/route.ts")).href);
const siteStore = await import("../lib/site-store.ts");
const base = process.env.SITECRAFT_BASE || "http://127.0.0.1:3062";

const missingSiteId = `t102-missing-${crypto.randomUUID().slice(0, 8)}`;

test.after(async () => {
  await rm(sitePath(missingSiteId), { force: true });
});

test("GET draft for a missing site returns 404 without creating a record", async () => {
  const siteId = missingSiteId;
  const response = await draftRoute.GET(new Request(`http://sitecraft.test/api/sites/${siteId}/draft`), { params: Promise.resolve({ siteId }) });
  assert.equal(response.status, 404);
  assert.equal(existsSync(sitePath(siteId)), false);
});

test("PUT draft for a missing site returns 404 without creating a record", async () => {
  const siteId = `t102-put-${crypto.randomUUID().slice(0, 8)}`;
  const response = await draftRoute.PUT(new Request(`http://sitecraft.test/api/sites/${siteId}/draft`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ baseRevision: 1, operations: [{ op: "set_text", target: "hero.title", locale: "zh", value: "T102" }], summary: "T102 missing", source: "manual" }),
  }), { params: Promise.resolve({ siteId }) });
  assert.equal(response.status, 404);
  assert.equal(existsSync(sitePath(siteId)), false);
});

test("store commit and history paths reject a missing site instead of creating it", async () => {
  const siteId = `t102-store-${crypto.randomUUID().slice(0, 8)}`;
  await assert.rejects(() => siteStore.commitOperations({
    siteId,
    baseRevision: 1,
    operations: [{ op: "set_text", target: "hero.title", locale: "zh", value: "T102" }],
    summary: "T102 missing store",
    source: "manual",
  }), /Site not found/);
  await assert.rejects(() => siteStore.moveHistory(siteId, "undo"), /Site not found/);
  assert.equal(await siteStore.getExistingSite(siteId), null);
  assert.equal(existsSync(sitePath(siteId)), false);
});

test("a missing published site is a 404 without a default empty draft", async () => {
  const siteId = `t102-published-${crypto.randomUUID().slice(0, 8)}`;
  const response = await fetch(`${base}/published/${siteId}`);
  assert.equal(response.status, 404);
  assert.equal(existsSync(sitePath(siteId)), false);
});

test("quality matrix reports a missing fixed site instead of creating it", async () => {
  const mainMatrixSite = path.join(repoRoot, ".sitecraft-data", "sites", "p4m-a.json");
  const mainMatrixSiteExisted = existsSync(mainMatrixSite);
  const dataRoot = await mkdtemp(path.join(os.tmpdir(), "sitecraft-t102-quality-"));
  try {
    await mkdir(path.join(dataRoot, "scripts"), { recursive: true });
    await copyFile(path.join(repoRoot, "scripts/visitor-layout-scan.js"), path.join(dataRoot, "scripts/visitor-layout-scan.js"));
    const fixture = path.join(repoRoot, "tests/fixtures/t102-quality-missing-site.ts");
    const result = await new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
      const child = spawn(process.execPath, ["--experimental-strip-types", fixture], {
        cwd: dataRoot,
        env: { ...process.env, SITE_STORE: "fs", T102_REPO_ROOT: repoRoot },
        stdio: ["ignore", "pipe", "pipe"],
      });
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (chunk) => { stdout += String(chunk); });
      child.stderr.on("data", (chunk) => { stderr += String(chunk); });
      child.on("error", reject);
      child.on("close", (code) => resolve({ code, stdout, stderr }));
    });
    assert.equal(result.code, 0, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /status=404/);
    assert.equal(existsSync(path.join(dataRoot, ".sitecraft-data", "sites", "p4m-a.json")), false);
    assert.equal(existsSync(mainMatrixSite), mainMatrixSiteExisted, "the quality missing-site check must not delete the worktree's real matrix site");
  } finally {
    await rm(dataRoot, { recursive: true, force: true });
  }
});

test("chat on a missing site returns site_not_found without creating it", async () => {
  const siteId = `t102-chat-${crypto.randomUUID().slice(0, 8)}`;
  const response = await chatRoute.POST(new Request(`http://sitecraft.test/api/sites/${siteId}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ baseRevision: 1, message: "读取当前站点" }),
  }), { params: Promise.resolve({ siteId }) });
  assert.equal(response.status, 404);
  assert.equal(existsSync(sitePath(siteId)), false);
});

test("workspace creation remains explicit through POST and its draft can be reread", async () => {
  const response = await sitesRoute.POST(new Request("http://sitecraft.test/api/sites", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "T102 explicit site", templateId: "forge", locales: ["zh", "en"] }),
  }));
  assert.equal(response.status, 201);
  const body = await response.json() as { id: string };
  assert.equal(existsSync(sitePath(body.id)), true);
  const draft = await draftRoute.GET(new Request(`http://sitecraft.test/api/sites/${body.id}/draft`), { params: Promise.resolve({ siteId: body.id }) });
  assert.equal(draft.status, 200);
  await rm(sitePath(body.id), { force: true });
});
