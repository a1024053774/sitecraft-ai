import assert from "node:assert/strict";
import test from "node:test";

import { getTemplateAdapter, templateAdapters } from "../lib/template-adapters/index.ts";
import { forgeAdapter } from "../lib/template-adapters/forge.ts";
import { atlasAdapter } from "../lib/template-adapters/atlas.ts";
import { poweraiAdapter } from "../lib/template-adapters/powerai.ts";
import { signalAdapter } from "../lib/template-adapters/signal.ts";
import { moonAdapter } from "../lib/template-adapters/moon.ts";

test("template adapters registry carries the per-template rules only", () => {
  // forge 是全量适配：servicesFn + designTokenCss + sanitize 齐备
  const forge = getTemplateAdapter("forge");
  assert.equal(forge, forgeAdapter);
  assert.equal(forge?.templateId, "forge");
  assert.ok(forge?.servicesFn, "forge servicesFn should declare native service-card adapter");
  assert.ok(forge?.designTokenCss, "forge design token css present");
  assert.ok(forge?.sanitize?.leafPatterns?.length, "forge published sanitize present");
  // 无适配模板拿不到任何适配
  assert.equal(getTemplateAdapter("not-a-template"), undefined);
});

test("adapters migrated from shared route preserve prior rules", () => {
  // 从 route 迁出的 atlas/powerai/signal 仅保留既有 fragment，不做新增适配
  assert.ok(atlasAdapter.sanitize?.sections?.length, "atlas published sanitize present");
  assert.ok(atlasAdapter.designTokenCss, "atlas design token css present");
  assert.equal(atlasAdapter.servicesFn, undefined, "atlas no custom servicesFn yet");

  assert.ok(poweraiAdapter.sanitize?.leafPatterns && poweraiAdapter.sanitize.leafPatterns.length >= 2, "powerai sanitize present");
  assert.equal(poweraiAdapter.designTokenCss, undefined);

  assert.ok(signalAdapter.designTokenCss, "signal design token css present");
  assert.equal(signalAdapter.sanitize, undefined);
  assert.equal(signalAdapter.servicesFn, undefined);

  // 每个注册表项与自身 templateId 一致，且不存在悬空引用
  for (const [templateId, adapter] of Object.entries(templateAdapters)) {
    assert.equal(adapter.templateId, templateId);
  }
});

test("moon adapter carries heroFn for its non-h1 visible hero", () => {
  const moon = getTemplateAdapter("moon");
  assert.equal(moon, moonAdapter);
  assert.ok(moon?.heroFn, "moon heroFn should locate the visible gradient h2 hero title");
  assert.match(moon!.heroFn!, /gradient-text/, "heroFn references moon gradient hero class");
  assert.equal(moon?.servicesFn, undefined, "moon has no custom servicesFn");
});
