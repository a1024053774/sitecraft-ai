import assert from "node:assert/strict";
import test from "node:test";
import { blockCatalog } from "../lib/blocks/catalog.ts";
import { blockFragments } from "../lib/blocks/fragments/index.ts";
import { parseHtmlFragment } from "./fixtures/html-dom.ts";

test("T-108 quality checklist keeps the bridge marker and uses a neutral status-free structure", () => {
  const spec = blockCatalog.qualityProcess.variants.checklist;
  assert.ok(spec);
  assert.deepEqual(spec.markers, ["[data-sitecraft-quality-process-grid]"]);
  assert.deepEqual(spec.parts, ["head", "title", "list"]);
  const document = parseHtmlFragment(blockFragments.qualityProcess.variants.checklist);
  assert.equal(document.querySelectorAll("[data-sitecraft-quality-process-grid]").length, 1);
  assert.ok(document.querySelector(".sitecraft-quality-process-checklist"));
  assert.equal(document.querySelectorAll("svg, img").length, 0);
  assert.match(blockFragments.qualityProcess.css, /quality-process-checklist/);
  assert.match(blockFragments.qualityProcess.css, /width: 3px/);
  assert.doesNotMatch(blockFragments.qualityProcess.css, /content:\s*["']✓/);
});

test("T-108 action flow keeps the bridge marker and exposes connectors without extra content", () => {
  const spec = blockCatalog.qualityProcess.variants.flow;
  assert.ok(spec);
  assert.deepEqual(spec.markers, ["[data-sitecraft-quality-process-grid]"]);
  const document = parseHtmlFragment(blockFragments.qualityProcess.variants.flow);
  assert.equal(document.querySelectorAll("[data-sitecraft-quality-process-grid]").length, 1);
  assert.ok(document.querySelector(".sitecraft-quality-process-flow"));
  assert.equal(document.querySelectorAll("svg, img").length, 0);
  assert.match(blockFragments.qualityProcess.css, /quality-process-flow/);
  assert.match(blockFragments.qualityProcess.css, /border-top: 1px solid var\(--site-accent\)/);
});
