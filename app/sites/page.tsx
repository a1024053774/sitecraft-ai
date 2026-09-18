import Link from "next/link";
import { ChevronRight, LayoutTemplate } from "lucide-react";
import { AppSidebar } from "@/components/app-sidebar";
import { SitesTable } from "@/components/sites-table";
import { listExistingSites } from "@/lib/site-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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
              <p>只列出已经保存的草稿，不预置演示站。打开工作台会按编号新建空草稿。电脑悬停或手机点行中间可看预览。</p>
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
            <SitesTable sites={sites} />
          )}
        </div>
      </main>
    </div>
  );
}
