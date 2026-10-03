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
  minSpecsPerProduct: number;
  maxSpecsPerProduct: number;
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
  const specCounts: number[] = [];
  for (const product of products) {
    const count = (product.specs ?? []).filter((spec) => hasValue(spec.name) && hasValue(spec.value)).length;
    specCount += count;
    specCounts.push(count);
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
    minSpecsPerProduct: specCounts.length ? Math.min(...specCounts) : 0,
    maxSpecsPerProduct: specCounts.length ? Math.max(...specCounts) : 0,
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

function productFactPhrase(features: MaterialFeatures) {
  const productPhrase = features.productCount > 0 ? `资料中有 ${features.productCount} 个产品` : "资料中暂未列出产品";
  if (features.productCount === 0) return productPhrase;
  if (features.minSpecsPerProduct === features.maxSpecsPerProduct && features.minSpecsPerProduct >= 3) {
    return `${productPhrase}，每个都有 ${features.minSpecsPerProduct} 项完整参数`;
  }
  if (features.minSpecsPerProduct >= 3) {
    return `${productPhrase}，每个都有 ${features.minSpecsPerProduct}–${features.maxSpecsPerProduct} 项参数`;
  }
  return `${productPhrase}，参数信息还不完整`;
}

function supportingFactPhrase(features: MaterialFeatures) {
  const parts = [
    features.industryCount ? `${features.industryCount} 个应用行业` : "",
    features.capabilityCount ? `${features.capabilityCount} 项加工能力` : "",
    features.certificationCount ? `${features.certificationCount} 项认证状态` : "",
  ].filter(Boolean);
  return parts.length ? `，并列出 ${parts.join("、")}` : "";
}

/**
 * Deterministic b-step rules. They use shape counts, never an industry-to-look table:
 *
 * - one sparse product or less: short path;
 * - two or three products with a uniform, complete parameter set: export catalog;
 * - four or more products, or at least two capability/industry/certification entries: engineering;
 * - other populated product sets: bright product.
 */
export function recommendLookFromDraft(draft: SiteDraft): LookRecommendation | null {
  const features = materialFeaturesFromDraft(draft);
  if (!features.hasSignal) return null;
  const productFacts = productFactPhrase(features);
  const supportingFacts = supportingFactPhrase(features);

  if (features.productCount <= 1 && features.structuredItemCount <= 4) {
    return {
      briefId: "technical-product",
      reason: `${productFacts}${supportingFacts}，资料量较少，灰底短路径适合快速理解并提交询盘。`,
      features,
    };
  }
  if (features.productCount >= 2 && features.productCount <= 3 && features.categoryCount <= 1 && features.parameterizedProducts === features.productCount && features.minSpecsPerProduct >= 3 && features.minSpecsPerProduct === features.maxSpecsPerProduct) {
    return {
      briefId: "export-catalog",
      reason: `${productFacts}，适合用蓝白目录按系列浏览并发起询盘。`,
      features,
    };
  }
  if (features.productCount >= 4 || features.capabilityCount >= 2 || features.industryCount >= 2 || features.certificationCount >= 2) {
    return {
      briefId: "engineering-industrial",
      reason: `${productFacts}${supportingFacts}，工程工业适合把选型参数和工厂能力放在一起展示。`,
      features,
    };
  }
  return {
    briefId: "industrial",
    reason: `${productFacts}${supportingFacts}，明亮产品适合先展示产品范围再进入行动入口。`,
    features,
  };
}
