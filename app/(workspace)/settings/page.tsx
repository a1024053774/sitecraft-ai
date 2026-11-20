import { AppTopbar } from "@/components/app-topbar";
import { SiteDeleteSettings } from "@/components/site-delete-panel";
import { ProviderSettingsPanel } from "@/components/provider-settings";

export default function SettingsPage() {
  return (
    <div className="app-page">
      <AppTopbar active="settings" />
      <main className="app-main">
        <div className="home-head">
          <h1>模型接口与设置</h1>
          <p>填写生成和修改网站时使用的模型接口，或删除不再需要的站点。</p>
        </div>
        <div className="settings-grid">
          <ProviderSettingsPanel />
          <SiteDeleteSettings />
        </div>
      </main>
    </div>
  );
}
