import assert from "node:assert/strict";
import { readFileSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { assertT103MeasurementCoverage, type PageReport } from "./helpers/t103-measurement-coverage.ts";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/t103-real-molding-draft.json", import.meta.url), "utf8"));

test("T-103 real molding pages keep FAQ lines, product specs, and the narrow header intact", async (t) => {
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
  // Counterexamples use real scanner output as input, never as the expected coverage.
  // Keep total counts unchanged so unrelated measurements cannot hide a missing target.
  for (const [field, slot] of [
    ["bodyLineLength", "faq.items.faq-sample-mold.body.zh"],
    ["bodyLineLength", "products.mold-two-shot.summary.zh"],
    ["textContrast", "faq.items.faq-sample-mold.body.zh"],
    ["textContrast", "products.mold-two-shot.summary.zh"],
    ["lineLengthExemptions", "faq.items.faq-sample-mold.title.zh"],
  ] as const) {
    for (const row of report) for (const [locale, measured] of [["zh", row], ["en", row.english]] as const) {
      const localizedSlot = slot.replace(/\.zh$/, `.${locale}`);
      await t.test(`${row.width} ${locale}: coverage rejects missing ${field} for ${localizedSlot} despite unchanged totals`, () => {
        const missing = structuredClone(measured);
        assert.ok(missing[field].some((entry) => entry.slot === localizedSlot), "the counterexample removes a measured real target");
        missing[field] = missing[field].map((entry) => entry.slot === localizedSlot ? { ...structuredClone(missing[field][0]), slot: "counterexample.unrelated" } : entry);
        assert.throws(() => assertT103MeasurementCoverage(missing, row.width, locale), new RegExp(`${field}.*${localizedSlot.replaceAll(".", "\\.")}`));
      });
    }
  }
  await t.test("coverage rejects an incomplete wrapped paragraph even when its slot is still measured", () => {
    const missing = structuredClone(report.find((row) => row.width === 375)!.english);
    const slot = "products.mold-two-shot.summary.en";
    const lines = missing.bodyLineLength.filter((entry) => entry.slot === slot);
    assert.ok(lines.length > 1, "the real product explanation spans multiple lines");
    missing.bodyLineLength.splice(missing.bodyLineLength.findIndex((entry) => entry === lines[0]), 1);
    assert.throws(() => assertT103MeasurementCoverage(missing, 375, "en"), /bodyLineLength.*products\.mold-two-shot\.summary\.en/);
  });
  await t.test("coverage accepts fewer lines after a legal rewrap of the complete input paragraph", () => {
    const rewrapped = structuredClone(report.find((row) => row.width === 768)!);
    const slot = "products.mold-two-shot.summary.zh";
    const text = fixture.draft.products.find((product: { id: string }) => product.id === "mold-two-shot").summary.zh;
    const count = Array.from(text.replace(/\s/g, "")).length;
    assert.ok(count <= 40, "the complete input fits the declared Chinese line-length limit");
    const lines = rewrapped.bodyLineLength.filter((entry) => entry.slot === slot);
    assert.ok(lines.length > 1, "the real paragraph provides a wrapping counterexample");
    rewrapped.bodyLineLength = rewrapped.bodyLineLength.filter((entry) => entry.slot !== slot);
    const line = { ...lines[0], text, count, language: "zh", max: 40, tooLong: false };
    rewrapped.bodyLineLength.push(line);
    assertT103MeasurementCoverage(rewrapped, 768, "zh");
  });
  for (const row of report) {
    assert.equal(row.siteKey, created.id, "measure the independently provisioned site");
    for (const [locale, measured] of [["zh", row], ["en", row.english]] as const) {
      assert.ok(measured, `${row.width} ${locale}: locale must be present`);
      assertT103MeasurementCoverage(measured, row.width, locale);
    }
  }
  assert.equal(result.status, 0, failures.join("\n"));
  assert.deepEqual(failures, []);
});
