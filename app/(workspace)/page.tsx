import Link from "next/link";
import type { Route } from "next";
import { ArrowRight } from "lucide-react";
import { AppTopbar } from "@/components/app-topbar";
import { listCodeSites, type CodeSiteListItem as SiteListItem } from "@/lib/code-site-store";
import { codeSiteSteps } from "@/lib/code-site";
import { codeStyles, readyCodeStyleIds } from "@/lib/code-site-styles";
import { LocalSiteList } from "@/components/local-site-list";
import { ProviderStatus } from "@/components/provider-settings";
import { SiteProgress, formatUpdatedAt, siteProgressText, siteVersionText } from "@/components/site-progress";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const workspaceHref = (siteId: string) => `/workspace?site=${encodeURIComponent(siteId)}` as Route;
const stepNotes: Record<(typeof codeSiteSteps)[number]["id"], string> = {
  material: "粘贴或上传公司资料。网站上的话都从这里来，资料里没有的标成「待补充」。",
  style: "从真实生成过的站点里挑一种风格，再定版式和信息量的松紧。",
  outline: "看要做哪几页、每页写什么。你确认了才开始写。",
  generate: "写页面，核对事实出处，检查电脑、平板、手机三种宽度，保存第 1 版。",
  edit: "在预览上点一块说怎么改，或直接对整页提要求。每次修改存成一个新版本，可以退回。",
};

function SiteThumb({ site }: { site: SiteListItem }) {
  return <div className="site-thumb"><iframe title={`${site.siteName}缩略预览`} src={`/published/${encodeURIComponent(site.siteId)}`} loading="lazy" sandbox="" tabIndex={-1} /></div>;
}

function HowItWorks() {
  return (
    <section className="home-section" aria-labelledby="home-steps">
      <h2 id="home-steps">一个站点分五步做完</h2>
      <ol className="home-steps">
        {codeSiteSteps.map((step, index) => <li key={step.id}><i>{index + 1}</i><strong>{step.label}</strong><p>{stepNotes[step.id]}</p></li>)}
      </ol>
    </section>
  );
}

function StyleSamples() {
  return (
    <section className="home-section" aria-labelledby="home-styles">
      <div className="home-section-head"><h2 id="home-styles">四种风格，缩略图来自真实生成过的站点</h2><a href="/style-previews/SOURCE.md" target="_blank" rel="noreferrer">示例来源</a></div>
      <div className="home-styles">
        {readyCodeStyleIds.map(id => {
          const style = codeStyles[id];
          return <figure key={id}>{style.preview.status === "ready" && <img src={style.preview.src} alt={`${style.label}：真实生成站点首屏示例`} width="576" height="400" loading="lazy" />}<figcaption><strong>{style.label}</strong><span>{style.description}</span></figcaption></figure>;
        })}
      </div>
      <p className="home-note">选风格在第 2 步；也可以让系统按资料帮你选。具体排法随资料变化。</p>
    </section>
  );
}

export default async function Dashboard() {
  if (process.env.SITE_STORE === "browser") return <LocalDashboard />;
  const sites = await listCodeSites();
  const latest = sites.find(site => site.hasVersion && !site.readError);
  const waiting = sites.filter(site => siteProgressText(site).tone !== "plain").length;

  return (
    <div className="app-page">
      <AppTopbar active="home" />
      <main className="app-main">
        <div className="home-head">
          <h1>站点</h1>
          <p>{sites.length ? `${sites.length} 个站点${waiting ? `，其中 ${waiting} 个等你处理` : ""}。` : "还没有站点。"}把公司资料发过来，五步做成它自己的官网。</p>
          <ProviderStatus />
        </div>

        {latest && (
          <section className="home-latest" aria-label="上次改到这里">
            <Link href={workspaceHref(latest.siteId)} className="home-latest-thumb" aria-label={`打开 ${latest.siteName}`}><SiteThumb site={latest} /></Link>
            <div className="home-latest-body">
              <span className="home-kicker">上次改到这里</span>
              <h2>{latest.siteName}</h2>
              <p>{siteVersionText(latest).main} · {siteVersionText(latest).sub}</p>
              <p className="home-muted">最后修改 {formatUpdatedAt(latest.updatedAt)}</p>
              <SiteProgress site={latest} />
              <div className="home-latest-actions">
                <Link href={workspaceHref(latest.siteId)} className="primary-button">继续修改 <ArrowRight size={15} /></Link>
                <a className="secondary-button" href={`/api/sites/${encodeURIComponent(latest.siteId)}/export`} download>下载站点包</a>
              </div>
            </div>
          </section>
        )}

        <section className="home-section" aria-labelledby="home-sites">
          <div className="home-section-head">
            <h2 id="home-sites">{sites.length > 6 ? "最近改过的 6 个" : "全部站点"}</h2>
            <Link href={"/sites" as Route} data-testid="view-all-sites">查看全部 <ArrowRight size={13} /></Link>
          </div>
          {sites.length === 0 ? (
            <div className="home-empty">
              <p>还没有已保存站点，这里不会先放演示站。手头没有资料也可以开始：第 1 步里能载入一份模拟公司的资料试一遍。</p>
              <Link href="/workspace?new=1" className="primary-button">新建站点，先发资料 <ArrowRight size={15} /></Link>
            </div>
          ) : (
            <div className="site-table" role="table" aria-label="站点">
              <div className="site-table-row site-table-head" role="row"><span role="columnheader">站点</span><span role="columnheader">做到哪一步</span><span role="columnheader">当前版本</span><span role="columnheader">最后修改</span><span role="columnheader" /></div>
              {sites.slice(0, 6).map(site => {
                const text = siteProgressText(site), version = siteVersionText(site);
                return (
                  <Link href={workspaceHref(site.siteId)} className="site-table-row" role="row" key={site.siteId}>
                    <span role="cell" className="site-table-name"><strong>{site.siteName}</strong>{site.readError && <small className="site-read-error" role="status">{site.readError}</small>}</span>
                    <span role="cell"><SiteProgress site={site} /></span>
                    <span role="cell"><strong>{version.main}</strong><small>{version.sub}</small></span>
                    <span role="cell">{formatUpdatedAt(site.updatedAt)}</span>
                    <span role="cell" className={`site-table-action${text.tone === "plain" ? "" : " strong"}`}>{text.action} <ArrowRight size={13} /></span>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        <HowItWorks />
        <StyleSamples />
      </main>
    </div>
  );
}

// T-202 browser storage: sites live in this browser, so the dashboard lists them client side.
function LocalDashboard() {
  return (
    <div className="app-page">
      <AppTopbar active="home" />
      <main className="app-main">
        <div className="home-head">
          <h1>站点</h1>
          <p>站点、版本和对话只保存在这个浏览器里。把公司资料发过来，五步做成它自己的官网。</p>
          <ProviderStatus />
        </div>
        <section className="home-section" aria-labelledby="home-sites">
          <div className="home-section-head"><h2 id="home-sites">这个浏览器里的站点</h2><Link href={"/sites" as Route} data-testid="view-all-sites">查看全部 <ArrowRight size={13} /></Link></div>
          <LocalSiteList limit={6} />
        </section>
        <HowItWorks />
        <StyleSamples />
      </main>
    </div>
  );
}
