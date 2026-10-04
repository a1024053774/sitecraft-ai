import { loadQualityMatrix } from "@/lib/quality-matrix";
import { QualityComparisonClient } from "./quality-client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type QualitySearch = { blind?: string | string[]; seed?: string | string[] };

function firstQuery(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function QualityPage({
  searchParams,
}: {
  searchParams?: Promise<QualitySearch> | QualitySearch;
}) {
  const params = searchParams && typeof searchParams === "object" && "then" in searchParams
    ? await searchParams
    : searchParams ?? {};
  const payload = await loadQualityMatrix();
  const seedValue = Number(firstQuery(params.seed));
  return (
    <QualityComparisonClient
      initial={payload}
      initialBlind={firstQuery(params.blind) === "1"}
      initialSeed={Number.isInteger(seedValue) && seedValue > 0 ? seedValue : 18}
    />
  );
}
