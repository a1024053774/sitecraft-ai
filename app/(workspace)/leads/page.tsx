import Link from "next/link";
import type { Route } from "next";
import { ChevronRight, Mail, MessageSquareText } from "lucide-react";
import { AppSidebar } from "@/components/app-sidebar";
import { listLeads } from "@/lib/lead-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type LeadsSearch = { site?: string | string[] };

function firstQuery(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatReceivedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default async function LeadsPage({
  searchParams,
}: {
  searchParams?: Promise<LeadsSearch> | LeadsSearch;
}) {
  const query = searchParams && typeof searchParams === "object" && "then" in searchParams
    ? await searchParams
    : searchParams ?? {};
  const siteId = firstQuery(query.site)?.trim() || undefined;
  const leads = await listLeads(siteId ? { siteId } : {});

  return (
    <div className="app-shell">
      <AppSidebar active="leads" />
      <main className="main">
        <header className="topbar">
          <div className="breadcrumbs">
            <Link href="/">Workspace</Link>
            <ChevronRight size={12} />
            <strong>询盘线索</strong>
          </div>
        </header>
        <div className="page-content data-page">
          <div className="data-page-head">
            <div>
              <div className="eyebrow">Leads / Inbox</div>
              <h1>询盘线索</h1>
              <p>
                {siteId
                  ? `只显示站点 ${siteId} 经发布页表单送达的询盘。`
                  : "显示工作区里经发布页表单送达的询盘，不是演示名单。"}
              </p>
            </div>
            <div className="data-kpi" data-testid="leads-count">
              <MessageSquareText size={18} />
              <strong>{leads.length}</strong>
              <span>已收到</span>
            </div>
          </div>
          {leads.length === 0 ? (
            <div className="data-table" data-testid="leads-empty">
              <p className="leads-empty">还没有询盘。打开站点发布页，用右下角表单发一条，这里会出现同一条留言。</p>
            </div>
          ) : (
            <div className="data-table" data-testid="leads-table">
              <div className="data-row data-row-head">
                <span>客户 / 站点</span>
                <span>留言</span>
                <span>时间</span>
                <span>状态</span>
              </div>
              {leads.map((lead) => (
                <article className="data-row" key={lead.id} data-testid="lead-row" data-lead-id={lead.id} data-site-id={lead.siteId}>
                  <div>
                    <strong>{lead.name}</strong>
                    <small>
                      {lead.email}
                      {lead.company ? ` · ${lead.company}` : ""}
                      {" · "}
                      <Link href={`/leads?site=${encodeURIComponent(lead.siteId)}` as Route}>{lead.siteId}</Link>
                    </small>
                  </div>
                  <div>
                    <span data-testid="lead-message">{lead.message}</span>
                    <small className="row-action"><Mail size={11} /> 收件箱原文</small>
                  </div>
                  <span>{formatReceivedAt(lead.receivedAt)}</span>
                  <span className="lead-status new">新询盘</span>
                </article>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
