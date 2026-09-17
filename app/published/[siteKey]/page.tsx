import { getSite } from "@/lib/site-store";
import { normalizeDraft } from "@/lib/site-model";
import { findSitePage } from "@/lib/template-pages";
import { PublishedSiteClient } from "./published-client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PublishedSearch = { page?: string | string[] };

function firstQuery(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
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
  const site = await getSite(siteKey);
  const initialDraft = normalizeDraft(site.draft);
  const requestedPage = firstQuery(query.page);
  const page = findSitePage(initialDraft.pagePlan, requestedPage);
  return (
    <PublishedSiteClient
      siteKey={siteKey}
      initialDraft={initialDraft}
      initialPageId={page?.id ?? "home"}
    />
  );
}
