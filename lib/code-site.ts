import type { CodeFactReview } from './code-site-fact-segments.ts';
import type { AnnotationBatchItem, AnnotationTarget } from './annotations.ts';
import type { CodeStyleId } from './code-site-styles.ts';
import { z } from 'zod';
import { systemIconSvg, systemIconLicense } from './code-site-icons.ts';
import { systemBackdrops, systemBackdropLicense } from './code-site-backdrops.ts';

export const codeSiteSchema = z.object({
  header: z.string().max(30000), footer: z.string().max(30000), css: z.string().max(100000),
  pages: z.array(z.object({
    id: z.string().regex(/^[a-z][a-z0-9-]{0,39}$/), title: z.string().min(1).max(80), html: z.string().min(1).max(100000),
  })).min(1).max(12),
}).superRefine((site, ctx) => {
  if (new Set(site.pages.map(p => p.id)).size !== site.pages.length) ctx.addIssue({ code: 'custom', message: '页面 ID 重复' });
  if (!site.pages.some(p => p.id === 'home')) ctx.addIssue({ code: 'custom', message: '缺少首页' });
});
export type SiteCode = z.infer<typeof codeSiteSchema>;
export type CodePreferences = { style: 'auto' | CodeStyleId; layout: number; density: number };
export type CodePlan = { summary: string; style: CodeStyleId; styleReason: string;
  // Saved outlines from before T-135 have no skeleton; new model plans require it.
  skeleton?: { id: string; reason: string }; skeletonOrder?: string[]; pages: Array<{ id: string; title: string; outline: string }> };
export type CodeQualityKind = 'truncatedText' | 'ungatedHover' | 'smallTargets' | 'coveredAnchors' | 'croppedProductImages' | 'narrowColumns';
export type CodeQualityFeedback = Record<Exclude<CodeQualityKind, 'narrowColumns'>, number> & {
  // Absent on historical checks before T-160; absence means unmeasured.
  narrowColumns?: number;
  details: Array<{ kind: CodeQualityKind; target: string; text: string; detail: string }>;
};
export type CodeCheck = {
  passed: boolean; issues: string[]; cleaned: string[]; checkedAt: string;
  factReview?: 'legacy-unreviewed';
  factSegments?: CodeFactReview;
  factReviewFrom?: { versionId: string; revision: number; checkedAt: string };
  viewports: Array<{ pageId: string; width: number; overflow: number; overlaps: number; contrastIssues: number; longLines: number;
    // Absent on versions checked before T-147; absence is not zero findings.
    qualityFeedback?: CodeQualityFeedback }>;
};
export type CodeVersion = {
  id: string; revision: number; author: 'assistant' | 'user' | 'legacy-import'; summary: string; request: string; createdAt: string;
  code: SiteCode; checks: CodeCheck; model?: string; restoredFrom?: string; name?: string;
  // Raw site materials at the fact review; version requests remain immutable
  // and are restored through codeFactMaterials with the target version.
  materialSnapshot?: string;
  chineseRevision?: number;
  english?: { sourceRevision: number; header: string; footer: string; pages: SiteCode['pages']; checks: CodeCheck };
};
export type CodeModelCall = {
  purpose: 'plan' | 'select' | 'write' | 'repair' | 'facts' | 'translate' | 'local-edit' | 'local-facts'; model: string; startedAt: string; latencyMs: number; httpStatus: number | null;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number; reasoningTokens?: number } | null;
  skeletonOrder?: string[];
  translationInput?: { pageId: string | null; slotCount: number; sourceChars: number; maxTokens: number;
    slotMap?: Array<{ id: string; domId: string }>; correctionRound?: number };
  response?: { finishReason: string | null; answerChars: number | null; reasoningTokens: number | null;
    // Translation replies only; absent on older runs that did not capture the body.
    rawMessage?: { content: unknown; tool_calls: unknown };
    translationCoverage?: { missingIds: string[]; unknownIds: string[]; duplicateIds: string[] } };
};
export type CodeRun = {
  id: string; kind: 'plan' | 'generate' | 'edit' | 'translate'; status: 'running' | 'complete' | 'error';
  step: string; request: string; baseRevision: number; startedAt: string; updatedAt: string;
  selectedTarget?: AnnotationTarget; pageId?: string; saveAnnotation?: boolean; annotationId?: string;
  annotationSubmissionId?: string;
  annotationBatch?: AnnotationBatchItem[];
  annotationOverlapConfirmed?: boolean;
  annotationIds?: Array<{ draftId: string; annotationId: string }>;
  annotationResults?: Array<{ draftIds: string[]; status: 'applied' | 'rejected'; message: string }>;
  overallIssue?: string;
  localResponses?: Array<{ response: unknown; issues: string[] }>;
  repairRound: number; issues: string[]; versionId?: string; referenceVersionIds?: string[];
  attempts: Array<{ code: SiteCode; checks: CodeCheck }>;
  modelCalls?: CodeModelCall[];
  repairFailure?: { reason: string; response: unknown };
};
export type CodeSiteRecord = {
  route: 'code'; siteId: string; name: string; conversationId: string; materials: string;
  preferences: CodePreferences; plan: CodePlan | null; versions: CodeVersion[]; currentVersionId: string | null;
  run: CodeRun | null; runs: CodeRun[]; updatedAt: string;
  legacySource?: { revision: number; updatedAt: string };
};
export type UnavailableCodeSite = {
  route: 'unavailable'; siteId: string; name: string; updatedAt: string;
  status: '旧站转换失败' | '旧站点未转换，含用户上传，已保留'; readError: string;
  checks?: CodeCheck; legacySource?: { revision: number; updatedAt: string };
};
export function codeCheckLabel(checks: CodeCheck) {
  return checks.factReview === 'legacy-unreviewed'
    ? `${checks.passed ? '确定性检查通过' : '确定性检查未过'} · 旧站转换未做模型校对`
    : `${checks.passed ? '底线检查通过' : '底线检查未过'}${checks.factReviewFrom ? ` · 沿用 v${checks.factReviewFrom.revision} 的事实核对` : ''}`;
}
// A missing snapshot is unknown, unless an initial generation run proves its
// complete original source. Never infer historical sources from current text.
export function reviewedMaterialSnapshot(site: CodeSiteRecord, version: CodeVersion): string | undefined {
  if (!version.checks.passed || version.checks.factReview === 'legacy-unreviewed') return undefined;
  if (typeof version.materialSnapshot === 'string') return version.materialSnapshot;
  if (version.revision !== 1 || version.author !== 'assistant' || version.restoredFrom) return undefined;
  const generation = site.runs.find(run => run.kind === 'generate' && run.status === 'complete'
    && run.baseRevision === 0 && run.versionId === version.id && run.request === version.request
    && run.modelCalls?.some(call => call.purpose === 'facts' && call.httpStatus === 200 && call.response?.finishReason === 'stop'));
  return generation?.request;
}
export function codeVersionAuthor(author: CodeVersion['author']) {
  return author === 'legacy-import' ? '旧站转换' : author === 'user' ? '你' : '助手';
}
export function currentCodeVersion(site: CodeSiteRecord) {
  return site.versions.find(v => v.id === site.currentVersionId) ?? null;
}
export function chineseCodeRevision(version: CodeVersion) { return version.chineseRevision ?? version.revision; }
export function englishSiteCode(site: CodeSiteRecord, version: CodeVersion): SiteCode | null {
  if (!version.english) return null;
  const source = site.versions.find(item => item.revision === version.english!.sourceRevision);
  if (!source) throw new Error('找不到英文版对应的中文版本。');
  return { header: version.english.header, footer: version.english.footer, pages: version.english.pages, css: source.code.css };
}
// Requests are user-supplied data. Restore the effective request chain together with the code;
// a later edit must not revive facts from a change that the user has already undone.
export function codeFactMaterials(site: CodeSiteRecord, request?: string, versionId = site.currentVersionId, compact = false) {
  const chains = new Map<string, string[]>();
  let chain: string[] = [];
  for (const version of site.versions) {
    if (version.restoredFrom) {
      const restored = chains.get(version.restoredFrom);
      if (!restored) throw new Error('找不到恢复版本的资料来源。');
      chain = restored;
    } else chain = [...chain, version.request];
    chains.set(version.id, chain);
  }
  const effective = versionId ? chains.get(versionId) : [];
  if (!effective) throw new Error('找不到当前版本的资料来源。');
  if (compact) {
    // Exact duplicate messages can be omitted, but keep their last occurrence:
    // later source updates must retain their ordering. No source is paraphrased.
    const originals = [site.materials, ...(effective ?? []), ...(request ? [request] : [])];
    return `资料原文与有效版本用户补充（按最后出现顺序）：\n${originals.filter((text, index) => text && !originals.slice(index + 1).includes(text)).join('\n\n')}\n只把用户明确提供的企业信息作为事实；设计要求不是企业事实，字段更新采用最后一次声明。`;
  }
  return `${site.materials}\n\n已采用版本的用户资料和补充（按顺序）：\n${effective.join('\n\n')}\n\n${request ? `本次用户补充与要求：\n${request}` : ''}\n只把用户明确提供或更新的企业信息作为事实；设计要求不是企业事实。字段有明确更新时采用最后一次声明。`;
}
export function escapeCodeText(value: string) {
  return value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}
export function explicitEnglishCompanyName(materials: string): string | null {
  return [...materials.matchAll(/^[ \t]*(?:英文公司名|公司英文名|英文名)[：:][ \t]*(\S.*)$/gm)].at(-1)?.[1].trim() || null;
}

// Model links use /<page id>. The system alone resolves them to a versioned preview URL.
export function renderSiteCode(siteId: string, code: SiteCode, pageId: string, versionId = '', imageCredits: string[] = [], basePath?: string,
  options: { language?: 'zh' | 'en'; languageLinks?: { zh: string; en: string } } = {}) {
  const page = code.pages.find(p => p.id === pageId);
  if (!page) throw new Error('找不到这个页面');
  const prefix = basePath ?? `/api/sites/${encodeURIComponent(siteId)}/code-preview`;
  const en = options.language === 'en';
  let usesIcons = false;
  const links = (html: string) => html.replace(/href="\/([a-z][a-z0-9-]*)(#[^"]*)?"/g, (all, id: string, hash = '') => code.pages.some(p => p.id === id)
    ? `href="${prefix}?page=${id}${versionId ? `&amp;version=${encodeURIComponent(versionId)}` : ''}${en && !basePath ? '&amp;language=en' : ''}${hash}"` : all)
    .replace(/<img\b([^>]*?)data-image-id="(img_[a-z0-9]{16,40})"([^>]*)>/g, (_all, before: string, id: string, after: string) => `<img${before}data-image-id="${id}"${after} src="/api/sites/${encodeURIComponent(siteId)}/images/${id}">`)
    .replace(/<span\b([^>]*?)data-system-icon="([^"]*)"([^>]*)><\/span>/g, (_all, before: string, name: string, after: string) => {
      usesIcons = true;
      return `<span${before}${after}>${systemIconSvg(name)}</span>`;
    })
  const source = code.css + code.header + code.footer + code.pages.map(p => p.html).join('');
  const usedBackdrops = Object.entries(systemBackdrops).filter(([id, entry]) => source.includes(`data-system-backdrop="${id}"`) || Object.values(entry.urls).some(url => source.includes(url)));
  const backdropCss = usedBackdrops.map(([id, entry]) => {
    const selector = `[data-system-backdrop="${id}"]`;
    return `${selector}{background-image:url("${entry.urls[1440]}")!important}@media(max-width:1023px){${selector}{background-image:url("${entry.urls[768]}")!important}}@media(max-width:479px){${selector}{background-image:url("${entry.urls[375]}")!important}}`;
  }).join('\n');
  const allCredits = [...imageCredits, ...(usedBackdrops.length ? [en ? 'Abstract backdrops generated offline; Shader Effects Inc., shaders 4.0.4, MIT. Not product, equipment, or facility photographs.' : '抽象底图：系统离线生成；Shader Effects Inc.，shaders 4.0.4，MIT。不是产品、设备或现场照片。'] : [])];
  const credits = allCredits.length ? `<details class="sc-image-credits"><summary>${en ? 'Image sources and licenses' : '图片来源与许可'}</summary>${[...new Set(allCredits)].map(credit => `<p>${escapeCodeText(en && credit === '用户提供；仅当前站点使用' ? 'User supplied; for this site only' : credit)}</p>`).join('')}</details>` : '';
  const languages = options.languageLinks ? `<nav class="sc-language-links" aria-label="${en ? 'Language' : '语言'}"><a lang="zh-CN" href="${escapeCodeText(options.languageLinks.zh)}"${!en ? ' aria-current="page"' : ''}>中文</a><a lang="en" href="${escapeCodeText(options.languageLinks.en)}"${en ? ' aria-current="page"' : ''}>English</a></nav>` : '';
  return `<!doctype html><html lang="${en ? 'en' : 'zh-CN'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src 'self'; form-action 'none'; base-uri 'none'; script-src 'none'"><title>${escapeCodeText(page.title)}</title><style>${code.css}</style><style>${backdropCss}.sc-language-links{display:flex!important;position:static!important;flex-wrap:wrap;justify-content:flex-end;gap:12px;padding:8px 24px;background:#fff;color:#222;font:14px/1.5 sans-serif}.sc-language-links a{display:inline-block!important;position:static!important;color:#222!important;padding:10px;text-decoration:underline}.sc-image-credits{padding:12px 24px;background:#fff;color:#333;font-size:12px}.sc-image-credits p{max-width:40em;overflow-wrap:anywhere}</style></head><body>${links(code.header)}${languages}${links(page.html)}${links(code.footer)}${credits}${usesIcons ? systemIconLicense : ''}${usedBackdrops.length ? systemBackdropLicense : ''}</body></html>`;
}
