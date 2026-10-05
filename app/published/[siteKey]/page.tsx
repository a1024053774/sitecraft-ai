import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getExistingSite } from "@/lib/site-store";
import { listSiteImages, publicImagePayload } from "@/lib/site-images";
import { normalizeDraft } from "@/lib/site-model";
import { findSitePage } from "@/lib/template-pages";
import { PublishedSiteClient } from "./published-client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PublishedSearch = { page?: string | string[] };

function firstQuery(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function localizeText(value: unknown, locale: "zh" | "en" = "zh") {
  if (typeof value === "string") return value.trim();
  if (!value || typeof value !== "object") return "";
  const record = value as Record<string, unknown>;
  const preferred = record[locale];
  if (typeof preferred === "string" && preferred.trim()) return preferred.trim();
  const fallback = record.zh ?? record.en;
  return typeof fallback === "string" ? fallback.trim() : "";
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ siteKey: string }>;
}): Promise<Metadata> {
  const { siteKey } = await params;
  try {
    const site = await getExistingSite(siteKey);
    if (!site) return { title: siteKey };
    const draft = normalizeDraft(site.draft);
    const title = (draft.companyName || draft.siteName || siteKey).trim() || siteKey;
    const description = localizeText(draft.content?.hero?.subtitle)
      || localizeText(draft.visualBrief?.summary)
      || undefined;
    return {
      title,
      ...(description ? { description } : {}),
    };
  } catch {
    return { title: siteKey };
  }
}

export default async function PublishedSitePage({
  params,
  searchParams,
}: {
  params: Promise<{ siteKey: string }>;
  searchParams?: Promise<PublishedSearch> | PublishedSearch;
}) {
  const { siteKey } = await params;
  const query = searchParams && typeof searchParams === "object" && "then" in searchParams
    ? await searchParams
    : searchParams ?? {};
  const site = await getExistingSite(siteKey);
  if (!site) notFound();
  const initialDraft = normalizeDraft(site.draft);
  const requestedPage = firstQuery(query.page);
  const page = findSitePage(initialDraft.pagePlan, requestedPage);
  const images = (await listSiteImages(siteKey)).map(publicImagePayload);
  return (
    <PublishedSiteClient
      siteKey={siteKey}
      initialDraft={initialDraft}
      initialPageId={page?.id ?? "home"}
      initialImages={images}
    />
  );
}
