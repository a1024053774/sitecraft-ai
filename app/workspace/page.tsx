"use client";

import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  ChevronRight,
  CircleHelp,
  Cloud,
  CloudUpload,
  FileSpreadsheet,
  FileText,
  Globe2,
  History,
  Image as ImageIcon,
  Laptop as Desktop,
  LoaderCircle,
  MessageSquareText,
  MoreHorizontal,
  RotateCcw,
  RotateCw,
  Send,
  Smartphone as Mobile,
  Sparkles,
  Tablet,
  Upload,
  Plus,
  X,
} from "lucide-react";
import { type ChangeEvent, type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import readXlsxFile from "read-excel-file";
import { OpenSourceTemplateFrame } from "@/components/open-source-template-frame";
import {
  defaultDraft,
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
  simulatedPackList,
  wrapCompanyMaterials,
  type SimulatedPackId,
} from "@/lib/simulated-packs";

function conversationStorageKey(siteId: string) {
  return `sitecraft-conversation:${siteId}`;
}

function readStoredConversationId(siteId: string) {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(conversationStorageKey(siteId));
}

type ChatStatus = "syncing" | "applied" | "warning" | "error" | "no_change" | "answer" | "clarify" | "alignment";
type AlignmentOptionCard = { id: string; label: string; description: string };
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
  utilities: AlignmentOptionCard[];
  summary: string | null;
  saved: boolean;
  waitingForUser: boolean;
  awaitingConfirmation: boolean;
  prefsOnly: boolean;
  cannotProceed: boolean;
  pendingMessage: string | null;
  processing: boolean;
  answers: Array<{ questionId: string; question: string; label: string; note: string | null }>;
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
};
type ProviderStatus = { mode: "deepseek" | "unconfigured"; model: string | null };

const initialMessages: ChatMessage[] = [
  {
    id: "welcome",
    role: "assistant",
    text: "我已经载入你选择的开源模板。现在可以修改首屏、关于、优势、服务、商品和联系区块；每次操作都会保存为可撤销草稿。",
  },
  {
    id: "guide",
    role: "assistant",
    text: "可以直接说“把第二个服务标题改为智能产线集成”或点击右侧内容后再下达指令。模板只有在你明确要求更换时才会切换。",
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
  if (view.lastResult?.status === "answer") return view.lastResult.text || view.lastResult.summary || "模型已回答。";
  if (view.lastResult?.summary) return view.lastResult.summary;
  if (action === "cancel" || view.state === "cancelled") return "已关闭需求对齐。已保存的选择仍保留在会话中。";
  return view.summary || "需求对齐已更新";
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
  const [plusOpen, setPlusOpen] = useState(false);
  const [alignmentEnabled, setAlignmentEnabled] = useState(false);
  const [alignmentView, setAlignmentView] = useState<AlignmentViewState | null>(null);
  const [device, setDevice] = useState<Device>("desktop");
  const [locale, setLocale] = useState<Locale>("zh");
  const [showImport, setShowImport] = useState(false);
  const [showMaterials, setShowMaterials] = useState(false);
  const [materialsText, setMaterialsText] = useState("");
  const [loadedPackId, setLoadedPackId] = useState<SimulatedPackId | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [importState, setImportState] = useState<{ name: string; imported: number; errors: string[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [busyText, setBusyText] = useState("正在连接模型…");
  const [mobilePane, setMobilePane] = useState<"chat" | "preview">("chat");
  const [selectedTarget, setSelectedTarget] = useState<{ key: string; label: string } | null>(null);
  const [draftReady, setDraftReady] = useState(false);
  const [expectedTargets, setExpectedTargets] = useState<string[]>([]);
  const [previewState, setPreviewState] = useState<"loading" | "synced" | "warning">("loading");
  const [providerStatus, setProviderStatus] = useState<ProviderStatus>({ mode: "unconfigured", model: null });
  const fileRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const adoptSnapshot = (snapshot: DraftSnapshot) => {
    setDraft(normalizeDraft(snapshot.draft));
    setHistory(snapshot.history ?? []);
    setCanUndo(Boolean(snapshot.canUndo));
    setCanRedo(Boolean(snapshot.canRedo));
    setUpdatedAt(snapshot.updatedAt ?? new Date().toISOString());
  };

  useEffect(() => {
    let cancelled = false;
    async function loadDraft() {
      const activeSiteId = parseWorkspaceSiteId(new URLSearchParams(window.location.search).get("site"));
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
        const requestedTemplate = new URLSearchParams(window.location.search).get("template");
        const requestedBrief = requestedTemplate
          ? visualBriefCatalog.find((item) => item.templateId === requestedTemplate)
          : undefined;
        if (requestedTemplate && templates.some((item) => item.id === requestedTemplate) && snapshot.draft.templateId !== requestedTemplate) {
          const response = await fetch(`/api/sites/${activeSiteId}/draft`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              baseRevision: snapshot.draft.revision,
              operations: [requestedBrief
                ? { op: "set_visual_brief", briefId: requestedBrief.id }
                : { op: "set_template", templateId: requestedTemplate }],
              summary: requestedBrief ? `选择样子 ${requestedBrief.label}` : `选择模板 ${getTemplate(requestedTemplate).name}`,
              source: "template",
            }),
          });
          if (response.ok) snapshot = await response.json() as DraftSnapshot;
        }
        if (!cancelled) {
          adoptSnapshot(snapshot);
          setDraftReady(true);
          setPreviewState("loading");
          if (new URLSearchParams(window.location.search).get("import") === "products") setShowImport(true);
        }
      } catch (error) {
        if (!cancelled) {
          setMessages((items) => [...items, { id: crypto.randomUUID(), role: "assistant", status: "error", text: error instanceof Error ? error.message : "草稿加载失败" }]);
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
              text: payload.message || "无法恢复需求对齐状态。",
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
            text: error instanceof Error ? error.message : "无法恢复需求对齐状态。",
            change: "没有静默创建新会话",
          }]);
        }
      }
    }
    void restoreAlignment();
    return () => { cancelled = true; };
  }, [draftReady, siteId]);

  const currentTemplate = getTemplate(draft.templateId);
  const saveLabel = useMemo(() => {
    if (!draftReady) return "正在读取草稿";
    if (previewState === "loading") return "草稿已保存 · 正在同步预览";
    if (previewState === "warning") return "草稿已保存 · 部分槽位未显示";
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
      setExpectedTargets(changeSet.appliedTargets);
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
      throw new Error(String(done.error || "模型操作失败"));
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

  const runAlignment = async (body: Record<string, unknown>) => {
    if (busy) return;
    setBusy(true);
    setBusyText("正在更新需求对齐…");
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
        const payload = await response.json().catch(() => ({})) as { message?: string; error?: string; alignment?: AlignmentViewState };
        if (payload.alignment) {
          setAlignmentView(payload.alignment);
          setAlignmentEnabled(payload.alignment.enabled);
        }
        throw new Error(payload.message || payload.error || "需求对齐请求失败");
      }
      const doneEvent = await readSseDone(response, (value) => setBusyText(value));
      applyDoneEvent(doneEvent);
      if ((body.action === "start" && body.message) || (body.action === "select" && body.optionId === "other")) setInput("");
    } catch (error) {
      setMessages((items) => [...items, {
        id: crypto.randomUUID(),
        role: "assistant",
        status: "error",
        text: error instanceof Error ? error.message : "需求对齐失败",
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
    if (Date.now() - restoreStartedRef.current > 120_000) {
      setMessages((items) => [...items, { id: crypto.randomUUID(), role: "assistant", status: "warning", text: "任务仍未返回最终状态，已停止自动读取。请刷新检查服务器状态，避免重复执行。" }]);
      return;
    }
    const timer = window.setTimeout(() => { void runAlignment({ action: "state" }); }, 2000);
    return () => window.clearTimeout(timer);
  }, [alignmentView, busy, conversationId]);

  const toggleAlignment = async (enabled: boolean) => {
    setPlusOpen(false);
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
    await runAlignment({
      action: "start",
      conversationId,
      ...(pending ? { message: pending, baseRevision: draft.revision, selectedTarget: selectedTarget?.key ?? null } : {}),
    });
  };

  const sendChat = async (value: string) => {
    if (!value || busy || !draftReady) return false;
    setBusy(true);
    setBusyText("正在连接模型…");
    setMessages((items) => [...items, { id: crypto.randomUUID(), role: "user", text: value }]);
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
        const payload = await response.json().catch(() => ({})) as Partial<DraftSnapshot> & { message?: string; alignment?: AlignmentViewState };
        if (payload.draft) adoptSnapshot(payload as DraftSnapshot);
        if (payload.alignment) {
          setAlignmentView(payload.alignment);
          setAlignmentEnabled(payload.alignment.enabled);
        }
        throw new Error(payload.message || (response.status === 409 ? "草稿版本冲突，已载入最新版本，请重新发送。" : "AI 请求失败"));
      }
      const doneEvent = await readSseDone(response, (status) => setBusyText(status));
      applyDoneEvent(doneEvent);
      return true;
    } catch (error) {
      setMessages((items) => [...items, { id: crypto.randomUUID(), role: "assistant", status: "error", text: error instanceof Error ? error.message : "AI 修改失败", change: "请以服务器草稿和恢复状态为准" }]);
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
    if (!hasExpectedTargets) return;
    setMessages((items) => items.map((message) => {
      if (message.revision !== report.revision || message.status !== "syncing") return message;
      if (missing.length || fallback.length) {
        const fallbackNote = fallback.length ? `；回退命中未计精确槽位：${fallback.join("、")}` : "";
        const proposalNote = proposals.length
          ? `；可改已映射字段：${proposals.map((item) => `${item.requested}→${item.proposed}`).join("、")}`
          : "";
        return {
          ...message,
          status: "warning",
          text: `草稿 v${report.revision} 已保存，但当前模板没有找到 ${missing.length} 个对应显示槽位。`,
          change: `${message.change}；未显示：${missing.join("、")}${fallbackNote}${proposalNote}`,
        };
      }
      return { ...message, status: "applied", text: `草稿 v${report.revision} 已保存，右侧模板已确认更新。` };
    }));
    setExpectedTargets([]);
  };

  const moveHistory = async (action: "undo" | "redo") => {
    if (busy) return;
    setBusy(true);
    setBusyText(action === "undo" ? "正在撤销并保存…" : "正在重做并保存…");
    try {
      const response = await fetch(`/api/sites/${siteId}/history/${action}`, { method: "POST" });
      const result = await response.json() as DraftSnapshot & { status: string; appliedTargets?: string[] };
      if (!response.ok || result.status !== "applied") throw new Error(action === "undo" ? "没有可撤销的修改" : "没有可重做的修改");
      adoptSnapshot(result);
      setExpectedTargets(result.appliedTargets ?? []);
      setPreviewState("loading");
    } catch (error) {
      setMessages((items) => [...items, { id: crypto.randomUUID(), role: "assistant", status: "error", text: error instanceof Error ? error.message : "历史操作失败" }]);
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
    const result = await response.json() as DraftSnapshot & { error?: string; changeSet?: { appliedTargets: string[] } };
    if (!response.ok) throw new Error(result.error || "草稿保存失败");
    adoptSnapshot(result);
    setExpectedTargets((result.changeSet?.appliedTargets ?? []).filter((target) => target !== "visualBrief" && target !== "template" && target !== "draft"));
    setPreviewState("loading");
  };

  const selectVisualBrief = async (briefId: string) => {
    if (busy || !draftReady) return;
    const brief = visualBriefCatalog.find((item) => item.id === briefId);
    if (!brief || (brief.id === draft.visualBrief.id && brief.templateId === draft.templateId)) return;
    setBusy(true);
    setBusyText("正在切换样子…");
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
        text: error instanceof Error ? error.message : "样子保存失败",
      }]);
    } finally {
      setBusy(false);
    }
  };

  const commitImportedRows = async (name: string, rows: Record<string, string>[]) => {
    const result = importProductsFromRows(draft, rows);
    try {
      await saveOperations([{ op: "replace_products", products: result.products }], `导入商品表格 ${name}`, "import");
      setImportState({ name, imported: result.imported, errors: result.errors });
    } catch (error) {
      setImportState({ name, imported: 0, errors: [error instanceof Error ? error.message : "导入失败"] });
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

  return (
    <div className="builder-shell">
      <div className="builder-mobile-tabs" role="tablist" aria-label="建站工作区视图">
        <button className={mobilePane === "chat" ? "active" : ""} onClick={() => setMobilePane("chat")} role="tab" aria-selected={mobilePane === "chat"}><MessageSquareText size={14} /> AI 对话</button>
        <button className={mobilePane === "preview" ? "active" : ""} onClick={() => setMobilePane("preview")} role="tab" aria-selected={mobilePane === "preview"}><Desktop size={14} /> 网站预览</button>
      </div>
      <aside className={`builder-chat ${mobilePane !== "chat" ? "mobile-hidden" : ""}`}>
        <div className="builder-chat-head">
          <div>
            <Link href="/" className="eyebrow" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><ArrowLeft size={12} />返回站点</Link>
            <h2>{draft.siteName}</h2>
            <span className="builder-template-name">{currentTemplate.name}</span>
            <span className="chat-context"><span className={`provider-dot ${providerStatus.mode === "deepseek" ? "remote" : "offline"}`} />{providerStatus.mode === "deepseek" ? `DEEPSEEK API · ${providerStatus.model}` : "DeepSeek 未配置 · 不会执行本地伪修改"}</span>
          </div>
          <Link className="icon-button" href="/templates" aria-label="更换模板"><MoreHorizontal size={16} /></Link>
        </div>
        <div className="draft-status-panel">
          <div className="draft-status-icon"><Cloud size={15} /></div>
          <div><strong>当前草稿 · v{draft.revision}</strong><span>{updatedAt ? `${new Date(updatedAt).toLocaleString("zh-CN")} 保存到服务器` : "正在载入"}</span></div>
          <button type="button" onClick={() => setShowHistory((value) => !value)}><History size={13} />历史 {history.length}</button>
        </div>
        <section className="visual-brief-panel" aria-label="网站样子">
          <div className="visual-brief-head">
            <div><span className="eyebrow">Look board</span><strong>先选网站的样子</strong></div>
            <span className="visual-brief-current">当前：{draft.visualBrief.label}</span>
          </div>
          <p>样子会改变右侧预览的版式与配色，行业仍来自公司资料。</p>
          <div className="visual-brief-grid">
            {visualBriefCatalog.map((brief) => {
              const template = getTemplate(brief.templateId);
              const selected = draft.visualBrief.id === brief.id && draft.templateId === brief.templateId;
              return (
                <button
                  className={selected ? "visual-brief-card selected" : "visual-brief-card"}
                  key={brief.id}
                  type="button"
                  disabled={busy || !draftReady}
                  onClick={() => void selectVisualBrief(brief.id)}
                >
                  <span className="visual-brief-swatch" style={{ background: `linear-gradient(135deg, ${template.colors.primary}, ${template.colors.accent})` }} />
                  <span className="visual-brief-copy"><strong>{brief.label}</strong><span>{brief.summary}</span><small>适合：{brief.audience}</small></span>
                  {selected ? <Check size={13} /> : null}
                </button>
              );
            })}
          </div>
        </section>
        {showHistory && (
          <div className="draft-history" aria-label="草稿历史">
            <div className="draft-history-head"><strong>修改历史</strong><button onClick={() => setShowHistory(false)} aria-label="关闭历史"><X size={13} /></button></div>
            {history.length ? history.map((item) => <div className="history-row" key={item.id}><span>v{item.revision}</span><div><strong>{item.summary}</strong><small>{new Date(item.createdAt).toLocaleString("zh-CN")} · {item.source.toUpperCase()}</small></div></div>) : <div className="history-empty">尚无修改记录</div>}
          </div>
        )}
        <div className="chat-messages">
          {messages.map((message) => (
            <div className={`message ${message.role} ${message.status ?? ""}`} key={message.id}>
              <div className="message-label">{message.role === "assistant" ? <><Sparkles size={10} style={{ verticalAlign: "middle", marginRight: 4 }} />SITECRAFT AI</> : "YOU"}</div>
              <div className="message-bubble">{message.text}</div>
              {message.options?.length ? <div className="chat-hints clarify-options">{message.options.map((option) => <button className="hint" key={option} type="button" onClick={() => { setInput(option); window.requestAnimationFrame(() => inputRef.current?.focus()); }}>{option}</button>)}</div> : null}
              {message.alignment?.waitingForUser && message.alignment.selectedLabel ? (
                <div className="change-summary alignment">{message.alignment.selectedLabel}</div>
              ) : null}
              {message.change && <div className={`change-summary ${message.status ?? ""}`}>{message.status === "error" || message.status === "warning" ? <AlertCircle size={11} /> : message.status === "syncing" ? <LoaderCircle className="spin" size={11} /> : <Check size={11} />}<span>{message.status === "applied" ? "已应用" : message.status === "syncing" ? "同步中" : message.status === "no_change" ? "未修改" : "注意"}：{message.change}{message.meta ? ` · ${message.meta}` : ""}</span></div>}
            </div>
          ))}
          {busy && <div className="message assistant"><div className="message-label"><Sparkles size={10} style={{ verticalAlign: "middle", marginRight: 4 }} />SITECRAFT AI</div><div className="message-bubble busy-message"><LoaderCircle className="spin" size={13} />{busyText}</div></div>}
          <div ref={messagesEndRef} />
        </div>
        <div className="chat-input-wrap">
          {selectedTarget && <div className="chat-target"><span>正在修改：{selectedTarget.label}</span><button aria-label="清除修改目标" onClick={() => setSelectedTarget(null)} type="button"><X size={12} /></button></div>}
          {alignmentView && (alignmentView.enabled || alignmentView.waitingForUser || alignmentView.prefsOnly || alignmentView.lastResult || alignmentView.answers.length) ? (
            <div className="alignment-panel">
              {alignmentView.answers.length ? <details className="alignment-summary"><summary>已保存的问答（{alignmentView.answers.length}）</summary>{alignmentView.answers.map((answer) => <p key={answer.questionId}><strong>{answer.question}</strong><br />{answer.label}{answer.note ? `：${answer.note}` : ""}</p>)}</details> : null}
              {alignmentView.processing ? <div className="alignment-summary" role="status">正在继续已保存的任务…</div> : null}
              {alignmentView.waitingForUser ? (
                <>
                  <div className="alignment-question">{alignmentView.question || "等待你选择"}</div>
                  <div className="alignment-cards">
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
                        <span>{option.description}</span>
                      </button>
                    ))}
                  </div>
                  <div className="alignment-actions">
                    {alignmentView.utilities.map((option) => (
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
                  {alignmentView.pendingMessage ? <div className="alignment-summary">已保存任务：{alignmentView.pendingMessage}</div> : null}
                  {alignmentView.summary ? <div className="alignment-summary">{alignmentView.summary}</div> : null}
                </>
              ) : alignmentView.prefsOnly ? (
                <div className="alignment-confirmed">偏好已保存。</div>
              ) : alignmentView.lastResult?.status === "applied" ? (
                <div className="alignment-confirmed">已应用已确认的方案{typeof alignmentView.lastResult.revision === "number" ? `，草稿 v${alignmentView.lastResult.revision}` : ""}</div>
              ) : null}
            </div>
          ) : null}
          <form className="chat-input" onSubmit={submitChat}>
            <div className="chat-plus-wrap">
              <button
                className={plusOpen || alignmentEnabled ? "chat-plus-button active" : "chat-plus-button"}
                type="button"
                aria-label="更多"
                aria-expanded={plusOpen}
                onClick={() => setPlusOpen((value) => !value)}
              >
                <Plus size={14} />
              </button>
              {plusOpen ? (
                <div className="chat-plus-menu" role="menu">
                  <label>
                    <input
                      type="checkbox"
                      checked={alignmentEnabled}
                      disabled={busy}
                      onChange={(event) => { void toggleAlignment(event.target.checked); }}
                    />
                    需求对齐
                  </label>
                  <button
                    type="button"
                    role="menuitem"
                    disabled={busy || !draftReady}
                    onClick={() => {
                      setPlusOpen(false);
                      setShowMaterials(true);
                    }}
                  >
                    提供公司资料
                  </button>
                </div>
              ) : null}
            </div>
            <textarea ref={inputRef} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void submitChat(); } }} placeholder="告诉 AI 你想怎么改..." rows={2} />
            <button className="send-button" type="submit" disabled={!input.trim() || busy || !draftReady} aria-label="发送"><Send size={14} /></button>
          </form>
          <div className="chat-hints">
            <button className="hint" type="button" onClick={() => setShowMaterials(true)}>提供公司资料</button>
            <button className="hint" type="button" onClick={() => setInput("只把第二个服务标题改为智能产线集成，其他内容不变")}>修改服务</button>
            <button className="hint" type="button" onClick={() => setInput("重写首屏标题和说明，不要更换模板")}>优化首屏</button>
            <button className="hint" type="button" onClick={() => setShowImport(true)}>上传商品表格</button>
          </div>
        </div>
      </aside>
      <main className={`preview-shell ${mobilePane !== "preview" ? "mobile-hidden" : ""}`}>
        <header className="preview-toolbar">
          <div className="preview-toolbar-left"><div className="project-name">{draft.siteName}</div><span className={`save-status ${previewState}`}><Check size={12} />{saveLabel}</span></div>
          <div className="preview-toolbar-right">
            <div className="device-toggle"><button className={device === "desktop" ? "active" : ""} onClick={() => setDevice("desktop")} aria-label="桌面预览"><Desktop size={14} /></button><button className={device === "tablet" ? "active" : ""} onClick={() => setDevice("tablet")} aria-label="平板预览"><Tablet size={14} /></button><button className={device === "mobile" ? "active" : ""} onClick={() => setDevice("mobile")} aria-label="手机预览"><Mobile size={14} /></button></div>
            <div className="device-toggle"><button className={locale === "zh" ? "active" : ""} onClick={() => setLocale("zh")}>中</button><button className={locale === "en" ? "active" : ""} onClick={() => setLocale("en")}>EN</button></div>
            <button className="icon-button" onClick={() => void moveHistory("undo")} disabled={!canUndo || busy} aria-label="撤销"><RotateCcw size={14} /></button>
            <button className="icon-button" onClick={() => void moveHistory("redo")} disabled={!canRedo || busy} aria-label="重做"><RotateCw size={14} /></button>
            <button className="secondary-button" onClick={() => setShowImport(true)}><Upload size={14} />商品</button>
            <Link className="primary-button" href="/published/forge-industrial" target="_blank" rel="noreferrer"><Globe2 size={14} />发布</Link>
          </div>
        </header>
        <div className="preview-stage"><div className={`browser-frame ${device}`}><div className="browser-bar"><span className="browser-dot" /><span className="browser-dot" /><span className="browser-dot" /><div className="browser-url">{draft.visualBrief.label}.sites.ai</div><CircleHelp size={11} color="#adb8af" /></div>{draftReady && <OpenSourceTemplateFrame templateId={draft.templateId} draft={draft} locale={locale} variant="workspace" expectedTargets={expectedTargets} onSelectTarget={selectPreviewTarget} onApplyReport={handlePreviewReport} />}</div></div>
      </main>
      {showImport && (
        <div className="modal-backdrop" onClick={() => setShowImport(false)}><div className="import-modal" onClick={(event) => event.stopPropagation()}>
          <div className="modal-head"><div><div className="eyebrow">Content / Products</div><h3>填充你的商品目录</h3></div><button className="icon-button" onClick={() => setShowImport(false)} aria-label="关闭"><X size={15} /></button></div>
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
                <div className="eyebrow">Company / Materials</div>
                <h3>提供公司资料</h3>
              </div>
              <button className="icon-button" onClick={() => setShowMaterials(false)} aria-label="关闭资料"><X size={15} /></button>
            </div>
            <p className="modal-copy">资料会经现有对话发给模型，再走 commitOperations。模拟包只用于内部 Demo，事实只能来自资料或「待补充」。当前不能另开独立页面，只能改同一模板上的声明区块。</p>
            <div className="pack-actions">
              {simulatedPackList.map((pack) => (
                <button
                  className={loadedPackId === pack.id ? "hint selected" : "hint"}
                  key={pack.id}
                  type="button"
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
              <span><FileText size={14} /> 发送后由模型改草稿，不会绕过 commitOperations</span>
              <button
                className="primary-button"
                type="button"
                disabled={!materialsText.trim() || busy || !draftReady}
                onClick={() => { void submitMaterials(); }}
              >
                根据资料生成站点
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
