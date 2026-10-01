import assert from "node:assert/strict";
import test from "node:test";
import { engineeringLook } from "../lib/blocks/looks/engineering.ts";
import { brightLook } from "../lib/blocks/looks/bright.ts";
import { shortPathLook } from "../lib/blocks/looks/short-path.ts";
import { validateSiteStyleRules } from "../lib/blocks/site-style.ts";

test("engineering direction recipes are named, sized, and whitelist-valid", () => {
  const directions = engineeringLook.styleDirections;
  assert.deepEqual(Object.keys(directions ?? {}).sort(), ["capability-led", "catalog-led", "spec-led"]);
  for (const [id, direction] of Object.entries(directions ?? {})) {
    assert.ok(direction.rules.length >= 12 && direction.rules.length <= 20, `${id} rule count`);
    const checked = validateSiteStyleRules(direction.rules);
    assert.equal(checked.ok, true, checked.ok ? "" : checked.errors.join("；"));
  }
});

test("bright product direction recipes are named, sized, and whitelist-valid", () => {
  const directions = brightLook.styleDirections;
  assert.deepEqual(Object.keys(directions ?? {}).sort(), ["capability-led", "catalog-led", "spec-led"]);
  for (const [id, direction] of Object.entries(directions ?? {})) {
    assert.ok(direction.rules.length >= 12 && direction.rules.length <= 20, `${id} rule count`);
    const checked = validateSiteStyleRules(direction.rules);
    assert.equal(checked.ok, true, checked.ok ? "" : checked.errors.join("；"));
  }
});

test("short-path direction recipes are named, sized, and whitelist-valid", () => {
  const directions = shortPathLook.styleDirections;
  assert.deepEqual(Object.keys(directions ?? {}).sort(), ["capability-led", "catalog-led", "spec-led"]);
  for (const [id, direction] of Object.entries(directions ?? {})) {
    assert.ok(direction.rules.length >= 12 && direction.rules.length <= 20, `${id} rule count`);
    const checked = validateSiteStyleRules(direction.rules);
    assert.equal(checked.ok, true, checked.ok ? "" : checked.errors.join("；"));
  }
});
