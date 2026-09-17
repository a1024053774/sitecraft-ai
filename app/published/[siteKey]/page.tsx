"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { OpenSourceTemplateFrame } from "@/components/open-source-template-frame";
import {
  defaultDraft,
  normalizeDraft,
  type Locale,
  type SiteDraft,
} from "@/lib/site-model";
import { findSitePage, pagePlanSourceLabel, previewPathForPage } from "@/lib/template-pages";

export default function PublishedSitePage() {
  const { siteKey } = useParams<{ siteKey: string }>();
  const [draft, setDraft] = useState<SiteDraft | null>(null);
  const [locale, setLocale] = useState<Locale>("zh");
  const [activePageId, setActivePageId] = useState("home");

  useEffect(() => {
    setDraft(null);
    const requestedPage = new URLSearchParams(window.location.search).get("page");
    fetch(`/api/sites/${encodeURIComponent(siteKey)}/draft`, { cache: "no-store" })
      .then((response) => response.json())
      .then((snapshot: { draft?: unknown }) => {
        const next = snapshot.draft ? normalizeDraft(snapshot.draft) : defaultDraft;
        setDraft(next);
        const page = findSitePage(next.pagePlan, requestedPage);
        if (page) setActivePageId(page.id);
      })
      .catch(() => {
        setDraft(defaultDraft);
      });
  }, [siteKey]);

  if (!draft) return <main className="published-template-shell" aria-busy="true" />;

  const activePage = findSitePage(draft.pagePlan, activePageId);
  const selectPage = (pageId: string) => {
    setActivePageId(pageId);
    const url = new URL(window.location.href);
    url.searchParams.set("page", pageId);
    window.history.replaceState(null, "", url);
  };

  return (
    <main className="published-template-shell">
      <nav className="published-page-nav" aria-label="站点页面" data-testid="site-page-nav">
        {draft.pagePlan.pages.map((page) => (
          <button
            className={activePage?.id === page.id ? "active" : ""}
            key={page.id}
            type="button"
            data-testid="site-page-tab"
            data-page-id={page.id}
            data-page-placement={page.placement}
            onClick={() => selectPage(page.id)}
          >
            {page.label[locale]}
          </button>
        ))}
      </nav>
      <p className="published-page-source" data-testid="site-page-source">{pagePlanSourceLabel(draft.pagePlan.source)}</p>
      {draft.pagePlan.unsupported.length ? (
        <p className="published-page-unsupported" role="status" data-testid="site-page-unsupported">
          未支持：{draft.pagePlan.unsupported.map((item) => `${item.requested}（${item.reason}）`).join("；")}
        </p>
      ) : null}
      <div className="published-template-locale" aria-label="站点语言">
        <button className={locale === "zh" ? "active" : ""} onClick={() => setLocale("zh")}>中</button>
        <button className={locale === "en" ? "active" : ""} onClick={() => setLocale("en")}>EN</button>
      </div>
      <OpenSourceTemplateFrame
        templateId={draft.templateId}
        draft={draft}
        locale={locale}
        variant="published"
        pagePath={previewPathForPage(activePage)}
        activePage={activePage}
      />
    </main>
  );
}
