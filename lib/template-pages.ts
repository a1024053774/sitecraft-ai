import { getTemplateAdapter } from "./template-adapters/registry.ts";

export const pageRoles = ["home", "products", "services", "contact", "about", "custom"] as const;
export type PageRole = (typeof pageRoles)[number];
export const pagePlanSources = ["user", "model", "default"] as const;
export type PagePlanSource = (typeof pagePlanSources)[number];
export const pagePlacements = ["section", "route"] as const;
export type PagePlacement = (typeof pagePlacements)[number];
export const pageSectionKeys = [
  "hero",
  "about",
  "features",
  "services",
  "products",
  "contact",
  "faq",
  "partners",
  "process",
  "solutions",
  "industries",
] as const;
export type PageSectionKey = (typeof pageSectionKeys)[number];

export const PAGE_ID_PATTERN = /^[a-z][a-z0-9-]{0,39}$/;
export const TEMPLATE_PAGE_PATH_PATTERN = /^[A-Za-z0-9/_-]{0,80}$/;

type ExtraRoute = {
  role: Exclude<PageRole, "custom">;
  path: string;
};

/**
 * Extra HTML documents that actually exist in local snapshots.
 * Tests must keep this table honest against vendor files. Missing paths
 * must not be faked by cloning index.html.
 */
export const templateExtraRoutes: Readonly<Record<string, readonly ExtraRoute[]>> = {
  forge: [
    { role: "home", path: "" },
    { role: "about", path: "About" },
    { role: "services", path: "Services" },
    { role: "contact", path: "Contact" },
  ],
  screwfast: [
    { role: "home", path: "" },
    { role: "products", path: "products" },
    { role: "contact", path: "contact" },
  ],
};

export type RequestedSitePage = {
  id?: string;
  role: PageRole;
  label?: { zh: string; en: string };
  requested?: string;
};

export type UnsupportedSitePage = {
  requested: string;
  reason: string;
};

export type SitePage = {
  id: string;
  role: PageRole;
  label: { zh: string; en: string };
  placement: PagePlacement;
  section?: PageSectionKey;
  route?: string;
  source: PagePlanSource;
};

export type PagePlan = {
  version: 1;
  source: PagePlanSource;
  pages: SitePage[];
  unsupported: UnsupportedSitePage[];
};

const DEFAULT_LABELS: Record<Exclude<PageRole, "custom">, { zh: string; en: string }> = {
  home: { zh: "首页", en: "Home" },
  products: { zh: "产品", en: "Products" },
  services: { zh: "服务", en: "Services" },
  contact: { zh: "联系", en: "Contact" },
  about: { zh: "关于", en: "About" },
};

const DEFAULT_THREE: RequestedSitePage[] = [
  { id: "home", role: "home" },
  { id: "products", role: "products" },
  { id: "contact", role: "contact" },
];

function declaredSectionKeys(templateId: string) {
  return new Set((getTemplateAdapter(templateId)?.sections ?? []).map((section) => section.key));
}

function extraRoutesFor(templateId: string) {
  return templateExtraRoutes[templateId] ?? [];
}

export function isSafeTemplatePagePath(value: string) {
  if (!TEMPLATE_PAGE_PATH_PATTERN.test(value)) return false;
  if (value.startsWith("/") || value.includes("..") || value.includes("\\")) return false;
  return true;
}

export function previewPageSegments(pagePath: string | null | undefined) {
  const trimmed = pagePath?.trim() ?? "";
  if (!trimmed) return [];
  if (!isSafeTemplatePagePath(trimmed)) return null;
  return trimmed.split("/").filter(Boolean);
}

export function pageLabelFor(role: PageRole, label?: { zh: string; en: string }, requested?: string) {
  if (label?.zh && label?.en) return { zh: label.zh, en: label.en };
  if (role !== "custom") return structuredClone(DEFAULT_LABELS[role]);
  const text = requested?.trim() || "未命名页面";
  return { zh: text, en: text };
}

function sectionForRole(role: PageRole, templateId: string): PageSectionKey | undefined {
  if (role === "home") return "hero";
  if (role === "custom") return undefined;
  const declared = declaredSectionKeys(templateId);
  if (declared.has(role)) return role;
  if (role === "products" && declared.has("services")) return "services";
  if (role === "services" && declared.has("products")) return "products";
  return role;
}

function placeRequestedPage(templateId: string, item: RequestedSitePage, source: PagePlanSource): SitePage | UnsupportedSitePage {
  const requested = item.requested?.trim() || item.label?.zh || (item.role === "custom" ? item.id : DEFAULT_LABELS[item.role as Exclude<PageRole, "custom">]?.zh) || item.role;
  const id = item.id && PAGE_ID_PATTERN.test(item.id) ? item.id : item.role === "custom" ? "" : item.role;
  if (!id || !PAGE_ID_PATTERN.test(id)) {
    return { requested, reason: "页面标识无效，不能开通。" };
  }
  const routeMatch = extraRoutesFor(templateId).find((entry) => entry.role === item.role);
  if (routeMatch) {
    return {
      id,
      role: item.role,
      label: pageLabelFor(item.role, item.label, item.requested),
      placement: "route",
      route: routeMatch.path,
      source,
    };
  }
  const section = sectionForRole(item.role, templateId);
  if (!section) {
    return {
      requested,
      reason: `当前模板没有「${requested}」的独立 HTML，也没有可切换的声明区块，不能假装另开站点。`,
    };
  }
  return {
    id,
    role: item.role,
    label: pageLabelFor(item.role, item.label, item.requested),
    placement: "section",
    section,
    source,
  };
}

function dedupeUnsupported(items: UnsupportedSitePage[]) {
  const seen = new Set<string>();
  const result: UnsupportedSitePage[] = [];
  for (const item of items) {
    const key = `${item.requested}::${item.reason}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result.slice(0, 12);
}

export function resolvePagePlan(input: {
  templateId: string;
  source: PagePlanSource;
  requested?: RequestedSitePage[];
  unsupported?: UnsupportedSitePage[];
}): PagePlan {
  const source = input.source;
  const requested = source === "default" ? DEFAULT_THREE : (input.requested ?? []).slice(0, 12);
  const pages: SitePage[] = [];
  const unsupported: UnsupportedSitePage[] = [...(input.unsupported ?? [])];
  const seenIds = new Set<string>();

  for (const item of requested) {
    const placed = placeRequestedPage(input.templateId, item, source);
    if ("reason" in placed && !("placement" in placed)) {
      unsupported.push(placed);
      continue;
    }
    const page = placed as SitePage;
    if (seenIds.has(page.id)) {
      unsupported.push({ requested: page.label.zh, reason: `重复的页面标识 ${page.id} 已忽略。` });
      continue;
    }
    seenIds.add(page.id);
    pages.push(page);
  }

  if (!pages.length) {
    const home = placeRequestedPage(input.templateId, { id: "home", role: "home" }, source);
    if ("placement" in home) pages.push(home);
  }

  return {
    version: 1,
    source,
    pages,
    unsupported: dedupeUnsupported(unsupported),
  };
}

export function defaultPagePlanFor(templateId: string): PagePlan {
  return resolvePagePlan({ templateId, source: "default" });
}

export function rehostPagePlan(plan: PagePlan, templateId: string): PagePlan {
  if (plan.source === "default") return defaultPagePlanFor(templateId);
  return resolvePagePlan({
    templateId,
    source: plan.source,
    requested: plan.pages.map((page) => ({
      id: page.id,
      role: page.role,
      label: page.label,
      requested: page.label.zh,
    })),
    unsupported: plan.unsupported,
  });
}

export function findSitePage(plan: PagePlan | undefined, pageId: string | null | undefined) {
  if (!plan?.pages.length) return undefined;
  return plan.pages.find((page) => page.id === pageId) ?? plan.pages[0];
}

export function previewPathForPage(page: SitePage | undefined) {
  if (!page || page.placement !== "route") return "";
  return page.route ?? "";
}

export function pagePlanSourceLabel(source: PagePlanSource) {
  if (source === "user") return "按你点名的页面规划";
  if (source === "model") return "按业务需求规划的页面";
  return "未指定页面时的默认三项：首页 / 产品或服务 / 联系";
}

export function declaredSectionsForTemplate(templateId: string) {
  return declaredSectionKeys(templateId);
}
