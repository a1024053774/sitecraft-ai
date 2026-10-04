import assert from "node:assert/strict";
import { readFileSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/t103-real-molding-draft.json", import.meta.url), "utf8"));
const baseline = JSON.parse(readFileSync(new URL("./fixtures/t103-real-molding-measurements.json", import.meta.url), "utf8")) as {
  rows: Array<{ width: number; locales: Record<string, Record<string, number>> }>;
};
type Measurement = { failures: string[]; textContrast: unknown[]; bodyLineLength: unknown[]; lineLengthExemptions: unknown[] };
type PageReport = Measurement & { siteKey: string; width: number; english: Measurement };

test("T-103 real molding pages keep FAQ lines, product specs, and the narrow header intact", async () => {
  const base = process.env.SITECRAFT_BASE || "http://127.0.0.1:3034";
  const createdResponse = await fetch(`${base}/api/sites`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "T-103 real molding regression", templateId: fixture.draft.templateId, locales: ["zh", "en"] }),
  });
  assert.equal(createdResponse.status, 201, "create the regression site through the public API");
  const created = await createdResponse.json();
  assert.ok(typeof created.id === "string" && created.id.length > 0, "new site has a real id");
  const appliedResponse = await fetch(`${base}/api/sites/${created.id}/draft`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ baseRevision: created.draft.revision, operations: [{ op: "replace_draft", draft: fixture.draft }], summary: "T-103 real molding fixture", source: "manual" }),
  });
  assert.equal(appliedResponse.status, 200, "install the tracked real draft through commitOperations");
  const applied = await appliedResponse.json();
  assert.equal(applied.status, "applied", "the real draft is committed before rendering");
  const out = path.resolve(process.env.T103_CHECK_OUT || "artifacts/t103/focused-check");
  mkdirSync(out, { recursive: true });
  const result = spawnSync(process.execPath, ["scripts/check-published.mjs", "--out", out, created.id], {
    cwd: process.cwd(),
    env: { ...process.env, SITECRAFT_BASE: base },
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
  });
  process.stdout.write(result.stdout || "");
  process.stderr.write(result.stderr || "");
  assert.equal(result.error, undefined, result.error?.message);
  const report = JSON.parse(readFileSync(path.join(out, "report.json"), "utf8")) as PageReport[];
  const failures = report.flatMap((row) => row.failures);
  assert.deepEqual(report.map((row) => row.width), [1440, 768, 375], "all acceptance viewports are measured");
  for (const row of report) {
    assert.equal(row.siteKey, created.id, "measure the independently provisioned site");
    const expected = baseline.rows.find((entry) => entry.width === row.width)!;
    for (const [locale, measured] of [["zh", row], ["en", row.english]] as const) {
      assert.ok(measured, `${row.width} ${locale}: locale must be present`);
      for (const field of ["textContrast", "bodyLineLength", "lineLengthExemptions"] as const) {
        assert.ok(Array.isArray(measured[field]) && measured[field].length >= expected.locales[locale][field], `${row.width} ${locale} ${field}: measurements must not be fewer than the known-bad baseline`);
      }
    }
  }
  assert.equal(result.status, 0, failures.join("\n"));
  assert.deepEqual(failures, []);
});
