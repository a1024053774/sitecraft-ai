import Link from "next/link";
import type { Route } from "next";
import { ChevronRight } from "lucide-react";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteDeleteSettings } from "@/components/site-delete-panel";
import { ProviderSettingsPanel } from "@/components/provider-settings";

export default function SettingsPage() {
  return (
    <div className="app-shell">
      <AppSidebar active="settings" />
      <main className="main">
        <header className="topbar">
          <div className="breadcrumbs">
            <Link href="/">Workspace</Link>
            <ChevronRight size={12} />
            <strong>工作区设置</strong>
          </div>
        </header>
        <div className="page-content data-page">
          <div className="data-page-head">
            <div>
              <div className="eyebrow">Workspace / Settings</div>
              <h1>工作区设置</h1>
              <p>模型接口与站点删除。</p>
            </div>
          </div>
          <div className="settings-grid">
            <ProviderSettingsPanel />
            <SiteDeleteSettings />
          </div>
        </div>
      </main>
    </div>
  );
}
