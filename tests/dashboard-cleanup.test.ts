import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("dashboard has no hardcoded demo metrics or Forge activity", async () => {
  const source = await readFile(new URL("../app/(workspace)/page.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /Forge Industrial/);
  assert.doesNotMatch(source, /<div className="stat-value">24<\/div>/);
  assert.doesNotMatch(source, /<div className="stat-value">18<\/div>/);
  assert.match(source, /listLeads/);
  assert.match(source, /leads\.length/);
  const sidebar = await readFile(new URL("../components/app-sidebar.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(sidebar, /34%|3 \/ 10|Lydia Yang|lydia@sitecraft/);
});
