import Link from "next/link";
import { AppTopbar } from "@/components/app-topbar";
import { SitesTable } from "@/components/sites-table";
import { listCodeSites } from "@/lib/code-site-store";
import { LocalSiteList } from "@/components/local-site-list";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function SitesPage() {
  // T-202: browser storage lists only this browser's sites, client side.
  if (process.env.SITE_STORE === 'browser') return <LocalSitesPage />;
  const sites = await listCodeSites();

  return (
    <div className="app-page">
      <AppTopbar active="sites" />
      <main className="app-main">
        <div className="home-head">
          <h1>全部站点</h1>
          <p data-testid="sites-count"><strong>{sites.length}</strong> 个已保存的站点，不预置演示站。电脑悬停或手机点行中间可看预览。</p>
        </div>
        {sites.length === 0 ? (
          <div className="home-empty" data-testid="sites-empty">
            <p>还没有已保存站点。新建一个，从发公司资料开始。</p>
            <Link href="/workspace?new=1" className="primary-button">新建站点，先发资料</Link>
          </div>
        ) : (
          <SitesTable sites={sites} />
        )}
      </main>
    </div>
  );
}

function LocalSitesPage() {
  return (
    <div className="app-page">
      <AppTopbar active="sites" />
      <main className="app-main">
        <div className="home-head"><h1>全部站点</h1><p>只列出保存在这个浏览器里的站点。</p></div>
        <LocalSiteList />
      </main>
    </div>
  );
}
