import { blockCatalog, type BlockId, type BlockRequirement } from "./catalog.ts";
import type { Product, SiteDraft } from "../site-document.ts";

/**
 * Checks a variant's minimum materials (the catalog's `requires`) against a draft. Counts follow
 * what the preview bridge renders for that variant: gaps (待补充 / To be provided) never count, and
 * products are the ones a visitor sees. The messages go to users, so they use page words.
 */

export type RequirementResult = {
  ok: boolean;
  requirement: BlockRequirement;
  /** What the draft has: facts, named categories, shared specs or contact lines. */
  found: number;
  /** Names behind `found`, when there are names (shared specs, categories, contact lines). */
  names: string[];
  /** Why the layout cannot be used; empty when `ok`. */
  message: string;
};

const GAP = new Set(["", "待补充", "To be provided", "To be completed"]);
export function isGapText(value: unknown) {
  return GAP.has(String(value ?? "").trim());
}

function zh(value: string | { zh: string; en: string } | undefined) {
  if (value == null) return "";
  return (typeof value === "string" ? value : value.zh).trim();
}

/** Products a visitor sees: not archived, and not blank in both name and summary. */
export function visibleProducts(draft: SiteDraft): Product[] {
  return draft.products.filter((product) => {
    if ((product.status as string) === "archived") return false;
    return !(isGapText(zh(product.name)) && isGapText(zh(product.summary)));
  });
}

/** Specs with a real value, as the hero strip reads them: up to 2 per product (4 for one product), 4 in all. */
export function heroFacts(draft: SiteDraft) {
  const products = visibleProducts(draft);
  const perProduct = products.length > 1 ? 2 : 4;
  const facts: Array<{ product: string; name: string; value: string }> = [];
  for (const product of products) {
    const valued = (product.specs ?? []).filter((spec) => !isGapText(spec.value));
    for (const spec of valued.slice(0, perProduct)) {
      if (facts.length >= 4) break;
      facts.push({ product: zh(product.name), name: zh(spec.name), value: spec.value.trim() });
    }
  }
  return facts;
}

/** Visible products by their category (zh), in first-seen order; products without one are left out. */
export function productGroups(draft: SiteDraft) {
  const groups: Array<{ category: string; products: Product[] }> = [];
  for (const product of visibleProducts(draft)) {
    const category = zh(product.category);
    if (isGapText(category)) continue;
    const group = groups.find((item) => item.category === category);
    if (group) group.products.push(product);
    else groups.push({ category, products: [product] });
  }
  return groups;
}

/** A spec every visible product has by the same (zh) name, each with a real value. */
export function sharedSpecNames(draft: SiteDraft) {
  const products = visibleProducts(draft);
  if (!products.length) return [];
  const valued = (product: Product) => new Set((product.specs ?? []).filter((spec) => !isGapText(zh(spec.name)) && !isGapText(spec.value)).map((spec) => zh(spec.name)));
  const [first, ...others] = products.map(valued);
  return [...first].filter((name) => others.every((set) => set.has(name)));
}

export function contactLines(draft: SiteDraft) {
  const contact = draft.content.contact;
  const lines: Array<[string, string]> = [["邮箱", contact.email], ["电话", contact.phone], ["地址", zh(contact.address)]];
  return lines.filter(([, value]) => !isGapText(value)).map(([label]) => label);
}

const list = (names: string[]) => names.join("、");

export function checkRequirement(draft: SiteDraft, requirement: BlockRequirement): RequirementResult {
  const result = (ok: boolean, found: number, names: string[], message: string): RequirementResult => ({ ok, requirement, found, names, message: ok ? "" : message });
  if (requirement.kind === "heroFacts") {
    const facts = heroFacts(draft);
    return result(facts.length >= requirement.min, facts.length, facts.map((fact) => fact.name),
      `大标题加参数条要至少 ${requirement.min} 项带数值的产品参数；现在${facts.length ? `只有 ${facts.length} 项` : "产品还没有带数值的参数"}。`);
  }
  if (requirement.kind === "productGroups") {
    const groups = productGroups(draft);
    const largest = Math.max(0, ...groups.map((group) => group.products.length));
    const ok = groups.length >= requirement.minGroups && largest >= requirement.minLargest;
    const now = !groups.length
      ? "产品都还没有写类别"
      : groups.length < requirement.minGroups
        ? `产品只有 ${groups.length} 个类别（${list(groups.map((group) => group.category))}）`
        : "每个类别都只有 1 个产品";
    return result(ok, groups.length, groups.map((group) => group.category),
      `按类别分组要至少 ${requirement.minGroups} 个产品类别，且有一类不少于 ${requirement.minLargest} 个产品；现在${now}。`);
  }
  if (requirement.kind === "sharedSpecs") {
    const count = visibleProducts(draft).length;
    if (count < requirement.minProducts || count > requirement.maxProducts) {
      return result(false, 0, [], `参数对比表要 ${requirement.minProducts}–${requirement.maxProducts} 个产品；现在有 ${count} 个。`);
    }
    const shared = sharedSpecNames(draft);
    return result(shared.length >= requirement.minShared, shared.length, shared,
      `参数对比表要这些产品共有至少 ${requirement.minShared} 项都有数值的同名参数；现在${shared.length ? `只共有 ${shared.length} 项（${list(shared)}）` : "没有共有的参数"}。`);
  }
  const lines = contactLines(draft);
  return result(lines.length >= requirement.min, lines.length, lines,
    `联系条要邮箱、电话、地址至少 ${requirement.min} 项；现在${lines.length ? `只有${list(lines)}` : "三项都还没有"}。`);
}

/** All requirements of a block variant; an unknown variant fails with no requirement results. */
export function checkVariantRequirements(draft: SiteDraft, block: BlockId, variant: string) {
  const spec = blockCatalog[block]?.variants[variant];
  if (!spec) return { ok: false, known: false, failures: [] as RequirementResult[] };
  const results = (spec.requires ?? []).map((requirement) => checkRequirement(draft, requirement));
  const failures = results.filter((item) => !item.ok);
  return { ok: failures.length === 0, known: true, failures };
}
