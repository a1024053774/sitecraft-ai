"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Trash2, X } from "lucide-react";
import {
  FloatingSitePreview,
  previewHint,
  publishedHref,
  SitePeek,
  useSitePreview,
  workspaceHref,
} from "@/components/site-preview-pop";

type SiteListItem = {
  siteId: string;
  siteName: string;
  companyName: string;
  templateId: string;
  updatedAt: string;
};

async function requestDelete(siteId: string, confirmSiteId: string) {
  const response = await fetch(`/api/sites/${encodeURIComponent(siteId)}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ confirmSiteId }),
  });
  const payload = await response.json() as { error?: string; deleted?: boolean };
  if (!response.ok || !payload.deleted) {
    throw new Error(payload.error || "没有删除");
  }
}

export function SiteDeleteDialog({
  siteId,
  open,
  onClose,
  onDeleted,
}: {
  siteId: string;
  open: boolean;
  onClose: () => void;
  onDeleted?: (siteId: string) => void;
}) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setTyped("");
      setError("");
      setBusy(false);
    }
  }, [open, siteId]);

  if (!open) return null;

  const matched = typed === siteId;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="import-modal delete-modal" data-testid="site-delete-dialog" onClick={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="eyebrow">Delete / Confirm</div>
            <h3>删除站点 {siteId}</h3>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="关闭删除"><X size={15} /></button>
        </div>
        <p className="modal-copy">
          只有你确认后才会删。会去掉这份草稿、对话、上传图片和该站询盘。系统不会定时清理，也不会替你删别的站。输入站点编号后才能删除。
        </p>
        {siteId ? <SitePeek siteId={siteId} /> : null}
        <div className="delete-site-actions">
          <Link className="section-link" href={workspaceHref(siteId)}>先去工作台</Link>
          <Link className="section-link" href={publishedHref(siteId)} target="_blank" rel="noreferrer">打开发布页</Link>
        </div>
        <label className="materials-label" htmlFor="confirm-site-id">站点编号</label>
        <input
          id="confirm-site-id"
          className="delete-confirm-input"
          data-testid="site-delete-confirm"
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
        {error ? <p className="published-inquiry-error" role="alert">{error}</p> : null}
        <div className="modal-foot">
          <span>须与 {siteId} 完全一致</span>
          <button
            className="danger-button"
            type="button"
            data-testid="site-delete-submit"
            disabled={!matched || busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                await requestDelete(siteId, typed);
                onDeleted?.(siteId);
                onClose();
              } catch (caught) {
                setBusy(false);
                setError(caught instanceof Error ? caught.message : "没有删除");
              }
            }}
          >
            {busy ? "正在删除…" : "确认删除"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function SiteDeleteSettings() {
  const [sites, setSites] = useState<SiteListItem[]>([]);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const { preview, hoverable, keepPreview, releasePreview, rowProps } = useSitePreview(!pendingId);

  async function refresh() {
    const response = await fetch("/api/sites", { cache: "no-store" });
    const payload = await response.json() as { sites?: SiteListItem[] };
    setSites(payload.sites ?? []);
  }

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <section className="settings-section settings-section-stack" id="data-delete">
      <div className="settings-icon"><Trash2 size={17} /></div>
      <div>
        <h2>手动删除</h2>
        <p>删除须由你输入站点编号确认。系统不会自动清对话、草稿、上传或已发布站点。每行可回工作台或发布页。{previewHint(hoverable)}</p>
      </div>
      {sites.length === 0 ? (
        <p className="delete-empty" data-testid="site-delete-empty">当前没有已保存站点。打开工作台会新建草稿，不会在这里预先列一份假名单。</p>
      ) : (
        <ul className="delete-site-list" data-testid="site-delete-list">
          {sites.map((site) => (
            <li key={site.siteId} tabIndex={0} {...rowProps(site)}>
              <div data-preview-label="">
                <strong>{site.siteName}</strong>
                <small>{site.siteId} · {site.templateId}{site.companyName ? ` · ${site.companyName}` : ""}</small>
              </div>
              <div className="delete-site-actions" data-preview-actions="">
                <Link className="section-link" href={workspaceHref(site.siteId)}>工作台</Link>
                <Link className="section-link" href={publishedHref(site.siteId)} target="_blank" rel="noreferrer">发布页</Link>
                <button
                  className="danger-button"
                  type="button"
                  data-testid="site-delete-open"
                  data-site-id={site.siteId}
                  onClick={() => setPendingId(site.siteId)}
                >
                  删除
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {note ? <p className="delete-note" role="status">{note}</p> : null}
      <FloatingSitePreview preview={preview} onKeep={keepPreview} onRelease={releasePreview} />
      <SiteDeleteDialog
        siteId={pendingId ?? ""}
        open={Boolean(pendingId)}
        onClose={() => setPendingId(null)}
        onDeleted={(siteId) => {
          setNote(`已删除 ${siteId}`);
          void refresh();
        }}
      />
    </section>
  );
}
