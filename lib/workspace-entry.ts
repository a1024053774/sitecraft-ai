import { WORKSPACE_SITE_ID_PATTERN } from './simulated-packs.ts';

export type WorkspaceEntry = {kind:'open';siteId:string}|{kind:'create'}|{kind:'choose'};
// Reading a URL never creates a record; only the explicit new-site entry does.
export function resolveWorkspaceEntry(search:string|URLSearchParams):WorkspaceEntry {
  const params=typeof search==='string'?new URLSearchParams(search):search;
  const site=params.get('site')?.trim()??'';
  if(WORKSPACE_SITE_ID_PATTERN.test(site))return {kind:'open',siteId:site};
  return params.get('new')==='1'?{kind:'create'}:{kind:'choose'};
}
export function workspaceUrlForSite(currentSearch:string,siteId:string):string {
  const params=new URLSearchParams(currentSearch);params.delete('new');params.delete('template');params.set('site',siteId);return `/workspace?${params.toString()}`;
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
