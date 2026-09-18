"use client";

import Link from "next/link";
import { getTemplate } from "@/lib/site-model";
import type { SiteListItem } from "@/lib/site-store";
import {
  FloatingSitePreview,
  previewHint,
  publishedHref,
  useSitePreview,
  workspaceHref,
} from "@/components/site-preview-pop";

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

export function SitesTable({ sites }: { sites: SiteListItem[] }) {
  const { preview, hoverable, keepPreview, releasePreview, rowProps } = useSitePreview();

  return (
    <div>
      <p className="sites-preview-hint">{previewHint(hoverable)}</p>
      <div className="data-table" data-testid="sites-list">
        <div className="data-row data-row-sites data-row-head">
          <span>站点</span>
          <span>公司</span>
          <span>模板</span>
          <span>更新</span>
          <span>打开</span>
        </div>
        {sites.map((site) => {
          const template = getTemplate(site.templateId);
          return (
            <article
              className="data-row data-row-sites"
              key={site.siteId}
              data-testid="site-row"
              data-site-id={site.siteId}
              {...rowProps(site)}
            >
              <div data-preview-label="">
                <strong>{site.siteName}</strong>
                <small>{site.siteId}</small>
              </div>
              <span>{site.companyName || "—"}</span>
              <span>{template.name}</span>
              <span>{formatUpdatedAt(site.updatedAt)}</span>
              <div className="site-row-actions" data-preview-actions="">
                <Link className="section-link" href={workspaceHref(site.siteId)}>工作台</Link>
                <Link className="section-link" href={publishedHref(site.siteId)} target="_blank" rel="noreferrer">发布页</Link>
              </div>
            </article>
          );
        })}
      </div>
      <FloatingSitePreview preview={preview} onKeep={keepPreview} onRelease={releasePreview} />
    </div>
  );
}
