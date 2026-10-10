"use client";

import Link from "next/link";
import type { Route } from "next";
import {
  Columns3,
  FileText,
  LayoutTemplate,
  Menu,
  MessageSquareText,
  Settings2,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { useState } from "react";

export type SidebarSection =
  | "sites"
  | "builder"
  | "leads"
  | "content"
  | "team"
  | "settings";

const workspaceItems = [
  { id: "sites", href: "/", label: "我的站点", icon: LayoutTemplate },
  { id: "builder", href: "/workspace?new=1", label: "AI 建站", icon: Sparkles },
  {
    id: "leads",
    href: "/leads",
    label: "询盘线索",
    icon: MessageSquareText,
  },
  { id: "content", href: "/content", label: "内容与商品", icon: FileText },
] as const;

const manageItems = [
  { id: "team", href: "/settings#team", label: "团队协作", icon: Users },
  {
    id: "settings",
    href: "/settings",
    label: "工作区设置",
    icon: Settings2,
  },
] as const;

export function AppSidebar({ active }: { active: SidebarSection }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <button
        className="mobile-nav-trigger"
        type="button"
        aria-label="打开工作区导航"
        aria-expanded={mobileOpen}
        onClick={() => setMobileOpen(true)}
      >
        <Menu size={18} />
      </button>
      <button
        className={`mobile-sidebar-backdrop ${mobileOpen ? "open" : ""}`}
        type="button"
        aria-label="关闭工作区导航"
        onClick={() => setMobileOpen(false)}
      />
      <aside className={`sidebar ${mobileOpen ? "mobile-open" : ""}`}>
      <button
        className="mobile-sidebar-close"
        type="button"
        aria-label="关闭工作区导航"
        onClick={() => setMobileOpen(false)}
      >
        <X size={18} />
      </button>
      <Link href="/" className="brand" aria-label="Sitecraft AI 首页">
        <span className="brand-mark">S/</span> sitecraft
        <span style={{ color: "#9aa69d", fontSize: 9, marginLeft: -5 }}>
          AI
        </span>
      </Link>
      <div className="eyebrow" style={{ padding: "0 12px 9px" }}>
        workspace
      </div>
      <nav className="nav" aria-label="工作区导航">
        {workspaceItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              className={`nav-button ${active === item.id ? "active" : ""}`}
              href={item.href as Route}
              key={item.id}
              onClick={() => setMobileOpen(false)}
            >
              <Icon size={15} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="eyebrow" style={{ padding: "27px 12px 9px" }}>
        manage
      </div>
      <nav className="nav" aria-label="工作区管理">
        {manageItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              className={`nav-button ${active === item.id ? "active" : ""}`}
              href={item.href as Route}
              key={item.id}
              onClick={() => setMobileOpen(false)}
            >
              <Icon size={15} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="sidebar-spacer" />
      </aside>
    </>
  );
}
