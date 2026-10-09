'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CodeWorkspace, type CodeWorkspacePayload } from '@/components/code-workspace';
import { CodeWorkspaceEntry } from '@/components/code-workspace-entry';
import { resolveWorkspaceEntry } from '@/lib/workspace-entry';

export default function WorkspacePage() {
  const [entry, setEntry] = useState<{ siteId: string; payload: CodeWorkspacePayload } | 'create' | 'choose' | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const resolved = resolveWorkspaceEntry(window.location.search);
      if (resolved.kind !== 'open') { if (!cancelled) setEntry(resolved.kind); return; }
      const response = await fetch(`/api/sites/${resolved.siteId}/draft`, { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.userMessage || '站点读取失败。');
      if (!cancelled) setEntry({ siteId: resolved.siteId, payload });
    }
    void load().catch(error => { if (!cancelled) setError(error instanceof Error ? error.message : '工作台载入失败。'); });
    return () => { cancelled = true; };
  }, []);
  if (error) return <main className="builder-shell code-workspace-loading" role="alert">{error}</main>;
  if (!entry) return <main className="builder-shell code-workspace-loading" aria-busy="true" role="status">正在读取站点…</main>;
  if (entry === 'create') return <CodeWorkspaceEntry />;
  if (entry === 'choose') return <main className="code-workspace-loading"><h1>打开一个站点</h1><p>从已保存站点继续修改，或用公司资料新建网站。</p><Link className="primary-button" href="/workspace?new=1">新建站点</Link> <Link href="/sites">查看已保存站点</Link></main>;
  return <CodeWorkspace siteId={entry.siteId} initial={entry.payload} />;
}
