"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Locale, SiteDraft } from "@/lib/site-model";

type FrameVariant = "thumbnail" | "preview" | "workspace" | "published" | "quality";
type PreviewLoadState = "loading" | "ready" | "error";

type OpenSourceTemplateFrameProps = {
  templateId: string;
  draft?: SiteDraft;
  locale?: Locale;
  variant?: FrameVariant;
  expectedTargets?: string[];
  pagePath?: string;
  activePage?: {
    id: string;
    role: string;
    placement: string;
    section?: string;
    route?: string;
  };
  onInquiry?: (payload: {
    name: string;
    email: string;
    company: string;
    message: string;
    honeypot: string;
  }) => void;
  onSelectTarget?: (target: string, label: string, prompt: string) => void;
  onApplyReport?: (report: {
    revision: number;
    appliedSlots: string[];
    missingSlots: string[];
    fallbackMatched: string[];
    proposedAlternatives: Array<{ requested: string; proposed: string }>;
  }) => void;
  onLoadState?: (state: PreviewLoadState, message?: string) => void;
};

const targetPrompts: Record<string, { label: string; prompt: string }> = {
  brand: { label: "品牌名称", prompt: "修改品牌名称，并保持当前开源模板的 Logo 区域和排版不变。" },
  heroTitle: { label: "首屏标题", prompt: "重写首屏标题，保持当前开源模板原有的字号、断行节奏和版式。" },
  heroSubtitle: { label: "首屏说明", prompt: "优化首屏说明，保留当前模板的信息密度并避免虚构企业事实。" },
  heroImage: { label: "首屏图片", prompt: "只用已经上传且属于本站的产品图替换已声明的首屏图片槽，不要使用模板演示图。" },
  products: { label: "产品与能力", prompt: "根据已导入商品优化产品与能力区块，不存在的信息标记为待补充。" },
  about: { label: "关于我们", prompt: "修改关于我们区块，只使用已经提供的企业事实。" },
  features: { label: "核心优势", prompt: "修改核心优势区块，保持当前模板的信息密度和卡片数量。" },
  services: { label: "服务模块", prompt: "修改服务模块，可指定第几个服务的标题或说明。" },
  faq: { label: "常见问题", prompt: "修改 FAQ 问答，只使用资料里的交期、认证、MOQ 和售后；没有的写成待补充。" },
  contact: { label: "联系模块", prompt: "修改联系区块文案和联系方式，不得虚构数据。" },
};

// Bump when the local snapshot/host overlay contract changes. Keeping this in
// the iframe URL prevents a browser from showing an older template shell after
// the runtime asset bundle has been rebuilt.
const PREVIEW_ASSET_REVISION = "20260923-family-kit-2";
export const PREVIEW_TIMEOUT_MS = 10_000;
const PREVIEW_CHROME_HINT = "如果预览打不开，请用 Chrome 打开。";

export function OpenSourceTemplateFrame({
  templateId,
  draft,
  locale = "zh",
  variant = "preview",
  expectedTargets = [],
  pagePath = "",
  activePage,
  onInquiry,
  onSelectTarget,
  onApplyReport,
  onLoadState,
}: OpenSourceTemplateFrameProps) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [hydrated, setHydrated] = useState(false);
  const [loadState, setLoadState] = useState<PreviewLoadState>("loading");
  const [loadError, setLoadError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const loadStateRef = useRef(onLoadState);
  loadStateRef.current = onLoadState;
  const timeoutRef = useRef<number | null>(null);
  const bridgeWaitersRef = useRef<number[]>([]);
  const contentRef = useRef({ templateId, draft, locale, expectedTargets, variant, activePage });
  contentRef.current = { templateId, draft, locale, expectedTargets, variant, activePage };

  const clearBridgeWait = useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    for (const timer of bridgeWaitersRef.current) window.clearTimeout(timer);
    bridgeWaitersRef.current = [];
  }, []);

  const reportLoadState = useCallback((state: PreviewLoadState, message?: string) => {
    if (state !== "loading") clearBridgeWait();
    setLoadState(state);
    setLoadError(message ?? "");
    loadStateRef.current?.(state, message);
  }, [clearBridgeWait]);

  const sendContent = useCallback(() => {
    const content = contentRef.current;
    frameRef.current?.contentWindow?.postMessage(
      { type: "sitecraft:content", typeVersion: 1, ...content },
      "*",
    );
  }, []);

  const handleFrameLoad = useCallback(() => {
    if (frameRef.current) frameRef.current.dataset.documentLoaded = "true";
    sendContent();
    clearBridgeWait();
    bridgeWaitersRef.current = [500, 1500, 3500, 6000].map((delay) => window.setTimeout(sendContent, delay));
    const timeout = window.setTimeout(() => {
      reportLoadState("error", `页面已经打开，但内容没有显示出来。请重试。${PREVIEW_CHROME_HINT}`);
    }, PREVIEW_TIMEOUT_MS);
    timeoutRef.current = timeout;
  }, [clearBridgeWait, reportLoadState, sendContent]);

  useEffect(() => {
    setHydrated(false);
    reportLoadState("loading");
    if (frameRef.current?.dataset.documentLoaded === "true") handleFrameLoad();
    else clearBridgeWait();
    return () => {
      clearBridgeWait();
    };
  }, [activePage?.id, activePage?.placement, activePage?.route, activePage?.section, attempt, clearBridgeWait, draft?.revision, expectedTargets.join("|"), handleFrameLoad, locale, pagePath, reportLoadState, templateId, variant]);

  useEffect(() => {
    const receiveMessage = (event: MessageEvent) => {
      if (event.source !== frameRef.current?.contentWindow) return;
      const data = event.data as {
        type?: string;
        templateId?: string;
        target?: string;
        payload?: {
          name?: string;
          email?: string;
          company?: string;
          message?: string;
          honeypot?: string;
        };
        revision?: number;
        appliedSlots?: string[];
        missingSlots?: string[];
        fallbackMatched?: string[];
        proposedAlternatives?: Array<{ requested: string; proposed: string }>;
        reason?: string;
      };
      if (data?.type === "sitecraft:error") {
        const reason = typeof data.reason === "string" && data.reason.trim() ? data.reason.trim() : "预览没有载入。";
        reportLoadState("error", `${reason} ${PREVIEW_CHROME_HINT}`);
        return;
      }
      if (data?.type === "sitecraft:ready" && data.templateId === templateId) {
        sendContent();
        return;
      }
      if (data?.type === "sitecraft:select" && data.target && onSelectTarget) {
        const target = targetPrompts[data.target];
        if (target) onSelectTarget(data.target, target.label, target.prompt);
      }
      if (data?.type === "sitecraft:inquiry" && data.templateId === templateId && onInquiry) {
        onInquiry({
          name: data.payload?.name ?? "",
          email: data.payload?.email ?? "",
          company: data.payload?.company ?? "",
          message: data.payload?.message ?? "",
          honeypot: data.payload?.honeypot ?? "",
        });
      }
      if (data?.type === "sitecraft:applied" && data.templateId === templateId) {
        setHydrated(true);
        reportLoadState("ready");
        if (typeof data.revision === "number" && onApplyReport) {
          onApplyReport({
            revision: data.revision,
            appliedSlots: data.appliedSlots ?? [],
            missingSlots: data.missingSlots ?? [],
            fallbackMatched: data.fallbackMatched ?? [],
            proposedAlternatives: data.proposedAlternatives ?? [],
          });
        }
      }
    };
    window.addEventListener("message", receiveMessage);
    return () => window.removeEventListener("message", receiveMessage);
  }, [draft?.revision, onApplyReport, onInquiry, onSelectTarget, reportLoadState, sendContent, templateId]);

  const previewQuery = new URLSearchParams({ v: PREVIEW_ASSET_REVISION });
  if (pagePath) previewQuery.set("pagePath", pagePath);

  const retry = () => {
    setAttempt((value) => value + 1);
  };

  return (
    <div className={`open-source-template-frame-shell open-source-template-frame-shell-${variant}`} data-preview-state={loadState}>
      <iframe
        ref={frameRef}
        key={`${templateId}:${pagePath || "index"}:${attempt}`}
        className={`open-source-template-frame open-source-template-frame-${variant}`}
        src={`/api/templates/${encodeURIComponent(templateId)}/preview?${previewQuery.toString()}`}
        title={`开源模板 ${templateId} 预览`}
        data-page-path={pagePath || "index"}
        data-page-placement={activePage?.placement ?? ""}
        data-preview-hydrated={hydrated ? "true" : "false"}
        data-testid="open-source-template-frame"
        loading={variant === "thumbnail" ? "lazy" : "eager"}
        sandbox="allow-scripts allow-forms"
        onLoad={handleFrameLoad}
        onError={() => reportLoadState("error", `预览没有载入。请重试。${PREVIEW_CHROME_HINT}`)}
      />
      {loadState === "loading" ? (
        <div className="open-source-template-frame-loading" data-testid="preview-load-progress" aria-hidden="true">
          <span />
        </div>
      ) : null}
      {loadState === "error" ? (
        <div className="open-source-template-frame-error" role="alert" data-testid="preview-load-error">
          <strong>预览暂时无法显示</strong>
          <span>{loadError || "预览载入失败。"}</span>
          <button className="secondary-button" type="button" onClick={retry}>重试</button>
        </div>
      ) : null}
    </div>
  );
}
