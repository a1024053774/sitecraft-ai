"use client";

import Link from "next/link";
import type { Route } from "next";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { OpenSourceTemplateFrame } from "@/components/open-source-template-frame";
import {
  QUALITY_SCORE_DIMENSIONS,
  presentPackCells,
  type QualityGroupId,
  type QualityPackId,
  type QualityScoreDimension,
} from "@/lib/quality-comparison";
import { normalizeDraft, type SiteDraft } from "@/lib/site-model";

type CellView = {
  cellId: string;
  packId: QualityPackId;
  group: QualityGroupId;
  siteId: string;
  draft: {
    revision: number;
    templateId: string;
    visualBrief: { id: string; label: string; templateId: string };
    companyName: string;
    heroTitle: string;
    nonceVisible: boolean;
    lookVsDefault: string;
  };
  previewDraft?: SiteDraft;
  result: {
    ok: boolean;
    live: boolean;
    unverified: string[];
    error?: string;
  } | null;
};

type QualityPayload = {
  baseline: {
    model: string;
    toneVersion: string;
    frozenHead: string;
  };
  provider: { configured: boolean; model: string | null };
  packs: Array<{ id: QualityPackId; label: string; nonce: string; industry: string }>;
  groups: Array<{ id: QualityGroupId; label: string; process: string }>;
  cells: CellView[];
  packComparisons: Array<{ packId: QualityPackId; aVsB: string; bVsC: string; cVsD: string }>;
};

type ScoreCard = Record<QualityScoreDimension, number>;
type ScoreMap = Record<string, ScoreCard>;

const SCORE_KEY = "sitecraft-quality-scores-p4";

function emptyScore(): ScoreCard {
  return { industry: 0, difference: 0, readability: 0, imageText: 0, action: 0 };
}

function readScores(): ScoreMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(SCORE_KEY);
    return raw ? JSON.parse(raw) as ScoreMap : {};
  } catch {
    return {};
  }
}

function draftsFromPayload(payload: QualityPayload) {
  const loaded: Record<string, SiteDraft> = {};
  for (const cell of payload.cells) {
    if (cell.previewDraft && cell.draft.nonceVisible) {
      loaded[cell.siteId] = normalizeDraft(cell.previewDraft);
    }
  }
  return loaded;
}

export function QualityComparisonClient({
  initial,
  initialBlind = false,
  initialSeed = 18,
}: {
  initial: QualityPayload;
  initialBlind?: boolean;
  initialSeed?: number;
}) {
  const [payload, setPayload] = useState<QualityPayload>(initial);
  const [drafts, setDrafts] = useState<Record<string, SiteDraft>>(() => draftsFromPayload(initial));
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [blind, setBlind] = useState(initialBlind);
  const [seed, setSeed] = useState(initialSeed);
  const [scores, setScores] = useState<ScoreMap>({});
  const [note, setNote] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const reload = useCallback(async () => {
    const response = await fetch("/api/quality/cells", { cache: "no-store" });
    const next = await response.json() as QualityPayload & { error?: string };
    if (!response.ok) throw new Error(next.error || "无法读取对照矩阵");
    setPayload(next);
    setDrafts(draftsFromPayload(next));
  }, []);

  useEffect(() => {
    setScores(readScores());
    const params = new URLSearchParams(window.location.search);
    if (params.get("blind") === "1") setBlind(true);
    const seedParam = Number(params.get("seed"));
    if (Number.isInteger(seedParam) && seedParam > 0) setSeed(seedParam);
    void reload().catch((err: unknown) => setError(err instanceof Error ? err.message : "读取失败"));
  }, [reload]);

  const togglePreview = (siteId: string) => {
    setExpanded((current) => ({ ...current, [siteId]: !current[siteId] }));
  };

  const runCell = async (packId: QualityPackId, group: QualityGroupId, reviewOnly = false) => {
    const id = `${packId}-${group}`;
    setBusyId(id);
    setError("");
    setNote(reviewOnly ? `正在审查 ${id}…` : `正在生成 ${id}…`);
    try {
      const response = await fetch("/api/quality/cells", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId, group, reviewOnly }),
      });
      const result = await response.json() as { ok?: boolean; error?: string; unverified?: string[]; live?: boolean };
      if (!response.ok && !result.live) throw new Error(result.error || "生成失败");
      if (result.error) setNote(`${id}：${result.error}${result.unverified?.length ? `；${result.unverified.join("；")}` : ""}`);
      else setNote(`${id} ${result.ok ? "已写入核验记号" : "已跑完但未见到核验记号"}`);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "生成失败");
    } finally {
      setBusyId("");
    }
  };

  const runAll = async () => {
    for (const pack of payload.packs) {
      for (const group of payload.groups) {
        await runCell(pack.id, group.id);
      }
    }
  };

  const runSupplementary = async (action: "style-switch" | "long-title") => {
    setBusyId(action);
    setError("");
    try {
      const response = await fetch("/api/quality/cells", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, sourceSiteId: "p4m-c" }),
      });
      const result = await response.json() as { error?: string; lookVs?: string; length?: number };
      if (!response.ok) throw new Error(result.error || "补充证据失败");
      setNote(action === "style-switch" ? `样式切换：${result.lookVs}` : `超长标题 ${result.length} 字`);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "补充证据失败");
    } finally {
      setBusyId("");
    }
  };

  const saveScore = (cellId: string, dimension: QualityScoreDimension, value: number) => {
    setScores((current) => {
      const next = { ...current, [cellId]: { ...(current[cellId] ?? emptyScore()), [dimension]: value } };
      window.localStorage.setItem(SCORE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const liveCount = payload.cells.filter((cell) => cell.result?.live && cell.draft.nonceVisible).length;
  const scoredCount = Object.values(scores).filter((card) => QUALITY_SCORE_DIMENSIONS.every((item) => card[item.id] > 0)).length;

  const packRows = useMemo(() => {
    return payload.packs.map((pack) => ({
      pack,
      cells: presentPackCells(pack.id, blind, seed).map((presented) => {
        const view = payload.cells.find((item) => item.cellId === presented.cellId);
        return { presented, view };
      }),
    }));
  }, [blind, payload, seed]);

  return (
    <div className="app-shell">
      <AppSidebar active="quality" />
      <main className="main">
        <header className="topbar">
          <div className="breadcrumbs"><span>workspace</span><strong>12组对照</strong></div>
          <div className="top-actions">
            <span className="quality-live-count" data-testid="quality-live-count">{liveCount} / 12 已现场写入记号</span>
          </div>
        </header>
        <div className="page-content quality-page" data-testid="quality-page">
          <div className="hero-row">
            <div>
              <div className="eyebrow">P4 quality comparison</div>
              <h1>12 组对照</h1>
              <p>同一份模拟资料只换流程组。隐藏分组后打乱评分。模型审查不是审美通过证明，作者自评不能外推客户偏好或转化。这不是 Demo 验收。</p>
            </div>
            <div className="quality-actions">
              <button className="primary-button" type="button" data-testid="quality-generate-all" disabled={Boolean(busyId)} onClick={() => { void runAll(); }}>生成 12 组</button>
              <button className={blind ? "primary-button" : "secondary-button"} type="button" data-testid="quality-blind-toggle" onClick={() => setBlind((value) => !value)}>{blind ? "盲评中" : "进入盲评"}</button>
              <button className="secondary-button" type="button" data-testid="quality-shuffle" onClick={() => { setBlind(true); setSeed((value) => value + 1); }}>重新打乱</button>
            </div>
          </div>

          <div className="quality-baseline" data-testid="quality-baseline">
            <span>模型 {payload.baseline.model}</span>
            <span>表达约束冻结 {payload.baseline.toneVersion.split("@").at(-1)}</span>
            <span>冻结 HEAD {payload.baseline.frozenHead}</span>
            <span>{payload.provider.configured ? `已配置 ${payload.provider.model}` : "DeepSeek 未配置，不会伪造成功"}</span>
          </div>

          <p className="quality-disclaimer">评分人：项目负责人（作者自评）。样本很小，阈值未校准。不要据此声称客户满意度、行业真实性或转化率。若格子只改了文案或标签，不能说样子生效。</p>
          {note ? <p className="quality-note" role="status">{note}</p> : null}
          {error ? <p className="quality-error" role="alert">{error}</p> : null}

          {packRows.map(({ pack, cells }) => (
            <section className="quality-pack" key={pack.id} data-testid="quality-pack" data-pack-id={pack.id}>
              <div className="section-heading">
                <h2>{pack.label}</h2>
                <span>核验记号 {pack.nonce} · {pack.industry}</span>
              </div>
              <div className="quality-grid">
                {cells.map(({ presented, view }) => {
                  const draft = drafts[presented.siteId];
                  const running = busyId === `${presented.packId}-${presented.group}`;
                  return (
                    <article
                      className="quality-cell"
                      key={presented.cellId}
                      data-testid="quality-cell"
                      data-cell-id={presented.cellId}
                      data-group={presented.groupHidden ? "hidden" : presented.group}
                    >
                      <header>
                        <strong data-testid="quality-cell-label">{presented.displayLabel}</strong>
                        {presented.groupHidden ? null : <span data-testid="quality-cell-group">{view?.draft.visualBrief.label} / {view?.draft.templateId}</span>}
                      </header>
                      <div className="quality-preview">
                        {expanded[presented.siteId] && draft ? (
                          <OpenSourceTemplateFrame templateId={draft.templateId} draft={draft} locale="zh" variant="thumbnail" />
                        ) : (
                          <div className="quality-empty">{view?.draft.nonceVisible ? "点预览查看模板首屏" : "尚未生成"}</div>
                        )}
                      </div>
                      <dl>
                        <div><dt>公司</dt><dd>{view?.draft.companyName}</dd></div>
                        <div><dt>首屏</dt><dd>{view?.draft.heroTitle}</dd></div>
                        <div><dt>记号</dt><dd>{view?.draft.nonceVisible ? pack.nonce : "未见"}</dd></div>
                        <div><dt>对照默认</dt><dd>{view?.draft.lookVsDefault}</dd></div>
                      </dl>
                      {view?.result?.unverified.length ? <p className="quality-unverified">UNVERIFIED：{view.result.unverified.join("；")}</p> : null}
                      {view?.result?.error ? <p className="quality-error">{view.result.error}</p> : null}
                      <div className="quality-cell-actions">
                        <button className="secondary-button" type="button" data-testid="quality-preview-cell" disabled={!draft} onClick={() => togglePreview(presented.siteId)}>{expanded[presented.siteId] ? "收起预览" : "预览"}</button>
                        <button className="secondary-button" type="button" data-testid="quality-generate-cell" disabled={Boolean(busyId)} onClick={() => { void runCell(presented.packId, presented.group); }}>{running ? "生成中…" : "生成"}</button>
                        {presented.group === "D" ? (
                          <button className="secondary-button" type="button" disabled={Boolean(busyId)} onClick={() => { void runCell(presented.packId, presented.group, true); }}>审查修复</button>
                        ) : null}
                        <Link className="section-link" href={`/workspace?site=${encodeURIComponent(presented.siteId)}` as Route}>工作台</Link>
                      </div>
                      <div className="quality-scores" data-testid="quality-score">
                        {QUALITY_SCORE_DIMENSIONS.map((dimension) => (
                          <label key={dimension.id}>
                            {dimension.label}
                            <select
                              aria-label={`${presented.displayLabel} ${dimension.label}`}
                              value={scores[presented.cellId]?.[dimension.id] ?? 0}
                              onChange={(event) => saveScore(presented.cellId, dimension.id, Number(event.target.value))}
                            >
                              <option value={0}>未评</option>
                              {[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value}</option>)}
                            </select>
                          </label>
                        ))}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}

          <section className="quality-pack">
            <div className="section-heading">
              <h2>流程差（非盲评）</h2>
              <span>已完成评分 {scoredCount} / 12 · 作者自评</span>
            </div>
            <ul className="quality-compare-list" data-testid="quality-pack-comparisons">
              {payload.packComparisons.map((item) => (
                <li key={item.packId}>{item.packId}：A↔B {item.aVsB}；B↔C {item.bVsC}；C↔D {item.cVsD}</li>
              ))}
            </ul>
            {blind ? null : (
              <ul className="quality-compare-list">
                {payload.groups.map((group) => (
                  <li key={group.id}><strong>{group.id} {group.label}</strong>：{group.process}</li>
                ))}
              </ul>
            )}
          </section>

          <section className="quality-pack">
            <div className="section-heading">
              <h2>补充证据</h2>
              <span>不能代替 12 组</span>
            </div>
            <p>同一份工业草稿换明亮产品 / 工程工业，核验版式是否真变。超长标题是反例。缺图：12 组资料都没有产品图，首屏图不应变成客户授权照片。</p>
            <div className="quality-actions">
              <button className="secondary-button" type="button" data-testid="quality-style-switch" disabled={Boolean(busyId)} onClick={() => { void runSupplementary("style-switch"); }}>样式切换核对</button>
              <button className="secondary-button" type="button" data-testid="quality-long-title" disabled={Boolean(busyId)} onClick={() => { void runSupplementary("long-title"); }}>超长标题反例</button>
              <Link className="section-link" href={"/published/p4-sw-bright" as Route} target="_blank">明亮产品</Link>
              <Link className="section-link" href={"/published/p4-sw-eng" as Route} target="_blank">工程工业</Link>
              <Link className="section-link" href={"/published/p4-long" as Route} target="_blank">超长标题</Link>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
