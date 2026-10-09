import Link from "next/link";
import type { Route } from "next";
import {
  ArrowUpRight,
  ChevronRight,
  Clock3,
  FileText,
  Globe2,
  LayoutTemplate,
  MessageSquareText,
  Plus,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import { AppSidebar } from "@/components/app-sidebar";
import { listCodeSites, type CodeSiteListItem as SiteListItem } from "@/lib/code-site-store";
import { listLeads, type PublicLead } from "@/lib/lead-store";

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

function SiteThumb({ site }: { site: SiteListItem }) {
  if (site.readError || !site.hasVersion) return <div className="site-thumb site-thumb-unavailable">{site.status}</div>;
  return <div className="site-thumb"><iframe title={`${site.siteName}缩略预览`} src={`/published/${encodeURIComponent(site.siteId)}`} loading="lazy" sandbox="" style={{width:1440,height:1000,border:0,transform:'scale(.25)',transformOrigin:'top left',pointerEvents:'none'}} /></div>;
}

export default async function Dashboard() {
  const [sites, leads] = await Promise.all([listCodeSites(), listLeads()]);
  const recent = sites.slice(0, 3);
  const activities = [
    ...sites.map((site) => ({ kind: "site" as const, at: site.updatedAt, title: `${site.readError ? "无法打开" : "已更新"} ${site.siteName}`, detail: site.readError || "打开工作台继续修改", icon: "sparkles" as const })),
    ...leads.map((lead: PublicLead) => ({ kind: "lead" as const, at: lead.receivedAt, title: "收到新的询盘", detail: [lead.company, lead.name].filter(Boolean).join(" · ") || "访客询盘", icon: "message" as const })),
  ].sort((left, right) => right.at.localeCompare(left.at)).slice(0, 3);

  return (
    <div className="app-shell">
      <AppSidebar active="sites" />
      <main className="main">
        <header className="topbar">
          <div className="breadcrumbs">
            <span>Workspace</span>
            <ChevronRight size={12} />
            <strong>我的站点</strong>
          </div>
          <div className="top-actions">
            <button className="icon-button" aria-label="通知">
              <Clock3 size={15} />
            </button>
            <Link href="/workspace?new=1" className="primary-button">
              <Plus size={15} />
              新建站点
            </Link>
          </div>
        </header>
        <div className="page-content">
          <div className="hero-row">
            <div>
              <h1>
                把你的能力，
                <br />
                <span style={{ color: "#2e6b4f" }}>变成一座网站。</span>
              </h1>
              <p>用一段对话开始。选择一个方向，剩下的交给 AI。</p>
            </div>
            <Link href="/workspace?new=1" className="primary-button new-site-button">
              <WandSparkles size={15} />
              开始一个新项目 <ArrowUpRight size={14} />
            </Link>
          </div>
          <div className="stats">
            <div className="stat-card">
              <div className="stat-label">
                <span>站点总数</span>
                <LayoutTemplate size={14} />
              </div>
              <div className="stat-value">{String(sites.length).padStart(2, "0")}</div>
              <div className="stat-note">已保存草稿，不是演示名单</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">
                <span>收到的询盘</span>
                <MessageSquareText size={14} />
              </div>
              <div className="stat-value">{String(leads.length).padStart(2, "0")}</div>
              <div className="stat-note">来自当前工作区</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">
                <span>最近更新</span>
                <Globe2 size={14} />
              </div>
              <div className="stat-value">{String(recent.length).padStart(2, "0")}</div>
              <div className="stat-note">最近三项站点记录</div>
            </div>
          </div>
          <div className="section-heading">
            <h2>最近的站点</h2>
            <Link className="section-link" href={"/sites" as Route} data-testid="view-all-sites">
              查看全部{" "}
              <ArrowUpRight size={12} style={{ verticalAlign: "middle" }} />
            </Link>
          </div>
          <div className="site-grid">
            {recent.length === 0 ? (
              <p className="leads-empty recent-sites-empty">还没有已保存站点。点击新建站点开始建站，这里不会先放演示站。</p>
            ) : recent.map((site) => {
                          return (
                <Link
                  href={`/workspace?site=${encodeURIComponent(site.siteId)}` as Route}
                  className="site-card"
                  key={site.siteId}
                >
                  <SiteThumb site={site} />
                  <div className="site-card-body">
                    <div className="site-title">
                      <strong>{site.siteName}</strong>
                      <span className="site-status">{site.status || "● 已保存"}</span>
                    </div>
                    <div className="site-meta">{site.siteId}</div>
                    {site.readError && <p className="site-read-error" role="status">{site.readError}</p>}
                    <div className="site-card-footer">
                      <span>最后编辑 {formatUpdatedAt(site.updatedAt)}</span>
                      <span className="tiny-action">
                        {site.readError ? "查看原因" : "打开工作台"}{" "}
                        <ArrowUpRight
                          size={11}
                          style={{ verticalAlign: "middle" }}
                        />
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
          <div className="activity-panel">
            <div className="panel">
              <div className="section-heading">
                <h2>最近动态</h2>
                <Link className="section-link" href={"/leads" as Route}>
                  活动记录
                </Link>
              </div>
              {activities.length ? activities.map((activity) => (
                <div className="activity-row" key={`${activity.kind}-${activity.at}-${activity.title}`}>
                  <div className="activity-icon">{activity.icon === "message" ? <MessageSquareText size={14} /> : <Sparkles size={14} />}</div>
                  <div className="activity-text"><strong>{activity.title}</strong><span>{activity.detail}</span></div>
                  <span className="activity-time">{formatUpdatedAt(activity.at)}</span>
                </div>
              )) : <p className="leads-empty">暂无动态。创建站点或收到询盘后会显示在这里。</p>}
            </div>
            <div className="panel">
              <div className="section-heading">
                <h2>快速开始</h2>
              </div>
              <div className="quick-list">
                <Link href="/workspace?new=1" className="quick-item">
                  <WandSparkles size={14} />
                  从模板开始一个站点
                  <ArrowUpRight size={12} style={{ marginLeft: "auto" }} />
                </Link>
                <Link
                  href="/workspace?import=products"
                  className="quick-item"
                  style={{
                    textAlign: "left",
                  }}
                >
                  <FileText size={14} />
                  上传商品表格
                  <ArrowUpRight size={12} style={{ marginLeft: "auto" }} />
                </Link>
                <Link
                  href={"/leads" as Route}
                  className="quick-item"
                  style={{
                    textAlign: "left",
                  }}
                >
                  <MessageSquareText size={14} />
                  查看未处理询盘
                  <ArrowUpRight size={12} style={{ marginLeft: "auto" }} />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
