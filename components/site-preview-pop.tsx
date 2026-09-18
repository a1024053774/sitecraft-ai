"use client";

import type { CSSProperties, MouseEvent, PointerEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Route } from "next";

export const PREVIEW_DELAY_MS = 50;
const HIDE_DELAY_MS = 80;
const POPOVER_WIDTH = 360;
const POPOVER_HEIGHT = 228;
const MIN_GAP = 200;
const VIEW_PAD = 12;

export type PreviewSite = {
  siteId: string;
  siteName: string;
};

export function workspaceHref(siteId: string) {
  return `/workspace?site=${encodeURIComponent(siteId)}` as Route;
}

export function publishedHref(siteId: string) {
  return `/published/${encodeURIComponent(siteId)}` as Route;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(min, value), max);
}

function measure(row: HTMLElement) {
  const label = row.querySelector("[data-preview-label]");
  const actions = row.querySelector("[data-preview-actions]");
  return {
    row: row.getBoundingClientRect(),
    label: label?.getBoundingClientRect(),
    actions: actions?.getBoundingClientRect(),
  };
}

function popoverStyle(row: HTMLElement): CSSProperties {
  const { row: rowBox, label, actions } = measure(row);
  const gapLeft = label ? label.right + 8 : rowBox.left + 16;
  const gapRight = actions ? actions.left - 8 : rowBox.right - 16;
  const gap = gapRight - gapLeft;
  const maxLeft = window.innerWidth - POPOVER_WIDTH - VIEW_PAD;
  const maxTop = window.innerHeight - POPOVER_HEIGHT - VIEW_PAD;

  if (gap < MIN_GAP) {
    const left = clamp(rowBox.left + rowBox.width / 2 - POPOVER_WIDTH / 2, VIEW_PAD, maxLeft);
    const below = rowBox.bottom + 8;
    const top = below + POPOVER_HEIGHT + VIEW_PAD <= window.innerHeight
      ? below
      : clamp(rowBox.top - POPOVER_HEIGHT - 8, VIEW_PAD, maxTop);
    return { top, left };
  }

  const left = clamp(gapLeft + (gap - POPOVER_WIDTH) / 2, VIEW_PAD, maxLeft);
  const top = clamp(rowBox.top + rowBox.height / 2 - POPOVER_HEIGHT / 2, VIEW_PAD, maxTop);
  return { top, left };
}

export function SitePeek({ siteId }: { siteId: string }) {
  return (
    <div className="site-preview-frame" data-testid="site-preview-frame" data-site-id={siteId}>
      <iframe
        title={`${siteId} 预览`}
        src={publishedHref(siteId)}
        loading="eager"
        tabIndex={-1}
      />
    </div>
  );
}

export function useSitePreview(active = true) {
  const [preview, setPreview] = useState<{ siteId: string; siteName: string; row: HTMLElement } | null>(null);
  const [hoverable, setHoverable] = useState(false);
  const showTimer = useRef<number | null>(null);
  const hideTimer = useRef<number | null>(null);
  const hoverableRef = useRef(false);
  const lastInput = useRef<"mouse" | "touch">("mouse");
  const previewRef = useRef(preview);
  previewRef.current = preview;

  function clearShow() {
    if (showTimer.current !== null) {
      window.clearTimeout(showTimer.current);
      showTimer.current = null;
    }
  }

  function clearHide() {
    if (hideTimer.current !== null) {
      window.clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  }

  function hide() {
    clearShow();
    clearHide();
    setPreview(null);
  }

  function show(site: PreviewSite, row: HTMLElement) {
    clearShow();
    clearHide();
    setPreview({ ...site, row });
  }

  function canHover() {
    return hoverableRef.current && lastInput.current !== "touch";
  }

  function schedule(site: PreviewSite, row: HTMLElement) {
    if (!active || !canHover()) return;
    clearHide();
    clearShow();
    if (previewRef.current) {
      show(site, row);
      return;
    }
    showTimer.current = window.setTimeout(() => show(site, row), PREVIEW_DELAY_MS);
  }

  function scheduleHide() {
    if (!canHover()) return;
    clearShow();
    clearHide();
    hideTimer.current = window.setTimeout(() => setPreview(null), HIDE_DELAY_MS);
  }

  function toggle(site: PreviewSite, row: HTMLElement) {
    if (!active) return;
    if (previewRef.current?.siteId === site.siteId) hide();
    else show(site, row);
  }

  function rowProps(site: PreviewSite) {
    return {
      "data-preview-row": site.siteId,
      "data-preview-mode": hoverable ? "hover" : "tap",
      onMouseOver: (event: MouseEvent<HTMLElement>) => {
        const related = event.relatedTarget as Node | null;
        if (related && event.currentTarget.contains(related)) return;
        schedule(site, event.currentTarget);
      },
      onMouseOut: (event: MouseEvent<HTMLElement>) => {
        const related = event.relatedTarget as Node | null;
        if (related && event.currentTarget.contains(related)) return;
        scheduleHide();
      },
      onPointerDown: (event: PointerEvent<HTMLElement>) => {
        lastInput.current = event.pointerType === "touch" ? "touch" : "mouse";
      },
      onClick: (event: MouseEvent<HTMLElement>) => {
        if (canHover()) return;
        if ((event.target as HTMLElement).closest("a,button")) return;
        toggle(site, event.currentTarget);
      },
    };
  }

  useEffect(() => {
    const media = window.matchMedia("(hover: hover) and (pointer: fine)");
    function syncHover() {
      hoverableRef.current = media.matches;
      setHoverable(media.matches);
    }
    syncHover();
    media.addEventListener("change", syncHover);
    return () => {
      media.removeEventListener("change", syncHover);
      clearShow();
      clearHide();
    };
  }, []);

  useEffect(() => {
    if (!preview || !active) return;
    function onDocumentClick(event: Event) {
      if (canHover()) return;
      const target = event.target as HTMLElement;
      if (target.closest("[data-preview-row], [data-testid=site-preview-pop]")) return;
      hide();
    }
    document.addEventListener("click", onDocumentClick);
    return () => document.removeEventListener("click", onDocumentClick);
  }, [preview, active]);

  useEffect(() => {
    if (!active) hide();
  }, [active]);

  return {
    preview: active ? preview : null,
    hoverable,
    hide,
    keepPreview: clearHide,
    releasePreview: scheduleHide,
    rowProps,
  };
}

export function FloatingSitePreview({
  preview,
  onKeep,
  onRelease,
}: {
  preview: { siteId: string; siteName: string; row: HTMLElement } | null;
  onKeep?: () => void;
  onRelease?: () => void;
}) {
  const [, bump] = useState(0);

  useEffect(() => {
    if (!preview) return;
    function sync() {
      bump((value) => value + 1);
    }
    window.addEventListener("scroll", sync, true);
    window.addEventListener("resize", sync);
    return () => {
      window.removeEventListener("scroll", sync, true);
      window.removeEventListener("resize", sync);
    };
  }, [preview]);

  if (!preview || typeof document === "undefined" || !preview.row.isConnected) return null;

  return createPortal(
    <div
      className="site-preview-pop"
      data-testid="site-preview-pop"
      style={popoverStyle(preview.row)}
      onMouseEnter={onKeep}
      onMouseLeave={onRelease}
    >
      <p className="site-preview-pop-meta">{preview.siteName} · {preview.siteId}</p>
      <SitePeek siteId={preview.siteId} />
    </div>,
    document.body,
  );
}

export function previewHint(hoverable: boolean) {
  return hoverable
    ? "把鼠标停在一行中间会出现预览。"
    : "点一下行中间会出现预览，再点一次收起。";
}
