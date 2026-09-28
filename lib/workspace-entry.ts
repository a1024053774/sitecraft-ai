import { DEFAULT_WORKSPACE_SITE_ID, WORKSPACE_SITE_ID_PATTERN } from "./simulated-packs.ts";

export type WorkspaceEntry =
  | { kind: "open"; siteId: string }
  | { kind: "create"; templateId: string };

// `/workspace?site=<id>` opens that site. `/workspace?template=<id>` without a site is the
// "新建站点" entry: it creates a new site with that template instead of reusing the shared
// demo site. Anything else opens the default site.
export function resolveWorkspaceEntry(search: string | URLSearchParams, knownTemplateIds: readonly string[]): WorkspaceEntry {
  const params = typeof search === "string" ? new URLSearchParams(search) : search;
  const site = params.get("site")?.trim() ?? "";
  if (WORKSPACE_SITE_ID_PATTERN.test(site)) return { kind: "open", siteId: site };
  const template = params.get("template")?.trim() ?? "";
  if (template && knownTemplateIds.includes(template)) return { kind: "create", templateId: template };
  return { kind: "open", siteId: DEFAULT_WORKSPACE_SITE_ID };
}

// After creating the site, the URL points at it so a refresh reopens it instead of creating another.
export function workspaceUrlForSite(currentSearch: string, siteId: string): string {
  const params = new URLSearchParams(currentSearch);
  params.delete("template");
  params.set("site", siteId);
  return `/workspace?${params.toString()}`;
}
