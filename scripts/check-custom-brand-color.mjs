#!/usr/bin/env node
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { generateCustomPalette, contrastRatio } from "../lib/custom-brand-color.ts";

const base = process.env.SITECRAFT_BASE || "http://127.0.0.1:3034";
const out = process.argv[2] || `artifacts/t025-brand-${Date.now()}`;
await mkdir(out, { recursive: true });
const report = { ticket: "T-025", base, steps: [] };
async function request(step, url, body, method = "PUT") {
  const response = await fetch(base + url, body ? { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {});
  const result = await response.json();
  report.steps.push({ step, url, input: body ?? null, status: response.status, result });
  assert.ok(response.ok, `${step}: HTTP ${response.status}`);
  return result;
}

const generated = generateCustomPalette("#f4fbff", "logo");
const site = await request("create", "/api/sites", { name: "T025 品牌色验收", templateId: "screwfast", locales: ["zh", "en"] }, "POST");
for (const color of ["#f4fbff", "#111827", "#ff00aa"]) {
  const sample = generateCustomPalette(color, "color").palette;
  assert.ok(contrastRatio(sample.text, sample.background) >= 4.5, `${color} text contrast`);
  assert.ok(contrastRatio("#ffffff", sample.accent) >= 4.5, `${color} button contrast`);
}
const applied = await request("apply-custom-palette", `/api/sites/${site.id}/draft`, {
  baseRevision: site.draft.revision,
  operations: [{ op: "set_custom_palette", palette: generated.palette }],
  summary: "应用自定义品牌色板",
  source: "manual",
});
assert.equal(applied.draft.customPalette.source, "logo");
assert.equal(applied.draft.customPalette.sourceColor, "#f4fbff");
assert.equal(applied.draft.customPalette.adjusted, true);
assert.ok(applied.changeSet.appliedTargets.includes("palette"));
const undone = await fetch(`${base}/api/sites/${site.id}/history/undo`, { method: "POST" }).then((response) => response.json());
report.steps.push({ step: "undo", url: `/api/sites/${site.id}/history/undo`, input: null, status: 200, result: undone });
assert.equal(undone.draft.customPalette, null);
const reapplied = await request("reapply-for-preview", `/api/sites/${site.id}/draft`, {
  baseRevision: undone.draft.revision,
  operations: [{ op: "set_custom_palette", palette: generated.palette }],
  summary: "应用自定义品牌色板（预览）",
  source: "manual",
});
const previewHtml = await fetch(`${base}/published/${site.id}`).then((response) => response.text());
assert.match(previewHtml, /data-testid="published-template-shell"/);
report.steps.push({ step: "published-readback", url: `/published/${site.id}`, input: null, status: 200, result: { customPalette: reapplied.draft.customPalette, publishedShell: true } });
const workspaceOut = `${out}/workspace`;
await new Promise((resolve, reject) => {
  const child = spawn(process.execPath, ["scripts/check-workspace-layout.mjs", site.id, workspaceOut], { stdio: "inherit" });
  child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`workspace check exited ${code}`)));
});
report.workspaceEvidence = workspaceOut;
report.result = "PASS";
await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ result: report.result, artifact: `${out}/report.json` }));
