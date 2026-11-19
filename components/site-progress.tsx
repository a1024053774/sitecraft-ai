import { codeSiteSteps } from "@/lib/code-site";
import type { CodeSiteListItem } from "@/lib/code-site-store";

export function formatUpdatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

// T-220: what the list says about a site and what its button does next.
export function siteProgressText(site: CodeSiteListItem) {
  const progress = site.progress;
  if (site.readError || !progress) return { label: site.status || "无法打开", action: "查看原因", tone: "bad" as const };
  const index = codeSiteSteps.findIndex(step => step.id === progress.step);
  const name = `第 ${index + 1} 步 · ${codeSiteSteps[index].label}`;
  if (progress.step === "edit") return progress.runFailed
    ? { label: `${name}，上次改动没通过检查`, action: "继续修改", tone: "bad" as const }
    : { label: name, action: "继续修改", tone: "plain" as const };
  if (progress.step === "generate") return progress.runFailed
    ? { label: `${name}，没通过检查`, action: "继续生成", tone: "bad" as const }
    : { label: `${name}，正在写页面`, action: "查看进度", tone: "wait" as const };
  if (progress.step === "outline") return { label: `${name}，等你确认`, action: "确认大纲", tone: "wait" as const };
  if (progress.step === "style") return { label: `${name}，等你选`, action: "选风格", tone: "wait" as const };
  return { label: `${name}，还没发`, action: "发资料", tone: "wait" as const };
}

export function SiteProgress({ site }: { site: CodeSiteListItem }) {
  const text = siteProgressText(site);
  const current = site.progress ? codeSiteSteps.findIndex(step => step.id === site.progress!.step) : -1;
  return (
    <div className={`site-progress tone-${text.tone}`}>
      <div className="site-progress-bar" aria-hidden="true">
        {codeSiteSteps.map((step, index) => <i key={step.id} className={index < current ? "done" : index === current ? "current" : ""} />)}
      </div>
      <span>{text.label}</span>
    </div>
  );
}

export function siteVersionText(site: CodeSiteListItem) {
  const progress = site.progress;
  if (!progress || progress.revision === null) return { main: "—", sub: progress?.pageCount ? `大纲 ${progress.pageCount} 页` : "还没有页面" };
  return { main: `第 ${progress.revision} 版`, sub: `${progress.pageCount} 页 · ${progress.checksPassed ? "检查通过" : "检查未过"}${progress.english ? " · 中英文" : ""}` };
}
