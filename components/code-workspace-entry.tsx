'use client';

import { useEffect, useState } from 'react';
import { CodeWorkspace, type CodeWorkspacePayload } from './code-workspace';
import { createSiteOnce, workspaceUrlForSite } from '@/lib/workspace-entry';

export function CodeWorkspaceEntry() {
  const [entry, setEntry] = useState<{ siteId: string; payload: CodeWorkspacePayload } | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const search = window.location.search;
      const siteId = await createSiteOnce(search, async () => {
        const response = await fetch('/api/sites', { method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name: '未命名站点' }) });
        const payload = await response.json();
        if (!response.ok || !payload.id) throw new Error(payload.userMessage || '新站点没有建成。');
        return payload.id as string;
      });
      window.history.replaceState(null, '', workspaceUrlForSite(search, siteId));
      const response = await fetch(`/api/sites/${siteId}/draft`, { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.userMessage || '站点读取失败。');
      if (!cancelled) setEntry({ siteId, payload });
    }
    void load().catch(error => { if (!cancelled) setError(error instanceof Error ? error.message : '工作台载入失败。'); });
    return () => { cancelled = true; };
  }, []);
  if (error) return <main className="code-workspace-loading" role="alert">{error}</main>;
  if (!entry) return <main className="code-workspace-loading" aria-busy="true">正在新建站点…</main>;
  return <CodeWorkspace siteId={entry.siteId} initial={entry.payload} />;
}
