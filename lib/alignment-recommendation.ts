import type { SiteDraft } from "./site-document.ts";

const GAP_TEXT = /^(?:待补充|to be provided)$/i;

function hasValue(value: unknown): boolean {
  if (typeof value === "string") return value.trim().length > 0 && !GAP_TEXT.test(value.trim());
  if (!value || typeof value !== "object") return false;
  const localized = value as { zh?: unknown; en?: unknown };
  return hasValue(localized.zh) || hasValue(localized.en);
}

function valueKey(value: unknown): string {
  if (typeof value === "string") return value.trim().toLocaleLowerCase();
  if (!value || typeof value !== "object") return "";
  const localized = value as { zh?: unknown; en?: unknown };
  return `${typeof localized.zh === "string" ? localized.zh.trim() : ""}|${typeof localized.en === "string" ? localized.en.trim() : ""}`.toLocaleLowerCase();
}

function sectionItemCount(section: { items?: Array<{ title?: unknown }> } | undefined) {
  return section?.items?.filter((item) => hasValue(item.title)).length ?? 0;
}

export type MaterialFeatures = {
  productCount: number;
  categoryCount: number;
  specCount: number;
  parameterizedProducts: number;
  averageSpecsPerProduct: number;
  industryCount: number;
  capabilityCount: number;
  certificationCount: number;
  serviceCount: number;
  faqCount: number;
  structuredItemCount: number;
  hasSignal: boolean;
};

/**
 * Count only fields that are already structured in the draft. This deliberately never reads the
 * company prompt, prose bodies, industry labels, or product names to infer a business type.
 */
export function materialFeaturesFromDraft(draft: SiteDraft): MaterialFeatures {
  const products = draft.products.filter((product) => product.status !== "draft" && hasValue(product.name));
  const categories = new Set(products.map((product) => valueKey(product.category)).filter(Boolean));
  let specCount = 0;
  let parameterizedProducts = 0;
  for (const product of products) {
    const count = (product.specs ?? []).filter((spec) => hasValue(spec.name) && hasValue(spec.value)).length;
    specCount += count;
    if (count >= 3) parameterizedProducts += 1;
  }
  const industryCount = sectionItemCount(draft.content.industries);
  const capabilityCount = sectionItemCount(draft.content.capabilities);
  const certificationCount = sectionItemCount(draft.content.certifications);
  const serviceCount = sectionItemCount(draft.content.services);
  const faqCount = sectionItemCount(draft.content.faq);
  const structuredItemCount = products.length + industryCount + capabilityCount + certificationCount + serviceCount + faqCount;
  return {
    productCount: products.length,
    categoryCount: categories.size,
    specCount,
    parameterizedProducts,
    averageSpecsPerProduct: products.length ? Number((specCount / products.length).toFixed(1)) : 0,
    industryCount,
    capabilityCount,
    certificationCount,
    serviceCount,
    faqCount,
    structuredItemCount,
    hasSignal: structuredItemCount > 0 || specCount > 0,
  };
}

export type LookRecommendation = {
  briefId: "industrial" | "engineering-industrial" | "export-catalog" | "technical-product";
  reason: string;
  features: MaterialFeatures;
};

function featureSummary(features: MaterialFeatures) {
  return `${features.productCount} 个产品、${features.categoryCount} 个产品类别、${features.parameterizedProducts} 个产品有至少 3 项非空参数（平均 ${features.averageSpecsPerProduct} 项）；${features.industryCount} 个应用行业、${features.capabilityCount} 项能力、${features.certificationCount} 项认证`;
}

/**
 * Deterministic b-step rules. They use shape counts, never an industry-to-look table:
 *
 * - one sparse product or less: short path;
 * - four or more products, or at least two capability/industry/certification entries: engineering;
 * - two or more parameterized products without those factory/catalog-section signals: export catalog;
 * - other populated product sets: bright product.
 */
export function recommendLookFromDraft(draft: SiteDraft): LookRecommendation | null {
  const features = materialFeaturesFromDraft(draft);
  if (!features.hasSignal) return null;
  const summary = featureSummary(features);

  if (features.productCount <= 1 && features.structuredItemCount <= 4) {
    return {
      briefId: "technical-product",
      reason: `结构化资料有${summary}，条目较少，灰底短路径更适合快速理解并提交询盘。`,
      features,
    };
  }
  if (features.productCount >= 4 || features.capabilityCount >= 2 || features.industryCount >= 2 || features.certificationCount >= 2) {
    return {
      briefId: "engineering-industrial",
      reason: `结构化资料有${summary}，参数和制造/应用条目较多，工程工业更适合承载参数选型与能力证据。`,
      features,
    };
  }
  if (features.productCount >= 2 && features.parameterizedProducts >= 2 && features.capabilityCount === 0 && features.industryCount === 0 && features.certificationCount <= 1) {
    return {
      briefId: "export-catalog",
      reason: `结构化资料有${summary}，产品参数已成目录形态且辅助条目较少，蓝白目录更适合按系列浏览和发起询盘。`,
      features,
    };
  }
  return {
    briefId: "industrial",
    reason: `结构化资料有${summary}，以产品条目为主且参数密度较轻，明亮产品更适合先展示产品范围再进入行动入口。`,
    features,
  };
}
