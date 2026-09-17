import { mkdir, readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { requestPreviewReview, requestStructuredOperations } from "./ai-provider.ts";
import { defaultDraft } from "./site-document.ts";
import { commitOperations, getSite } from "./site-store.ts";
import { inspectPreviewScreenshot, type PreviewReview } from "./preview-vision.ts";
import type { SiteOperation } from "./site-operations.ts";
import {
  QUALITY_BASELINE,
  buildQualityFixMessage,
  buildQualityMaterialsMessage,
  compareLookVsCopy,
  copyFingerprint,
  draftShowsPackNonce,
  filterLimitedFixOperations,
  lookFingerprint,
  qualityRecipe,
  type CopyFingerprint,
  type LookFingerprint,
  type LookVsCopy,
  type QualityGroupId,
  type QualityPackId,
} from "./quality-comparison.ts";

const resultRoot = path.join(process.cwd(), ".sitecraft-data", "quality", "p4");
const artifactRoot = path.join(process.cwd(), "artifacts", "p4-quality-comparison");
const MAX_FIX_ROUNDS = 2;

export type QualityStep = { name: string; status: "ok" | "skip" | "fail"; detail: string };

export type QualityCellResult = {
  cellId: string;
  packId: QualityPackId;
  group: QualityGroupId;
  siteId: string;
  ok: boolean;
  live: boolean;
  unverified: string[];
  error?: string;
  model: string | null;
  latencyMs: number;
  revision: number;
  nonceVisible: boolean;
  steps: QualityStep[];
  look: LookFingerprint;
  copy: CopyFingerprint;
  lookVsDefault: LookVsCopy;
  rejected: string[];
  review: PreviewReview | null;
  fixRounds: number;
  baseline: typeof QUALITY_BASELINE;
  savedAt: string;
};

function resultPath(cellId: string) {
  return path.join(resultRoot, `${cellId}.json`);
}

export async function readQualityResult(cellId: string): Promise<QualityCellResult | null> {
  try {
    return JSON.parse(await readFile(resultPath(cellId), "utf8")) as QualityCellResult;
  } catch {
    return null;
  }
}

async function saveQualityResult(result: QualityCellResult) {
  await mkdir(resultRoot, { recursive: true });
  await writeFile(resultPath(result.cellId), `${JSON.stringify(result, null, 2)}\n`, "utf8");
}

async function commit(siteId: string, baseRevision: number, operations: SiteOperation[], summary: string, source: "ai" | "template") {
  return commitOperations({ siteId, baseRevision, operations, summary, source });
}

export async function capturePublishedPng(origin: string, siteId: string): Promise<{ bytes: Uint8Array | null; file: string | null; error: string }> {
  const chrome = process.env.QUALITY_CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  await mkdir(artifactRoot, { recursive: true });
  const file = path.join(artifactRoot, `${siteId}-review.png`);
  const url = `${origin.replace(/\/$/, "")}/published/${encodeURIComponent(siteId)}`;
  const args = [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--no-first-run",
    "--no-default-browser-check",
    "--window-size=1440,900",
    `--screenshot=${file}`,
    "--virtual-time-budget=12000",
    "--timeout=20000",
    url,
  ];
  const error = await new Promise<string>((resolve) => {
    const child = spawn(/* turbopackIgnore: true */ chrome, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      resolve("截图超时");
    }, 25_000);
    child.stderr.on("data", (chunk) => { stderr += String(chunk); });
    child.on("error", (err) => {
      clearTimeout(timer);
      resolve(err.message);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve(code === 0 ? "" : stderr.trim() || `chrome 退出码 ${code}`);
    });
  });
  if (error) return { bytes: null, file: null, error };
  try {
    const bytes = new Uint8Array(await readFile(file));
    inspectPreviewScreenshot(bytes);
    return { bytes, file, error: "" };
  } catch (err) {
    return { bytes: null, file: null, error: err instanceof Error ? err.message : "截图无法作为真实首屏" };
  }
}

export async function runQualityCell(args: {
  packId: QualityPackId;
  group: QualityGroupId;
  previewOrigin?: string | null;
  screenshotBytes?: Uint8Array | null;
  reviewOnly?: boolean;
}): Promise<QualityCellResult> {
  const startedAt = Date.now();
  const recipe = qualityRecipe(args.packId, args.group);
  const { cell, pack } = recipe;
  const steps: QualityStep[] = [];
  const unverified: string[] = [];
  const rejected: string[] = [];
  let model: string | null = null;
  let review: PreviewReview | null = null;
  let fixRounds = 0;
  let live = false;
  let error: string | undefined;

  const fail = async (message: string, extra?: Partial<QualityCellResult>): Promise<QualityCellResult> => {
    const snapshot = await getSite(cell.siteId);
    const result: QualityCellResult = {
      cellId: cell.cellId,
      packId: cell.packId,
      group: cell.group,
      siteId: cell.siteId,
      ok: false,
      live,
      unverified,
      error: message,
      model,
      latencyMs: Date.now() - startedAt,
      revision: snapshot.draft.revision,
      nonceVisible: draftShowsPackNonce(snapshot.draft, pack),
      steps,
      look: lookFingerprint(snapshot.draft),
      copy: copyFingerprint(snapshot.draft),
      lookVsDefault: compareLookVsCopy(defaultDraft, snapshot.draft),
      rejected,
      review,
      fixRounds,
      baseline: QUALITY_BASELINE,
      savedAt: new Date().toISOString(),
      ...extra,
    };
    await saveQualityResult(result);
    return result;
  };

  try {
    let current = await getSite(cell.siteId);
    if (!args.reviewOnly) {
      const resetOps: SiteOperation[] = [
        { op: "replace_draft", draft: structuredClone(defaultDraft) },
        ...recipe.preOps,
      ];
      const prepared = await commit(cell.siteId, current.draft.revision, resetOps, `P4 ${cell.group} 重置并套用流程前置`, "template");
      if (prepared.status === "conflict") {
        steps.push({ name: "reset", status: "fail", detail: "revision conflict" });
        return fail("草稿版本冲突，未覆盖已有结果");
      }
      current = await getSite(cell.siteId);
      steps.push({
        name: "reset",
        status: "ok",
        detail: recipe.lookBriefId ? `look=${recipe.lookBriefId} template=${current.draft.templateId}` : `default ${current.draft.templateId}`,
      });

      const provider = await requestStructuredOperations({
        message: buildQualityMaterialsMessage(pack),
        draft: current.draft,
        templateId: current.draft.templateId,
      });
      live = true;
      if (!provider.ok) {
        steps.push({ name: "generate", status: "fail", detail: provider.error });
        return fail(provider.error, { model: provider.model, latencyMs: provider.latencyMs });
      }
      model = provider.model;
      if (provider.type !== "edit") {
        const detail = provider.type === "answer" ? provider.text : provider.question;
        steps.push({ name: "generate", status: "fail", detail: `${provider.type}: ${detail}` });
        return fail(`生成返回 ${provider.type}，没有写入草稿`);
      }
      rejected.push(...provider.rejected);
      const generated = await commit(cell.siteId, current.draft.revision, provider.operations, provider.summary, "ai");
      if (generated.status === "conflict") {
        steps.push({ name: "generate", status: "fail", detail: "revision conflict" });
        return fail("生成时草稿已被更新");
      }
      current = await getSite(cell.siteId);
      steps.push({
        name: "generate",
        status: generated.status === "applied" ? "ok" : "fail",
        detail: generated.status === "applied"
          ? `rev=${current.draft.revision} targets=${generated.changeSet.appliedTargets.join(",") || "none"}`
          : generated.status,
      });
      if (generated.status !== "applied") return fail("生成没有产生可保存的草稿修改");
    } else {
      current = await getSite(cell.siteId);
      if (!draftShowsPackNonce(current.draft, pack)) {
        steps.push({ name: "generate", status: "fail", detail: "missing nonce" });
        return fail("还没有生成结果，不能只审查");
      }
      steps.push({ name: "reset", status: "skip", detail: "review-only" });
      steps.push({ name: "generate", status: "skip", detail: "review-only" });
    }

    if (recipe.reviewAndFix) {
      let screenshot = args.screenshotBytes ?? null;
      if (!screenshot && args.previewOrigin) {
        const captured = await capturePublishedPng(args.previewOrigin, cell.siteId);
        if (captured.bytes) {
          screenshot = captured.bytes;
          steps.push({ name: "capture", status: "ok", detail: captured.file ?? "png" });
        } else {
          steps.push({ name: "capture", status: "fail", detail: captured.error });
          unverified.push("D 组没有可用的真实预览截图，审查未跑");
        }
      } else if (!screenshot) {
        steps.push({ name: "capture", status: "skip", detail: "no origin" });
        unverified.push("D 组没有可用的真实预览截图，审查未跑");
      }

      if (screenshot) {
        const reviewed = await requestPreviewReview({
          imageBytes: screenshot,
          claimedTemplateId: current.draft.templateId,
        });
        live = true;
        if (!reviewed.ok) {
          steps.push({ name: "review", status: "fail", detail: reviewed.error });
          unverified.push(`预览审查失败：${reviewed.error}`);
        } else {
          review = reviewed.review;
          model = reviewed.model;
          steps.push({
            name: "review",
            status: "ok",
            detail: `mismatches=${reviewed.review.imageTextMismatches.length} nonce=${reviewed.review.nonce ?? "null"}`,
          });
          const reviewJson = JSON.stringify(reviewed.review);
          for (let round = 0; round < MAX_FIX_ROUNDS; round += 1) {
            if (round > 0 && reviewed.review.imageTextMismatches.length === 0) break;
            const fixer = await requestStructuredOperations({
              message: buildQualityFixMessage(reviewJson),
              draft: current.draft,
              templateId: current.draft.templateId,
            });
            if (!fixer.ok) {
              steps.push({ name: `fix-${round + 1}`, status: "fail", detail: fixer.error });
              break;
            }
            if (fixer.type !== "edit") {
              steps.push({ name: `fix-${round + 1}`, status: "skip", detail: fixer.type });
              break;
            }
            const filtered = filterLimitedFixOperations(fixer.operations);
            rejected.push(...fixer.rejected, ...filtered.rejected);
            if (!filtered.operations.length) {
              steps.push({ name: `fix-${round + 1}`, status: "skip", detail: "no whitelist ops" });
              break;
            }
            const fixed = await commit(cell.siteId, current.draft.revision, filtered.operations, fixer.summary, "ai");
            if (fixed.status !== "applied") {
              steps.push({ name: `fix-${round + 1}`, status: "skip", detail: fixed.status });
              break;
            }
            current = await getSite(cell.siteId);
            fixRounds += 1;
            model = fixer.model;
            steps.push({ name: `fix-${round + 1}`, status: "ok", detail: `targets=${fixed.changeSet.appliedTargets.join(",")}` });
            break;
          }
        }
      }
    } else {
      steps.push({ name: "review", status: "skip", detail: `${cell.group} 不审查` });
    }

    const snapshot = await getSite(cell.siteId);
    const nonceVisible = draftShowsPackNonce(snapshot.draft, pack);
    const result: QualityCellResult = {
      cellId: cell.cellId,
      packId: cell.packId,
      group: cell.group,
      siteId: cell.siteId,
      ok: nonceVisible,
      live,
      unverified,
      error: nonceVisible ? undefined : "草稿里没有出现资料核验记号",
      model,
      latencyMs: Date.now() - startedAt,
      revision: snapshot.draft.revision,
      nonceVisible,
      steps,
      look: lookFingerprint(snapshot.draft),
      copy: copyFingerprint(snapshot.draft),
      lookVsDefault: compareLookVsCopy(defaultDraft, snapshot.draft),
      rejected,
      review,
      fixRounds,
      baseline: QUALITY_BASELINE,
      savedAt: new Date().toISOString(),
    };
    await saveQualityResult(result);
    return result;
  } catch (err) {
    steps.push({ name: "run", status: "fail", detail: err instanceof Error ? err.message : "unknown" });
    return fail(err instanceof Error ? err.message : "对照格子执行失败");
  }
}
