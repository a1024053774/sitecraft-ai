"use client";

import { useEffect, useState } from "react";
import { OpenSourceTemplateFrame, type PreviewImage } from "@/components/open-source-template-frame";
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
  initialImages,
}: {
  siteKey: string;
  initialDraft: SiteDraft;
  initialPageId: string;
  initialImages: PreviewImage[];
}) {
  const draft = normalizeDraft(initialDraft);
  const offersEnglish = draftOffersVisitorEnglish(draft);
  const [locale, setLocale] = useState<Locale>("zh");
  const [activePageId, setActivePageId] = useState(initialPageId);
  const [hydrated, setHydrated] = useState(false);

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
  ): Promise<{ ok: boolean; message: string }> => {
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
      return { ok: true, message: locale === "zh" ? "询盘已发送。" : "Your inquiry has been sent." };
    } catch (error) {
      return {
        ok: false,
        message: userFacingError({ message: error instanceof Error ? error.message : null }, locale === "zh" ? "询盘未保存" : "Inquiry was not saved"),
      };
    }
  };

  return (
    <main
      className="published-template-shell published-template-shell-bare"
      data-preview-hydrated={hydrated ? "true" : "false"}
      data-site-key={siteKey}
      data-offers-english={offersEnglish ? "true" : "false"}
      data-testid="published-template-shell"
    >
      <link rel="stylesheet" href="/visitor-host.css" />
      <div className="published-template-stage">
        <OpenSourceTemplateFrame
          templateId={draft.templateId}
          draft={draft}
          images={initialImages}
          locale={locale}
          variant="published"
          offersVisitorEnglish={offersEnglish}
          pagePath={previewPathForPage(activePage)}
          activePage={activePage}
          onLocaleChange={setLocale}
          onApplyReport={() => setHydrated(true)}
          onInquiry={postInquiry}
        />
      </div>
    </main>
  );
}
