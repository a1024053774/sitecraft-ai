import { templateCatalog } from "./template-catalog.ts";
import { getRuntimeTemplates, markBaselineTemplateIds } from "./template-runtime.ts";
import {
  cloneDraft,
  defaultDraft,
  normalizeDraft,
  starterProducts,
  type Device,
  type EditableItem,
  type Locale,
  type LocalizedText,
  type Product,
  type SectionKey,
  type SiteDraft,
} from "./site-document.ts";

export type TemplateCategory = "制造业" | "外贸目录" | "科技企业" | "专业服务";
export type TemplateTargetKey =
  | "brand"
  | "heroTitle"
  | "heroSubtitle"
  | "primaryCta"
  | "about"
  | "features"
  | "services"
  | "products"
  | "contact";

export type Template = {
  id: string;
  name: string;
  category: TemplateCategory;
  description: string;
  tags: string[];
  colors: { primary: string; secondary: string; accent: string };
  headline: string;
  subtitle: string;
  /**
   * 站点形态：corporate 企业官网（默认）/ portfolio 个人作品集 / blog 博客内容站。
   * 显式标注避免用能力词正则推导误伤企业模板（如 blog 能力词命中含"内容/知识"的企业模板）。
   */
  shape?: "corporate" | "portfolio" | "blog";
  source: {
    name: string;
    repoUrl: string;
    license: "MIT" | "Internal";
    framework: string;
    demoUrl: string;
    localPath: string;
  };
  promptProfile: {
    role: string;
    structure: string[];
    visualRules: string[];
    targets: Array<{ key: TemplateTargetKey; label: string; guidance: string }>;
    guardrails: string[];
    starters: string[];
  };
};

export const templates: Template[] = templateCatalog;

/** 编译期基线的 id 集合（22 个开源模板）。运行时模板不得与之重名。 */
const baselineTemplateIds = templateCatalog.map((item) => item.id);
markBaselineTemplateIds(baselineTemplateIds);

/**
 * 运行时模板装载钩子。
 *
 * 由服务端启动时注入（`instrumentation.ts` → `template-runtime-loader`），
 * 客户端 bundle 里**永远是 undefined**。这是唯一能同时满足三个约束的做法：
 *   1. `allTemplates()` 必须同步（20+ 调用点，含同步的 `getTemplate`）；
 *   2. 装载要读磁盘，而本模块在客户端 bundle 里，**静态 import `node:fs` 会让
 *      Turbopack 构建直接失败**（实测：`does not support external modules (request: node:fs)`）；
 *   3. `node:fs` 无法从客户端代码里动态 `require`——打包器会替换它，
 *      运行期得到 `undefined`，被 try/catch 吞掉后**静默退化为「服务器上也看不到沉淀模板」**。
 *
 * 所以改成依赖倒置：本模块只持有一个函数引用，谁在服务端谁注入。
 * 客户端不注入 → 自动只看到基线；服务端注入 → 看到全量。两边都不会静默出错。
 */
let runtimeLoader: (() => void) | undefined;

export function setRuntimeLoader(loader: (() => void) | undefined): void {
  runtimeLoader = loader;
}

/**
 * 全部可用模板 = **静态基线 + 运行时注册表**（2026-09-10，方向 3 阶段 A）。
 *
 * 替代此前的 `templates` 直接当全集用。保留 `templates` 导出是因为它仍准确表示
 * 「编译期基线」，而客户端 bundle 读不到磁盘，只能用基线快照——服务端才调本函数。
 * 调用点显式化，正是为了让「这里依赖运行期注册」在代码里看得见。
 */
export function allTemplates(): Template[] {
  runtimeLoader?.();
  const runtime = getRuntimeTemplates();
  return runtime.length ? [...templateCatalog, ...runtime] : templateCatalog;
}

/**
 * 找模板，**找不到时回退到第一个基线模板**。
 *
 * 这是历史行为，保留它是为了不改动 20+ 个调用点的类型（它们都假设拿得到一份可用模板）。
 * 需要「找不到就是找不到」的语义时用 `findTemplate()`——**已校验过白名单的链路**
 * （静态资源路由、预览）必须用它：把「不认识的模板」静默换成 forge，会让预览
 * 显示另一个模板、资源路由读另一个目录，而 HTTP 状态码还是 200，极难排查。
 */
export function getTemplate(id: string): Template {
  return findTemplate(id) ?? templates[0];
}

/** 精确查找：不认识这个 id 就返回 undefined，**不做回退**。 */
export function findTemplate(id: string): Template | undefined {
  return allTemplates().find((item) => item.id === id);
}

export function importProductsFromRows(
  draft: SiteDraft,
  rows: Record<string, string>[],
): { draft: SiteDraft; products: Product[]; imported: number; errors: string[] } {
  const next = cloneDraft(draft);
  const errors: string[] = [];
  let imported = 0;
  rows.slice(0, 1000).forEach((row, index) => {
    const normalized = Object.fromEntries(
      Object.entries(row).map(([key, value]) => [key.trim().toLowerCase(), String(value ?? "").trim()]),
    );
    const sku = normalized.sku || normalized["产品编号"] || normalized["编码"];
    const name = normalized.name || normalized["产品名称"] || normalized["中文名称"];
    if (!sku || !name) {
      errors.push(`第 ${index + 2} 行缺少 SKU 或产品名称`);
      return;
    }
    // 图片列：图片/图片URL/主图/image → 主图 URL（本地 /api/product-images/ 或完整 URL）
    const imageRaw = normalized.image || normalized["图片"] || normalized["图片url"] || normalized["主图"] || normalized["图片地址"] || "";
    const product: Product = {
      sku,
      name: { zh: name, en: normalized["name en"] || normalized["英文名称"] || name },
      summary: {
        zh: normalized.summary || normalized["产品简介"] || "待补充产品简介",
        en: normalized["summary en"] || normalized["英文简介"] || "Product description to be completed.",
      },
      category: normalized.category || normalized["分类"] || "未分类",
      status: "draft",
      imageColor: "#e6eee5",
      ...(imageRaw ? { image: imageRaw } : {}),
      aiGenerated: !normalized.summary,
    };
    const existing = next.products.findIndex((item) => item.sku === sku);
    if (existing >= 0) next.products[existing] = product;
    else if (next.products.length < 1000) next.products.push(product);
    else {
      errors.push(`第 ${index + 2} 行超过单站 1000 个商品上限`);
      return;
    }
    imported += 1;
  });
  return { draft: next, products: next.products, imported, errors };
}

export { cloneDraft, defaultDraft, normalizeDraft, starterProducts };
export type { Device, EditableItem, Locale, LocalizedText, Product, SectionKey, SiteDraft };
