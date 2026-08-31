"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  MessageSquareText,
  Sparkles,
  WandSparkles,
  LoaderCircle,
  AlertCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { OpenSourceTemplateFrame } from "@/components/open-source-template-frame";
import { templates, type SiteDraft } from "@/lib/site-model";
import { defaultDraft } from "@/lib/site-document";

type Intent = {
  businessType: string;
  companyName: string;
  industry: string;
  targetAudience: string;
  tone: string;
  colorTone?: string;
  coreSections: string[];
  recommendedTemplateId: string;
  summary: string;
};
type TemplateMatch = { id: string; name: string; category: string; reason: string };
type Step = "input" | "confirm" | "generating" | "done";

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
  about: "关于",
  features: "优势",
  services: "服务",
  products: "产品",
  contact: "联系",
};

function readSseEvents(raw: string) {
  return raw
    .split("\n\n")
    .map((block) => block.split("\n").find((line) => line.startsWith("data: "))?.slice(6))
    .filter(Boolean)
    .map((value) => JSON.parse(value as string) as Record<string, unknown>);
}

export default function GeneratePage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("input");
  const [message, setMessage] = useState("");
  const [intent, setIntent] = useState<Intent | null>(null);
  const [template, setTemplate] = useState<TemplateMatch | null>(null);
  const [hiddenSections, setHiddenSections] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progressText, setProgressText] = useState("");

  const category = template?.category ?? "";
  const templateOptions = useMemo(
    () => (category ? templates.filter((t) => t.category === category) : templates),
    [category],
  );

  const analyze = async (text: string) => {
    setBusy(true);
    setError(null);
    setProgressText("正在理解你的需求…");
    try {
      const res = await fetch(`/api/sites/demo/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: "analyze", message: text }),
      });
      const reader = res.body?.getReader();
      if (!reader) throw new Error("无法读取响应");
      const decoder = new TextDecoder();
      let raw = "";
      let done: Record<string, unknown> | undefined;
      while (true) {
        const result = await reader.read();
        raw += decoder.decode(result.value ?? new Uint8Array(), { stream: !result.done });
        const events = readSseEvents(raw);
        const status = [...events].reverse().find((e) => e.type === "status");
        if (typeof status?.value === "string") setProgressText(status.value);
        done = events.find((e) => e.type === "done");
        if (result.done) break;
      }
      if (!done) throw new Error("没有返回结果");
      if (done.status === "error") throw new Error(String(done.error || "分析失败"));
      if (done.status !== "ready") throw new Error(`意外状态 ${done.status}`);
      setIntent(done.intent as Intent);
      setTemplate(done.template as TemplateMatch);
      setHiddenSections((done.hiddenSections as string[]) ?? []);
      setStep("confirm");
    } catch (e) {
      setError(e instanceof Error ? e.message : "分析失败");
      setStep("input");
    } finally {
      setBusy(false);
    }
  };

  const execute = async () => {
    if (!intent || !template) return;
    setBusy(true);
    setError(null);
    setStep("generating");
    const sessionId = window.sessionStorage.getItem("sitecraft-session") ?? crypto.randomUUID();
    window.sessionStorage.setItem("sitecraft-session", sessionId);
    setProgressText("正在创建站点…");
    try {
      // 1. 创建新站点
      const siteRes = await fetch(`/api/sites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: intent.companyName, templateId: template.id, locales: ["zh", "en"] }),
      });
      const sitePayload = await siteRes.json().catch(() => null);
      const siteId = sitePayload?.id ?? "demo";
      // 2. 读初始 revision
      const draftRes = await fetch(`/api/sites/${siteId}/draft`, { cache: "no-store" });
      const draftPayload = await draftRes.json();
      const baseRevision = draftPayload.draft?.revision ?? 1;
      // 3. 执行生成
      const res = await fetch(`/api/sites/${siteId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step: "execute",
          message,
          intent,
          templateId: template.id,
          hiddenSections,
          baseRevision,
          sessionId,
        }),
      });
      const reader = res.body?.getReader();
      if (!reader) throw new Error("无法读取生成结果");
      const decoder = new TextDecoder();
      let raw = "";
      let done: Record<string, unknown> | undefined;
      while (true) {
        const result = await reader.read();
        raw += decoder.decode(result.value ?? new Uint8Array(), { stream: !result.done });
        const events = readSseEvents(raw);
        const status = [...events].reverse().find((e) => e.type === "status");
        if (typeof status?.value === "string") setProgressText(status.value);
        done = events.find((e) => e.type === "done");
        if (result.done) break;
      }
      if (!done) throw new Error("生成没有返回结果");
      if (done.status === "error") throw new Error(String(done.error || "生成失败"));
      if (done.status === "conflict") throw new Error("草稿冲突，请重试");
      setStep("done");
      setTimeout(() => router.push(`/workspace?siteId=${siteId}`), 1200);
    } catch (e) {
      setError(e instanceof Error ? e.message : "生成失败");
      setStep("confirm");
    } finally {
      setBusy(false);
    }
  };

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
              <div className="eyebrow">✨ 自然语言建站</div>
              <h1>用一段对话，<br /><span style={{ color: "#2e6b4f" }}>变成一座网站。</span></h1>
              <p>描述你的业务，AI 帮你选模板、出初稿，再进工作台精修。</p>
              <textarea
                className="generate-textarea"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="例如：做个光伏出口企业的官网，主打欧美，要显得专业可靠"
                rows={3}
              />
              <div className="generate-examples">
                {examples.map((ex) => (
                  <button key={ex} className="generate-chip" onClick={() => setMessage(ex)}>
                    {ex}
                  </button>
                ))}
              </div>
              {error && <p className="generate-error"><AlertCircle size={13} />{error}</p>}
              <button
                className="primary-button"
                disabled={!message.trim() || busy}
                onClick={() => void analyze(message)}
              >
                {busy ? <LoaderCircle size={15} className="spin" /> : <WandSparkles size={15} />}
                {busy ? progressText : "开始理解需求"} <ArrowRight size={15} />
              </button>
              {busy && <p className="generate-progress">{progressText}</p>}
            </div>
          )}

          {step === "confirm" && intent && template && (
            <div className="generate-confirm">
              <div className="eyebrow">我理解你要的是</div>
              <h1>{intent.summary}</h1>
              <div className="generate-confirm-grid">
                <div className="template-card generate-intent-card">
                  <h3>意图摘要</h3>
                  <div className="generate-intent-rows">
                    <div><span>行业</span><strong>{BUSINESS_LABELS[intent.businessType] ?? intent.businessType} · {intent.industry}</strong></div>
                    <div><span>受众</span><strong>{AUDIENCE_LABELS[intent.targetAudience] ?? intent.targetAudience}</strong></div>
                    <div><span>语气</span><strong>{TONE_LABELS[intent.tone] ?? intent.tone}</strong></div>
                    {intent.colorTone && <div><span>色系</span><strong>{intent.colorTone}</strong></div>}
                  </div>
                  <h3 style={{ marginTop: 14 }}>板块</h3>
                  <div className="generate-sections">
                    {intent.coreSections.map((s) => (
                      <button
                        key={s}
                        className={`generate-toggle ${hiddenSections.includes(s) ? "off" : "on"}`}
                        onClick={() => setHiddenSections((prev) =>
                          prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
                        )}
                      >
                        {SECTIONS_LABELS[s] ?? s}
                        {hiddenSections.includes(s) ? " 隐藏" : " 显示"}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="template-card generate-template-card">
                  <h3>推荐模板</h3>
                  <div className="generate-template-cover">
                    <OpenSourceTemplateFrame templateId={template.id} variant="thumbnail" />
                  </div>
                  <div className="generate-template-meta">
                    <strong>{template.name}</strong>
                    <span>{template.category}</span>
                    <p>{template.reason}</p>
                  </div>
                  <select
                    className="generate-select"
                    value={template.id}
                    onChange={(e) => setTemplate({ ...template, id: e.target.value, name: templates.find((t) => t.id === e.target.value)?.name ?? e.target.value })}
                  >
                    {templateOptions.map((t) => (
                      <option key={t.id} value={t.id}>{t.name} · {t.category}</option>
                    ))}
                  </select>
                </div>
              </div>
              {error && <p className="generate-error"><AlertCircle size={13} />{error}</p>}
              <button className="primary-button" disabled={busy} onClick={() => void execute()}>
                {busy ? <LoaderCircle size={15} className="spin" /> : <Sparkles size={15} />}
                {busy ? progressText : "生成初稿"} <ArrowRight size={15} />
              </button>
            </div>
          )}

          {step === "generating" && (
            <div className="generate-progress-view">
              <div className="eyebrow">正在搭建</div>
              <h1>{intent?.companyName || "你的网站"}</h1>
              <div className="generate-steps">
                <div className="step done"><Check size={13} /> 理解需求</div>
                <div className="step done"><Check size={13} /> 匹配模板 · {template?.name}</div>
                <div className="step active"><LoaderCircle size={13} className="spin" /> {progressText}</div>
              </div>
            </div>
          )}

          {step === "done" && (
            <div className="generate-progress-view">
              <div className="eyebrow">完成</div>
              <h1>🎉 初稿已生成</h1>
              <p>正在进入工作台…</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
