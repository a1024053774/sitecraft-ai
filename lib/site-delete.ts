import { deleteConversationsForSite } from "./conversation-store.ts";
import { deleteLeadsForSite } from "./lead-store.ts";
import { deleteImagesForSite } from "./site-images.ts";
import { deleteSiteRecord, getExistingSite } from "./site-store.ts";

export class SiteDeleteError extends Error {
  readonly code: "invalid" | "not_found" | "unconfirmed";

  constructor(code: SiteDeleteError["code"], message: string) {
    super(message);
    this.name = "SiteDeleteError";
    this.code = code;
  }
}

export function assertDeleteConfirmation(siteId: string, confirmSiteId: unknown) {
  if (typeof confirmSiteId !== "string" || confirmSiteId !== siteId) {
    throw new SiteDeleteError("unconfirmed", "请输入当前站点编号以确认删除");
  }
}

export async function deleteSiteByUserChoice(siteId: string, confirmSiteId: unknown) {
  assertDeleteConfirmation(siteId, confirmSiteId);
  const existing = await getExistingSite(siteId);
  if (!existing) throw new SiteDeleteError("not_found", "站点不存在，没有删除");
  const removed = await deleteSiteRecord(siteId);
  if (!removed) throw new SiteDeleteError("not_found", "站点不存在，没有删除");
  await Promise.all([
    deleteConversationsForSite(siteId),
    deleteImagesForSite(siteId),
    deleteLeadsForSite(siteId),
  ]);
  const leftover = await getExistingSite(siteId);
  if (leftover) throw new Error("站点记录删除后仍能读到，未完成");
  return { siteId, deleted: true as const };
}
