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
import { getTemplate } from "@/lib/site-model";
import { listExistingSites, type SiteListItem } from "@/lib/site-store";

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
  const template = getTemplate(site.templateId);
  const brand = site.siteName.split(/\s+/)[0] || site.siteName;
  return (
    <div
      className="site-thumb"
      style={{
        background: `linear-gradient(135deg, ${template.colors.primary}, ${template.colors.primary}dd)`,
      }}
    >
      <div className="thumb-grid">
        <div className="thumb-nav">
          <span>◼ {brand}</span>
          <span>ABOUT&nbsp;&nbsp; WORK&nbsp;&nbsp; CONTACT</span>
        </div>
        <div className="thumb-title">
          <span style={{ display: "block" }}>{site.siteName}</span>
        </div>
        <div className="thumb-lines">
          <span />
          <span />
        </div>
      </div>
    </div>
  );
}

export default async function Dashboard() {
  const sites = await listExistingSites();
  const recent = sites.slice(0, 3);

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
            <Link href="/templates" className="primary-button">
              <Plus size={15} />
              新建站点
            </Link>
          </div>
        </header>
        <div className="page-content">
          <div className="hero-row">
            <div>
              <div className="eyebrow">Site studio / 08.21</div>
              <h1>
                把你的能力，
                <br />
                <span style={{ color: "#2e6b4f" }}>变成一座网站。</span>
              </h1>
              <p>用一段对话开始。选择一个方向，剩下的交给 AI。</p>
            </div>
            <Link href="/templates" className="primary-button new-site-button">
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
              <div className="stat-value">24</div>
              <div className="stat-note">↑ 比上月多 18%</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">
                <span>已发布页面</span>
                <Globe2 size={14} />
              </div>
              <div className="stat-value">18</div>
              <div className="stat-note">全部运行正常</div>
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
              <p className="leads-empty recent-sites-empty">还没有已保存站点。打开工作台会新建草稿，这里不会先放演示站。</p>
            ) : recent.map((site) => {
              const template = getTemplate(site.templateId);
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
                      <span className="site-status">● {template.name}</span>
                    </div>
                    <div className="site-meta">{site.siteId} · {template.category}</div>
                    <div className="site-card-footer">
                      <span>最后编辑 {formatUpdatedAt(site.updatedAt)}</span>
                      <span className="tiny-action">
                        打开工作台{" "}
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
              <div className="activity-row">
                <div className="activity-icon">
                  <Sparkles size={14} />
                </div>
                <div className="activity-text">
                  <strong>AI 更新了 Forge Industrial 的首页</strong>
                  <span>“把产品能力放到首屏，并让标题更有工程感”</span>
                </div>
                <span className="activity-time">2 MIN</span>
              </div>
              <div className="activity-row">
                <div className="activity-icon">
                  <Globe2 size={14} />
                </div>
                <div className="activity-text">
                  <strong>Forge Industrial 发布了新版本</strong>
                  <span>forge-industrial.sites.ai</span>
                </div>
                <span className="activity-time">1 DAY</span>
              </div>
              <div className="activity-row">
                <div className="activity-icon">
                  <MessageSquareText size={14} />
                </div>
                <div className="activity-text">
                  <strong>收到来自 Germany 的新询盘</strong>
                  <span>Northstar Robotics · 产品询盘</span>
                </div>
                <span className="activity-time">2 DAY</span>
              </div>
            </div>
            <div className="panel">
              <div className="section-heading">
                <h2>快速开始</h2>
              </div>
              <div className="quick-list">
                <Link href="/templates" className="quick-item">
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
