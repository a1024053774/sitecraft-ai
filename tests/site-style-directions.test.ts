import assert from "node:assert/strict";
import test from "node:test";
import { engineeringLook } from "../lib/blocks/looks/engineering.ts";
import { styleDirectionRecommendation, validateSiteStyleRules } from "../lib/blocks/site-style.ts";
import { packDraft } from "./fixtures/pack-drafts.ts";

test("engineering direction recipes are named, sized, and whitelist-valid", () => {
  const directions = engineeringLook.styleDirections;
  assert.deepEqual(Object.keys(directions ?? {}).sort(), ["capability-led", "catalog-led", "spec-led"]);
  for (const [id, direction] of Object.entries(directions ?? {})) {
    assert.ok(direction.rules.length >= 12 && direction.rules.length <= 20, `${id} rule count`);
    const checked = validateSiteStyleRules(direction.rules);
    assert.equal(checked.ok, true, checked.ok ? "" : checked.errors.join("；"));
  }
});

test("server direction recommendation follows the materials table", () => {
  assert.equal(styleDirectionRecommendation(packDraft("industrial"), "按图加工、规格参数和图纸询盘").direction, "spec-led");
  assert.equal(styleDirectionRecommendation(packDraft("export"), "面向 OEM 外贸采购，首屏索取样品册").direction, "catalog-led");
  assert.equal(styleDirectionRecommendation(packDraft("molding"), "加工能力/主设备：CNC；磨床；线切割；试模；检测。").direction, "capability-led");
});

test('a capability heading alone does not override the material counts', async () => {
  const { defaultDraft } = await import('../lib/site-document.ts');
  const { simulatedPacks, wrapCompanyMaterials } = await import('../lib/simulated-packs.ts');
  for(const [id,expected] of [['industrial','spec-led'],['export','catalog-led'],['molding','capability-led']] as const) {
    assert.equal(styleDirectionRecommendation(defaultDraft,wrapCompanyMaterials(simulatedPacks[id].body)).direction,expected,id);
  }
});
