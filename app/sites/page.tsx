import Link from "next/link";
import type { Route } from "next";
import { ChevronRight, LayoutTemplate } from "lucide-react";
import { AppSidebar } from "@/components/app-sidebar";
import { getTemplate } from "@/lib/site-model";
import { listExistingSites } from "@/lib/site-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function formatUpdatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default async function SitesPage() {
  const sites = await listExistingSites();

  return (
    <div className="app-shell">
      <AppSidebar active="sites" />
      <main className="main">
        <header className="topbar">
          <div className="breadcrumbs">
            <Link href="/">Workspace</Link>
            <ChevronRight size={12} />
            <strong>全部站点</strong>
          </div>
        </header>
        <div className="page-content data-page">
          <div className="data-page-head">
            <div>
              <div className="eyebrow">Sites / All</div>
              <h1>全部站点</h1>
              <p>只列出已经保存的草稿，不预置演示站。打开工作台会按编号新建空草稿。</p>
            </div>
            <div className="data-kpi" data-testid="sites-count">
              <LayoutTemplate size={18} />
              <strong>{sites.length}</strong>
              <span>已保存</span>
            </div>
          </div>
          {sites.length === 0 ? (
            <div className="data-table" data-testid="sites-empty">
              <p className="leads-empty">还没有已保存站点。从模板开始，或打开工作台新建一份草稿。</p>
            </div>
          ) : (
            <div className="data-table" data-testid="sites-list">
              <div className="data-row data-row-sites data-row-head">
                <span>站点</span>
                <span>公司</span>
                <span>模板</span>
                <span>更新</span>
                <span>打开</span>
              </div>
              {sites.map((site) => {
                const template = getTemplate(site.templateId);
                return (
                  <article className="data-row data-row-sites" key={site.siteId} data-testid="site-row" data-site-id={site.siteId}>
                    <div>
                      <strong>{site.siteName}</strong>
                      <small>{site.siteId}</small>
                    </div>
                    <span>{site.companyName || "—"}</span>
                    <span>{template.name}</span>
                    <span>{formatUpdatedAt(site.updatedAt)}</span>
                    <div className="site-row-actions">
                      <Link className="section-link" href={`/workspace?site=${encodeURIComponent(site.siteId)}` as Route}>
                        工作台
                      </Link>
                      <Link className="section-link" href={`/published/${encodeURIComponent(site.siteId)}` as Route} target="_blank" rel="noreferrer">
                        发布页
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
