import { codeSiteSteps } from "@/lib/code-site";
import type { CodeSiteListItem } from "@/lib/code-site-store";

export function formatUpdatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

type ListedSite = Pick<CodeSiteListItem, "progress" | "hasVersion" | "readError" | "status">;
// T-220: what the list says about a site and what its button does next. The step and its state come from codeSiteFlow, as in the workspace.
export function siteProgressText(site: ListedSite) {
  const progress = site.progress;
  if (site.readError) return { label: site.status || "无法打开", action: "查看原因", tone: "bad" as const };
  // A summary saved before the list carried progress still opens.
  if (!progress) return site.hasVersion ? { label: "已有版本", action: "继续修改", tone: "plain" as const } : { label: "还没有生成页面", action: "继续新建", tone: "wait" as const };
  const index = codeSiteSteps.findIndex(step => step.id === progress.step);
  const name = `第 ${index + 1} 步 · ${codeSiteSteps[index].label}`;
  const text = (note: string, action: string, tone: "plain" | "wait" | "bad") => ({ label: note ? `${name}，${note}` : name, action, tone });
  if (progress.state === "edit-failed") return text("上次改动没有保存", "继续修改", "bad");
  if (progress.state === "writing") return text("正在写页面", "查看进度", "wait");
  if (progress.state === "resume") return text("页面已写好，还没通过检查", "继续检查", "bad");
  if (progress.state === "generate-failed") return text("没有生成成功", "查看原因", "bad");
  if (progress.state === "regenerate") return text("生成中断，等你重新生成", "重新生成", "bad");
  if (progress.state === "planning") return text("正在拟大纲", "查看进度", "wait");
  if (progress.state === "plan-failed") return text("大纲没拟出来", "重新规划", "bad");
  if (progress.state === "subject") return text("还差主体名称", "填主体名称", "wait");
  if (progress.step === "edit") return text("", "继续修改", "plain");
  if (progress.step === "outline") return text("等你确认", "确认大纲", "wait");
  if (progress.step === "style") return text("等你选", "选风格", "wait");
  return progress.hasMaterials ? text("可以继续补充", "补充资料", "wait") : text("还没发", "发资料", "wait");
}

export function SiteProgress({ site }: { site: ListedSite }) {
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

export function siteVersionText(site: ListedSite) {
  const progress = site.progress;
  if (!progress) return site.hasVersion && !site.readError ? { main: "已有版本", sub: "打开后查看" } : { main: "—", sub: "还没有页面" };
  if (progress.revision === null) return { main: "—", sub: progress.pageCount ? `大纲 ${progress.pageCount} 页` : "还没有页面" };
  return { main: `第 ${progress.revision} 版`, sub: `${progress.pageCount} 页 · ${progress.checksPassed ? "检查通过" : "检查未过"}${progress.english ? " · 中英文" : ""}` };
}
