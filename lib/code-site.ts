import { z } from 'zod';
import { systemIconSvg, systemIconLicense } from './code-site-icons.ts';

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
export type CodePreferences = { style: 'auto' | 'precision' | 'documentary'; layout: number; density: number };
export type CodePlan = { summary: string; style: 'precision' | 'documentary'; styleReason: string;
  // Saved outlines from before T-135 have no skeleton; new model plans require it.
  skeleton?: { id: string; reason: string }; skeletonOrder?: string[]; pages: Array<{ id: string; title: string; outline: string }> };
export type CodeQualityKind = 'truncatedText' | 'ungatedHover' | 'smallTargets' | 'coveredAnchors' | 'croppedProductImages';
export type CodeQualityFeedback = Record<CodeQualityKind, number> & {
  details: Array<{ kind: CodeQualityKind; target: string; text: string; detail: string }>;
};
export type CodeCheck = {
  passed: boolean; issues: string[]; cleaned: string[]; checkedAt: string;
  factReview?: 'legacy-unreviewed';
  viewports: Array<{ pageId: string; width: number; overflow: number; overlaps: number; contrastIssues: number; longLines: number;
    // Absent on versions checked before T-147; absence is not zero findings.
    qualityFeedback?: CodeQualityFeedback }>;
};
export type CodeVersion = {
  id: string; revision: number; author: 'assistant' | 'user' | 'legacy-import'; summary: string; request: string; createdAt: string;
  code: SiteCode; checks: CodeCheck; model?: string; restoredFrom?: string; name?: string;
  chineseRevision?: number;
  english?: { sourceRevision: number; header: string; footer: string; pages: SiteCode['pages']; checks: CodeCheck };
};
export type CodeModelCall = {
  purpose: 'plan' | 'select' | 'write' | 'repair' | 'facts' | 'translate'; model: string; startedAt: string; latencyMs: number; httpStatus: number | null;
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
    : checks.passed ? '底线检查通过' : '底线检查未过';
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
export function codeFactMaterials(site: CodeSiteRecord, request?: string, versionId = site.currentVersionId) {
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
    .replace(/<div\b([^>]*?)data-system-inquiry=""([^>]*)><\/div>/g, (_all, before: string, after: string) => `<div${before}${after}><form class="sc-inquiry" action="/api/public/${encodeURIComponent(siteId)}/leads" method="post"><label>${en ? 'Name' : '姓名'}<input name="name" required maxlength="80" autocomplete="name"></label><label>${en ? 'Email' : '邮箱'}<input name="email" type="email" required maxlength="160" autocomplete="email"></label><label>${en ? 'Company' : '公司'}<input name="company" maxlength="120" autocomplete="organization"></label><label>${en ? 'Inquiry' : '询盘内容'}<textarea name="message" required maxlength="4000" rows="5"></textarea></label><button type="submit">${en ? 'Send inquiry' : '发送询盘'}</button></form></div>`);
  const credits = imageCredits.length ? `<details class="sc-image-credits"><summary>${en ? 'Image sources and licenses' : '图片来源与许可'}</summary>${imageCredits.map(credit => `<p>${escapeCodeText(en && credit === '用户提供；仅当前站点使用' ? 'User supplied; for this site only' : credit)}</p>`).join('')}</details>` : '';
  const languages = options.languageLinks ? `<nav class="sc-language-links" aria-label="${en ? 'Language' : '语言'}"><a lang="zh-CN" href="${escapeCodeText(options.languageLinks.zh)}"${!en ? ' aria-current="page"' : ''}>中文</a><a lang="en" href="${escapeCodeText(options.languageLinks.en)}"${en ? ' aria-current="page"' : ''}>English</a></nav>` : '';
  return `<!doctype html><html lang="${en ? 'en' : 'zh-CN'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src 'self'; form-action 'self'; base-uri 'none'; script-src 'none'"><title>${escapeCodeText(page.title)}</title><style>${code.css}</style><style>.sc-language-links{display:flex!important;position:static!important;flex-wrap:wrap;justify-content:flex-end;gap:12px;padding:8px 24px;background:#fff;color:#222;font:14px/1.5 sans-serif}.sc-language-links a{display:inline-block!important;position:static!important;color:#222!important;padding:10px;text-decoration:underline}.sc-image-credits{padding:12px 24px;background:#fff;color:#333;font-size:12px}.sc-image-credits p{max-width:40em;overflow-wrap:anywhere} .sc-inquiry label{display:block;margin:12px 0}.sc-inquiry input,.sc-inquiry textarea{display:block;box-sizing:border-box;width:100%;max-width:100%;font:inherit;padding:10px;color:#222;background:#fff;border:1px solid #777}.sc-inquiry button{font:inherit;padding:12px 20px;color:#fff;background:#222;border:0}.sc-inquiry{max-width:40em;min-width:0;grid-column:1/-1;width:100%}</style></head><body>${links(code.header)}${languages}${links(page.html)}${links(code.footer)}${credits}${usesIcons ? systemIconLicense : ''}</body></html>`;
}
