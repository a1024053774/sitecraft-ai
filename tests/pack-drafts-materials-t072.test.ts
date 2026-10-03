import assert from "node:assert/strict";
import test from "node:test";
import { packDraft } from "./fixtures/pack-drafts.ts";

// Expected facts transcribed from the three simulated materials, independent of the seed builder.
const expected = {
  industrial: {
    industries: ["矿山输送", "冶金辊道", "港口起重", "水泥窑传动"],
    capabilities: ["滚齿与磨齿", "箱体数控镗铣", "动平衡与跑合试验", "装配与出厂检验"],
    certifications: [["ISO 9001", "认证中"], ["特种设备相关许可", "待补充"], ["CE", "待补充"]],
    specCounts: [5, 6],
  },
  export: {
    industries: ["食品饮料灌装", "制药洁净流体", "化工取样", "半导体超纯水辅助回路"],
    capabilities: ["数控车削", "自动攻丝", "气密试验台", "钝化与清洁包装"],
    certifications: [["ISO 9001", "已有"], ["材料可追溯报告", "认证中"], ["FDA", "待补充"]],
    specCounts: [5, 5],
  },
  molding: {
    industries: ["家电外壳与结构件", "汽车内饰件与连接器", "医疗器械耗材外壳", "照明透镜与灯罩", "电动工具壳体"],
    capabilities: ["高速 CNC 加工中心", "精密慢走丝线切割", "镜面电火花", "精密平面磨床", "注塑机", "双色注塑机"],
    certifications: [["ISO 9001", "已有"], ["ISO 14001", "已有"], ["IATF 16949", "认证中"]],
    specCounts: [7, 6, 6, 6, 6],
  },
};

for (const packId of ["industrial", "export", "molding"] as const) {
  test(`${packId} seed retains the simulated material's catalog entries, statuses and parameters`, () => {
    const draft = packDraft(packId);
    const facts = expected[packId];
    assert.deepEqual(draft.content.industries?.items.map((item) => item.title.zh), facts.industries);
    assert.deepEqual(draft.content.capabilities?.items.map((item) => item.title.zh), facts.capabilities);
    assert.deepEqual(draft.content.certifications?.items.map((item) => [item.title.zh, item.status]), facts.certifications);
    assert.deepEqual(draft.products.map((product) => product.specs?.length ?? 0), facts.specCounts);
    for (const product of draft.products) {
      for (const spec of product.specs ?? []) {
        assert.notEqual(typeof spec.value === "string" ? spec.value : spec.value.zh, "待补充", "the packs provide all product parameter values");
      }
    }
  });
}
