// Test fixture only. New drafts carry no products (T-035); tests that exercise product
// operations start from this draft with three neutral fixture products. Runtime code must
// not import this file.
import { defaultDraft as emptyDefaultDraft, normalizeDraft, type Product, type SiteDraft } from "../../lib/site-document.ts";

export const fixtureProducts: Product[] = [
  {
    sku: "FM-2401",
    name: { zh: "高精度模块", en: "Precision Module" },
    summary: { zh: "适用于连续生产线的高精度模块。", en: "High-precision module for continuous production lines." },
    category: { zh: "核心组件", en: "Core components" },
    status: "published",
    imageColor: "#d7e7d1",
  },
  {
    sku: "FM-2402",
    name: { zh: "复合材料组件", en: "Composite Assembly" },
    summary: { zh: "轻量化、耐腐蚀的复合材料组件。", en: "Lightweight, corrosion-resistant composite assembly." },
    category: { zh: "复合材料", en: "Composite materials" },
    status: "published",
    imageColor: "#e6e1cf",
  },
  {
    sku: "FM-2403",
    name: { zh: "智能检测单元", en: "Smart Inspection Unit" },
    summary: { zh: "面向质量控制的实时检测单元。", en: "Real-time inspection unit for quality control." },
    category: { zh: "智能设备", en: "Smart equipment" },
    status: "published",
    imageColor: "#d9e4ef",
  },
];

export const draftWithFixtureProducts: SiteDraft = Object.freeze(normalizeDraft({
  ...structuredClone(emptyDefaultDraft),
  products: structuredClone(fixtureProducts),
})) as SiteDraft;
