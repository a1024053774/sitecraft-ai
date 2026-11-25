'use client';
import Link from 'next/link';
import type { Route } from 'next';
import { useEffect, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { listLocalSites, type LocalSite } from '@/lib/browser-sites-client';
import { SiteProgress, formatUpdatedAt, siteProgressText, siteVersionText } from '@/components/site-progress';

// T-202: in browser storage the site list comes from this browser's IndexedDB only.
export function LocalSiteList({ limit }: { limit?: number }) {
  const [sites, setSites] = useState<LocalSite[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { void listLocalSites().then(setSites).catch(error => setError(error instanceof Error ? error.message : '读取本地站点失败。')); }, []);
  if (error) return <p className="empty-state" role="alert">{error}</p>;
  if (!sites) return <p className="empty-state" aria-busy="true">正在读取这个浏览器里的站点…</p>;
  if (!sites.length) return <p className="empty-state" data-testid="local-sites-empty">这个浏览器里还没有站点。站点只保存在建站时使用的浏览器中，换浏览器或清除网站数据后不会出现在这里。</p>;
  return (
    <div className="site-table local-site-list" data-testid="local-sites">
      {(limit ? sites.slice(0, limit) : sites).map(site => {
        const text = siteProgressText(site), version = siteVersionText(site);
        return (
          <Link key={site.siteId} className="local-site-row" href={`/workspace?site=${encodeURIComponent(site.siteId)}` as Route}>
            <span><strong>{site.siteName}</strong>{site.readError && <small className="site-read-error" role="status">{site.readError}</small>}</span>
            <SiteProgress site={site} />
            <span>{version.main === '—' ? version.sub : `${version.main} · ${version.sub}`} · 最后修改 {formatUpdatedAt(site.updatedAt)}</span>
            <span className="site-table-action">{text.action} <ArrowUpRight size={12} /></span>
          </Link>
        );
      })}
    </div>
  );
}
