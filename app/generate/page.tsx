"use client";

import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleAlert,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  MessageSquareText,
  Sparkles,
  WandSparkles,
  LoaderCircle,
  AlertCircle,
  Eye,
  EyeOff,
  ExternalLink,
} from "lucide-react";
import { useMemo, useRef, useState, useEffect } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { OpenSourceTemplateFrame } from "@/components/open-source-template-frame";
import { templates, type SiteDraft } from "@/lib/site-model";
import { defaultDraft } from "@/lib/site-document";
import { deriveDesignTokenResult } from "@/lib/design-variants";
import { adaptIntentLimits, buildTemplateRecommendations, formatGenerationProgress, getGenerationProgress } from "@/lib/generation-experience";
import { GENERATION_BUDGET, getGenerationWaitNotice } from "@/lib/generation-budget";
import { readSseEvents } from "@/lib/sse-events";
import type { ContentCoverageReport } from "@/lib/template-content-coverage";
import { QUALITY_TIER_LABELS, qualityTier, type ContentQualityReport } from "@/lib/content-quality";

type Intent = {
  businessType: string;
  companyName: string;
  industry: string;
  targetAudience: string;
  tone: string;
  coreSections: string[];
  recommendedTemplateId: string;
  summary: string;
  status?: "ready" | "need_info" | "rejected";
  notices?: string[];
  needsInfo?: string[];
  conflicts?: string[];
  limits?: string[];
  rejectionReason?: string;
};
type TemplateMatch = { id: string; name: string; category: string; reason: string };
type Step = "input" | "clarify" | "confirm" | "generating" | "done";
type ClarifyState = { needsInfo: string[] };
type GenerationCompletion = {
  siteId: string;
  partial: boolean;
  fallbackReason: string;
  missingSections: string[];
  /**
   * 被确定性校验拒绝的操作（人话原因）。
   *
   * 2026-09-11 之前这个字段根本不存在：生成层算出 `rejected` 就丢，
   * 于是「标题超长被拒 → 槽位保留旧文案 → 界面照常提示成功」对用户完全静默。
   */
  rejected: string[];
  revision: number;
  coverage?: ContentCoverageReport;
  quality?: ContentQualityReport;
  notice: string;
  requiresReview: boolean;
};

const GENERATE_DRAFT_KEY = "sitecraft:generate-draft:v1";
const ACTIVE_GENERATION_KEY = "sitecraft:active-generation:v1";
const REAL_PREVIEW_DRAFT_KEY = "sitecraft:real-preview-draft:v1";
const GENERATION_TIMEOUT_MS = GENERATION_BUDGET.clientHardDeadlineMs;
const ANALYZE_TIMEOUT_MS = GENERATION_BUDGET.clientHardDeadlineMs;

const examples = [
  "做个光伏出口企业的官网，主打欧美，要显得专业可靠",
  "帮我的 SaaS 团队做官网，用户是海外开发者",
  "工业零部件厂的官网，突出质量和服务",
  "设计咨询公司的作品集网站",
];

const BUSINESS_LABELS: Record<string, string> = {
  manufacturing: "工业制造",
  trade: "外贸",
  tech: "科技",
  services: "专业服务",
  other: "其他",
};
const AUDIENCE_LABELS: Record<string, string> = {
  overseasB2b: "海外企业",
  domesticB2b: "国内企业",
  globalB2b: "全球企业",
  endUsers: "终端用户",
  investorsPartners: "投资人/伙伴",
  other: "其他",
};
const TONE_LABELS: Record<string, string> = {
  professional: "专业",
  technical: "技术",
  friendly: "友好",
  bold: "大胆",
  minimal: "极简",
  editorial: "编辑式",
};
const SECTIONS_LABELS: Record<string, string> = {
  hero: "首屏",
  about: "关于",
  features: "优势",
  services: "服务",
  products: "产品",
  contact: "联系",
};

/**
 * 生成幂等/会话 key。crypto.randomUUID 仅安全上下文可用（http://localhost 属安全，
 * 但局域网 http / 非 https 不是）；缺省时降级为时间戳随机串，避免同步抛错卡死。
 */
function newClientKey() {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch { /* fall through to fallback */ }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function GeneratePage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("input");
  const [message, setMessage] = useState("");
  // P1 导入：用户粘贴的公司简介/产品清单（选填，以用户信息为准）
  const [extraContext, setExtraContext] = useState("");
  const [draftRestored, setDraftRestored] = useState(false);
  const draftHydrated = useRef(false);
  const pageActive = useRef(true);
  const [intent, setIntent] = useState<Intent | null>(null);
  const [template, setTemplate] = useState<TemplateMatch | null>(null);
  const [recommendedTemplate, setRecommendedTemplate] = useState<TemplateMatch | null>(null);
  const [templatePreviewState, setTemplatePreviewState] = useState<"loading" | "ready" | "error">("loading");
  void setTemplatePreviewState; // 仅保留 iframe 握手状态上报（不再据此降级为本地渲染）
  const carouselRef = useRef<HTMLDivElement>(null);
  const [recommendationIndex, setRecommendationIndex] = useState(0);
  const [hiddenSections, setHiddenSections] = useState<string[]>([]);
  const [previewCollapsed, setPreviewCollapsed] = useState(false);
  const [previewFeedback, setPreviewFeedback] = useState<{ section: string; mode: "show" | "hide" } | null>(null);
  const previewFeedbackTimer = useRef<number | null>(null);
  const analyzeControllerRef = useRef<AbortController | null>(null);
  const generationControllerRef = useRef<AbortController | null>(null);
  const generationRequestKeyRef = useRef<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progressText, setProgressText] = useState("");
  const [generationPhase, setGenerationPhase] = useState<"content" | "review" | "saving">("content");
  const [completedSections, setCompletedSections] = useState<string[]>([]);
  const [activeSections, setActiveSections] = useState<string[]>([]);
  const [recoveringSections, setRecoveringSections] = useState<string[]>([]);
  const [failedSections, setFailedSections] = useState<string[]>([]);
  const [generationElapsed, setGenerationElapsed] = useState(0);
  const [generationDuration, setGenerationDuration] = useState<number | null>(null);
  const [generationCompletion, setGenerationCompletion] = useState<GenerationCompletion | null>(null);
  const generationStartedAt = useRef<number | null>(null);
  const [clarifyState, setClarifyState] = useState<ClarifyState | null>(null);
  const [clarifyText, setClarifyText] = useState("");
  const [siteLanguage, setSiteLanguage] = useState<"zh" | "en">("zh");
  // 多轮迭代：全量对话历史（超越 clarify 追问，覆盖「确认后还想改」的整条链路）
  const [history, setHistory] = useState<Array<{ role: "user" | "assistant"; text: string }>>([]);
  // 从确认页回来继续调整（输入态变为「调整模式」）
  const [adjusting, setAdjusting] = useState(false);
  // 再生模式：?siteId 存在时复用现有站点重新生成（不创建新站）
  const [regenerateSiteId, setRegenerateSiteId] = useState<string | null>(null);
  // 追问轮缓存：模型在 need_info 时已识别的模板推荐，补全后随 previousIntent 带回，避免推荐丢失
  const [pendingTemplateRecommendation, setPendingTemplateRecommendation] = useState<string | null>(null);

  const category = template?.category ?? "";
  // 放开跨分类选择：下拉列出全部模板（推荐分类排前），不把用户锁死在 category 内
  const templateOptions = useMemo(() => {
    const order = (t: { category: string }) =>
      t.category === category ? 0 : t.category === (intent && BUSINESS_LABELS[intent.businessType]) ? 1 : 2;
    return templates.map((t) => ({ ...t, _order: order(t) }))
      .sort((a, b) => a._order - b._order || a.category.localeCompare(b.category, "zh") || a.name.localeCompare(b.name, "zh"));
  }, [category, intent?.businessType]);
  const recommendationTemplates = useMemo<TemplateMatch[]>(() => {
    const options = templates.map((item) => ({ id: item.id, name: item.name, category: item.category, reason: "AI 根据你的业务方向推荐" }));
    return buildTemplateRecommendations(options, intent);
  }, [intent]);
  // 配色一律用模板自带值（2026-09-09 产品决策：移除「色系」选择，见 lib/design-variants.ts）。
  // designTokenResult 只负责「风格 ↔ 字体/圆角/密度」的冲突收敛。
  const designTokenResult = useMemo(
    () => intent && template ? deriveDesignTokenResult(intent, template.id) : null,
    [intent, template],
  );
  const previewDraft = useMemo<SiteDraft>(() => {
    const companyName = intent?.companyName || defaultDraft.companyName;
    const summary = intent?.summary || defaultDraft.content.hero.subtitle.zh;
    return {
      ...defaultDraft,
      templateId: template?.id ?? defaultDraft.templateId,
      siteName: companyName,
      companyName,
      industry: intent?.industry ?? defaultDraft.industry,
      content: {
        ...defaultDraft.content,
        hero: {
          ...defaultDraft.content.hero,
          title: { zh: companyName, en: companyName },
          subtitle: { zh: summary, en: summary },
        },
      },
      hiddenSections: (previewFeedback?.mode === "hide"
        ? hiddenSections.filter((section) => section !== previewFeedback.section)
        : hiddenSections) as SiteDraft["hiddenSections"],
      // 2026-09-10：不再发送 designTokens。
      // 后端 `site-generator.ts:53` 早已停发（产品决策：配色一律取模板自带值），
      // 但前端这里仍在发送 → 预览与生成结果不一致；且 preview 路由会据此注入
      // `body{font-family!important}` / `border-radius!important` / `section padding!important`，
      // 覆盖 22/22 模板的原生字体/圆角/间距，使「真实开源模板」的卖点自相矛盾。
      designTokens: null,
    };
  }, [hiddenSections, intent?.companyName, intent?.industry, intent?.summary, previewFeedback?.mode, previewFeedback?.section, template?.id]);

  useEffect(() => {
    setTemplatePreviewState("loading");
  }, [template?.id]);

  const chooseRecommendation = (candidate: TemplateMatch, index: number) => {
    setTemplate((current) => ({ ...(current ?? candidate), ...candidate }));
    setRecommendationIndex(index);
    setTemplatePreviewState("loading");
    window.requestAnimationFrame(() => {
      const card = carouselRef.current?.querySelector<HTMLElement>(`[data-template-card="${candidate.id}"]`);
      card?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    });
  };

  const moveRecommendation = (direction: -1 | 1) => {
    if (!recommendationTemplates.length) return;
    const next = (recommendationIndex + direction + recommendationTemplates.length) % recommendationTemplates.length;
    chooseRecommendation(recommendationTemplates[next], next);
  };
  const generationSections = useMemo(
    () => ["hero", ...(intent?.coreSections ?? []).filter((section) => !hiddenSections.includes(section))],
    [hiddenSections, intent?.coreSections],
  );
  const generationSectionState = (section: string) => {
    if (completedSections.includes(section)) return "done";
    if (failedSections.includes(section)) return "failed";
    if (recoveringSections.includes(section)) return "recovering";
    if (activeSections.includes(section) && generationPhase === "content") return "active";
    return "waiting";
  };

  // 再生模式：工作台「换方向重新生成」带 ?siteId 进入 → 复用现有站点重新生成
  useEffect(() => {
    // StrictMode 下 React 会挂载→卸载→重挂：cleanup 会把 pageActive 置 false，
    // 重挂后 effect 重跑必须重新置 true，否则 analyze 的 finally 因 pageActive=false
    // 跳过 setBusy(false)，追问页按钮永远 disabled（busy=true）卡死。
    pageActive.current = true;
    const q = new URLSearchParams(window.location.search);
    const siteId = q.get("siteId");
    if (siteId) setRegenerateSiteId(siteId);
    const qText = q.get("q");
    if (qText) {
      // 从模板页「一句话」入口预填：query 优先于草稿恢复
      setMessage(qText.slice(0, 400));
      setDraftRestored(false);
    }
    const qTemplateId = q.get("templateId");
    if (qTemplateId && templates.some((t) => t.id === qTemplateId)) {
      const t = templates.find((item) => item.id === qTemplateId);
      if (t) setTemplate({ id: t.id, name: t.name, category: t.category, reason: "从模板页选择的方向" });
    }
    return () => { pageActive.current = false; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const restoreActiveGeneration = async () => {
      try {
        const raw = window.sessionStorage.getItem(ACTIVE_GENERATION_KEY);
        if (!raw) return;
        const saved = JSON.parse(raw) as { siteId?: unknown; baseRevision?: unknown };
        if (typeof saved.siteId !== "string" || (saved.baseRevision !== null && typeof saved.baseRevision !== "number")) {
          window.sessionStorage.removeItem(ACTIVE_GENERATION_KEY);
          return;
        }
        const response = await fetch(`/api/sites/${saved.siteId}/draft`, { cache: "no-store" });
        if (!response.ok) throw new Error("无法读取上次生成任务");
        const payload = await response.json() as { draft?: { revision?: unknown } };
        const revision = typeof payload.draft?.revision === "number" ? payload.draft.revision : 0;
        if (cancelled) return;
        if (typeof saved.baseRevision === "number" && revision > saved.baseRevision) {
          window.sessionStorage.removeItem(ACTIVE_GENERATION_KEY);
          router.replace(`/workspace?siteId=${saved.siteId}&generated=1&recovered=1`);
          return;
        }
        setRegenerateSiteId(saved.siteId);
        setError("检测到上次未完成的建站任务，已保留原站点。确认需求后可继续生成，不会重复创建网站。");
      } catch {
        window.sessionStorage.removeItem(ACTIVE_GENERATION_KEY);
      }
    };
    void restoreActiveGeneration();
    return () => { cancelled = true; };
  }, [router]);

  useEffect(() => {
    // query 预填（?q=）优先于历史草稿恢复，避免旧草稿覆盖模板页带入的话
    if (new URLSearchParams(window.location.search).get("q")) {
      draftHydrated.current = true;
      return;
    }
    try {
      const raw = window.sessionStorage.getItem(GENERATE_DRAFT_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as { message?: unknown; extraContext?: unknown };
      const restoredMessage = typeof saved.message === "string" ? saved.message.slice(0, 400) : "";
      const restoredContext = typeof saved.extraContext === "string" ? saved.extraContext.slice(0, 2000) : "";
      if (restoredMessage || restoredContext) {
        setMessage(restoredMessage);
        setExtraContext(restoredContext);
        setDraftRestored(true);
      }
    } catch {
      window.sessionStorage.removeItem(GENERATE_DRAFT_KEY);
    } finally {
      draftHydrated.current = true;
    }
  }, []);

  useEffect(() => {
    if (!draftHydrated.current) return;
    const timer = window.setTimeout(() => {
      try {
        if (message || extraContext) {
          window.sessionStorage.setItem(GENERATE_DRAFT_KEY, JSON.stringify({ message, extraContext }));
        } else {
          window.sessionStorage.removeItem(GENERATE_DRAFT_KEY);
        }
      } catch {
        // Draft recovery is optional; storage restrictions must not block generation.
      }
    }, 200);
    return () => window.clearTimeout(timer);
  }, [extraContext, message]);

  const analyze = async (text: string) => {
    analyzeControllerRef.current?.abort();
    const controller = new AbortController();
    analyzeControllerRef.current = controller;
    let timeout = window.setTimeout(() => controller.abort(new Error("需求分析超时")), ANALYZE_TIMEOUT_MS);
    const bumpAnalyzeTimeout = () => {
      window.clearTimeout(timeout);
      timeout = window.setTimeout(() => controller.abort(new Error("需求分析超时")), ANALYZE_TIMEOUT_MS);
    };
    setBusy(true);
    setError(null);
    setProgressText("正在理解你的需求…");
    const idempotencyKey = newClientKey();
    try {
      // 多轮迭代：全量 history（slice(-10) 对齐服务端 cap）+ 上一轮意图基线（增量更新）
      const res = await fetch(`/api/sites/demo/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step: "analyze",
          message: text,
          history: history.slice(-10),
          ...(intent ? { previousIntent: intent } : {}),
          ...(extraContext.trim() ? { extraContext: extraContext.trim() } : {}),
          idempotencyKey,
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(payload.message || "需求分析请求失败，请稍后重试");
      }
      const reader = res.body?.getReader() ?? null;
      if (!reader) throw new Error("无法读取响应");
      // B5：消费交给 lib/sse-events（逐事件到达即更新 + envelope 去重 + O(n)）。
      // 此前这里是手写的 while + `readSseEvents(raw)` 重解析整个缓冲——
      // 那份实现每收一个 chunk 就把全部数据从头解析一遍（O(n²)），
      // 且没有 deduper（断点续做重放时可能重复应用）。
      //
      // ⚠️ setBusy(false) 必须在本回调里做，不能挪到 await 之后：
      // 回调是本函数里**最后一个同步点**——readSseEvents 返回后到分支分发之间
      // 没有 await，单线程下不会有新的 analyze 插入竞态。
      // （原文注释：「收到合法 done 即同步复位 busy，不依赖 finally：SSE 流活性
      //  异常时 finally 可能不执行，busy 残留会让确认/追问页按钮 disabled 且显示
      //  旧 progressText，表现像卡死。」）
      const events = await readSseEvents(reader, (event) => {
        // 有进展就重置静默计时（原在 while 循环里，按每次读到 chunk 触发；
        // 现在按每个**完整事件**触发——语义更准：半个事件不算进展）
        bumpAnalyzeTimeout();
        if (event.type === "status" && typeof event.value === "string") setProgressText(event.value);
        if (event.type === "done" && pageActive.current) setBusy(false);
      });
      const done = events.find((e) => e.type === "done");
      if (!done) throw new Error("没有返回结果");
      if (done.status === "error") throw new Error(String(done.error || "分析失败"));
      if (done.status !== "ready") throw new Error(`意外状态 ${done.status}`);
      const parsedIntent = adaptIntentLimits(done.intent as Intent);
      const intentStatus = parsedIntent.status ?? "ready"; // 旧后端/旧模型兼容
      if (pageActive.current) setBusy(false);
      if (intentStatus === "need_info") {
        const needsInfo = parsedIntent.needsInfo ?? [];
        // 缓存模型已识别的模板推荐（need_info 时 done.template 为空，但 intent.recommendedTemplateId 可能已有）
        // 同时种入 intent 基线，让后续追问轮作为 previousIntent 传给模型，推荐不丢失
        if (parsedIntent.recommendedTemplateId) {
          setPendingTemplateRecommendation(parsedIntent.recommendedTemplateId);
          setIntent({
            businessType: parsedIntent.businessType ?? "other",
            companyName: parsedIntent.companyName ?? "",
            industry: parsedIntent.industry ?? "",
            targetAudience: parsedIntent.targetAudience ?? "other",
            tone: parsedIntent.tone ?? "professional",
            // coreSections 只需 schema 白名单板块（hero 是隐式前缀，不在此列）。
            // 过滤掉越界项后再判断空，防模型输出含 hero/其它非法板块致下一轮 previousIntent 校验 400。
            coreSections: (() => {
              const valid = (parsedIntent.coreSections ?? []).filter((section) => section !== "hero");
              return valid.length ? valid : ["about", "features", "services", "products", "contact"];
            })(),
            recommendedTemplateId: parsedIntent.recommendedTemplateId,
            summary: parsedIntent.summary ?? "",
          });
        }
        // 追问轮次写入全量 history（顶层），不再用局部 clarifyState.history
        setHistory((h) => [...h, { role: "user", text }, { role: "assistant", text: needsInfo.join("；") }]);
        setClarifyState({ needsInfo });
        setStep("clarify");
        return;
      }
      if (intentStatus === "rejected") {
        // 重新开始：清空迭代状态回干净起点
        setHistory([]);
        setError(parsedIntent.rejectionReason ?? "该需求超出建站范围，我无法帮你完成。");
        setStep("input");
        return;
      }
      // ready：本轮对话入历史；保留已折叠板块（迭代轮不覆盖用户勾选）
      setHistory((h) => [...h, { role: "user", text }, { role: "assistant", text: parsedIntent.summary }]);
      setIntent(parsedIntent);
      setTemplate(done.template as TemplateMatch);
      setRecommendedTemplate(done.template as TemplateMatch);
      setHiddenSections((prev) => {
        const next = (done.hiddenSections as string[]) ?? [];
        return next.length ? next : prev;
      });
      setSiteLanguage((done.siteLanguage as "zh" | "en") ?? "zh");
      setAdjusting(false);
      setStep("confirm");
    } catch (e) {
      if (pageActive.current && analyzeControllerRef.current === controller) {
        setError(controller.signal.aborted ? "需求分析等待时间过长，已停止等待，请重试。" : e instanceof Error ? e.message : "分析失败");
        setStep(clarifyState ? "clarify" : "input");
      }
    } finally {
      window.clearTimeout(timeout);
      // B5：这里原本还要 `reader?.releaseLock()`。现在锁由 `readSseEvents`
      // 自己的 finally 释放（它对每个 reader 恰好释放一次），
      // 页面再释放一次是二次调用——它会抛 TypeError 被吞掉，看着无害，
      // 但语义上把"谁负责释放"变成了两处，将来必漂。**所有权归 lib。**
      // `reader` 变量保留：它仍是"取到 body reader 了吗"的守卫。
      if (analyzeControllerRef.current === controller) {
        analyzeControllerRef.current = null;
        // 兜底：理论上收到合法 done 的分支已 setBusy(false)；此处保证异常/取消路径也不残留 busy。
        if (pageActive.current) setBusy(false);
      }
    }
  };

  const toggleSection = (section: string) => {
    if (previewFeedbackTimer.current) window.clearTimeout(previewFeedbackTimer.current);
    const isHidden = hiddenSections.includes(section);
    setPreviewFeedback({ section, mode: isHidden ? "show" : "hide" });
    if (isHidden) {
      setHiddenSections((prev) => prev.filter((item) => item !== section));
      previewFeedbackTimer.current = window.setTimeout(() => setPreviewFeedback(null), 520);
      return;
    }
    // Product state must commit immediately; the timer owns visual feedback only.
    setHiddenSections((prev) => prev.includes(section) ? prev : [...prev, section]);
    previewFeedbackTimer.current = window.setTimeout(() => {
      setPreviewFeedback(null);
    }, 240);
  };

  useEffect(() => () => {
    if (previewFeedbackTimer.current) window.clearTimeout(previewFeedbackTimer.current);
    analyzeControllerRef.current?.abort();
    generationControllerRef.current?.abort();
  }, []);

  const enterGeneratedWorkspace = (siteId: string, partial: boolean) => {
    try {
      window.sessionStorage.removeItem(GENERATE_DRAFT_KEY);
    } catch {
      // Successful navigation must continue even when storage is unavailable.
    }
    router.push(`/workspace?siteId=${siteId}&generated=1${partial ? "&partial=1" : ""}`);
  };

  const execute = async () => {
    if (!intent || !template || generationRequestKeyRef.current) return;
    const idempotencyKey = newClientKey();
    generationRequestKeyRef.current = idempotencyKey;
    setBusy(true);
    setError(null);
    setStep("generating");
    generationStartedAt.current = performance.now();
    setGenerationDuration(null);
    setGenerationCompletion(null);
    setGenerationPhase("content");
    setCompletedSections([]);
    setActiveSections(generationSections);
    setRecoveringSections([]);
    setFailedSections([]);
    setGenerationElapsed(0);
    generationControllerRef.current?.abort();
    const controller = new AbortController();
    generationControllerRef.current = controller;
    let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
    // 进展感知超时（替代固定总时长）：只要服务端持续推送事件就不断重置；
    // 真正"静默无进展"超过 GENERATION_TIMEOUT_MS 才中止。
    let timeout = window.setTimeout(() => {
      controller.abort();
      void reader?.cancel();
    }, GENERATION_TIMEOUT_MS);
    const bumpTimeout = () => {
      window.clearTimeout(timeout);
      timeout = window.setTimeout(() => {
        controller.abort();
        void reader?.cancel();
      }, GENERATION_TIMEOUT_MS);
    };
    const sessionId = window.sessionStorage.getItem("sitecraft-session") ?? newClientKey();
    window.sessionStorage.setItem("sitecraft-session", sessionId);
    setProgressText(regenerateSiteId ? "正在为现有站点重新生成内容…" : "正在为所选模板生成内容…");
    try {
      // 再生模式：复用现有站点（不创建新站）；否则创建新站点（locales 跟随站点语言）
      let siteId = regenerateSiteId;
      if (!siteId) {
        const siteRes = await fetch(`/api/sites`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: intent.companyName,
            templateId: template.id,
            locales: siteLanguage === "en" ? ["en"] : ["zh", "en"],
            initialDraft: {
              ...previewDraft,
              siteName: intent.companyName,
              companyName: intent.companyName,
              templateId: template.id,
              locale: siteLanguage,
            },
          }),
          signal: controller.signal,
        });
        const sitePayload = await siteRes.json().catch(() => null);
        if (!siteRes.ok || typeof sitePayload?.id !== "string") throw new Error("创建网站失败，请稍后重试");
        siteId = sitePayload.id;
        window.sessionStorage.setItem(ACTIVE_GENERATION_KEY, JSON.stringify({ siteId, baseRevision: null, startedAt: Date.now() }));
      }
      if (typeof siteId !== "string") throw new Error("无法确定已创建的网站，请稍后重试");
      const generatedSiteId = siteId;
      // 2. 读初始 revision
      const draftRes = await fetch(`/api/sites/${generatedSiteId}/draft`, { cache: "no-store", signal: controller.signal });
      if (!draftRes.ok) throw new Error("读取网站草稿失败，请稍后重试");
      const draftPayload = await draftRes.json();
      const baseRevision = draftPayload.draft?.revision ?? 1;
      window.sessionStorage.setItem(ACTIVE_GENERATION_KEY, JSON.stringify({ siteId: generatedSiteId, baseRevision, startedAt: Date.now() }));
      // 3. 执行生成
      const res = await fetch(`/api/sites/${generatedSiteId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step: "execute",
          message,
          intent,
          templateId: template.id,
          siteLanguage,
          hiddenSections,
          baseRevision,
          sessionId,
          // 素材随 execute 一起发（2026-09-10，方向 2）：此前只随 analyze 发，
          // 导致**真正写内容时模型看不到素材**，只能靠 intent 摘要泛泛而谈。
          ...(extraContext.trim() ? { sourceMaterial: extraContext.trim() } : {}),
          idempotencyKey,
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(payload.message || "生成请求失败，请稍后重试");
      }
      reader = res.body?.getReader() ?? null;
      if (!reader) throw new Error("无法读取生成结果");
      const events = await readSseEvents(reader, (event) => {
        bumpTimeout(); // 有进展就重置静默计时（按完整事件，半事件不算）
        if (event.type === "status") {
          if (typeof event.value === "string") setProgressText(event.value);
          const phase = event.phase;
          if (phase === "content" || phase === "review" || phase === "saving") setGenerationPhase(phase);
          const asStrings = (value: unknown) =>
            Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : null;
          const completed = asStrings(event.completedSections);
          if (completed) setCompletedSections(completed);
          const active = asStrings(event.activeSections);
          if (active) setActiveSections(active);
          const recovering = asStrings(event.recoveringSections);
          if (recovering) setRecoveringSections(recovering);
          const failed = asStrings(event.failedSections);
          if (failed) setFailedSections(failed);
          return;
        }
        // 流式增量：优先显示**模型正在写的内容片段**（更有临场感），
        // 拿不到可读片段时回退到"已输出 N 字"（2026-09-10 用户要求流式为主）。
        //
        // ⚠️ 逐事件处理在这里**比旧实现更准确**：旧实现每次取"最后一个 status +
        // 最后一个 delta"再去重，status 与 delta 交替到达时后者会盖掉前者；
        // 现在两类事件各按各的语义更新。
        if (event.type === "content_delta" && typeof event.chars === "number") {
          const secs = Array.isArray(event.sections) ? event.sections.join("、") : "";
          if (typeof event.preview === "string" && event.preview) {
            setProgressText(`${event.preview}${secs ? `（${secs}）` : ""}`);
          } else {
            setProgressText(`正在生成内容…已输出 ${event.chars} 字${secs ? `（${secs}）` : ""}`);
          }
        }
      });
      const done = events.find((e) => e.type === "done");
      if (!done) throw new Error("生成没有返回结果");
      if (done.status === "error") throw new Error(String(done.error || "生成失败"));
      if (done.status === "conflict") throw new Error("草稿冲突，请重试");
      window.sessionStorage.removeItem(ACTIVE_GENERATION_KEY);
      if (!pageActive.current) return;
      if (generationStartedAt.current !== null) setGenerationDuration(Math.round(performance.now() - generationStartedAt.current));
      // P0-2：批 B 失败时 partial=true，提示板块未完整生成（避免用户以为全是默认模板文案）
      const partial = Boolean((done as { partial?: boolean }).partial);
      const missingSections = Array.isArray((done as { missingSections?: string[] }).missingSections)
        ? ((done as { missingSections?: string[] }).missingSections ?? [])
        : [];
      const missingSectionLabels = missingSections.map((section) => SECTIONS_LABELS[section] ?? section);
      const fallbackReason = typeof done.templateFallbackReason === "string" ? done.templateFallbackReason : "";
      // 被拒操作（超长/越界/白名单外）：此前完全静默，用户只看到"成功"。
      // 与工作台 chat 路径的 rejected 同一份数据形状，统一渲染。
      const rejected = Array.isArray((done as { rejected?: string[] }).rejected)
        ? ((done as { rejected?: string[] }).rejected ?? []).filter((item): item is string => typeof item === "string")
        : [];
      const quality = (done as { quality?: ContentQualityReport | null }).quality ?? undefined;
      const qualityNeedsReview = Boolean(quality && !quality.publishable);
      const qualityNotice = qualityNeedsReview && quality
        ? `内容质量评分 ${quality.score}（${QUALITY_TIER_LABELS[qualityTier(quality)]}），待处理 ${quality.missingSlots.length + quality.fabricatedTargets.length + quality.metaCommentaryTargets.length + quality.overLimitSlots.length + quality.placeholderTargets.length + quality.languageMismatches.length + quality.unverifiedFacts.length} 项问题。`
        : "";
      // P1.3 兜底显性化：模型声明"某节装不下"（fallbackDeclared）时明确告知用户
      const awareness = (done as { sectionUnderstanding?: Array<{ section: string; fallbackDeclared?: boolean; verdict?: string }> }).sectionUnderstanding ?? [];
      const declaredFallbacks = awareness.filter((item) => item.fallbackDeclared === true).map((item) => SECTIONS_LABELS[item.section] ?? item.section);
      const fallbackNotice = declaredFallbacks.length
        ? `以下板块因模板原生排版承载不下，已声明使用动态排版：${declaredFallbacks.join("、")}。建议检查观感。`
        : "";
      const completionNotices = [
        fallbackReason,
        partial ? `部分板块未完整生成（${missingSectionLabels.join("、") || "板块内容"}），已保存首屏与已生成内容。可在工作台继续让 AI 补全。` : "",
        qualityNotice,
        fallbackNotice,
        // 被拒操作必须显性化：它们**没有写进模板**，却混在"生成成功"里
        rejected.length ? `有 ${rejected.length} 项内容未写入模板（多为超长或超出模板容量），草稿其余部分已保存。` : "",
      ].filter(Boolean);
      const requiresReview = partial || Boolean(fallbackReason) || qualityNeedsReview || declaredFallbacks.length > 0 || rejected.length > 0;
      const completion = {
        siteId: generatedSiteId,
        partial,
        fallbackReason,
        missingSections,
        rejected,
        revision: typeof (done as { draft?: { revision?: unknown } }).draft?.revision === "number"
          ? (done as { draft: { revision: number } }).draft.revision
          : baseRevision + (done.status === "applied" ? 1 : 0),
        coverage: (done as { coverage?: ContentCoverageReport }).coverage,
        quality,
        notice: completionNotices.join("；"),
        requiresReview,
      };
      setGenerationCompletion(completion);
      if (requiresReview) {
        setProgressText(
          partial
            ? "已保存当前可用内容，部分板块需要继续补全"
            : fallbackReason
              ? "已切换到兼容模板并保存站点初稿"
              : qualityNeedsReview
                ? "初稿已保存，建议处理内容质量问题"
                : "初稿已保存",
        );
        return;
      }
      setStep("done");
      setTimeout(() => {
        if (!pageActive.current) return;
        enterGeneratedWorkspace(generatedSiteId, false);
      }, 1200);
    } catch (e) {
      if (pageActive.current) {
        setError(controller.signal.aborted ? "建站已超过 120 秒，已停止等待并保留当前站点。你可以直接重试，不会重复创建网站。" : e instanceof Error ? e.message : "生成失败");
        setStep("confirm");
      }
    } finally {
      window.clearTimeout(timeout);
      // B5：reader 的 releaseLock 归 `readSseEvents` 的 finally（每个 reader 恰好一次）。
      // 页面侧不再重复释放——二次调用会抛 TypeError 被吞掉，看着无害，
      // 但把"谁负责释放"变成两处，将来必漂。
      if (generationControllerRef.current === controller) generationControllerRef.current = null;
      if (generationRequestKeyRef.current === idempotencyKey) generationRequestKeyRef.current = null;
      if (pageActive.current) setBusy(false);
    }
  };

  const recoverMissingSections = async () => {
    if (!generationCompletion?.missingSections.length || !intent || !template || busy || generationRequestKeyRef.current) return;
    const idempotencyKey = newClientKey();
    generationRequestKeyRef.current = idempotencyKey;
    const sections = [...generationCompletion.missingSections];
    setBusy(true);
    setError(null);
    setRecoveringSections(sections);
    setFailedSections([]);
    setProgressText("正在补全缺失板块…");
    generationControllerRef.current?.abort();
    const controller = new AbortController();
    generationControllerRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), GENERATION_TIMEOUT_MS);
    try {
      const response = await fetch(`/api/sites/${generationCompletion.siteId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step: "execute",
          message,
          intent,
          templateId: template.id,
          siteLanguage,
          hiddenSections,
          baseRevision: generationCompletion.revision,
          sessionId: window.sessionStorage.getItem("sitecraft-session") ?? undefined,
          regenerateMissing: { sections },
          // 补全也带素材：否则补出来的内容与初稿的口径不一致
          ...(extraContext.trim() ? { sourceMaterial: extraContext.trim() } : {}),
          idempotencyKey,
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as { message?: string };
        throw new Error(payload.message || "补全请求失败，请稍后重试");
      }
      // B5：这里原来是 `await response.text()` 整串读完后才解析——
      // 三处消费点里**唯一真正"收完才更新"**的一处（前两处是重解析缓冲）。
      // 补全阶段同样有"恢复中"的可视化状态（recoveringSections），
      // 整串等待会让那段时间界面完全静止。
      const reader = response.body?.getReader() ?? null;
      if (!reader) throw new Error("补全结果不可读取");
      const events = await readSseEvents(reader, (event) => {
        if (event.type === "status" && typeof event.value === "string") setProgressText(event.value);
      });
      const done = events.find((item) => item.type === "done");
      if (!done) throw new Error("补全没有返回结果");
      if (done.status === "error" || done.status === "conflict") throw new Error(String(done.error || "补全失败"));
      const remaining = Array.isArray(done.missingSections)
        ? done.missingSections.filter((section): section is string => typeof section === "string")
        : sections;
      // 补全阶段同样会产出被拒操作：并进既有列表，不要因为"补全成功"又把它们藏起来
      const recoveredRejected = Array.isArray((done as { rejected?: string[] }).rejected)
        ? ((done as { rejected?: string[] }).rejected ?? []).filter((item): item is string => typeof item === "string")
        : [];
      const revision = typeof (done as { draft?: { revision?: unknown } }).draft?.revision === "number"
        ? (done as { draft: { revision: number } }).draft.revision
        : generationCompletion.revision + (done.status === "applied" ? 1 : 0);
      setCompletedSections((current) => [...new Set([...current, ...sections.filter((section) => !remaining.includes(section))])]);
      setFailedSections(remaining);
      setGenerationCompletion({
        ...generationCompletion,
        partial: remaining.length > 0,
        missingSections: remaining,
        rejected: [...new Set([...generationCompletion.rejected, ...recoveredRejected])],
        revision,
        coverage: (done as { coverage?: ContentCoverageReport }).coverage,
        quality: (done as { quality?: ContentQualityReport | null }).quality ?? undefined,
        notice: remaining.length > 0 ? `仍有 ${remaining.map((section) => SECTIONS_LABELS[section] ?? section).join("、")} 待补全，可直接重试。` : "缺失板块已补全，当前草稿已保存。",
        requiresReview: true,
      });
      setProgressText(remaining.length > 0 ? "部分板块仍待补全" : "缺失板块已补全");
    } catch (recoveryError) {
      setFailedSections(sections);
      setError(controller.signal.aborted ? "补全已超时，当前草稿未丢失，可直接重试。" : recoveryError instanceof Error ? recoveryError.message : "补全失败");
    } finally {
      window.clearTimeout(timeout);
      setRecoveringSections([]);
      if (generationControllerRef.current === controller) generationControllerRef.current = null;
      if (generationRequestKeyRef.current === idempotencyKey) generationRequestKeyRef.current = null;
      setBusy(false);
    }
  };

  useEffect(() => {
    if (step !== "generating" || generationStartedAt.current === null || generationCompletion) return;
    const updateElapsed = () => setGenerationElapsed(Math.floor((performance.now() - generationStartedAt.current!) / 1000));
    updateElapsed();
    const timer = window.setInterval(updateElapsed, 1000);
    return () => window.clearInterval(timer);
  }, [generationCompletion, step]);

  const generationProgress = getGenerationProgress({
    phase: generationPhase,
    sections: generationSections,
    completedSections,
    failedSections,
    elapsedMs: generationElapsed * 1000,
    terminal: step === "done" || Boolean(generationCompletion),
  });
  const generationProgressLabel = formatGenerationProgress(generationProgress);
  const generationWaitNotice = getGenerationWaitNotice(generationElapsed * 1000);

  return (
    <div className="app-shell">
      <AppSidebar active="sites" />
      <main className="main">
        <header className="topbar">
          <div className="breadcrumbs">
            <Link href="/"><ArrowLeft size={14} /></Link>
            <ChevronRight size={12} />
            <strong>用一句话开始</strong>
          </div>
          <div className="top-actions">
            <span className="eyebrow">{step === "input" ? "Step 01 / 03" : step === "confirm" ? "Step 02 / 03" : "Step 03 / 03"}</span>
          </div>
        </header>
        <div className="page-content">
          {step === "input" && (
            <div className="generate-input">
              <div className="eyebrow">{adjusting ? "继续调整需求" : "✨ 自然语言建站"}</div>
              <h1>
                {adjusting ? (
                  <>还想怎么改？<br /><span style={{ color: "#2e6b4f" }}>继续聊，我接着调。</span></>
                ) : (
                  <>用一段对话，<br /><span style={{ color: "#2e6b4f" }}>变成一座网站。</span></>
                )}
              </h1>
              <p>{adjusting ? "在已确认的需求上继续说，AI 只改你提到的地方。" : "描述你的业务，AI 帮你选模板、出初稿，再进工作台精修。"}</p>
              <textarea
                className="generate-textarea"
                value={message}
                onChange={(e) => { setMessage(e.target.value); setDraftRestored(false); }}
                placeholder={adjusting ? "例如：改成日系风格 / 加上预约功能" : "例如：做个光伏出口企业的官网，主打欧美，要显得专业可靠"}
                rows={3}
                maxLength={400}
              />
              <div className="generate-char-count">{message.trim().length}/400</div>
              {!adjusting && (
                <div className="generate-examples">
                  {examples.map((ex) => (
                    <button key={ex} className="generate-chip" onClick={() => setMessage(ex)}>
                      {ex}
                    </button>
                  ))}
                </div>
              )}
              {!adjusting && (
                <details className="generate-import">
                  <summary>有现成的公司简介或产品清单？粘贴进来（选填，让内容更准）</summary>
                  <textarea
                    className="generate-textarea"
                    value={extraContext}
                    onChange={(e) => { setExtraContext(e.target.value); setDraftRestored(false); }}
                    placeholder="粘贴公司简介 / 产品清单 / 资质与案例，例如：华辰光伏成立于 2001 年，专注光伏组件与逆变器制造，通过 ISO 9001 认证，产品销往欧美……"
                    rows={6}
                    maxLength={20000}
                  />
                  <div className="generate-char-count">{extraContext.trim().length}/20000</div>
                </details>
              )}
              {error && <p className="generate-error"><AlertCircle size={13} />{error}</p>}
              {draftRestored && <p className="generate-progress" role="status">已恢复刷新前的需求草稿</p>}
              <div className="generate-clarify-actions">
                {adjusting && (
                  <button className="secondary-button" disabled={busy} onClick={() => setStep("confirm")}>
                    返回确认页
                  </button>
                )}
                <button
                  className="primary-button"
                  disabled={!message.trim() || busy}
                  onClick={() => {
                    // 正向检测是否含文字/数字：!!!/组合 emoji/带肤色 emoji 全拦，全角文字正确放行
                    const isEmptyOrSymbolOnly = (s: string) => !/[\p{L}\p{N}]/u.test(s);
                    if (!message.trim() || isEmptyOrSymbolOnly(message)) {
                      setError("请输入文字描述（业务方向、目标用户等），只有表情或符号无法识别。");
                      return;
                    }
                    void analyze(message);
                  }}
                >
                  {busy ? <LoaderCircle size={15} className="spin" /> : <WandSparkles size={15} />}
                  {busy ? progressText : adjusting ? "更新理解" : "开始理解需求"} <ArrowRight size={15} />
                </button>
                {adjusting && (
                  <button
                    className="secondary-button"
                    disabled={busy}
                    onClick={() => {
                      // 重新开始：全量清空迭代状态
                      setHistory([]);
                      setIntent(null);
                      setTemplate(null);
                      setHiddenSections([]);
                      setAdjusting(false);
                      setMessage("");
                      setError(null);
                      setClarifyState(null);
                      setClarifyText("");
                    }}
                  >
                    重新开始
                  </button>
                )}
              </div>
              {busy && <p className="generate-progress">{progressText}</p>}
            </div>
          )}

          {step === "clarify" && clarifyState && (
            <div className="generate-input">
              <div className="eyebrow">还差几个关键信息</div>
              <h1>再告诉我一点，<br /><span style={{ color: "#2e6b4f" }}>才能不瞎猜。</span></h1>
              <p>AI 觉得信息还不够，下面这些问题补充后会更准。也可以留空直接"按默认值继续"。</p>
              <ol className="generate-clarify-list">
                {clarifyState.needsInfo.map((q, i) => (
                  <li key={`${i}-${q}`}>{q}</li>
                ))}
              </ol>
              <textarea
                className="generate-textarea"
                value={clarifyText}
                onChange={(e) => setClarifyText(e.target.value)}
                placeholder="补充回答，例如：我是华辰光伏，做组件出口，客户在欧美"
                rows={3}
                maxLength={400}
              />
              <div className="generate-char-count">{clarifyText.trim().length}/400</div>
              {error && <p className="generate-error"><AlertCircle size={13} />{error}</p>}
              <div className="generate-clarify-actions">
                <button className="secondary-button" disabled={busy} onClick={() => { setClarifyState(null); setClarifyText(""); setError(null); setStep("input"); }}>
                  返回修改
                </button>
                <button
                  className="primary-button"
                  disabled={busy}
                  onClick={() => {
                    const rounds = history.filter((m) => m.role === "user").length;
                    if (rounds >= 3) {
                      // 已追问 3 轮仍信息不足：强制收敛，用默认值（服务端规则 5 转 ready）
                      // 注意：不传空 history——顶层 history 自然携带已收集对话，防丢失
                      setClarifyState(null);
                      void analyze("按默认值继续");
                      return;
                    }
                    // 留空或纯符号 → 也走默认值收敛，不发空串（避免 400）
                    void analyze(clarifyText.trim() || "按默认值继续");
                  }}
                >
                  {busy ? <LoaderCircle size={15} className="spin" /> : <Sparkles size={15} />}
                  {busy ? progressText : "继续理解"} <ArrowRight size={15} />
                </button>
              </div>
              <p className="generate-progress" style={{ marginTop: 12, fontSize: 11, color: "#94a3b8" }}>
                已追问 {history.filter((m) => m.role === "user").length} 轮，最多 3 轮后自动用默认值继续
              </p>
              {busy && <p className="generate-progress">{progressText}</p>}
            </div>
          )}

          {step === "confirm" && intent && template && (
            <div className="generate-confirm">
              <div className="eyebrow">我理解你要的是</div>
              <h1>{intent.summary}</h1>
              <div className="generate-confirm-grid">
                <div className="template-card generate-intent-card">
                  <div className="generate-intent-row">
                    <h3>意图摘要</h3>
                    <div className="generate-intent-rows">
                      <div><span>行业</span><strong>{BUSINESS_LABELS[intent.businessType] ?? intent.businessType} · {intent.industry}</strong></div>
                      <div><span>受众</span><strong>{AUDIENCE_LABELS[intent.targetAudience] ?? intent.targetAudience}</strong></div>
                      <div><span>语气</span><strong>{TONE_LABELS[intent.tone] ?? intent.tone}</strong></div>
                    </div>
                  </div>
                  <div className="generate-intent-row">
                    <h3>套用到模板的板块</h3>
                    <div className="generate-sections">
                      {intent.coreSections.map((s) => {
                        const isVisible = !hiddenSections.includes(s);
                        return (
                          <button
                            key={s}
                            type="button"
                            className={`generate-toggle ${isVisible ? "on" : "off"}`}
                            aria-pressed={isVisible}
                            title={isVisible ? `点击隐藏「${SECTIONS_LABELS[s] ?? s}」板块` : `点击重新显示「${SECTIONS_LABELS[s] ?? s}」板块`}
                            onClick={() => toggleSection(s)}
                          >
                            {isVisible ? <Eye size={14} /> : <EyeOff size={14} />}
                            <span>{SECTIONS_LABELS[s] ?? s}</span>
                            <strong>{isVisible ? "已显示" : "已隐藏"}</strong>
                          </button>
                        );
                      })}
                      <span className="generate-sections-hint">点开关可增删要生成的板块</span>
                    </div>
                  </div>
                </div>
                <div className="generate-template-picker" data-template-carousel>
                  {/* 主预览区：随选中模板切换的大图，AI 内容与色板即时套用（问题 1：点卡时上面有对应变化） */}
                  {template && (
                    <div className={`generate-hero-preview${previewCollapsed ? " collapsed" : ""}`} data-template-hero-preview={template.id}>
                      {!previewCollapsed && (
                        <div className="generate-hero-preview-toolbar" aria-hidden="true">
                          <span className="generate-hero-preview-dot" />
                          <span className="generate-hero-preview-dot" />
                          <span className="generate-hero-preview-dot" />
                          <span className="generate-hero-preview-url">{template.name} · 真实模板预览</span>
                        </div>
                      )}
                      {!previewCollapsed && (
                        <div className="generate-hero-preview-frame">
                          <OpenSourceTemplateFrame
                            key={`hero-${template.id}`}
                            templateId={template.id}
                            draft={{ ...previewDraft, templateId: template.id }}
                            locale={siteLanguage}
                            variant="preview"
                            onPreviewStateChange={setTemplatePreviewState}
                          />
                        </div>
                      )}
                      <div className="generate-hero-preview-meta">
                        <div className="generate-hero-preview-title">
                          <strong>{template.name}</strong>
                          <span>{template.category} · {template.reason || "推荐模板"}</span>
                        </div>
                        <div className="generate-hero-preview-actions">
                          <button
                            type="button"
                            className="generate-preview-collapse-btn"
                            onClick={() => setPreviewCollapsed((c) => !c)}
                            aria-expanded={!previewCollapsed}
                            aria-label={previewCollapsed ? "展开大预览" : "收起大预览"}
                          >
                            {previewCollapsed ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
                            {previewCollapsed ? "展开预览" : "收起预览"}
                          </button>
                          <a
                            className="generate-real-preview-link"
                            href={`/templates/${template.id}/preview${generationCompletion?.siteId || regenerateSiteId ? `?siteId=${encodeURIComponent(generationCompletion?.siteId ?? regenerateSiteId ?? "")}` : ""}`}
                            target="_blank"
                            rel="noreferrer"
                            aria-label={`查看已填内容预览：${template.name}`}
                            onClick={() => {
                              if (generationCompletion?.siteId || regenerateSiteId) return;
                              try {
                                window.localStorage.setItem(REAL_PREVIEW_DRAFT_KEY, JSON.stringify({
                                  savedAt: Date.now(),
                                  draft: { ...previewDraft, templateId: template.id },
                                }));
                              } catch { /* 存储不可用时预览页会诚实展示模板原貌 */ }
                            }}
                          >
                            <ExternalLink size={13} /> 查看已填内容预览
                          </a>
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="generate-preview-heading">
                    <div>
                      <h3>推荐的现有模板</h3>
                      <span>真实模板预览 · AI 内容与设计变量即时套用</span>
                    </div>
                    <div className="generate-carousel-controls">
                      <span>{recommendationIndex + 1} / {recommendationTemplates.length}</span>
                      <button type="button" aria-label="上一个推荐模板" onClick={() => moveRecommendation(-1)} disabled={recommendationTemplates.length < 2}><ChevronLeft size={15} /></button>
                      <button type="button" aria-label="下一个推荐模板" onClick={() => moveRecommendation(1)} disabled={recommendationTemplates.length < 2}><ChevronRight size={15} /></button>
                    </div>
                  </div>
                  <div
                    className="generate-template-carousel"
                    ref={carouselRef}
                    onScroll={(event) => {
                      const target = event.currentTarget;
                      const first = target.querySelector<HTMLElement>("[data-template-card]");
                      const cardWidth = first?.getBoundingClientRect().width ?? target.clientWidth;
                      if (cardWidth) setRecommendationIndex(Math.max(0, Math.min(recommendationTemplates.length - 1, Math.round(target.scrollLeft / (cardWidth + 12)))));
                    }}
                  >
                    {recommendationTemplates.map((candidate, index) => {
                      const isActive = index === recommendationIndex;
                      const candidateDraft = candidate.id === template.id ? previewDraft : { ...previewDraft, templateId: candidate.id };
                      return (
                        <article
                          key={candidate.id}
                          className={`generate-template-option${isActive ? " active" : ""}`}
                          data-template-card={candidate.id}
                          onClick={() => chooseRecommendation(candidate, index)}
                          onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); chooseRecommendation(candidate, index); } }}
                          role="button"
                          tabIndex={0}
                          aria-label={`选择模板 ${candidate.name}`}
                        >
                          <div className="generate-template-option-label">
                            <span>{isActive ? "当前选择" : "备选模板"}</span>
                            {isActive && <Check size={13} />}
                          </div>
                          <div className="generate-template-option-cover">
                            <OpenSourceTemplateFrame
                              key={`real-${candidate.id}`}
                              templateId={candidate.id}
                              draft={candidateDraft}
                              locale={siteLanguage}
                              variant="thumbnail"
                              onPreviewStateChange={isActive ? setTemplatePreviewState : undefined}
                            />
                          </div>
                          <div className="generate-template-option-meta">
                            <strong>{candidate.name}</strong>
                            <span>{candidate.category}</span>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                  <div className="generate-template-selection-meta" data-template-selection={template.id}>
                    <div>
                      <strong>{template.name}</strong>
                      <span>{template.category} · {template.reason}</span>
                    </div>
                  </div>
                  <div className="generate-preview-sections" aria-live="polite">
                    {intent.coreSections.map((s) => (
                      <span key={s} className={`${hiddenSections.includes(s) ? "off" : "on"}${previewFeedback?.section === s ? " active" : ""}`}>
                        {hiddenSections.includes(s) ? <EyeOff size={11} /> : <Eye size={11} />}
                        {SECTIONS_LABELS[s] ?? s}
                      </span>
                    ))}
                  </div>
                  <select
                    className="generate-select"
                    value={template.id}
                    onChange={(e) => {
                      const selected = templates.find((t) => t.id === e.target.value);
                      if (selected) {
                        setTemplate({ ...template, id: selected.id, name: selected.name, category: selected.category });
                        const selectedIndex = recommendationTemplates.findIndex((item) => item.id === selected.id);
                        if (selectedIndex >= 0) setRecommendationIndex(selectedIndex);
                      }
                    }}
                  >
                    {["制造业", "外贸目录", "科技企业", "专业服务"].map((cat) => {
                      const group = templateOptions.filter((t) => t.category === cat);
                      if (!group.length) return null;
                      return (
                        <optgroup key={cat} label={cat === category ? `${cat}（推荐）` : cat}>
                          {group.map((t) => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </optgroup>
                      );
                    })}
                  </select>
                </div>
              </div>
              {error && <p className="generate-error"><AlertCircle size={13} />{error}</p>}
              {(intent.notices?.length || intent.conflicts?.length || intent.limits?.length) && (
                <div className="generate-tips">
                  {intent.notices?.map((n) => (
                    <div key={n} className="tip notice">ℹ {n}</div>
                  ))}
                  {intent.conflicts?.map((c) => (
                    <div key={c} className="tip conflict">⚠ {c}</div>
                  ))}
                  {intent.limits?.map((l) => (
                    <div key={l} className="tip limit">⛔ {l}</div>
                  ))}
                </div>
              )}
              {designTokenResult?.adjustments.length ? (
                <div className="generate-tips design-coordination-notice" aria-live="polite">
                  {designTokenResult.adjustments.map((adjustment) => (
                    <div key={adjustment} className="tip notice">设计变量已协调：{adjustment}</div>
                  ))}
                </div>
              ) : null}
              {regenerateSiteId && (
                <p className="generate-tips" style={{ marginBottom: 10 }}>
                  <span className="tip notice">ℹ 将在现有站点上重新生成初稿（覆盖当前内容，可通过历史撤销）</span>
                </p>
              )}
              <div className="generate-confirm-actions">
                <button className="secondary-button" disabled={busy} onClick={() => { setAdjusting(true); setStep("input"); }}>
                  <MessageSquareText size={15} /> 还想改 · 继续对话
                </button>
                <button className="primary-button" disabled={busy} onClick={() => void execute()}>
                  {busy ? <LoaderCircle size={15} className="spin" /> : <Sparkles size={15} />}
                  {busy ? progressText : "用此模板生成站点内容"} <ArrowRight size={15} />
                </button>
              </div>
            </div>
          )}

          {step === "generating" && (
            <div className="generate-progress-view">
              <div className="eyebrow">{generationCompletion ? "站点初稿已保存 · 等待你确认" : "复用模板结构 · AI 正在填充内容"}</div>
              <h1>{generationCompletion ? "当前结果已保存" : intent?.companyName || "你的网站"}</h1>
              <div className={`generate-building-preview ${generationPhase === "content" ? "" : generationPhase}`} aria-hidden="true">
                <div className="generate-building-bar"><i /><i /><i /><span /></div>
                <div className={`generate-building-hero ${generationSectionState("hero")}`}><span /><strong /><small /></div>
                <div className="generate-building-grid">
                  {generationSections.filter((section) => section !== "hero").map((section) => (
                    <span key={section} className={generationSectionState(section)} />
                  ))}
                </div>
                {(generationPhase === "review" || generationPhase === "saving") && <div className="generate-saving-shimmer" />}
              </div>
              <div className="generate-steps" aria-live="polite">
                <div className="generate-elapsed"><span>已用时间</span><strong>{generationElapsed} 秒</strong></div>
                {generationWaitNotice && <div className="step active" role="status"><LoaderCircle size={13} className="spin" />{generationWaitNotice}</div>}
                <div className="generate-completion-progress-meta" aria-live="polite">
                  <span>建站进度</span>
                  <strong>{generationProgressLabel}</strong>
                </div>
                <div
                  className="generate-completion-progress"
                  role="progressbar"
                  aria-label="建站进度"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={generationProgress}
                  aria-valuetext={generationProgressLabel}
                >
                  <span style={{ width: `${generationProgress}%` }} />
                </div>
                <div className="step done"><Check size={13} /> 理解需求</div>
                <div className="step done"><Check size={13} /> 匹配模板 · {template?.name}</div>
                <div className="generate-section-progress">
                  {generationSections.map((section) => {
                    const done = completedSections.includes(section);
                    const failed = failedSections.includes(section);
                    const recovering = recoveringSections.includes(section);
                    const active = activeSections.includes(section) && generationPhase === "content";
                    const state = done ? "done" : failed ? "failed" : recovering ? "recovering" : active ? "active" : "waiting";
                    return <div className={`step ${state}`} key={section}>{done ? <Check size={13} /> : failed ? <CircleAlert size={13} /> : active || recovering ? <LoaderCircle size={13} className="spin" /> : <span className="generate-step-dot" />}{SECTIONS_LABELS[section] ?? section}{recovering && <small>恢复中</small>}{failed && <small>稍后补全</small>}</div>;
                  })}
                </div>
                <div className={`step ${generationCompletion ? "done" : generationPhase === "review" || generationPhase === "saving" ? "active" : ""}`}>{generationCompletion ? <Check size={13} /> : generationPhase === "review" || generationPhase === "saving" ? <LoaderCircle size={13} className="spin" /> : <span className="generate-step-dot" />}{progressText}</div>
              </div>
              {generationCompletion?.requiresReview && (
                <section className="generate-terminal-panel" role="status">
                  <strong>{generationCompletion.rejected.length > 0 ? `初稿已保存，${generationCompletion.rejected.length} 项内容未写入模板` : generationCompletion.missingSections.length > 0 ? "初稿已保存，部分板块待补全" : generationCompletion.fallbackReason ? "已切换兼容模板并保存初稿" : generationCompletion.quality && !generationCompletion.quality.publishable ? "初稿已保存，建议处理内容质量问题" : "缺失板块已补全"}</strong>
                  <p>{generationCompletion.notice}</p>
                  {/*
                    被拒操作显性化（2026-09-11）：这些内容**没有写进模板**，
                    此前与"成功"混在一起完全静默。列出人话原因 + 操作指引。
                  */}
                  {generationCompletion.rejected.length > 0 && (
                    <div aria-label="未写入模板的内容" style={{ display: "grid", gap: 6 }}>
                      {generationCompletion.rejected.slice(0, 6).map((reason, index) => (
                        <div className="step failed" key={`${index}-${reason}`}>
                          <CircleAlert size={13} />
                          {reason}
                        </div>
                      ))}
                      {generationCompletion.rejected.length > 6 && (
                        <div className="step failed"><CircleAlert size={13} />另有 {generationCompletion.rejected.length - 6} 项，可在工作台让 AI 精简后重写</div>
                      )}
                    </div>
                  )}
                  {/*
                    2026-09-10 净删减：此处原有一段「缺口 N，伪造内容 N，说明性语句 N，超长 N，
                    待补充 N，语言问题 N，待确认事实 N」的**七项计数**。
                    用户明确答复「不点，我直接进工作台看」——他不看这个面板，
                    七项干巴巴的数字对他没有可操作性。真正有用的做法是
                    **进工作台后能定位到具体槽位**（见 app/workspace/page.tsx 的发布拦截提示）。
                  */}
                  {generationCompletion.missingSections.length > 0 && (
                    <div className="generate-section-progress" aria-label="待补全板块">
                      {generationCompletion.missingSections.map((section) => (
                        <div className={`step ${recoveringSections.includes(section) ? "recovering" : "failed"}`} key={section}>
                          {recoveringSections.includes(section) ? <LoaderCircle size={13} className="spin" /> : <CircleAlert size={13} />}
                          {SECTIONS_LABELS[section] ?? section}
                          <small>{recoveringSections.includes(section) ? "补全中" : "待补全"}</small>
                        </div>
                      ))}
                    </div>
                  )}
                  {generationCompletion.missingSections.length > 0 && (
                    <button type="button" className="primary-button" disabled={busy} onClick={() => void recoverMissingSections()}>
                      {busy ? <LoaderCircle size={15} className="spin" /> : <Sparkles size={15} />}
                      {busy ? "正在补全缺失板块" : "仅补全缺失板块"}
                    </button>
                  )}
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => enterGeneratedWorkspace(generationCompletion.siteId, generationCompletion.partial)}
                  >
                    <ArrowRight size={15} />
                    {generationCompletion.missingSections.length > 0 ? "进入工作台继续补全" : "进入工作台查看"}
                  </button>
                </section>
              )}
            </div>
          )}

          {step === "done" && (
            <div className="generate-progress-view">
              <div className="eyebrow">完成</div>
              <h1>站点内容已生成</h1>
              {generationDuration !== null && <p>共用时 {(generationDuration / 1000).toFixed(1)} 秒，正在进入工作台…</p>}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
