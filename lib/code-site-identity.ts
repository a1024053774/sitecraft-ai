import { factSourceRef, type CodeFactSource, type CodeFactSourceRef } from './code-site-fact-segments.ts';

export type CodeSubject = { name: string; declaration?: { source: CodeFactSourceRef; quote: string } };
type IdentityInput = { name: string; materials: string; factSources?: CodeFactSource[]; subject?: CodeSubject };

// Only explicit identity fields declare a subject. Display names and generated
// page text do not override a declaration supplied by the user.
export function siteSubject(site: IdentityInput): { subject: CodeSubject | null; issue?: string } {
  const sources: CodeFactSource[] = site.factSources ?? (site.materials ? [{ type: 'materials', messageIndex: 1, text: site.materials }] : []);
  for (const source of [...sources].reverse()) {
    const declarations = [...source.text.matchAll(/^[ \t]*(?:公司名|公司名称|企业名|企业名称|机构名|机构名称|主体名称)[：:][ \t]*([^\n\r]+)/gm)];
    if (!declarations.length) continue;
    const names = [...new Set(declarations.map(match => match[1].trim()))];
    if (names.length !== 1 || !names[0] || names[0].length > 100 || names[0] === '未命名站点')
      return { subject: null, issue: '资料中的主体名称不明确，请填写本网站唯一的完整主体名称。' };
    return { subject: { name: names[0], declaration: { source: factSourceRef(source), quote: declarations[0][0].trim() } } };
  }
  if (site.subject) return { subject: site.subject };
  // Persisted sites and explicitly named creation requests already have a
  // registered name. Retain that obligation until a user declares a new one.
  if (site.name.trim() && site.name !== '未命名站点') return { subject: { name: site.name } };
  return { subject: null, issue: '请先填写公司或机构的完整主体名称，再规划和生成网站。' };
}

export class CodeIdentityError extends Error {
  constructor(message: string) { super(message); this.name = 'CodeIdentityError'; }
}
