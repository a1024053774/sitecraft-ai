import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
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
export const PREVIEW_HYDRATED_SELECTOR = '[data-preview-hydrated="true"]';
export const QUALITY_FIRST_SCREEN = { width: 960, height: 420 };

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

type CdpResult = { result?: { value?: unknown } };

class CdpSession {
  private seq = 0;
  private pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();
  private ws: WebSocket;

  constructor(ws: WebSocket) {
    this.ws = ws;
    ws.addEventListener("message", (event) => {
      const payload = JSON.parse(String(event.data)) as {
        id?: number;
        result?: unknown;
        error?: { message?: string };
      };
      if (typeof payload.id !== "number") return;
      const waiter = this.pending.get(payload.id);
      if (!waiter) return;
      this.pending.delete(payload.id);
      if (payload.error) waiter.reject(new Error(payload.error.message || "CDP error"));
      else waiter.resolve(payload.result);
    });
  }

  send<T>(method: string, params?: Record<string, unknown>) {
    const id = ++this.seq;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`${method} 超时`));
      }, 20_000);
      this.pending.set(id, {
        resolve: (value) => {
          clearTimeout(timer);
          resolve(value as T);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
      });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function openCdpSocket(url: string) {
  const ws = new WebSocket(url);
  await new Promise<void>((resolve, reject) => {
    ws.addEventListener("open", () => resolve(), { once: true });
    ws.addEventListener("error", () => reject(new Error("无法连接 Chrome DevTools")), { once: true });
  });
  return ws;
}

async function waitForChromeWs(chrome: string, profile: string) {
  let stderr = "";
  let wsUrl = "";
  const child = spawn(/* turbopackIgnore: true */ chrome, [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--no-first-run",
    "--no-default-browser-check",
    "--remote-debugging-port=0",
    `--user-data-dir=${profile}`,
    `--window-size=${QUALITY_FIRST_SCREEN.width},${QUALITY_FIRST_SCREEN.height + 120}`,
    "about:blank",
  ], { stdio: ["ignore", "pipe", "pipe"] });
  const onOutput = (chunk: Buffer) => {
    const text = String(chunk);
    stderr += text;
    const match = /DevTools listening on (ws:\/\/\S+)/.exec(stderr);
    if (match?.[1]) wsUrl = match[1];
  };
  child.stdout.on("data", onOutput);
  child.stderr.on("data", onOutput);
  const started = Date.now();
  while (!wsUrl && Date.now() - started < 15_000) {
    if (child.exitCode != null) throw new Error(stderr.trim() || `chrome 退出码 ${child.exitCode}`);
    await sleep(100);
  }
  if (!wsUrl) {
    child.kill("SIGKILL");
    throw new Error(stderr.trim() || "Chrome 没有给出 DevTools 地址");
  }
  return { child, wsUrl, stderr };
}

async function waitForExpression(cdp: CdpSession, expression: string, timeoutMs: number, label: string) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const evaluated = await cdp.send<CdpResult>("Runtime.evaluate", { expression, returnByValue: true });
    if (evaluated.result?.value) return;
    await sleep(250);
  }
  throw new Error(label);
}

function clipFromBox(content: number[] | undefined) {
  if (!content || content.length < 8) return null;
  const xs = [content[0], content[2], content[4], content[6]].filter((value): value is number => typeof value === "number");
  const ys = [content[1], content[3], content[5], content[7]].filter((value): value is number => typeof value === "number");
  if (xs.length < 4 || ys.length < 4) return null;
  const x = Math.max(0, Math.min(...xs));
  const y = Math.max(0, Math.min(...ys));
  const width = Math.min(QUALITY_FIRST_SCREEN.width, Math.max(...xs) - x);
  const height = Math.min(QUALITY_FIRST_SCREEN.height, Math.max(...ys) - y);
  if (width < 320 || height < 200) return null;
  return { x, y, width, height, scale: 1 };
}

export async function capturePublishedPng(origin: string, siteId: string): Promise<{ bytes: Uint8Array | null; file: string | null; error: string }> {
  const chrome = process.env.QUALITY_CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  await mkdir(artifactRoot, { recursive: true });
  const file = path.join(artifactRoot, `${siteId}-review.png`);
  const url = `${origin.replace(/\/$/, "")}/published/${encodeURIComponent(siteId)}`;
  const profile = await mkdtemp(path.join(tmpdir(), "sitecraft-quality-"));
  let child: ReturnType<typeof spawn> | null = null;
  let ws: WebSocket | null = null;
  try {
    const launched = await waitForChromeWs(chrome, profile);
    child = launched.child;
    const parsed = new URL(launched.wsUrl.replace(/^ws:/, "http:"));
    const list = await waitForExpressionReady(async () => {
      const response = await fetch(`http://127.0.0.1:${parsed.port}/json/list`);
      if (!response.ok) return null;
      const targets = await response.json() as Array<{ type?: string; webSocketDebuggerUrl?: string }>;
      return targets.find((target) => target.type === "page" && target.webSocketDebuggerUrl)?.webSocketDebuggerUrl ?? null;
    }, 10_000, "Chrome 没有可用的页面目标");
    ws = await openCdpSocket(list);
    const cdp = new CdpSession(ws);
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("DOM.enable");
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: QUALITY_FIRST_SCREEN.width,
      height: QUALITY_FIRST_SCREEN.height + 120,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await cdp.send("Page.navigate", { url });
    await waitForExpression(
      cdp,
      `location.pathname.indexOf("/published/") === 0 && document.readyState === "complete"`,
      15_000,
      "发布页没有完成加载",
    );
    await waitForExpression(
      cdp,
      `Boolean(document.querySelector(${JSON.stringify(PREVIEW_HYDRATED_SELECTOR)}))`,
      20_000,
      "预览 iframe 未完成草稿落点，拒绝把未写入槽位的模板壳拿去审查",
    );
    await sleep(400);
    let clip = {
      x: 0,
      y: 0,
      width: QUALITY_FIRST_SCREEN.width,
      height: QUALITY_FIRST_SCREEN.height,
      scale: 1,
    };
    try {
      const documentNode = await cdp.send<{ root: { nodeId: number } }>("DOM.getDocument", { depth: 1 });
      const iframe = await cdp.send<{ nodeId: number }>("DOM.querySelector", {
        nodeId: documentNode.root.nodeId,
        selector: "iframe.open-source-template-frame",
      });
      if (iframe.nodeId) {
        const box = await cdp.send<{ model?: { content: number[] } }>("DOM.getBoxModel", { nodeId: iframe.nodeId });
        const next = clipFromBox(box.model?.content);
        if (next) clip = next;
      }
    } catch {
      // Fall back to the first-screen viewport clip.
    }
    const shot = await cdp.send<{ data: string }>("Page.captureScreenshot", {
      format: "png",
      clip,
      fromSurface: true,
      captureBeyondViewport: false,
    });
    const bytes = new Uint8Array(Buffer.from(shot.data, "base64"));
    inspectPreviewScreenshot(bytes);
    await writeFile(file, bytes);
    return { bytes, file, error: "" };
  } catch (err) {
    return { bytes: null, file: null, error: err instanceof Error ? err.message : "截图无法作为真实首屏" };
  } finally {
    ws?.close();
    child?.kill("SIGKILL");
    await rm(profile, { recursive: true, force: true }).catch(() => undefined);
  }
}

async function waitForExpressionReady<T>(read: () => Promise<T | null>, timeoutMs: number, label: string) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const value = await read();
      if (value) return value;
    } catch {
      // Chrome JSON endpoint is not up yet.
    }
    await sleep(150);
  }
  throw new Error(label);
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
