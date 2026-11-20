"use client";

import Link from "next/link";
import type { CodeSiteListItem as SiteListItem } from "@/lib/code-site-store";
import {
  FloatingSitePreview,
  previewHint,
  publishedHref,
  useSitePreview,
  workspaceHref,
} from "@/components/site-preview-pop";
import { SiteProgress, formatUpdatedAt, siteProgressText, siteVersionText } from "@/components/site-progress";

export function SitesTable({ sites }: { sites: SiteListItem[] }) {
  const { preview, hoverable, keepPreview, releasePreview, rowProps } = useSitePreview();

  return (
    <div>
      <p className="sites-preview-hint">{previewHint(hoverable)}</p>
      <div className="site-table" data-testid="sites-list">
        <div className="site-table-row site-table-head">
          <span>站点</span>
          <span>做到哪一步</span>
          <span>当前版本</span>
          <span>最后修改</span>
          <span>打开</span>
        </div>
        {sites.map((site) => {
          const text = siteProgressText(site), version = siteVersionText(site);
          return (
            <article
              className="site-table-row"
              key={site.siteId}
              data-testid="site-row"
              data-site-id={site.siteId}
              {...(site.readError || !site.hasVersion ? {} : rowProps(site))}
            >
              <div data-preview-label="" className="site-table-name">
                <strong>{site.siteName}</strong>
                <small>{site.siteId}</small>
                {site.readError && <small className="site-read-error" role="status">{site.readError}</small>}
              </div>
              <span><SiteProgress site={site} /></span>
              <span><strong>{version.main}</strong><small>{version.sub}</small></span>
              <span>{formatUpdatedAt(site.updatedAt)}</span>
              <div className="site-row-actions" data-preview-actions="">
                <Link className={`site-table-action${text.tone === "plain" ? "" : " strong"}`} href={workspaceHref(site.siteId)}>{text.action}</Link>
                {!site.readError && site.hasVersion && <Link className="site-table-action" href={publishedHref(site.siteId)} target="_blank" rel="noreferrer">发布页</Link>}
              </div>
            </article>
          );
        })}
      </div>
      <FloatingSitePreview preview={preview} onKeep={keepPreview} onRelease={releasePreview} />
    </div>
  );
}
