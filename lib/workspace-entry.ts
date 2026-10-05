import { DEFAULT_WORKSPACE_SITE_ID, WORKSPACE_SITE_ID_PATTERN } from "./simulated-packs.ts";

export type WorkspaceEntry =
  | { kind: "open"; siteId: string }
  | { kind: "create"; templateId: string }
  | { kind: "refuse"; templateId: string };

// `/workspace?site=<id>` opens that site. `/workspace?new=1` is the public "AI 建站" entry:
// it creates a new site with the first look as the seed, then the alignment card can set the
// the user's look and colour set. A legacy `?template=<id>` URL is refused instead of creating
// a second kind of site. The only create entry is `?new=1`.
export function resolveWorkspaceEntry(
  search: string | URLSearchParams,
  _knownTemplateIds: readonly string[],
  lookTemplateIds: readonly string[] = _knownTemplateIds,
  newSiteTemplateId = lookTemplateIds[0],
): WorkspaceEntry {
  const params = typeof search === "string" ? new URLSearchParams(search) : search;
  const site = params.get("site")?.trim() ?? "";
  if (WORKSPACE_SITE_ID_PATTERN.test(site)) return { kind: "open", siteId: site };
  const template = params.get("template")?.trim() ?? "";
  if (template) return { kind: "refuse", templateId: template };
  if (params.get("new") === "1" && newSiteTemplateId && lookTemplateIds.includes(newSiteTemplateId)) {
    return { kind: "create", templateId: newSiteTemplateId };
  }
  return { kind: "open", siteId: DEFAULT_WORKSPACE_SITE_ID };
}

// After creating the site, the URL points at it so a refresh reopens it instead of creating another.
export function workspaceUrlForSite(currentSearch: string, siteId: string): string {
  const params = new URLSearchParams(currentSearch);
  params.delete("template");
  params.set("site", siteId);
  return `/workspace?${params.toString()}`;
}

// React runs the load effect twice in development; both runs of one entry share the creation that
// is still in flight. Once it settles the entry is forgotten, so a later 新建站点 makes a new site.
const inflightCreations = new Map<string, Promise<string>>();

export function createSiteOnce(key: string, create: () => Promise<string>): Promise<string> {
  const pending = inflightCreations.get(key);
  if (pending) return pending;
  const created = create().finally(() => { inflightCreations.delete(key); });
  inflightCreations.set(key, created);
  return created;
}
