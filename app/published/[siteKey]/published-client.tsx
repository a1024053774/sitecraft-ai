"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import type { Route } from "next";
import { OpenSourceTemplateFrame } from "@/components/open-source-template-frame";
import {
  normalizeDraft,
  type Locale,
  type SiteDraft,
} from "@/lib/site-model";
import { findSitePage, previewPathForPage } from "@/lib/template-pages";
import { userFacingError } from "@/lib/user-errors";

export function PublishedSiteClient({
  siteKey,
  initialDraft,
  initialPageId,
}: {
  siteKey: string;
  initialDraft: SiteDraft;
  initialPageId: string;
}) {
  const draft = normalizeDraft(initialDraft);
  const [locale, setLocale] = useState<Locale>("zh");
  const [activePageId, setActivePageId] = useState(initialPageId);
  const [hydrated, setHydrated] = useState(false);
  const [inquiryStatus, setInquiryStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [inquiryError, setInquiryError] = useState("");
  const [inquiryId, setInquiryId] = useState("");
  const [deliveryWarning, setDeliveryWarning] = useState(false);

  useEffect(() => {
    setHydrated(false);
    setActivePageId(initialPageId);
  }, [initialPageId, siteKey]);

  const activePage = findSitePage(draft.pagePlan, activePageId);
  const selectPage = (pageId: string) => {
    setHydrated(false);
    setActivePageId(pageId);
    const url = new URL(window.location.href);
    url.searchParams.set("page", pageId);
    window.history.replaceState(null, "", url);
  };

  const postInquiry = async (
    fields: { name: string; email: string; company: string; message: string; honeypot: string },
    form?: HTMLFormElement,
  ) => {
    setInquiryStatus("sending");
    setInquiryError("");
    setDeliveryWarning(false);
    try {
      const response = await fetch(`/api/public/${encodeURIComponent(siteKey)}/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      const payload = await response.json() as { id?: string; error?: string; code?: string; userMessage?: string; recovery?: string; deliveryWarning?: string };
      if (!response.ok || !payload.id) {
        throw new Error(userFacingError({ code: payload.code, message: payload.error, userMessage: payload.userMessage, recovery: payload.recovery }, locale === "zh" ? "询盘未保存" : "Inquiry was not saved"));
      }
      setInquiryId(payload.id);
      setDeliveryWarning(Boolean(payload.deliveryWarning));
      setInquiryStatus("sent");
      form?.reset();
    } catch (error) {
      setInquiryStatus("error");
      setInquiryError(userFacingError({ message: error instanceof Error ? error.message : null }, "询盘未保存"));
    }
  };

  return (
    <main
      className="published-template-shell"
      data-preview-hydrated={hydrated ? "true" : "false"}
      data-site-key={siteKey}
      data-testid="published-template-shell"
    >
      <div className="published-chrome-bar" data-testid="published-chrome-bar">
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
        <div className="published-template-locale" aria-label="站点语言">
          <button className={locale === "zh" ? "active" : ""} onClick={() => setLocale("zh")}>中</button>
          <button className={locale === "en" ? "active" : ""} onClick={() => setLocale("en")}>EN</button>
        </div>
      </div>
      <div className="published-template-stage">
        <OpenSourceTemplateFrame
          templateId={draft.templateId}
          draft={draft}
          locale={locale}
          variant="published"
          pagePath={previewPathForPage(activePage)}
          activePage={activePage}
          onApplyReport={() => setHydrated(true)}
          onInquiry={(fields) => {
            void postInquiry(fields);
          }}
        />
      </div>
      <details className="published-inquiry" data-testid="published-inquiry">
        <summary>{locale === "zh" ? "发送询盘" : "Send inquiry"}</summary>
        <p>
          {locale === "zh"
            ? "这条表单写入工作区收件箱。模板自带演示表单不会送达。"
            : "This form is stored in the workspace inbox. Demo forms inside the template are not delivered."}
        </p>
        {inquiryStatus === "sent" ? (
          <div className="published-inquiry-success" data-testid="published-inquiry-success">
            <strong>{locale === "zh" ? "已写入收件箱" : "Saved to inbox"}</strong>
            <span>{inquiryId}</span>
            {deliveryWarning ? <p role="status">{locale === "zh"
              ? "留言已保存，邮件转发结果尚未确认。无需重复提交。"
              : "Your message is saved. Email forwarding is unconfirmed. Please do not submit it again."}</p> : null}
            <Link href={`/leads?site=${encodeURIComponent(siteKey)}` as Route}>
              {locale === "zh" ? "打开询盘线索" : "Open inbox"}
            </Link>
          </div>
        ) : (
          <form
            className="published-inquiry-form"
            data-testid="published-inquiry-form"
            onSubmit={async (event: FormEvent<HTMLFormElement>) => {
              event.preventDefault();
              const form = event.currentTarget;
              const data = new FormData(form);
              await postInquiry({
                name: String(data.get("name") ?? ""),
                email: String(data.get("email") ?? ""),
                company: String(data.get("company") ?? ""),
                message: String(data.get("message") ?? ""),
                honeypot: String(data.get("honeypot") ?? ""),
              }, form);
            }}
          >
            <label>
              {locale === "zh" ? "姓名" : "Name"}
              <input name="name" required maxLength={80} autoComplete="name" />
            </label>
            <label>
              {locale === "zh" ? "邮箱" : "Email"}
              <input name="email" type="email" required maxLength={160} autoComplete="email" />
            </label>
            <label>
              {locale === "zh" ? "公司" : "Company"}
              <input name="company" maxLength={120} autoComplete="organization" />
            </label>
            <label>
              {locale === "zh" ? "留言" : "Message"}
              <textarea name="message" required maxLength={4000} rows={4} />
            </label>
            <input className="honeypot" name="honeypot" tabIndex={-1} autoComplete="off" />
            {inquiryStatus === "error" ? (
              <p className="published-inquiry-error" role="alert" data-testid="published-inquiry-error">{inquiryError}</p>
            ) : null}
            <button className="primary-button" type="submit" disabled={inquiryStatus === "sending"}>
              {inquiryStatus === "sending"
                ? (locale === "zh" ? "发送中…" : "Sending…")
                : (locale === "zh" ? "发送到收件箱" : "Send to inbox")}
            </button>
          </form>
        )}
      </details>
    </main>
  );
}
