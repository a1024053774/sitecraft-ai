import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (!specifier.startsWith("@/")) return nextResolve(specifier, context);
    const abs = path.join(process.cwd(), specifier.slice(2));
    let file = abs;
    if (existsSync(`${abs}.ts`)) file = `${abs}.ts`;
    else if (existsSync(path.join(abs, "index.ts"))) file = path.join(abs, "index.ts");
    return nextResolve(pathToFileURL(file).href, context);
  },
});

const { templates } = await import("../lib/site-model.ts");
const { getTemplateStaticRoot } = await import("../lib/template-static.ts");
const {
  EDIT_PREVIEW_CTA_LABEL,
  SOURCE_MATERIAL_NOTICE,
  getTemplateReadiness,
  listTemplateReadiness,
} = await import("../lib/template-readiness.ts");

test("readiness count follows the catalog and never claims a ready asset pack", () => {
  const readiness = listTemplateReadiness();
  assert.equal(readiness.length, templates.length);
  assert.equal(SOURCE_MATERIAL_NOTICE, "原始模板素材/样例非客户事实，发布前需替换或核验");
  assert.equal(EDIT_PREVIEW_CTA_LABEL, "进入编辑预览（非发布）");
  for (const item of readiness) {
    assert.equal(item.assetLabel, "素材待核验");
    assert.equal("approvedAssetPack" in item, false);
    assert.equal("generationReady" in item, false);
    assert.equal("illegal" in item, false);
  }
});

test("local snapshot availability is getTemplateStaticRoot, not a generation-ready claim", () => {
  for (const template of templates) {
    const root = getTemplateStaticRoot(template.id);
    const item = getTemplateReadiness(template.id);
    assert.equal(item.templateId, template.id);
    assert.equal(item.hasLocalSnapshot, root !== null);
    assert.equal(item.canEnterEditPreview, root !== null);
    assert.equal(item.snapshotLabel, root ? "本地静态预览" : "仅上游演示／待构建快照");
    assert.equal(item.assetLabel, "素材待核验");
  }
});

test("unknown or missing snapshots cannot enter edit preview", () => {
  const missing = getTemplateReadiness("not-a-template");
  assert.equal(getTemplateStaticRoot("not-a-template"), null);
  assert.equal(missing.hasLocalSnapshot, false);
  assert.equal(missing.canEnterEditPreview, false);
  assert.equal(missing.snapshotLabel, "仅上游演示／待构建快照");
});
