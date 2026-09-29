"use client";

import Link from "next/link";
import type { Route } from "next";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  ChevronRight,
  CloudUpload,
  FileSpreadsheet,
  FileText,
  Globe2,
  History,
  Image as ImageIcon,
  Laptop as Desktop,
  LoaderCircle,
  MessageSquareText,
  Moon,
  RotateCcw,
  RotateCw,
  Send,
  Smartphone as Mobile,
  Sparkles,
  Sun,
  Tablet,
  Trash2,
  X,
} from "lucide-react";
import { type ChangeEvent, type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import readXlsxFile from "read-excel-file";
import { OpenSourceTemplateFrame } from "@/components/open-source-template-frame";
import {
  defaultDraft,
  colorSetCatalog,
  paletteCatalogForVisualBrief,
  getTemplate,
  importProductsFromRows,
  normalizeDraft,
  templates,
  visualBriefCatalog,
  type Device,
  type Locale,
  type SiteDraft,
} from "@/lib/site-model";
import type { SiteOperation } from "@/lib/site-operations";
import { consumeSseFrames } from "@/lib/sse";
import {
  DEFAULT_WORKSPACE_SITE_ID,
  buildMaterialsChatMessage,
  parseWorkspaceSiteId,
  stripMaterialsInstruction,
  simulatedPackList,
  wrapCompanyMaterials,
  type SimulatedPackId,
} from "@/lib/simulated-packs";
import { findSitePage, pagePlanSourceLabel, previewPathForPage } from "@/lib/template-pages";
import { SiteDeleteDialog } from "@/components/site-delete-panel";
import { needsGuidedBusinessQuestion } from "@/lib/guided-flow";
import { createSiteOnce, resolveWorkspaceEntry, workspaceUrlForSite } from "@/lib/workspace-entry";
import { changeTargetLabels, describePreviewGaps } from "@/lib/workspace-copy";
import { templateAdapters } from "@/lib/template-adapters/registry";
import { userFacingError } from "@/lib/user-errors";
import { generateCustomPalette } from "@/lib/custom-brand-color";

const paletteSwatchRoles = ["background", "surface", "text", "muted", "border", "accent", "accentStrong", "input", "focus", "disabled"] as const;
const paletteRoleNames: Record<(typeof paletteSwatchRoles)[number], string> = {
  background: "背景", surface: "卡片", text: "正文", muted: "次要文字", border: "边线",
  accent: "强调", accentStrong: "强调（深）", input: "输入框", focus: "焦点", disabled: "不可用",
};
const historySourceNames: Record<string, string> = { ai: "对话", import: "表格导入", manual: "手动", migration: "迁移", template: "样子" };
const imageLicenseNames: Record<string, string> = { "user-provided": "用户提供" };
const imageScopeNames: Record<string, string> = { "current-site-only": "只用于本站", "generated-sites": "可用于生成站", "docs-only": "只用于文档" };

// Steps of one piece of work shown in the chat. A step with `match` becomes current when the
// server reports that status; `optional` steps are listed only once they are reached.
type JobStep = { label: string; match?: RegExp; optional?: boolean };
const chatEditJob: JobStep[] = [
  { label: "读你的要求" },
  { label: "生成修改", match: /调用模型|生成结构化/ },
  { label: "校验并写入草稿", match: /校验|保存草稿/ },
];
const alignmentStartJob: JobStep[] = [
  { label: "读资料和要求，规划页面和要问你的问题" },
  { label: "整理问题卡" },
];
const alignmentAnswerJob: JobStep[] = [
  { label: "保存你的选择" },
  { label: "按确认的方案生成修改", match: /应用已确认的方案|根据已保存的任务继续|调用模型/, optional: true },
  { label: "校验并写入草稿", match: /校验|保存草稿/, optional: true },
];
type ProgressView = { id: number; steps: JobStep[]; current: number; detail: string; closing: boolean };

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

function conversationStorageKey(siteId: string) {
  return `sitecraft-conversation:${siteId}`;
}

function slotExpectedTargets(targets: string[]) {
  return targets.filter((target) => (
    target !== "visualBrief"
    && target !== "template"
    && target !== "draft"
    && target !== "pagePlan"
    && target !== "sections.order"
    && !target.startsWith("siteName.")
    // The business goal guides generation; no look has a visitor slot for it.
    && !target.startsWith("goal.")
  ));
}


function readStoredConversationId(siteId: string) {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(conversationStorageKey(siteId));
}

type ChatStatus = "syncing" | "applied" | "warning" | "error" | "no_change" | "answer" | "clarify" | "alignment";
type AlignmentOptionCard = { id: string; label: string; description: string; recommended?: boolean; paletteId?: string; swatches?: string[] };
type AlignmentQuestionCard = { field?: string; questionId: string; prompt: string; options: AlignmentOptionCard[]; allowOther: boolean };
type AlignmentResultState = { status?: string; summary?: string; text?: string; revision?: number } | null;
type AlignmentViewState = {
  enabled: boolean;
  state: string;
  questionId: string | null;
  questionRevision: number;
  questionKind: string | null;
  selectedOptionId: string | null;
  selectedLabel: string | null;
  question: string;
  options: AlignmentOptionCard[];
  questions: AlignmentQuestionCard[];
  utilities: AlignmentOptionCard[];
  summary: string | null;
  saved: boolean;
  waitingForUser: boolean;
  awaitingConfirmation: boolean;
  prefsOnly: boolean;
  cannotProceed: boolean;
  pendingMessage: string | null;
  processing: boolean;
  answers: Array<{ questionId: string; optionId: string; question: string; label: string; note: string | null }>;
  lastResult: AlignmentResultState;
};
type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
  change?: string;
  status?: ChatStatus;
  revision?: number;
  meta?: string;
  options?: string[];
  alignment?: AlignmentViewState;
};
type HistoryItem = {
  id: string;
  revision: number;
  summary: string;
  source: string;
  appliedTargets: string[];
  createdAt: string;
};
type DraftSnapshot = {
  draft: SiteDraft;
  history: HistoryItem[];
  canUndo: boolean;
  canRedo: boolean;
  updatedAt: string;
  isNew?: boolean;
  hasGeneratedContent?: boolean;
};
type ProviderStatus = { mode: "deepseek" | "unconfigured"; model: string | null };
type SiteImageItem = {
  imageId: string;
  siteId: string;
  url: string;
  mime: string;
  width: number;
  height: number;
  byteLength: number;
  originalName: string;
  source: string;
  sourceUrl: string;
  license: string;
  licenseUrl: string | null;
  author: string;
  attribution: string;
  usageScope: string;
  retrievedAt: string;
  sha256: string;
  createdAt: string;
};
type ImageFactsView = {
  visibleText: string[];
  name: { zh: string; en: string };
  sellingPoints: { zh: string[]; en: string[] };
  category: string;
  alt: { zh: string; en: string };
  missingFacts: string[];
};

function readableWorkspaceError(value: unknown, fallback: string) {
  if (value && typeof value === "object") {
    const raw = value as { code?: unknown; status?: unknown; message?: unknown; error?: unknown; userMessage?: unknown; recovery?: unknown };
    return userFacingError({
      code: typeof raw.code === "string" ? raw.code : undefined,
      status: typeof raw.status === "number" ? raw.status : undefined,
      message: typeof raw.message === "string" ? raw.message : typeof raw.error === "string" ? raw.error : undefined,
      userMessage: typeof raw.userMessage === "string" ? raw.userMessage : undefined,
      recovery: typeof raw.recovery === "string" ? raw.recovery : undefined,
    }, fallback);
  }
  return userFacingError({ message: value instanceof Error ? value.message : undefined }, fallback);
}

const initialMessages: ChatMessage[] = [
  {
    id: "welcome",
    role: "assistant",
    text: "已载入当前站点。可以先提供公司资料，也可以直接说想怎么改首屏、产品、优势、常见问题或联系方式。",
  },
  {
    id: "guide",
    role: "assistant",
    text: "也可以在预览里点一块内容，再说改成什么。每次修改都存成新的草稿版本，右上角可以撤销。",
  },
];

async function readSseDone(response: Response, onStatus?: (value: string) => void) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("响应不可读取");
  const decoder = new TextDecoder();
  let rest = "";
  let doneEvent: Record<string, unknown> | undefined;
  while (true) {
    const result = await reader.read();
    rest += decoder.decode(result.value ?? new Uint8Array(), { stream: !result.done });
    const consumed = consumeSseFrames(rest);
    rest = consumed.rest;
    for (const item of consumed.events) {
      if (item.type === "status" && typeof item.value === "string") onStatus?.(item.value);
      if (item.type === "done") doneEvent = item;
    }
    if (result.done) break;
  }
  for (const item of consumeSseFrames(rest).events) {
    if (item.type === "done") doneEvent = item;
  }
  if (!doneEvent) throw new Error("没有返回完成事件");
  return doneEvent;
}

function asAlignmentOptions(value: unknown): AlignmentOptionCard[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const option = item as Record<string, unknown>;
    if (typeof option.id !== "string" || typeof option.label !== "string") return [];
    return [{
      id: option.id,
      label: option.label,
      description: typeof option.description === "string" ? option.description : "",
      recommended: option.recommended === true,
      paletteId: typeof option.paletteId === "string" ? option.paletteId : undefined,
      swatches: Array.isArray(option.swatches) ? option.swatches.filter((value): value is string => typeof value === "string") : undefined,
    }];
  });
}

function viewFromAlignmentDone(done: Record<string, unknown>): AlignmentViewState {
  const nested = done.alignment && typeof done.alignment === "object" ? done.alignment as Record<string, unknown> : {};
  const lastResult = nested.lastResult && typeof nested.lastResult === "object"
    ? nested.lastResult as AlignmentResultState
    : done.lastResult && typeof done.lastResult === "object"
      ? done.lastResult as AlignmentResultState
      : null;
  return {
    enabled: Boolean(nested.enabled ?? done.enabled),
    state: String(nested.state ?? done.state ?? ""),
    questionId: typeof nested.questionId === "string" ? nested.questionId : typeof done.questionId === "string" ? done.questionId : null,
    questionRevision: Number(nested.questionRevision ?? done.questionRevision ?? 0),
    questionKind: typeof nested.questionKind === "string" ? nested.questionKind : typeof done.questionKind === "string" ? done.questionKind : null,
    selectedOptionId: typeof nested.selectedOptionId === "string" ? nested.selectedOptionId : null,
    selectedLabel: typeof nested.selectedLabel === "string" ? nested.selectedLabel : null,
    question: String(nested.question ?? done.question ?? ""),
    options: asAlignmentOptions(nested.options ?? done.options),
    questions: Array.isArray(nested.questions) ? nested.questions.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const q = item as Record<string, unknown>;
      if (typeof q.questionId !== "string" || typeof q.prompt !== "string") return [];
      return [{ field: typeof q.field === "string" ? q.field : undefined, questionId: q.questionId, prompt: q.prompt, options: asAlignmentOptions(q.options), allowOther: Boolean(q.allowOther) }];
    }) : [],
    utilities: asAlignmentOptions(nested.utilities ?? done.utilities),
    summary: typeof nested.summary === "string" ? nested.summary : typeof done.summary === "string" ? done.summary : null,
    saved: Boolean(nested.saved ?? done.saved),
    waitingForUser: Boolean(nested.waitingForUser ?? done.waitingForUser),
    awaitingConfirmation: Boolean(nested.awaitingConfirmation ?? done.awaitingConfirmation),
    prefsOnly: Boolean(nested.prefsOnly ?? done.prefsOnly),
    cannotProceed: Boolean(nested.cannotProceed ?? done.cannotProceed),
    pendingMessage: typeof nested.pendingMessage === "string" ? nested.pendingMessage : typeof done.pendingMessage === "string" ? done.pendingMessage : null,
    processing: Boolean(nested.processing),
    answers: Array.isArray(nested.answers) ? nested.answers as AlignmentViewState["answers"] : [],
    lastResult,
  };
}

function alignmentMessageText(view: AlignmentViewState, action?: string) {
  if (view.processing) return "正在继续已保存的任务，刷新不会重复提交。";
  if (view.cannotProceed) return view.summary || "缺少足够信息，无法继续生成。";
  if (view.awaitingConfirmation) return view.question || "等待你选择是否应用当前方案。";
  if (view.waitingForUser) return view.question ? `等待你选择：${view.question}` : "等待你选择";
  if (view.prefsOnly) return "偏好已保存。";
  if (view.lastResult?.status === "applied" && typeof view.lastResult.revision === "number") {
    return `已应用已确认的方案，草稿 v${view.lastResult.revision}。`;
  }
  if (view.lastResult?.status === "error") return "需求对齐没有完成，草稿没有修改。请读取当前状态后重试。";
  if (view.lastResult?.status === "answer") return view.lastResult.text || view.lastResult.summary || "模型已回答。";
  if (view.lastResult?.summary) return view.lastResult.summary;
  if (action === "cancel" || view.state === "cancelled") return "已关闭需求对齐。已保存的选择仍保留在会话中。";
  return view.summary || "需求对齐已更新";
}

async function createSiteForTemplate(templateId: string): Promise<string> {
  const response = await fetch("/api/sites", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "未命名站点", templateId, locales: ["zh", "en"] }),
  });
  const created = await response.json().catch(() => ({})) as { id?: string; userMessage?: string };
  if (!response.ok || !created.id) throw new Error(created.userMessage || "新站点没有建成，请回到模板页重试。");
  return created.id;
}

export default function WorkspacePage() {
  const [siteId, setSiteId] = useState(DEFAULT_WORKSPACE_SITE_ID);
  const [draft, setDraft] = useState<SiteDraft>(defaultDraft);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [alignmentEnabled, setAlignmentEnabled] = useState(false);
  const [alignmentView, setAlignmentView] = useState<AlignmentViewState | null>(null);
  const [alignmentSelections, setAlignmentSelections] = useState<Record<string, string>>({});
  const [alignmentNotes, setAlignmentNotes] = useState<Record<string, string>>({});
  const [alignmentStep, setAlignmentStep] = useState(0);
  const [alignmentLeaving, setAlignmentLeaving] = useState(false);
  const stepDirectionRef = useRef<"next" | "back">("next");
  const [phoneLayout, setPhoneLayout] = useState(false);
  const [lookPanel, setLookPanel] = useState<"look" | "color" | null>(null);
  const [workspaceTheme, setWorkspaceTheme] = useState<"light" | "dark">("light");
  const [workspaceAccent, setWorkspaceAccent] = useState("porcelain");
  useEffect(() => {
    setAlignmentSelections(Object.fromEntries((alignmentView?.answers ?? []).map(a => [a.questionId, a.optionId])));
    setAlignmentNotes(Object.fromEntries((alignmentView?.answers ?? []).map(a => [a.questionId, a.note ?? ""])));
    setAlignmentStep(0);
  }, [alignmentView]);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 600px)");
    const update = () => setPhoneLayout(media.matches);
    update();
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, []);
  useEffect(() => {
    const storedTheme = window.localStorage.getItem("sitecraft-workspace-theme");
    const storedAccent = window.localStorage.getItem("sitecraft-workspace-accent");
    const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
    setWorkspaceTheme(storedTheme === "dark" || (!storedTheme && prefersDark) ? "dark" : "light");
    if (storedAccent && colorSetCatalog.some((item) => item.id === storedAccent)) setWorkspaceAccent(storedAccent);
  }, []);
  const toggleWorkspaceTheme = () => setWorkspaceTheme((theme) => { const next = theme === "light" ? "dark" : "light"; window.localStorage.setItem("sitecraft-workspace-theme", next); return next; });
  const chooseWorkspaceAccent = (accent: string) => { setWorkspaceAccent(accent); window.localStorage.setItem("sitecraft-workspace-accent", accent); };
  const [device, setDevice] = useState<Device>("desktop");
  const [locale, setLocale] = useState<Locale>("zh");
  const [showImport, setShowImport] = useState(false);
  const [showMaterials, setShowMaterials] = useState(false);
  const [showImages, setShowImages] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [materialsText, setMaterialsText] = useState("");
  const [brandColor, setBrandColor] = useState("#1f5aa6");
  const [loadedPackId, setLoadedPackId] = useState<SimulatedPackId | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [importState, setImportState] = useState<{ name: string; imported: number; errors: string[] } | null>(null);
  const [siteImages, setSiteImages] = useState<SiteImageItem[]>([]);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [imageFacts, setImageFacts] = useState<ImageFactsView | null>(null);
  const [imageNote, setImageNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [busyText, setBusyText] = useState("正在连接模型…");
  const [progress, setProgress] = useState<ProgressView | null>(null);
  const jobRef = useRef<{ id: number; steps: JobStep[]; current: number }>({ id: 0, steps: [], current: 0 });
  const [mobilePane, setMobilePane] = useState<"chat" | "preview">("chat");
  const [selectedTarget, setSelectedTarget] = useState<{ key: string; label: string } | null>(null);
  const [draftReady, setDraftReady] = useState(false);
  const [expectedTargets, setExpectedTargets] = useState<string[]>([]);
  const [lastChangedTargets, setLastChangedTargets] = useState<string[]>([]);
  const [previewState, setPreviewState] = useState<"loading" | "synced" | "warning">("loading");
  const [providerStatus, setProviderStatus] = useState<ProviderStatus>({ mode: "unconfigured", model: null });
  const [activePageId, setActivePageId] = useState("home");
  const fileRef = useRef<HTMLInputElement>(null);
  const brandLogoRef = useRef<HTMLInputElement>(null);
  const imageFileRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const startJob = (steps: JobStep[], text: string) => {
    jobRef.current = { id: jobRef.current.id + 1, steps, current: 0 };
    setBusyText(text);
    setBusy(true);
  };
  const advanceJob = (index: number, text: string) => {
    jobRef.current = { ...jobRef.current, current: Math.max(jobRef.current.current, index) };
    setBusyText(text);
  };
  const reportStatus = (value: string) => {
    const { steps, current } = jobRef.current;
    const next = steps.findIndex((step, index) => index > current && step.match?.test(value));
    if (next > current) jobRef.current = { ...jobRef.current, current: next };
    setBusyText(value);
  };
  useEffect(() => {
    if (busy) {
      // Each job is its own element, so a job that starts while the last one fades out enters fresh.
      setProgress({ id: jobRef.current.id, steps: jobRef.current.steps, current: jobRef.current.current, detail: busyText, closing: false });
      return;
    }
    // Finished or failed: the progress fades out, then leaves the conversation.
    setProgress((view) => (view ? { ...view, closing: true } : view));
    const timer = window.setTimeout(() => setProgress(null), prefersReducedMotion() ? 0 : 220);
    return () => window.clearTimeout(timer);
  }, [busy, busyText]);

  const adoptSnapshot = (snapshot: DraftSnapshot) => {
    setDraft(normalizeDraft(snapshot.draft));
    setHistory(snapshot.history ?? []);
    setCanUndo(Boolean(snapshot.canUndo));
    setCanRedo(Boolean(snapshot.canRedo));
    setUpdatedAt(snapshot.updatedAt ?? new Date().toISOString());
    setLastChangedTargets(changeTargetLabels(slotExpectedTargets(snapshot.history?.[0]?.appliedTargets ?? [])));
  };

  useEffect(() => {
    let cancelled = false;
    // `?site=` opens that site; `?template=` alone is the 新建站点 entry and creates a new site.
    async function resolveActiveSiteId() {
      const entry = resolveWorkspaceEntry(window.location.search, templates.map((item) => item.id), visualBriefCatalog.map((brief) => brief.templateId));
      if (entry.kind === "open") return parseWorkspaceSiteId(entry.siteId);
      if (entry.kind === "refuse") {
        throw new Error(`「${getTemplate(entry.templateId).name.split(" / ")[0]}」只作参考，不能直接生成网站。请回到模板页，从四个样子背后的模板开始。`);
      }
      const key = window.location.search;
      // Effects run twice in development; both runs share the one POST that is still in flight.
      const createdId = await createSiteOnce(key, () => createSiteForTemplate(entry.templateId));
      window.history.replaceState(null, "", workspaceUrlForSite(key, createdId));
      return createdId;
    }
    async function loadDraft() {
      let activeSiteId: string;
      try {
        activeSiteId = await resolveActiveSiteId();
      } catch (error) {
        if (!cancelled) {
          setMessages((items) => [...items, { id: crypto.randomUUID(), role: "assistant", status: "error", text: readableWorkspaceError(error, "新站点没有建成，请回到模板页重试。") }]);
        }
        return;
      }
      setSiteId(activeSiteId);
      try {
        let snapshot = await fetch(`/api/sites/${activeSiteId}/draft`, { cache: "no-store" }).then((response) => {
          if (!response.ok) throw new Error("无法读取草稿");
          return response.json() as Promise<DraftSnapshot>;
        });
        const saved = window.localStorage.getItem("sitecraft-draft");
        if (snapshot.isNew && saved) {
          try {
            const migrated = normalizeDraft(JSON.parse(saved));
            migrated.revision = snapshot.draft.revision;
            const response = await fetch(`/api/sites/${activeSiteId}/draft`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                baseRevision: snapshot.draft.revision,
                operations: [{ op: "replace_draft", draft: migrated }],
                summary: "迁移原浏览器草稿",
                source: "migration",
              }),
            });
            if (response.ok) snapshot = await response.json() as DraftSnapshot;
          } catch {
            /* A stale browser draft is ignored after schema validation fails. */
          }
        }
        window.localStorage.removeItem("sitecraft-draft");
        if (!cancelled) {
          adoptSnapshot(snapshot);
          // A site that was never generated starts with 需求对齐 on (spec §3.1); a saved
          // conversation restored below still decides the final state.
          if (!snapshot.hasGeneratedContent) setAlignmentEnabled(true);
          const requestedPage = new URLSearchParams(window.location.search).get("page");
          const nextPage = findSitePage(snapshot.draft.pagePlan, requestedPage);
          if (nextPage) setActivePageId(nextPage.id);
          setDraftReady(true);
          setPreviewState("loading");
          if (new URLSearchParams(window.location.search).get("import") === "products") setShowImport(true);
        }
      } catch (error) {
        if (!cancelled) {
          setMessages((items) => [...items, { id: crypto.randomUUID(), role: "assistant", status: "error", text: readableWorkspaceError(error, "草稿加载失败") }]);
          setDraftReady(true);
        }
      }
    }
    void loadDraft();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    fetch("/api/ai/status", { cache: "no-store" })
      .then((response) => response.json())
      .then((status: ProviderStatus) => setProviderStatus(status))
      .catch(() => setProviderStatus({ mode: "unconfigured", model: null }));
  }, []);
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages, busy, alignmentView]);

  useEffect(() => {
    if (!draftReady) return;
    const storedId = readStoredConversationId(siteId);
    if (!storedId) return;
    setConversationId(storedId);
    let cancelled = false;
    async function restoreAlignment() {
      try {
        const response = await fetch(`/api/sites/${siteId}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "state",
            conversationId: storedId,
          }),
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({})) as { message?: string; error?: string };
          if (!cancelled) {
            setMessages((items) => [...items, {
              id: crypto.randomUUID(),
              role: "assistant",
              status: "warning",
              text: readableWorkspaceError(payload, "无法恢复需求对齐状态。"),
              change: "没有静默创建新会话",
            }]);
          }
          return;
        }
        const doneEvent = await readSseDone(response);
        if (cancelled) return;
        if (doneEvent.draft) adoptSnapshot(doneEvent as unknown as DraftSnapshot);
        const view = viewFromAlignmentDone(doneEvent);
        const live = view.enabled || view.waitingForUser || view.prefsOnly || Boolean(view.lastResult) || view.state === "cancelled";
        setAlignmentView(live ? view : null);
        setAlignmentEnabled(view.enabled);
        if (live) {
          setMessages((items) => [...items, {
            id: crypto.randomUUID(),
            role: "assistant",
            status: view.lastResult?.status === "applied" ? "applied" : "alignment",
            text: alignmentMessageText(view, String(doneEvent.action || "state")),
            alignment: view,
            revision: view.lastResult?.revision,
            change: view.waitingForUser ? "等待你选择" : view.prefsOnly ? "偏好已保存" : undefined,
          }]);
        }
        if (typeof doneEvent.conversationId === "string") {
          setConversationId(doneEvent.conversationId);
          window.localStorage.setItem(conversationStorageKey(siteId), doneEvent.conversationId);
        }
      } catch (error) {
        if (!cancelled) {
          setMessages((items) => [...items, {
            id: crypto.randomUUID(),
            role: "assistant",
            status: "warning",
            text: readableWorkspaceError(error, "无法恢复需求对齐状态。"),
            change: "没有静默创建新会话",
          }]);
        }
      }
    }
    void restoreAlignment();
    return () => { cancelled = true; };
  }, [draftReady, siteId]);

  const currentTemplate = getTemplate(draft.templateId);
  const legacyLookRetained = draft.legacyVisualBriefId === "editorial-service" || draft.visualBrief.id === "editorial-service";
  const activePage = findSitePage(draft.pagePlan, activePageId);
  const previewPagePath = previewPathForPage(activePage);
  const pageUrlSuffix = activePage?.placement === "route"
    ? `/${previewPagePath || ""}`.replace(/\/$/, "") || "/"
    : activePage?.section ? `/#${activePage.section}` : "/";

  useEffect(() => {
    const next = findSitePage(draft.pagePlan, activePageId);
    if (next && next.id !== activePageId) setActivePageId(next.id);
  }, [activePageId, draft.pagePlan]);

  const selectSitePage = (pageId: string) => {
    setActivePageId(pageId);
    const url = new URL(window.location.href);
    url.searchParams.set("page", pageId);
    window.history.replaceState(null, "", url);
    setPreviewState("loading");
  };

  const saveLabel = useMemo(() => {
    if (!draftReady) return "正在读取草稿";
    if (previewState === "loading") return "草稿已保存 · 正在同步预览";
    if (previewState === "warning") return "草稿已保存 · 部分内容未显示";
    return "草稿与预览已同步";
  }, [draftReady, previewState]);

  const selectPreviewTarget = (key: string, label: string, prompt: string) => {
    setSelectedTarget({ key, label });
    setInput(prompt);
    setMobilePane("chat");
    window.requestAnimationFrame(() => inputRef.current?.focus());
  };

  const applyDoneEvent = (done: Record<string, unknown>) => {
    if (typeof done.conversationId === "string") {
      setConversationId(done.conversationId);
      window.localStorage.setItem(conversationStorageKey(siteId), done.conversationId);
    }
    const status = String(done.status);
    const view = viewFromAlignmentDone(done);
    const hasAlignment = Boolean(done.alignment) || status === "alignment" || view.enabled || view.waitingForUser || view.prefsOnly;
    if (hasAlignment) {
      const live = view.enabled || view.waitingForUser || view.prefsOnly || Boolean(view.lastResult) || view.state === "cancelled";
      setAlignmentView(live ? view : null);
      setAlignmentEnabled(view.enabled);
    }
    if ((status === "applied" || status === "no_change" || status === "conflict") && done.draft) adoptSnapshot(done as unknown as DraftSnapshot);
    if (done.action === "state" && view.processing) return;
    const latency = typeof done.latencyMs === "number" ? `模型 ${Math.max(0.1, done.latencyMs / 1000).toFixed(1)} 秒` : undefined;
    if (status === "applied" && done.replayed === true) {
      setMessages((items) => [...items, {
        id: crypto.randomUUID(), role: "assistant", status: "applied",
        text: `${alignmentMessageText(view)} 已读取当前草稿，本次没有重复提交。`,
      }]);
    } else if (status === "applied") {
      const changeSet = done.changeSet as { revision: number; appliedTargets: string[] };
      setExpectedTargets(slotExpectedTargets(changeSet.appliedTargets));
      setPreviewState("loading");
      setMessages((items) => [...items, {
        id: crypto.randomUUID(), role: "assistant", status: "syncing", revision: changeSet.revision,
        text: `草稿 v${changeSet.revision} 已保存，正在确认右侧模板已实际更新。`,
        change: String(done.summary), meta: latency,
        alignment: hasAlignment ? view : undefined,
      }]);
    } else if (status === "no_change") {
      setMessages((items) => [...items, { id: crypto.randomUUID(), role: "assistant", status: "no_change", text: "模型没有生成可应用的内容差异，草稿和模板均未修改。", change: String(done.summary || "没有变化"), meta: latency }]);
    } else if (status === "conflict") {
      setMessages((items) => [...items, { id: crypto.randomUUID(), role: "assistant", status: "warning", text: String(done.error), change: "没有覆盖较新的草稿" }]);
    } else if (status === "answer") {
      setMessages((items) => [...items, {
        id: crypto.randomUUID(), role: "assistant", status: "answer",
        text: String(done.text || done.summary || "模型已回答，但没有返回内容。"), meta: latency,
      }]);
    } else if (status === "clarify") {
      const stringOptions = Array.isArray(done.options)
        ? done.options.filter((option): option is string => typeof option === "string")
        : [];
      setMessages((items) => [...items, {
        id: crypto.randomUUID(),
        role: "assistant",
        status: view.waitingForUser ? "alignment" : "clarify",
        text: view.waitingForUser ? alignmentMessageText(view) : String(done.question || "还需要你补充一点信息。"),
        options: view.waitingForUser ? undefined : stringOptions,
        alignment: view.waitingForUser || view.options.length ? view : undefined,
        meta: latency,
        change: view.waitingForUser ? "等待你选择" : undefined,
      }]);
    } else if (status === "alignment") {
      setMessages((items) => [...items, {
        id: crypto.randomUUID(),
        role: "assistant",
        status: "alignment",
        text: alignmentMessageText(view, String(done.action || "")),
        alignment: view,
        change: view.waitingForUser ? "等待你选择" : view.saved ? "已保存选择" : view.prefsOnly ? "偏好已保存" : undefined,
      }]);
    } else {
      const safeText = readableWorkspaceError(done, "模型操作失败");
      setMessages((items) => [...items, {
        id: crypto.randomUUID(), role: "assistant", status: "error",
        text: safeText, change: "请以服务器草稿和恢复状态为准",
      }]);
    }
    if (done.conversationPersisted === false) {
      setMessages((items) => [...items, {
        id: crypto.randomUUID(),
        role: "assistant",
        status: "warning",
        text: String(done.conversationError || "会话历史保存失败"),
        change: "会话历史没有写入，草稿以当前版本为准",
      }]);
    }
    setSelectedTarget(null);
  };

  const runAlignment = async (body: Record<string, unknown>, options?: { force?: boolean }) => {
    if (busy && !options?.force) return;
    const planning = body.action === "start" && Boolean(body.message);
    if (planning) startJob(alignmentStartJob, "正在读资料和要求，规划页面和要问你的问题…");
    else startJob(alignmentAnswerJob, body.action === "state" ? "正在读取需求对齐的进度…" : body.action === "cancel" ? "正在关闭需求对齐…" : "正在保存你的选择…");
    try {
      const response = await fetch(`/api/sites/${siteId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...body,
          conversationId: body.conversationId ?? conversationId,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as { message?: string; userMessage?: string; error?: string; code?: string; recovery?: string; alignment?: AlignmentViewState };
        if (payload.alignment) {
          setAlignmentView(payload.alignment);
          setAlignmentEnabled(payload.alignment.enabled);
        }
        throw new Error(readableWorkspaceError(payload, "需求对齐请求失败"));
      }
      if (planning) advanceJob(1, "正在整理问题卡…");
      const doneEvent = await readSseDone(response, reportStatus);
      applyDoneEvent(doneEvent);
      if ((body.action === "start" && body.message) || (body.action === "select" && body.optionId === "other")) setInput("");
    } catch (error) {
      setMessages((items) => [...items, {
        id: crypto.randomUUID(),
        role: "assistant",
        status: "error",
        text: readableWorkspaceError(error, "需求对齐失败"),
        change: "请以服务器草稿和恢复状态为准",
      }]);
    } finally {
      setBusy(false);
    }
  };

  const restoreStartedRef = useRef<number | null>(null);
  useEffect(() => {
    if (!alignmentView?.processing || !conversationId) {
      restoreStartedRef.current = null;
      return;
    }
    if (busy) return;
    restoreStartedRef.current ??= Date.now();
    // The server may run two 90 s generation attempts; stop polling only after that.
    if (Date.now() - restoreStartedRef.current > 200_000) {
      setMessages((items) => [...items, { id: crypto.randomUUID(), role: "assistant", status: "warning", text: "任务仍未返回最终状态，已停止自动读取。请刷新检查服务器状态，避免重复执行。" }]);
      return;
    }
    const timer = window.setTimeout(() => { void runAlignment({ action: "state" }); }, 2000);
    return () => window.clearTimeout(timer);
  }, [alignmentView, busy, conversationId]);

  const toggleAlignment = async (enabled: boolean) => {
    if (!enabled) {
      if (!conversationId) {
        setAlignmentEnabled(false);
        setAlignmentView(null);
        return;
      }
      await runAlignment({ action: "cancel", conversationId });
      return;
    }
    const pending = input.trim();
    // Enabling the optional mode alone does not start a fixed questionnaire.
    // The first question is planned from the Prompt when the user submits it.
    if (!pending) {
      setAlignmentEnabled(true);
      setAlignmentView(null);
      return;
    }
    await runAlignment({
      action: "start",
      conversationId,
      ...(pending ? { message: pending, baseRevision: draft.revision, selectedTarget: selectedTarget?.key ?? null } : {}),
    });
  };

  const shouldGuideBusinessRequest = needsGuidedBusinessQuestion;

  const sendChat = async (value: string) => {
    if (!value || busy || !draftReady) return false;
    if (alignmentEnabled) {
      setMessages((items) => [...items, { id: crypto.randomUUID(), role: "user", text: stripMaterialsInstruction(value) }]);
      setAlignmentEnabled(true);
      await runAlignment({
        action: "start",
        message: value,
        baseRevision: draft.revision,
        selectedTarget: selectedTarget?.key ?? null,
      });
      return true;
    }
    if (shouldGuideBusinessRequest(value)) {
      setMessages((items) => [...items, { id: crypto.randomUUID(), role: "user", text: stripMaterialsInstruction(value) }]);
      setAlignmentEnabled(true);
      await runAlignment({
        action: "start",
        message: value,
        baseRevision: draft.revision,
        selectedTarget: selectedTarget?.key ?? null,
      });
      return true;
    }
    startJob(chatEditJob, "正在读你的要求…");
    setMessages((items) => [...items, { id: crypto.randomUUID(), role: "user", text: stripMaterialsInstruction(value) }]);
    try {
      const response = await fetch(`/api/sites/${siteId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseRevision: draft.revision,
          message: value,
          selectedTarget: selectedTarget?.key ?? null,
          conversationId,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as Partial<DraftSnapshot> & { message?: string; userMessage?: string; error?: string; code?: string; recovery?: string; alignment?: AlignmentViewState };
        if (payload.draft) adoptSnapshot(payload as DraftSnapshot);
        if (payload.alignment) {
          setAlignmentView(payload.alignment);
          setAlignmentEnabled(payload.alignment.enabled);
        }
        throw new Error(readableWorkspaceError({ ...payload, status: response.status }, response.status === 409 ? "草稿版本冲突，已载入最新版本，请重新发送。" : "AI 请求失败"));
      }
      const doneEvent = await readSseDone(response, reportStatus);
      applyDoneEvent(doneEvent);
      return true;
    } catch (error) {
      setMessages((items) => [...items, { id: crypto.randomUUID(), role: "assistant", status: "error", text: readableWorkspaceError(error, "AI 修改失败"), change: "请以服务器草稿和恢复状态为准" }]);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const submitChat = async (event?: FormEvent) => {
    event?.preventDefault();
    const value = input.trim();
    if (!value || busy || !draftReady) return;
    setInput("");
    const sent = await sendChat(value);
    if (!sent) setInput(value);
  };

  const loadSimulatedPack = (packId: SimulatedPackId) => {
    const pack = simulatedPackList.find((item) => item.id === packId);
    if (!pack) return;
    setLoadedPackId(pack.id);
    setMaterialsText(pack.body);
  };

  const submitMaterials = async () => {
    const source = materialsText.trim();
    if (!source || busy || !draftReady) return;
    const pack = loadedPackId ? simulatedPackList.find((item) => item.id === loadedPackId) : undefined;
    const message = pack && source === pack.body
      ? buildMaterialsChatMessage(pack)
      : wrapCompanyMaterials(source);
    setShowMaterials(false);
    await sendChat(message);
  };

  const handlePreviewReport = (report: {
    revision: number;
    appliedSlots: string[];
    missingSlots: string[];
    fallbackMatched: string[];
    proposedAlternatives: Array<{ requested: string; proposed: string }>;
  }) => {
    if (report.revision !== draft.revision) return;
    const hasExpectedTargets = expectedTargets.length > 0;
    const visibleTargets = expectedTargets.filter((target) => {
      const language = target.match(/\.(zh|en)$/)?.[1];
      return !language || language === locale || target === "companyName.zh";
    });
    if (hasExpectedTargets && visibleTargets.length === 0) {
      const editedLanguage = expectedTargets.some((target) => target.endsWith(".en")) ? "英文" : "中文";
      setPreviewState("synced");
      setMessages((items) => items.map((message) => message.revision === report.revision && message.status === "syncing"
        ? { ...message, status: "applied", text: `草稿 v${report.revision} 已保存；${editedLanguage}内容已更新，切换语言即可查看。` }
        : message));
      setExpectedTargets([]);
      return;
    }
    const missing = hasExpectedTargets
      ? report.missingSlots.filter((target) => visibleTargets.includes(target))
      : [];
    const fallback = report.fallbackMatched.filter((target) => !hasExpectedTargets || visibleTargets.includes(target));
    const proposals = report.proposedAlternatives.filter((item) => missing.includes(item.requested));
    setPreviewState(missing.length || fallback.length ? "warning" : "synced");
    if (!hasExpectedTargets) {
      // Changes with nothing to place in the preview (page plan only) are done once it reloads.
      setMessages((items) => items.map((message) => message.revision === report.revision && message.status === "syncing"
        ? { ...message, status: "applied", text: `草稿 v${report.revision} 已保存，预览已更新。` }
        : message));
      return;
    }
    setMessages((items) => items.map((message) => {
      if (message.revision !== report.revision || message.status !== "syncing") return message;
      if (missing.length || fallback.length) {
        const gaps = describePreviewGaps({ revision: report.revision, missing, fallback, proposals });
        return {
          ...message,
          status: "warning",
          text: gaps.text,
          change: [message.change, gaps.change].filter(Boolean).join("；"),
        };
      }
      return { ...message, status: "applied", text: `草稿 v${report.revision} 已保存，右侧模板已确认更新。` };
    }));
    setExpectedTargets([]);
  };

  const moveHistory = async (action: "undo" | "redo") => {
    if (busy) return;
    const text = action === "undo" ? "正在撤销并保存…" : "正在重做并保存…";
    startJob([{ label: text }], text);
    try {
      const response = await fetch(`/api/sites/${siteId}/history/${action}`, { method: "POST" });
      const result = await response.json() as DraftSnapshot & { status: string; appliedTargets?: string[] };
      if (!response.ok || result.status !== "applied") throw new Error(action === "undo" ? "没有可撤销的修改" : "没有可重做的修改");
      adoptSnapshot(result);
      setExpectedTargets(slotExpectedTargets(result.appliedTargets ?? []));
      setPreviewState("loading");
    } catch (error) {
      setMessages((items) => [...items, { id: crypto.randomUUID(), role: "assistant", status: "error", text: readableWorkspaceError(error, "历史操作失败") }]);
    } finally {
      setBusy(false);
    }
  };

  const saveOperations = async (operations: SiteOperation[], summary: string, source: "import" | "manual" | "template") => {
    const response = await fetch(`/api/sites/${siteId}/draft`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ baseRevision: draft.revision, operations, summary, source }),
    });
    const result = await response.json() as DraftSnapshot & { error?: string; changeSet?: { appliedTargets: string[]; revision?: number } };
    if (!response.ok) throw new Error(readableWorkspaceError({ ...result, status: response.status }, "草稿保存失败"));
    adoptSnapshot(result);
    const appliedTargets = slotExpectedTargets((result.changeSet?.appliedTargets ?? []).filter((target) => target !== "visualBrief" && target !== "template" && target !== "draft"));
    setExpectedTargets(appliedTargets);
    setLastChangedTargets(changeTargetLabels(appliedTargets));
    setPreviewState("loading");
    return result;
  };

  const selectVisualBrief = async (briefId: string) => {
    if (busy || !draftReady) return;
    const brief = visualBriefCatalog.find((item) => item.id === briefId);
    if (!brief) return;
    const alreadySelected = brief.id === draft.visualBrief.id && brief.templateId === draft.templateId;
    if (alreadySelected && !draft.legacyVisualBriefId) return;
    startJob([{ label: "正在切换样子…" }], "正在切换样子…");
    try {
      await saveOperations([{ op: "set_visual_brief", briefId: brief.id }], `选择样子 ${brief.label}`, "template");
      setMessages((items) => [...items, {
        id: crypto.randomUUID(),
        role: "assistant",
        status: "applied",
        text: `已切换为“${brief.label}”，右侧预览将使用对应版式与配色。已有内容保持不变。`,
        change: `受众：${brief.audience} · 主要行动：${brief.primaryAction}`,
      }]);
    } catch (error) {
      setMessages((items) => [...items, {
        id: crypto.randomUUID(),
        role: "assistant",
        status: "error",
        text: readableWorkspaceError(error, "样子保存失败"),
      }]);
    } finally {
      setBusy(false);
    }
  };

  const selectPalette = async (paletteId: string) => {
    if (busy || !draftReady) return;
    const palette = paletteCatalogForVisualBrief(draft.visualBrief.id).find((item) => item.id === paletteId);
    if (!palette || (draft.paletteId === palette.id && !draft.customPalette)) return;
    startJob([{ label: "正在切换色板…" }], "正在切换色板…");
    try {
      await saveOperations([{ op: "set_palette", paletteId: palette.id }], `选择色彩集 ${palette.label}`, "template");
      setMessages((items) => [...items, {
        id: crypto.randomUUID(),
        role: "assistant",
        status: "applied",
        text: `已切换为“${palette.label}”，保留当前${draft.visualBrief.label}版式、文案、产品和图片。`,
        change: palette.summary,
      }]);
    } catch (error) {
      setMessages((items) => [...items, {
        id: crypto.randomUUID(),
        role: "assistant",
        status: "error",
        text: readableWorkspaceError(error, "色板保存失败"),
      }]);
    } finally {
      setBusy(false);
    }
  };

  const applyCustomBrandColor = async (sourceColor: string, source: "color" | "logo") => {
    if (busy || !draftReady) return;
    try {
      const generated = generateCustomPalette(sourceColor, source);
      startJob([{ label: "正在生成品牌色板…" }], "正在生成品牌色板…");
      await saveOperations([{ op: "set_custom_palette", palette: generated.palette }], "应用自定义品牌色板", "manual");
      setMessages((items) => [...items, {
        id: crypto.randomUUID(),
        role: "assistant",
        status: "applied",
        text: generated.palette.adjustmentNote,
        change: `已从${source === "logo" ? "Logo" : "主色"}生成整套品牌色板。可在历史里撤销。`,
      }]);
    } catch (error) {
      setMessages((items) => [...items, { id: crypto.randomUUID(), role: "assistant", status: "error", text: readableWorkspaceError(error, "品牌色板生成失败") }]);
    } finally {
      setBusy(false);
    }
  };

  const sampleLogoColor = async (file: File) => {
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = url;
      await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error("无法读取 Logo 图片")); });
      const canvas = document.createElement("canvas");
      canvas.width = 64; canvas.height = 64;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("当前浏览器无法读取 Logo 颜色");
      context.drawImage(image, 0, 0, 64, 64);
      const pixels = context.getImageData(0, 0, 64, 64).data;
      let red = 0; let green = 0; let blue = 0; let weight = 0;
      for (let index = 0; index < pixels.length; index += 4) {
        const alpha = pixels[index + 3] / 255;
        const max = Math.max(pixels[index], pixels[index + 1], pixels[index + 2]);
        const min = Math.min(pixels[index], pixels[index + 1], pixels[index + 2]);
        const saturation = (max - min) / 255;
        const brightness = max / 255;
        const sampleWeight = alpha * (0.2 + saturation) * (brightness > 0.97 ? 0.1 : 1);
        red += pixels[index] * sampleWeight;
        green += pixels[index + 1] * sampleWeight;
        blue += pixels[index + 2] * sampleWeight;
        weight += sampleWeight;
      }
      if (!weight) throw new Error("Logo 没有可用的颜色像素");
      const sampled = `#${[red, green, blue].map((value) => Math.round(value / weight).toString(16).padStart(2, "0")).join("")}`;
      setBrandColor(sampled);
      await applyCustomBrandColor(sampled, "logo");
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  const commitImportedRows = async (name: string, rows: Record<string, string>[]) => {
    const result = importProductsFromRows(draft, rows);
    try {
      await saveOperations([{ op: "replace_products", products: result.products }], `导入商品表格 ${name}`, "import");
      setImportState({ name, imported: result.imported, errors: result.errors });
    } catch (error) {
      setImportState({ name, imported: 0, errors: [readableWorkspaceError(error, "导入失败")] });
    }
    setShowImport(true);
  };

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.name.toLowerCase().endsWith(".xlsx")) {
      const rows = await readXlsxFile(file);
      const [header, ...body] = rows;
      const keys = (header ?? []).map((cell) => String(cell ?? "").trim());
      await commitImportedRows(file.name, body.map((row) => Object.fromEntries(keys.map((key, index) => [key, String(row[index] ?? "")]))));
    } else {
      Papa.parse<Record<string, string>>(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => { void commitImportedRows(file.name, results.data); },
      });
    }
    event.target.value = "";
  };

  const loadSiteImages = async () => {
    const response = await fetch(`/api/sites/${siteId}/images`, { cache: "no-store" });
    const payload = await response.json() as { images?: SiteImageItem[]; error?: string };
    if (!response.ok) throw new Error(payload.error || "无法读取站点图片");
    const images = payload.images ?? [];
    setSiteImages(images);
    if (selectedImageId && !images.some((item) => item.imageId === selectedImageId)) {
      setSelectedImageId(images[0]?.imageId ?? null);
      setImageFacts(null);
    } else if (!selectedImageId && images[0]) {
      setSelectedImageId(images[0].imageId);
    }
    return images;
  };

  const openImageLibrary = async () => {
    setShowImages(true);
    setImageNote(null);
    try {
      await loadSiteImages();
    } catch (error) {
      setImageNote(readableWorkspaceError(error, "无法读取站点图片"));
    }
  };

  const handleImageFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || busy || !draftReady) return;
    let resumeImageId: string | null = null;
    startJob([{ label: "正在保存产品图…" }], "正在保存产品图…");
    setImageNote(null);
    setImageFacts(null);
    try {
      const form = new FormData();
      form.set("file", file);
      const response = await fetch(`/api/sites/${siteId}/images`, { method: "POST", body: form });
      const payload = await response.json() as { image?: SiteImageItem; error?: string };
      if (!response.ok || !payload.image) throw new Error(payload.error || "上传失败");
      const uploaded = payload.image;
      setSiteImages((items) => [uploaded, ...items.filter((item) => item.imageId !== uploaded.imageId)]);
      setSelectedImageId(uploaded.imageId);
      setImageNote(`已保存到本站 · ${imageLicenseNames[uploaded.license] ?? uploaded.license} · ${uploaded.width}×${uploaded.height}`);
      setMessages((items) => [...items, {
        id: crypto.randomUUID(),
        role: "assistant",
        status: "applied",
        text: "产品图已上传到这个站点，还没放进页面。可以先分析图里的信息，再放到首屏或第一个产品。",
        change: `${uploaded.originalName} 已保存到本站`,
      }]);
      if (alignmentView?.questionId === "image-upload") resumeImageId = uploaded.imageId;
    } catch (error) {
      setImageNote(readableWorkspaceError(error, "上传失败"));
    } finally {
      setBusy(false);
    }
    if (resumeImageId) {
      setShowImages(false);
      await runAlignment({ action: "image_ready", conversationId, imageId: resumeImageId }, { force: true });
    }
  };

  const analyzeSelectedImage = async () => {
    if (!selectedImageId || busy) return;
    startJob([{ label: "正在看图摘录事实…" }], "正在看图摘录事实…");
    setImageNote(null);
    try {
      const response = await fetch(`/api/sites/${siteId}/images/${selectedImageId}/analyze`, { method: "POST" });
      const payload = await response.json() as { facts?: ImageFactsView; error?: string; model?: string; latencyMs?: number };
      if (!response.ok || !payload.facts) throw new Error(payload.error || "分析失败");
      const facts = payload.facts;
      setImageFacts(facts);
      const missing = facts.missingFacts.length ? facts.missingFacts.join("、") : "无";
      setImageNote(`看图完成${payload.model ? ` · ${payload.model}` : ""}。缺口：${missing}`);
      setMessages((items) => [...items, {
        id: crypto.randomUUID(),
        role: "assistant",
        status: "answer",
        text: `已看图，未改草稿。可见文字 ${facts.visibleText.length} 条；名称 ${facts.name.zh}；缺口 ${missing}。`,
        change: "只读取了图片，没有修改草稿",
        meta: typeof payload.latencyMs === "number" ? `模型 ${Math.max(0.1, payload.latencyMs / 1000).toFixed(1)} 秒` : undefined,
      }]);
    } catch (error) {
      setImageNote(readableWorkspaceError(error, "分析失败"));
    } finally {
      setBusy(false);
    }
  };

  const applySelectedImage = async (kind: "hero" | "product") => {
    const image = siteImages.find((item) => item.imageId === selectedImageId);
    if (!image || busy || !draftReady) return;
    const alt = imageFacts?.alt ?? { zh: "待补充", en: "To be completed" };
    const operations: SiteOperation[] = kind === "hero"
      ? [{ op: "set_image_slot", target: "hero.image", imageId: image.imageId, url: image.url, alt }]
      : draft.products[0]
        ? [{ op: "set_product_image", sku: draft.products[0].sku, imageId: image.imageId, url: image.url, alt }]
        : [];
    if (!operations.length) {
      setImageNote("当前草稿没有商品，无法写入产品图。");
      return;
    }
    startJob([{ label: "正在放入图片…" }], "正在放入图片…");
    try {
      const saved = await saveOperations(operations, kind === "hero" ? "把已上传的产品图放到首屏" : `把已上传的产品图放到产品「${draft.products[0].name.zh}」`, "manual");
      setMessages((items) => [...items, {
        id: crypto.randomUUID(),
        role: "assistant",
        status: "syncing",
        revision: saved.draft.revision,
        text: kind === "hero"
          ? "已放到首屏图片。当前样子没有首屏图片位置时会提示没有显示，不会换到别的图片上。"
          : `已放到产品「${draft.products[0].name.zh}」的图片。当前样子没有这个产品的图片位置时会提示没有显示。`,
      }]);
    } catch (error) {
      setImageNote(readableWorkspaceError(error, "写入失败"));
    } finally {
      setBusy(false);
    }
  };

  const alignmentQuestions = alignmentView?.questions ?? [];
  const alignmentStepIndex = Math.min(alignmentStep, Math.max(0, alignmentQuestions.length - 1));
  const visibleAlignmentQuestions = phoneLayout
    ? alignmentQuestions.slice(alignmentStepIndex, alignmentStepIndex + 1)
    : alignmentQuestions;
  const activeAlignmentQuestion = alignmentQuestions[alignmentStep];
  // 配色按所选样子显示: color-set swatches follow the look picked in the same card.
  const cardColorSwatches = (optionId: string, fallback?: string[]) => {
    const lookQuestion = alignmentQuestions.find((item) => item.field === "style");
    const brief = lookQuestion ? visualBriefCatalog.find((item) => item.id === alignmentSelections[lookQuestion.questionId]) : undefined;
    const setId = optionId.startsWith("colorSet:") ? optionId.slice("colorSet:".length) : "";
    const palette = brief && setId ? paletteCatalogForVisualBrief(brief.id).find((item) => item.colorSet === setId) : undefined;
    const tokens = brief && palette ? templateAdapters[brief.templateId]?.kit?.palettes?.[palette.id] : undefined;
    if (!tokens) return fallback;
    return [tokens.background, tokens.surface, tokens.text, tokens.accent, tokens.accentStrong, tokens.border].filter((value): value is string => Boolean(value));
  };
  const activeAlignmentReady = Boolean(activeAlignmentQuestion && alignmentSelections[activeAlignmentQuestion.questionId] && (alignmentSelections[activeAlignmentQuestion.questionId] !== "other" || alignmentNotes[activeAlignmentQuestion.questionId]?.trim()));
  const alignmentComplete = alignmentQuestions.every((item) => alignmentSelections[item.questionId] && (alignmentSelections[item.questionId] !== "other" || alignmentNotes[item.questionId]?.trim()));
  const goToAlignmentStep = (next: number) => {
    stepDirectionRef.current = next < alignmentStep ? "back" : "next";
    setAlignmentStep(Math.max(0, Math.min(alignmentQuestions.length - 1, next)));
  };
  const submitAlignment = async () => {
    if (!alignmentView) return;
    // The card folds away while the answers are saved; it comes back if saving fails.
    setAlignmentLeaving(true);
    const started = Date.now();
    try {
      await runAlignment({ action: "select", conversationId, questionId: alignmentView.questionId, questionRevision: alignmentView.questionRevision, selections: alignmentView.questions.map((item) => ({ questionId: item.questionId, optionId: alignmentSelections[item.questionId], note: alignmentNotes[item.questionId] })) });
    } finally {
      // Let the fold finish before the next state fades in; an interrupted transition reverses at a shorter duration.
      const remaining = prefersReducedMotion() ? 0 : 260 - (Date.now() - started);
      if (remaining > 0) await new Promise((resolve) => window.setTimeout(resolve, remaining));
      setAlignmentLeaving(false);
    }
  };
  const questionHint = (question: AlignmentQuestionCard) => question.field === "colorSet" ? "会按所选样子调好" : question.field === "style" ? "单选，推荐按你的行业给出" : "单选";
  const currentPaletteLabel = draft.customPalette ? "自定义品牌色" : paletteCatalogForVisualBrief(draft.visualBrief.id).find((item) => item.id === draft.paletteId)?.label;
  const alignmentOpen = Boolean(alignmentView && (alignmentView.enabled || alignmentView.waitingForUser || alignmentView.prefsOnly || alignmentView.lastResult || alignmentView.answers.length));
  const alignmentDrawer = phoneLayout && Boolean(alignmentView && alignmentView.questions.length >= 1 && (alignmentView.waitingForUser || alignmentView.awaitingConfirmation));
  const visibleSteps = progress ? progress.steps.filter((step, index) => !step.optional || index <= progress.current) : [];
  const submitAlignmentButton = alignmentView && alignmentView.questions.length >= 1 && alignmentView.waitingForUser && !alignmentView.awaitingConfirmation
    ? <button className="primary-button" data-testid="alignment-submit" type="button" disabled={busy || !alignmentComplete} onClick={() => void submitAlignment()}>提交全部答案</button>
    : null;
  const toggleLookPanel = (panel: "look" | "color") => setLookPanel((value) => (value === panel ? null : panel));

  return (
    <div className={`builder-shell workspace-theme-${workspaceTheme} workspace-accent-${workspaceAccent} pane-${mobilePane}`}>
      <header className="preview-toolbar workspace-topbar">
        <div className="preview-toolbar-left">
          <Link href="/" className="topbar-back" aria-label="返回站点"><ArrowLeft size={17} /></Link>
          <div className="project-name">{draft.siteName}</div>
          <span className={`save-status ${previewState}`}>{previewState === "loading" ? <LoaderCircle className="spin" size={12} /> : previewState === "warning" ? <AlertCircle size={12} /> : <Check size={12} />}{saveLabel}</span>
        </div>
        <div className="builder-mobile-tabs" role="tablist" aria-label="建站工作区视图">
          <button className={mobilePane === "chat" ? "active" : ""} onClick={() => setMobilePane("chat")} role="tab" aria-selected={mobilePane === "chat"}><MessageSquareText size={15} />对话</button>
          <button className={mobilePane === "preview" ? "active" : ""} onClick={() => setMobilePane("preview")} role="tab" aria-selected={mobilePane === "preview"}><Desktop size={15} />预览</button>
        </div>
        <div className="topbar-tools">
          <div className="preview-toolbar-center">
            <div className="device-toggle" role="group" aria-label="预览宽度"><button className={device === "desktop" ? "active" : ""} onClick={() => setDevice("desktop")} aria-label="桌面预览" aria-pressed={device === "desktop"}><Desktop size={15} /></button><button className={device === "tablet" ? "active" : ""} onClick={() => setDevice("tablet")} aria-label="平板预览" aria-pressed={device === "tablet"}><Tablet size={15} /></button><button className={device === "mobile" ? "active" : ""} onClick={() => setDevice("mobile")} aria-label="手机预览" aria-pressed={device === "mobile"}><Mobile size={15} /></button></div>
            <div className="device-toggle" role="group" aria-label="预览语言"><button className={locale === "zh" ? "active" : ""} onClick={() => setLocale("zh")} aria-pressed={locale === "zh"}>中</button><button className={locale === "en" ? "active" : ""} onClick={() => setLocale("en")} aria-pressed={locale === "en"}>EN</button></div>
          </div>
          <div className="preview-toolbar-right">
            <button className="icon-button" onClick={() => void moveHistory("undo")} disabled={!canUndo || busy} aria-label="撤销"><RotateCcw size={15} /></button>
            <button className="icon-button" onClick={() => void moveHistory("redo")} disabled={!canRedo || busy} aria-label="重做"><RotateCw size={15} /></button>
            <Link className="primary-button" href={`/published/${encodeURIComponent(siteId)}?page=${encodeURIComponent(activePage?.id ?? "home")}` as Route} target="_blank" rel="noreferrer"><Globe2 size={15} />发布</Link>
            <button className="icon-button" type="button" data-testid="toolbar-delete-site" aria-label="删除本站" onClick={() => setShowDelete(true)}><Trash2 size={15} /></button>
          </div>
        </div>
      </header>
      <main className={`preview-shell ${phoneLayout && mobilePane !== "preview" ? "mobile-hidden" : ""}`}>
        <div className="site-page-chrome">
          <div className="canvas-meta">
            <nav className="site-page-nav" aria-label="站点页面" data-testid="site-page-nav">
              {draft.pagePlan.pages.map((page) => (
                <button
                  className={activePage?.id === page.id ? "site-page-tab active" : "site-page-tab"}
                  key={page.id}
                  type="button"
                  data-testid="site-page-tab"
                  data-page-id={page.id}
                  data-page-placement={page.placement}
                  aria-pressed={activePage?.id === page.id}
                  onClick={() => selectSitePage(page.id)}
                >
                  <strong>{page.label[locale]}</strong>
                  <small>{page.placement === "route" ? "独立页" : "页内区块"}</small>
                </button>
              ))}
            </nav>
            <span className="builder-template-name">{draft.visualBrief.label}{currentPaletteLabel ? ` · ${currentPaletteLabel}` : ""}</span>
          </div>
          <p className="site-page-source" data-testid="site-page-source">{pagePlanSourceLabel(draft.pagePlan.source)}</p>
          {draft.pagePlan.unsupported.length ? (
            <p className="site-page-unsupported" role="status" data-testid="site-page-unsupported">
              未支持：{draft.pagePlan.unsupported.map((item) => `${item.requested}（${item.reason}）`).join("；")}
            </p>
          ) : null}
        </div>
        <div className="preview-stage">
          {lastChangedTargets.length ? <div className="preview-change-markers" data-testid="preview-change-markers">本次修改：{lastChangedTargets.slice(0, 5).join("、")}</div> : null}
          <div className={`browser-frame ${device}`}>{draftReady && <OpenSourceTemplateFrame templateId={draft.templateId} draft={draft} locale={locale} variant="workspace" expectedTargets={expectedTargets} pagePath={previewPagePath} activePage={activePage} onSelectTarget={selectPreviewTarget} onApplyReport={handlePreviewReport} />}</div>
        </div>
      </main>
      <aside className={`builder-chat ${mobilePane !== "chat" ? "mobile-hidden" : ""}`} aria-label="对话">
        <div className="builder-chat-head">
          <div className="chat-head-status">
            <strong data-testid="workspace-draft-revision">当前草稿 · v{draft.revision}</strong>
            <span><span className="chat-context"><span className={`provider-dot ${providerStatus.mode === "deepseek" ? "remote" : "offline"}`} />{providerStatus.mode === "deepseek" ? "AI 已连接" : "AI 暂不可用"}</span><span className="chat-head-time"> · {updatedAt ? `${new Date(updatedAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })} 保存` : "正在载入"}</span></span>
          </div>
          <div className="chat-head-actions">
            <button className="chat-head-button" type="button" data-testid="history-toggle" aria-expanded={showHistory} onClick={() => setShowHistory((value) => !value)}><History size={14} />历史 {history.length}</button>
            <div className="workspace-controls">
              <button type="button" data-testid="workspace-theme-toggle" onClick={toggleWorkspaceTheme} aria-label={workspaceTheme === "dark" ? "换成浅色界面" : "换成深色界面"} title={workspaceTheme === "dark" ? "浅色界面" : "深色界面"}>{workspaceTheme === "dark" ? <Sun size={15} /> : <Moon size={15} />}</button>
              <select aria-label="工作台强调色" value={workspaceAccent} onChange={(event) => chooseWorkspaceAccent(event.target.value)}>{colorSetCatalog.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select>
            </div>
            <button className="icon-button chat-drawer-close" type="button" aria-label="收起对话" onClick={() => setMobilePane("preview")}><X size={15} /></button>
          </div>
        </div>
        {showHistory && (
          <div className="draft-history" aria-label="草稿历史">
            <div className="draft-history-head"><strong>修改历史</strong><button onClick={() => setShowHistory(false)} aria-label="关闭历史"><X size={14} /></button></div>
            {history.length ? history.map((item) => <div className="history-row" key={item.id}><span>v{item.revision}</span><div><strong>{item.summary}</strong><small>{new Date(item.createdAt).toLocaleString("zh-CN")} · {historySourceNames[item.source] ?? "修改"}</small></div></div>) : <div className="history-empty">还没有修改记录。改动保存后会列在这里，可以撤销。</div>}
          </div>
        )}
        <div className="chat-messages">
          {messages.map((message) => (
            <div className={`message ${message.role} ${message.status ?? ""}`} key={message.id}>
              <div className="message-label">{message.role === "assistant" ? <><Sparkles size={12} />AI 助手</> : "你"}</div>
              <div className="message-bubble">{message.text}</div>
              {message.options?.length ? <div className="chat-hints clarify-options">{message.options.map((option) => <button className="hint" key={option} type="button" onClick={() => { setInput(option); window.requestAnimationFrame(() => inputRef.current?.focus()); }}>{option}</button>)}</div> : null}
              {message.alignment?.waitingForUser && message.alignment.selectedLabel ? (
                <div className="change-summary alignment">{message.alignment.selectedLabel}</div>
              ) : null}
              {message.change && <div className={`change-summary ${message.status ?? ""}`}>{message.status === "error" || message.status === "warning" ? <AlertCircle size={12} /> : message.status === "syncing" ? <LoaderCircle className="spin" size={12} /> : <Check size={12} />}<span>{message.status === "applied" ? "已应用" : message.status === "syncing" ? "同步中" : message.status === "no_change" ? "未修改" : "注意"}：{message.change}{message.meta ? ` · ${message.meta}` : ""}</span></div>}
            </div>
          ))}
          {alignmentView && alignmentOpen ? (
            <div className={`alignment-panel${alignmentLeaving ? " is-leaving" : ""}`} data-mobile-drawer={alignmentDrawer ? "true" : undefined} aria-label="需求对齐">
              {alignmentDrawer ? <span className="alignment-drawer-handle" aria-hidden="true" /> : null}
              {alignmentView.answers.length ? <details className="alignment-summary"><summary>已保存的问答（{alignmentView.answers.length}）</summary>{alignmentView.answers.map((answer) => <p key={answer.questionId}><strong>{answer.question}</strong><br />{answer.label}{answer.note ? `：${answer.note}` : ""}</p>)}</details> : null}
              {alignmentView.processing ? <div className="alignment-summary" role="status">正在继续已保存的任务…</div> : null}
              {alignmentView.waitingForUser || alignmentView.awaitingConfirmation ? (
                <>
                  <div className="alignment-head">
                    {alignmentDrawer ? <span className="alignment-step-indicator" data-testid="alignment-step">开始生成前 · 第 {alignmentStepIndex + 1}{" / "}<span data-testid="alignment-step-total">{alignmentView.questions.length}</span>{" 题"}</span> : <strong>{alignmentView.question || "等待你选择"}</strong>}
                    {alignmentDrawer ? <span className="alignment-step-dots" aria-hidden="true">{alignmentView.questions.map((item, index) => <i key={item.questionId} className={index < alignmentStepIndex ? "done" : index === alignmentStepIndex ? "current" : ""} />)}</span> : null}
                  </div>
                  {alignmentView.questions.length >= 1 ? <>
                  {visibleAlignmentQuestions.map((cardQuestion) => {
                    const number = alignmentQuestions.indexOf(cardQuestion) + 1;
                    const layout = cardQuestion.field === "style" || cardQuestion.field === "colorSet" || cardQuestion.options.some((option) => option.description) ? "grid" : "pills";
                    const locked = busy || !alignmentView.waitingForUser || alignmentView.awaitingConfirmation;
                    return <div key={cardQuestion.questionId} data-testid="alignment-card-question" className={phoneLayout ? "alignment-card-question step-enter" : "alignment-card-question"} data-step-direction={stepDirectionRef.current}>
                    <div className="alignment-q-head">{alignmentView.questions.length > 1 && !alignmentDrawer ? <b>{number}</b> : null}<span className="alignment-question">{cardQuestion.prompt}</span><small>{questionHint(cardQuestion)}</small></div>
                    <div className="alignment-cards" data-layout={layout}>{cardQuestion.options.map((option) => {
                      const selected = alignmentSelections[cardQuestion.questionId] === option.id;
                      return (
                      <button className={selected ? "alignment-card selected" : "alignment-card"} key={option.id} type="button" aria-pressed={selected} disabled={locked} onClick={() => setAlignmentSelections((items) => ({ ...items, [cardQuestion.questionId]: option.id }))}>
                        {(() => {
                          const swatches = cardQuestion.field === "colorSet" ? cardColorSwatches(option.id, option.swatches) : option.swatches;
                          return swatches?.length ? <span className="palette-swatch-row" aria-label={`${option.label}颜色预览`}>{swatches.map((color, index) => <i key={`${index}-${color}`} className="palette-swatch-role" style={{ backgroundColor: color }} />)}</span> : null;
                        })()}
                        <strong>{option.label}{option.recommended ? <span className="recommend-badge">推荐</span> : null}</strong>{option.description ? <span>{option.description}</span> : null}
                        {selected ? <Check className="option-check" size={13} aria-hidden="true" /> : null}
                      </button>
                      );
                    })}
                    {cardQuestion.allowOther ? <button className={alignmentSelections[cardQuestion.questionId] === "other" ? "alignment-card selected" : "alignment-card"} type="button" aria-pressed={alignmentSelections[cardQuestion.questionId] === "other"} disabled={locked} onClick={() => setAlignmentSelections((items) => ({ ...items, [cardQuestion.questionId]: "other" }))}><strong>其他，我来写</strong>{alignmentSelections[cardQuestion.questionId] === "other" ? <Check className="option-check" size={13} aria-hidden="true" /> : null}</button> : null}
                    </div>
                    {cardQuestion.allowOther && alignmentSelections[cardQuestion.questionId] === "other" ? <input className="alignment-other-note" aria-label={`${cardQuestion.prompt}：其他说明`} placeholder="写下你的想法" value={alignmentNotes[cardQuestion.questionId] ?? ""} disabled={locked} onChange={(event) => setAlignmentNotes((items) => ({ ...items, [cardQuestion.questionId]: event.target.value }))} /> : null}
                  </div>;
                  })}
                  {alignmentDrawer && alignmentView.waitingForUser && !alignmentView.awaitingConfirmation ? <div className="alignment-mobile-nav">
                    <button type="button" className="secondary-button" disabled={busy || alignmentStep === 0} onClick={() => goToAlignmentStep(alignmentStep - 1)}>上一题</button>
                    {alignmentStep < alignmentView.questions.length - 1 ? <button type="button" className="primary-button" data-testid="alignment-next" disabled={busy || !activeAlignmentReady} onClick={() => goToAlignmentStep(alignmentStep + 1)}>下一题</button> : submitAlignmentButton}
                  </div> : null}
                  </> : <div className="alignment-cards">
                    {alignmentView.options.map((option) => (
                      <button
                        className={alignmentView.selectedOptionId === option.id ? "alignment-card selected" : "alignment-card"}
                        key={option.id}
                        type="button"
                        disabled={busy}
                        onClick={() => void runAlignment({
                          action: alignmentView.questionKind === "confirm_ops" ? "confirm" : "select",
                          conversationId,
                          questionId: alignmentView.questionId,
                          questionRevision: alignmentView.questionRevision,
                          optionId: option.id,
                        })}
                      >
                        <strong>{option.label}</strong>
                        {option.description ? <span>{option.description}</span> : null}
                      </button>
                    ))}
                  </div>}
                  {submitAlignmentButton && !alignmentDrawer ? <div className="alignment-submit-bar">{submitAlignmentButton}</div> : null}
                  {alignmentView.awaitingConfirmation && alignmentView.questions.length >= 1 ? <><div className="alignment-confirmed" data-testid="alignment-submitted">已保存你的选择，请确认生成方案</div><div className="alignment-submit-bar"><button type="button" className="primary-button" disabled={busy} onClick={() => void runAlignment({ action: "confirm", conversationId, questionId: alignmentView.questionId, questionRevision: alignmentView.questionRevision })}>确认并应用</button></div></> : null}
                  <div className="alignment-actions">
                    {alignmentView.questionId === "image-upload" ? (
                      <button className="primary-button" type="button" disabled={busy} onClick={() => void openImageLibrary()}>
                        打开图片库上传
                      </button>
                    ) : null}
                    {(alignmentView.questions.length ? [] : alignmentView.utilities).map((option) => (
                      <button
                        className={alignmentView.selectedOptionId === option.id ? "hint selected" : "hint"}
                        key={option.id}
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          if (option.id === "other") {
                            if (!input.trim()) {
                              window.requestAnimationFrame(() => inputRef.current?.focus());
                              return;
                            }
                            void runAlignment({
                              action: "select",
                              conversationId,
                              questionId: alignmentView.questionId,
                              questionRevision: alignmentView.questionRevision,
                              optionId: option.id,
                              note: input.trim(),
                            });
                            return;
                          }
                          void runAlignment({
                            action: "select",
                            conversationId,
                            questionId: alignmentView.questionId,
                            questionRevision: alignmentView.questionRevision,
                            optionId: option.id,
                          });
                        }}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  {alignmentView.pendingMessage ? <div className="alignment-summary">已保存任务：{stripMaterialsInstruction(alignmentView.pendingMessage)}</div> : null}
                  {alignmentView.summary ? <div className="alignment-summary">{alignmentView.summary}</div> : null}
                </>
              ) : alignmentView.prefsOnly ? (
                <div className="alignment-confirmed">偏好已保存。</div>
              ) : alignmentView.lastResult?.status === "applied" ? (
                <div className="alignment-confirmed">已应用已确认的方案{typeof alignmentView.lastResult.revision === "number" ? `，草稿 v${alignmentView.lastResult.revision}` : ""}</div>
              ) : null}
            </div>
          ) : null}
          {progress ? (
            <div key={progress.id} className={progress.closing ? "message assistant chat-progress is-closing" : "message assistant chat-progress"} data-testid="chat-progress" role="status" aria-live="polite">
              <div className="message-label"><Sparkles size={12} />AI 助手</div>
              <div className="message-bubble progress-bubble">
                <div className="progress-current"><LoaderCircle className="spin" size={14} aria-hidden="true" /><span>{progress.detail}</span></div>
                {visibleSteps.length > 1 ? <ol className="progress-steps">{visibleSteps.map((step, index) => <li key={step.label} data-step data-step-state={index < progress.current ? "done" : index === progress.current ? "current" : "pending"}>{step.label}</li>)}</ol> : null}
              </div>
            </div>
          ) : null}
          <div ref={messagesEndRef} />
        </div>
        <div className="chat-input-wrap">
          {selectedTarget && <div className="chat-target"><span>正在修改：{selectedTarget.label}</span><button aria-label="清除修改目标" onClick={() => setSelectedTarget(null)} type="button"><X size={13} /></button></div>}
          {lookPanel === "look" ? (
            <section className="visual-brief-panel" aria-label="网站样子">
              <div className="visual-brief-head">
                <div><strong>先选网站的样子</strong><span className="visual-brief-current">当前：{draft.visualBrief.label}</span></div>
                <Link className="section-link" href={"/quality" as Route}>12组对照</Link>
                <button className="panel-close" type="button" aria-label="收起样子" onClick={() => setLookPanel(null)}><X size={14} /></button>
              </div>
              {legacyLookRetained ? (
                <p className="legacy-look-warning" role="status" data-testid="legacy-look-warning">
                  当前草稿使用已撤下的“深色产品”样子，旧预览仍可打开；请换用可用样子后再继续修改。
                </p>
              ) : null}
              <p>样子会改变预览的版式与配色，行业仍来自公司资料。</p>
              <div className="visual-brief-grid">
                {visualBriefCatalog.map((brief) => {
                  const template = getTemplate(brief.templateId);
                  const selected = draft.visualBrief.id === brief.id && draft.templateId === brief.templateId;
                  return (
                    <button
                      className={selected ? "visual-brief-card selected" : "visual-brief-card"}
                      key={brief.id}
                      type="button"
                      data-testid="visual-brief-card"
                      data-brief-id={brief.id}
                      aria-pressed={selected}
                      disabled={busy || !draftReady}
                      onClick={() => void selectVisualBrief(brief.id)}
                    >
                      <span className="visual-brief-swatch" style={{ background: `linear-gradient(135deg, ${template.colors.primary}, ${template.colors.accent})` }} />
                      <span className="visual-brief-copy"><strong>{brief.label}</strong><span>{brief.summary}</span><small>适合：{brief.audience}</small></span>
                      {selected ? <Check size={14} /> : null}
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}
          {lookPanel === "color" ? (
            <section className="visual-brief-panel" aria-label="网站配色">
              <div className="palette-picker-head">
                <div><strong>同一版式，换一套配色</strong><span className="visual-brief-current">当前：{currentPaletteLabel ?? "未选"}</span></div>
                <button className="panel-close" type="button" aria-label="收起配色" onClick={() => setLookPanel(null)}><X size={14} /></button>
              </div>
              {paletteCatalogForVisualBrief(draft.visualBrief.id).length ? (
                <div className="palette-picker" aria-label={`${draft.visualBrief.label}色板`}>
                  <div className="palette-picker-grid">
                    {paletteCatalogForVisualBrief(draft.visualBrief.id).map((palette) => {
                      const kit = templateAdapters[draft.templateId]?.kit;
                      const tokens = kit?.palettes?.[palette.id] ?? kit?.tokens;
                      const tokenForRole = (role: (typeof paletteSwatchRoles)[number]) => {
                        if (!tokens) return undefined;
                        if (role === "input") return tokens.input ?? tokens.surface ?? tokens.background;
                        if (role === "focus") return tokens.focus ?? tokens.accentSoft ?? tokens.accent;
                        if (role === "disabled") return tokens.disabled ?? tokens.muted ?? tokens.border;
                        return tokens[role];
                      };
                      const selected = draft.paletteId === palette.id && !draft.customPalette;
                      return (
                      <button
                        className={selected ? "palette-card selected" : "palette-card"}
                        key={palette.id}
                        type="button"
                        aria-pressed={selected}
                        disabled={busy || !draftReady}
                        onClick={() => void selectPalette(palette.id)}
                      >
                        <span className="palette-swatch-row" data-testid="palette-swatch-row" aria-label={`${palette.label}颜色角色`}>
                          {paletteSwatchRoles.map((role) => (
                            <span
                              className="palette-swatch-role"
                              data-role={role}
                              key={role}
                              title={`${paletteRoleNames[role]}：${tokenForRole(role) ?? "未定义"}`}
                              style={{ backgroundColor: tokenForRole(role) ?? "transparent" }}
                            />
                          ))}
                        </span>
                        <span><strong>{palette.label}</strong><small>{palette.summary}</small></span>
                        {selected ? <Check size={14} /> : null}
                      </button>
                      );
                    })}
                  </div>
                </div>
              ) : <p>这个样子没有可换的配色。</p>}
              {paletteCatalogForVisualBrief(draft.visualBrief.id).length ? <div className="custom-palette-panel" data-testid="custom-palette-panel">
                <div className="palette-picker-head"><div><strong>自定义品牌色</strong><span className="visual-brief-current">从主色或 Logo 生成整套颜色</span></div></div>
                <div className="custom-palette-controls">
                  <label className="custom-color-input"><span>主色</span><input data-testid="custom-brand-color" type="color" value={brandColor} disabled={busy || !draftReady} onChange={(event) => setBrandColor(event.target.value)} /></label>
                  <button className="secondary-button" type="button" data-testid="apply-custom-brand-color" disabled={busy || !draftReady} onClick={() => void applyCustomBrandColor(brandColor, "color")}>应用品牌色</button>
                  <button className="secondary-button" type="button" data-testid="sample-logo-color" disabled={busy || !draftReady} onClick={() => brandLogoRef.current?.click()}>从 Logo 取色</button>
                  <input ref={brandLogoRef} data-testid="custom-brand-logo" type="file" accept="image/*" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void sampleLogoColor(file); event.currentTarget.value = ""; }} />
                </div>
                {draft.customPalette ? <div className="custom-palette-status" role="status"><span className="palette-swatch-row">{[draft.customPalette.background, draft.customPalette.surface, draft.customPalette.text, draft.customPalette.accent, draft.customPalette.accentStrong, draft.customPalette.border].map((color) => <i key={color} style={{ backgroundColor: color }} />)}</span><span>{draft.customPalette.adjustmentNote}</span></div> : null}
              </div> : null}
            </section>
          ) : null}
          <div className="chat-actions" data-testid="chat-actions" role="toolbar" aria-label="对话操作">
            <button className={alignmentEnabled ? "chat-action alignment-switch on" : "chat-action alignment-switch"} type="button" role="switch" aria-checked={alignmentEnabled} data-testid="alignment-toggle" disabled={busy} onClick={() => { void toggleAlignment(!alignmentEnabled); }}>
              <span className="switch-track" aria-hidden="true"><span className="switch-knob" /></span>需求对齐<span className="switch-state">{alignmentEnabled ? "开" : "关"}</span>
            </button>
            <button className="chat-action" type="button" data-testid="open-look-panel" aria-expanded={lookPanel === "look"} onClick={() => toggleLookPanel("look")}>样子</button>
            <button className="chat-action" type="button" data-testid="open-color-panel" aria-expanded={lookPanel === "color"} onClick={() => toggleLookPanel("color")}>配色</button>
            <button className="chat-action" type="button" data-testid="open-materials" disabled={busy || !draftReady} onClick={() => setShowMaterials(true)}>公司资料</button>
            <button className="chat-action" type="button" data-testid="open-image-library" disabled={busy || !draftReady} onClick={() => { void openImageLibrary(); }}>上传产品图</button>
            <button className="chat-action" type="button" data-testid="open-product-import" onClick={() => setShowImport(true)}>商品表格</button>
          </div>
          <form className="chat-input" onSubmit={submitChat}>
            <textarea ref={inputRef} aria-label="给 AI 的消息" value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void submitChat(); } }} placeholder={alignmentEnabled ? "说说公司和想要的网站，AI 会先问几件事再生成…" : "告诉 AI 你想怎么改…"} rows={2} />
            <button className="send-button" type="submit" data-testid="chat-send" disabled={!input.trim() || busy || !draftReady} aria-label="发送"><Send size={15} /></button>
          </form>
        </div>
      </aside>
      {showImport && (
        <div className="modal-backdrop" onClick={() => setShowImport(false)}><div className="import-modal" onClick={(event) => event.stopPropagation()}>
          <div className="modal-head"><div><div className="eyebrow">商品</div><h3>填充你的商品目录</h3></div><button className="icon-button" onClick={() => setShowImport(false)} aria-label="关闭"><X size={15} /></button></div>
          <p className="modal-copy">上传 CSV 或 XLSX 商品表格，校验后直接保存为可撤销草稿。AI 可以继续修改指定 SKU 的中英文名称、简介和分类。</p>
          <div className="upload-zone" onClick={() => fileRef.current?.click()}><input ref={fileRef} type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden onChange={handleFile} /><div className="upload-icon"><CloudUpload size={20} /></div><strong>点击上传表格</strong><span>需要包含 SKU、产品名称、分类等字段</span><small>CSV / XLSX · 最多 1000 行</small></div>
          <div className="import-options"><div><FileSpreadsheet size={15} /><span>支持中英文列名自动识别</span><ChevronRight size={13} style={{ marginLeft: "auto" }} /></div><div><ImageIcon size={15} /><span>相同 SKU 自动更新，新增项进入草稿</span><ChevronRight size={13} style={{ marginLeft: "auto" }} /></div></div>
          {importState && <div className={`import-result ${importState.imported ? "" : "error"}`}>{importState.imported ? <Check size={14} /> : <AlertCircle size={14} />}<div><strong>{importState.name} {importState.imported ? "已保存" : "导入失败"}</strong><span>{importState.imported ? `新增或更新 ${importState.imported} 个商品` : importState.errors[0]}{importState.imported && importState.errors.length ? `，${importState.errors.length} 行需要检查` : ""}</span></div></div>}
          <div className="modal-foot"><span>当前草稿商品：{draft.products.length} / 1000</span><button className="primary-button" onClick={() => setShowImport(false)}>完成</button></div>
        </div></div>
      )}
      {showMaterials && (
        <div className="modal-backdrop" onClick={() => setShowMaterials(false)}>
          <div className="import-modal materials-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-head">
              <div>
                <div className="eyebrow">资料</div>
                <h3>提供公司资料</h3>
              </div>
              <button className="icon-button" onClick={() => setShowMaterials(false)} aria-label="关闭资料"><X size={15} /></button>
            </div>
            <p className="modal-copy">资料会发给 AI 生成网站。页面上的事实只来自资料，资料没写的地方显示「待补充」。模拟包只用于内部演示。当前样子做不到的页面，会在生成结果里说明。</p>
            <div className="pack-actions">
              {simulatedPackList.map((pack) => (
                <button
                  className={loadedPackId === pack.id ? "hint selected" : "hint"}
                  key={pack.id}
                  type="button"
                  data-testid="simulated-pack"
                  data-pack-id={pack.id}
                  onClick={() => loadSimulatedPack(pack.id)}
                >
                  {pack.label}
                </button>
              ))}
            </div>
            <label className="materials-label" htmlFor="company-materials">公司资料正文</label>
            <textarea
              id="company-materials"
              value={materialsText}
              onChange={(event) => {
                setLoadedPackId(null);
                setMaterialsText(event.target.value);
              }}
              placeholder="粘贴公司简介、产品、联系方式和明确缺口。模拟资料请写明「模拟」。"
              rows={10}
            />
            <div className="materials-count">{materialsText.trim().length} 字 · 发送时会加上生成说明，总长不超过 4000 字</div>
            <div className="modal-foot">
              <span><FileText size={14} /> 生成的每一步都能在历史里撤销</span>
              <button
                className="primary-button"
                type="button"
                data-testid="submit-materials"
                disabled={!materialsText.trim() || busy || !draftReady}
                onClick={() => { void submitMaterials(); }}
              >
                根据资料生成站点
              </button>
            </div>
          </div>
        </div>
      )}
      {showImages && (
        <div className="modal-backdrop" onClick={() => setShowImages(false)}>
          <div className="import-modal materials-modal" onClick={(event) => event.stopPropagation()} data-testid="image-library-modal">
            <div className="modal-head">
              <div>
                <div className="eyebrow">产品图</div>
                <h3>上传并归属产品图</h3>
              </div>
              <button className="icon-button" onClick={() => setShowImages(false)} aria-label="关闭产品图"><X size={15} /></button>
            </div>
            <p className="modal-copy">图片只存在这个站点下。可以先让 AI 读出图里的文字和参数，再放到首屏或第一个产品；当前样子没有对应的图片位置时会提示没有显示，不会放到 Logo 或别的图上。模板自带的演示图没有授权，不能用在你的网站上；没有许可和署名的公共图片也不会用。</p>
            <div
              className="upload-zone"
              data-testid="upload-product-photo"
              onClick={() => imageFileRef.current?.click()}
            >
              <input
                ref={imageFileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
                hidden
                onChange={(event) => { void handleImageFile(event); }}
              />
              <div className="upload-icon"><CloudUpload size={20} /></div>
              <strong>点击上传真实产品照片</strong>
              <span>PNG / JPEG / WebP · 单张不超过 10MB</span>
              <small>只保存在这个站点下，按用户提供的图片使用</small>
            </div>
            <div className="image-library" data-testid="site-image-list">
              {siteImages.length === 0 ? <span>这个站点还没有上传过图片。上传后会列在这里，可以先分析再放进页面。</span> : siteImages.map((image) => (
                <button
                  className={selectedImageId === image.imageId ? "image-library-item selected" : "image-library-item"}
                  key={image.imageId}
                  type="button"
                  data-testid="site-image-item"
                  data-image-id={image.imageId}
                  onClick={() => {
                    setSelectedImageId(image.imageId);
                    setImageFacts(null);
                    setImageNote(`${image.originalName} · 只属于本站 · ${imageLicenseNames[image.license] ?? image.license}`);
                  }}
                >
                  <img src={image.url} alt="" />
                  <div>
                    <strong>{image.originalName}</strong>
                    <span>{image.width}×{image.height} · {imageLicenseNames[image.license] ?? image.license} · {imageScopeNames[image.usageScope] ?? image.usageScope}</span>
                    <small>归属：{image.author} · {image.retrievedAt.slice(0, 10)} 保存</small>
                  </div>
                </button>
              ))}
            </div>
            {imageFacts ? (
              <div className="image-facts" data-testid="image-analysis">
                <strong>看图事实（未写草稿）</strong>
                <div>名称：{imageFacts.name.zh} / {imageFacts.name.en}</div>
                <div>分类：{imageFacts.category}</div>
                <div>可见文字：{imageFacts.visibleText.length ? imageFacts.visibleText.join("；") : "待补充"}</div>
                <div>缺口：{imageFacts.missingFacts.length ? imageFacts.missingFacts.join("、") : "待补充"}</div>
              </div>
            ) : null}
            {imageNote ? <div className="image-facts" data-testid="image-library-note">{imageNote}</div> : null}
            <div className="image-actions">
              <button className="secondary-button" type="button" data-testid="analyze-image" disabled={!selectedImageId || busy} onClick={() => { void analyzeSelectedImage(); }}>分析事实</button>
              <button className="primary-button" type="button" data-testid="apply-hero-image" disabled={!selectedImageId || busy || !draftReady} onClick={() => { void applySelectedImage("hero"); }}>应用到首屏图</button>
              <button className="secondary-button" type="button" data-testid="apply-product-image" disabled={!selectedImageId || busy || !draftReady} onClick={() => { void applySelectedImage("product"); }}>应用到第一个商品</button>
            </div>
            <div className="modal-foot">
              <span><ImageIcon size={14} /> 分析只读取图片，不改页面</span>
              <button className="primary-button" type="button" onClick={() => setShowImages(false)}>完成</button>
            </div>
          </div>
        </div>
      )}
      <SiteDeleteDialog
        siteId={siteId}
        open={showDelete}
        onClose={() => setShowDelete(false)}
        onDeleted={(deletedId) => {
          window.localStorage.removeItem(conversationStorageKey(deletedId));
          window.location.assign("/settings#data-delete");
        }}
      />
    </div>
  );
}
