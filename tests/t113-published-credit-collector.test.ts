import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const sites = ["2712b46f-e375-4447-90df-11c411e7c5ca", "80f53a96-b2d4-4368-ac7d-5d2ed613ffef", "8142e99f-55be-406f-87a3-cf26308eef76"];
const base = process.env.SITECRAFT_BASE || "http://127.0.0.1:3034";

test("T-113 real published collector keeps full GET attribution, supplied credit and exact licence/source links", async () => {
  assert.ok(process.env.CHROME_PATH, "set the approved testing CHROME_PATH");
  const out = path.resolve(process.env.T113_CREDITS_OUT || `artifacts/t113/credits-${Date.now()}-${process.pid}`);
  mkdirSync(out, { recursive: true });
  const inventories = new Map<string, Array<Record<string, any>>>();
  for (const site of sites) {
    const response = await fetch(`${base}/api/sites/${site}/images`);
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.ok(Array.isArray(payload.images));
    inventories.set(site, payload.images);
    writeFileSync(path.join(out, `${site}-images.json`), JSON.stringify(payload, null, 2) + "\n", { flag: "wx" });
  }
  assert.ok([...inventories.values()].flat().some(image => /JPEG re-encoded\/resized/.test(image.attribution || "")), "the real GET input must include an explicit modification statement");
  const args = ["scripts/check-published.mjs", "--out", path.join(out, "published"), ...sites];
  const at = new Date().toISOString();
  const child = spawn(process.execPath, args, { env: { ...process.env, SITECRAFT_BASE: base }, stdio: ["ignore", "pipe", "pipe"] });
  let output = "";
  child.stdout.on("data", data => { output += data; });
  child.stderr.on("data", data => { output += data; });
  const code = await new Promise<number | null>((resolve, reject) => { child.on("error", reject); child.on("close", resolve); });
  writeFileSync(path.join(out, "run.json"), JSON.stringify({ args, at, finishedAt: new Date().toISOString(), base, chrome: process.env.CHROME_PATH, head: spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).stdout.trim(), code, output }, null, 2) + "\n", { flag: "wx" });
  assert.equal(code, 0, `published collector failed before credit assertions:\n${output}`);
  const rows = JSON.parse(readFileSync(path.join(out, "published/report.json"), "utf8"));
  assert.equal(rows.length, 9, "three original sites at three widths");
  for (const row of rows) assert.deepEqual(row.failures, [], `${row.siteKey}/${row.width}: collector failures must be reported before credit assertions`);
  for (const row of rows) for (const [locale, report] of [["zh", row], ["en", row.english]] as const) {
    assert.ok(report, "both original locales are inspected");
    assert.ok(report.imageCredits, `${row.siteKey}/${locale}/${row.width}: image credits measurement is missing`);
    const inventory = inventories.get(row.siteKey)!;
    const expected = inventory.filter(image => image.credit?.[locale] || image.attribution);
    assert.equal(report.imageCredits.required, expected.length);
    assert.equal(report.imageCredits.records.length, expected.length, "no supplied attribution is lost in aggregate counts");
    for (const image of expected) {
      const record = report.imageCredits.records.find((record: { imageId: string }) => record.imageId === image.imageId);
      assert.ok(record, `collector must retain ${image.imageId}`);
      assert.equal(record.credit, image.credit?.[locale] || "");
      assert.equal(record.attribution, image.attribution || "");
      assert.equal(record.licenseUrl, image.licenseUrl || "");
      assert.equal(record.sourceUrl, image.sourceUrl || "");
      assert.equal(record.completeTextVisible, true, `${row.siteKey}/${locale}/${row.width}: full supplied attribution is visible`);
      assert.equal(record.licenseLinkVisible, true, "the exact supplied licence URL remains clickable");
      assert.equal(record.sourceLinkVisible, true, "the original supplied source remains clickable");
    }
    assert.equal(report.imageCredits.independent, true);
    assert.ok(report.imageCredits.width >= report.imageCredits.containerWidth - 1, "long credits remain in their independent full-width region");
    assert.deepEqual(report.duplicateBodyRows, []);
    assert.deepEqual(report.captureFailures, []);
  }
  assert.equal(code, 0, output);
});
