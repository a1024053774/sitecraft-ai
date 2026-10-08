export class SiteMigrationError extends Error {
  readonly siteId: string | null;
  readonly field: string;
  readonly value: string;
  readonly reason: string;

  constructor(args: { siteId?: string | null; field: string; value: string; reason: string }) {
    super(`旧站点数据无法迁移：site=${args.siteId ?? "unknown"} field=${args.field} id=${args.value} reason=${args.reason}`);
    this.name = "SiteMigrationError";
    this.siteId = args.siteId ?? null;
    this.field = args.field;
    this.value = args.value;
    this.reason = args.reason;
  }

  get userMessage() {
    return `旧记录无法打开：${this.reason}。`;
  }
}

const SAFE_ID = /^[A-Za-z0-9_-]{1,80}$/;

function checkId(value: unknown, field: string, siteId?: string | null) {
  if (value === undefined) return;
  if (typeof value !== "string" || !SAFE_ID.test(value)) {
    throw new SiteMigrationError({ siteId, field, value: String(value), reason: "id 必须只含字母、数字、下划线或连字符，且不超过 80 个字符" });
  }
}

export function assertStableItemIds(raw: unknown, siteId?: string | null) {
  if (!raw || typeof raw !== "object") return;
  const record = raw as Record<string, unknown>;
  const products = Array.isArray(record.products) ? record.products : [];
  const productIds = new Set<string>();
  products.forEach((product, index) => {
    if (!product || typeof product !== "object") return;
    const id = (product as Record<string, unknown>).id;
    checkId(id, `draft.products[${index}].id`, siteId);
    if (typeof id === "string") {
      if (productIds.has(id)) throw new SiteMigrationError({ siteId, field: `draft.products[${index}].id`, value: id, reason: "显式产品 id 重复" });
      productIds.add(id);
    }
  });
  const content = record.content && typeof record.content === "object" ? record.content as Record<string, unknown> : {};
  for (const section of ["features", "services", "faq", "industries", "capabilities", "certifications"]) {
    const value = content[section];
    const items = value && typeof value === "object" && Array.isArray((value as Record<string, unknown>).items)
      ? (value as Record<string, unknown>).items as unknown[]
      : [];
    const ids = new Set<string>();
    items.forEach((item, index) => {
      if (!item || typeof item !== "object") return;
      const id = (item as Record<string, unknown>).id;
      checkId(id, `draft.content.${section}.items[${index}].id`, siteId);
      if (typeof id === "string") {
        if (ids.has(id)) throw new SiteMigrationError({ siteId, field: `draft.content.${section}.items[${index}].id`, value: id, reason: "显式卡片 id 重复" });
        ids.add(id);
      }
    });
  }
  const equipment = Array.isArray(content.equipment) ? content.equipment : [];
  const equipmentIds = new Set<string>();
  equipment.forEach((item, index) => {
    if (!item || typeof item !== "object") return;
    const id = (item as Record<string, unknown>).id;
    checkId(id, `draft.content.equipment[${index}].id`, siteId);
    if (typeof id === "string") {
      if (equipmentIds.has(id)) throw new SiteMigrationError({ siteId, field: `draft.content.equipment[${index}].id`, value: id, reason: "显式设备 id 重复" });
      equipmentIds.add(id);
    }
  });
}
