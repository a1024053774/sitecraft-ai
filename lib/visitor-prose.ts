// Visitor prose (hero subtitle, about, section intros, card and product text, inquiry copy) talks
// about the company. A sentence whose only job is to report a missing fact ("电话与地址待补充"), or
// that talks about building the site or about the materials ("四个整站共用", "资料中"), is meta
// talk and does not go on the visitor page (CONTEXT: 元话术). A gap inside a sentence that also
// states a real fact ("MOQ 20 台，交期待补充") stays, per the gap rule.

const GAP_ZH = /待补充|待确认|尚未提供|未提供|暂无资料/;
const GAP_EN = /to be (?:provided|completed|confirmed)|not (?:yet )?provided/i;
const BUILD_TALK_ZH = /整站|建站|本站点|网站模板|模板|区块|页面规划|草稿|资料(?:中|里|给出|显示|未|没有|所列)|模拟资料|核验记号/;
const BUILD_TALK_EN = /\b(?:template|site builder|draft|the materials|provided materials|all (?:four|4) sites)\b/i;

function sentences(text: string, locale: "zh" | "en") {
  const pattern = locale === "zh" ? /[^。！？!?；;]+[。！？!?；;]?/g : /[^.!?;]+[.!?;]?\s*/g;
  return text.match(pattern)?.map((item) => item) ?? [text];
}

// A clause is a gap clause when it reports a missing fact and carries no figure of its own.
function isGapClause(clause: string, locale: "zh" | "en") {
  const trimmed = clause.trim();
  if (!trimmed) return true;
  const gap = locale === "zh" ? GAP_ZH : GAP_EN;
  return gap.test(trimmed) && !/\d/.test(trimmed);
}

function isGapSentence(sentence: string, locale: "zh" | "en") {
  const body = sentence.replace(/[。！？!?；;.\s]+$/, "");
  if (!body.trim()) return false;
  // 、 joins items of one list ("电话、邮箱均为待补充"), so clauses split on commas only.
  const clauses = body.split(/[，,]/);
  return clauses.every((clause) => isGapClause(clause, locale)) && clauses.some((clause) => (locale === "zh" ? GAP_ZH : GAP_EN).test(clause));
}

function isBuildTalk(sentence: string, locale: "zh" | "en") {
  return (locale === "zh" ? BUILD_TALK_ZH : BUILD_TALK_EN).test(sentence);
}

export function stripGapTalk(text: string, locale: "zh" | "en"): string {
  const gapMarker = locale === "zh" ? "待补充" : "To be provided";
  const trimmed = text.trim();
  if (!trimmed || trimmed === gapMarker) return trimmed || gapMarker;
  const kept = sentences(trimmed, locale).filter((sentence) => !isGapSentence(sentence, locale) && !isBuildTalk(sentence, locale));
  let result = kept.join("").trim();
  // A dropped trailing sentence can leave "；" or "," behind; end the kept text properly.
  if (kept.length < sentences(trimmed, locale).length) {
    result = locale === "zh" ? result.replace(/[；;，,]$/, "。") : result.replace(/[;,]$/, ".");
  }
  return result || gapMarker;
}

export function stripGapTalkBilingual(value: string | { zh: string; en: string }, locale: "zh" | "en" = "zh") {
  if (typeof value === "string") return stripGapTalk(value, locale);
  return { zh: stripGapTalk(value.zh, "zh"), en: stripGapTalk(value.en, "en") };
}
