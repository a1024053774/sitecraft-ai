import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import path from "node:path";
import { registerHooks } from "node:module";
import { pathToFileURL } from "node:url";

const repoRoot = process.env.T102_REPO_ROOT;
if (!repoRoot) throw new Error("T102_REPO_ROOT is required");

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (!specifier.startsWith("@/")) return nextResolve(specifier, context);
    const abs = path.join(repoRoot, specifier.slice(2));
    const file = existsSync(`${abs}.ts`) ? `${abs}.ts` : path.join(abs, "index.ts");
    return nextResolve(pathToFileURL(file).href, context);
  },
});

const qualityRoute = await import(pathToFileURL(path.join(repoRoot, "app/api/quality/cells/route.ts")).href);
const response = await qualityRoute.GET();
assert.equal(response.status, 404);
const fixedSitePath = path.join(process.cwd(), ".sitecraft-data", "sites", "p4m-a.json");
assert.equal(existsSync(fixedSitePath), false);
await rm(path.dirname(fixedSitePath), { recursive: true, force: true });
console.log(`status=${response.status} dataRoot=${process.cwd()}`);
