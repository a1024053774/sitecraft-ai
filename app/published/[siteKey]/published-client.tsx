"use client";

import { useEffect, useState } from "react";
import { OpenSourceTemplateFrame } from "@/components/open-source-template-frame";
import { draftOffersVisitorEnglish } from "@/lib/draft-english";
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
  const offersEnglish = draftOffersVisitorEnglish(draft);
  const [locale, setLocale] = useState<Locale>("zh");
  const [activePageId, setActivePageId] = useState(initialPageId);
  const [hydrated, setHydrated] = useState(false);
  const [inquiryStatus, setInquiryStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [inquiryError, setInquiryError] = useState("");

  useEffect(() => {
    setHydrated(false);
    setActivePageId(initialPageId);
  }, [initialPageId, siteKey]);

  useEffect(() => {
    if (!offersEnglish && locale === "en") setLocale("zh");
  }, [offersEnglish, locale]);

  const activePage = findSitePage(draft.pagePlan, activePageId);

  const postInquiry = async (
    fields: { name: string; email: string; company: string; message: string; honeypot: string },
  ) => {
    setInquiryStatus("sending");
    setInquiryError("");
    try {
      const response = await fetch(`/api/public/${encodeURIComponent(siteKey)}/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      const payload = await response.json() as {
        id?: string;
        error?: string;
        code?: string;
        userMessage?: string;
        recovery?: string;
      };
      if (!response.ok || !payload.id) {
        throw new Error(userFacingError({
          code: payload.code,
          message: payload.error,
          userMessage: payload.userMessage,
          recovery: payload.recovery,
        }, locale === "zh" ? "询盘未保存" : "Inquiry was not saved"));
      }
      setInquiryStatus("sent");
    } catch (error) {
      setInquiryStatus("error");
      setInquiryError(userFacingError({
        message: error instanceof Error ? error.message : null,
      }, "询盘未保存"));
    }
  };

  return (
    <main
      className="published-template-shell published-template-shell-bare"
      data-preview-hydrated={hydrated ? "true" : "false"}
      data-site-key={siteKey}
      data-offers-english={offersEnglish ? "true" : "false"}
      data-inquiry-status={inquiryStatus}
      data-testid="published-template-shell"
    >
      <div className="published-template-stage">
        <OpenSourceTemplateFrame
          templateId={draft.templateId}
          draft={draft}
          locale={locale}
          variant="published"
          offersVisitorEnglish={offersEnglish}
          pagePath={previewPathForPage(activePage)}
          activePage={activePage}
          onLocaleChange={setLocale}
          onApplyReport={() => setHydrated(true)}
          onInquiry={(fields) => {
            void postInquiry(fields);
          }}
        />
      </div>
      {inquiryStatus === "error" ? (
        <p className="published-inquiry-error" role="alert" data-testid="published-inquiry-error">
          {inquiryError}
        </p>
      ) : null}
    </main>
  );
}
