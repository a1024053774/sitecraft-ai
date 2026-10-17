import { parseFragment, type DefaultTreeAdapterTypes as Dom } from 'parse5';
import { annotationTargetSchema, type AnnotationTarget } from './annotations.ts';
import type { CodeVersion } from './code-site.ts';
import { factSourceKey, normalizeFactQuote, type CodeFactSource } from './code-site-fact-segments.ts';

// Normalization locates the adopted quote; matching later uses only these raw
// source slices. Grapheme boundaries retain composed and expanded NFKC forms.
function originalQuotes(text: string, quote: string): string[] {
  const needle = normalizeFactQuote(quote);
  if (!needle) return [];
  let normalized = '';
  const positions: Array<{ start: number; end: number }> = [];
  for (const { segment, index } of new Intl.Segmenter('und', { granularity: 'grapheme' }).segment(text)) {
    for (const char of segment.normalize('NFKC')) {
      const value = /\s/u.test(char) ? ' ' : char, end = index + segment.length;
      if (value === ' ' && normalized.endsWith(' ')) { positions.at(-1)!.end = end; continue; }
      normalized += value;
      for (let i = 0; i < value.length; i++) positions.push({ start: index, end });
    }
  }
  if (normalized.trim() !== normalizeFactQuote(text)) return [];
  const originals: string[] = [];
  for (let at = normalized.indexOf(needle); at >= 0; at = normalized.indexOf(needle, at + 1)) {
    const raw = text.slice(positions[at].start, positions[at + needle.length - 1].end);
    // A quote cannot select only part of one expanded compatibility character.
    if (normalizeFactQuote(raw) === needle) originals.push(raw);
  }
  return originals;
}

// Only adopted quotes from this submission's new message sources authorize a
// match. Uploads, old citations and the request text alone cannot trigger one.
export function stalePlaceholderPrompts(version: CodeVersion, parent: CodeVersion | null, source: CodeFactSource | CodeFactSource[] | undefined,
  scope: { targets: AnnotationTarget[]; pageId?: string }): NonNullable<CodeVersion['stalePlaceholders']> {
  if (!parent || (!scope.targets.length && !scope.pageId)) return [];
  const previous = new Set((parent.factSourceSnapshot ?? []).map(factSourceKey));
  const added = new Set([source ?? []].flat().filter(item => item.type === 'message' && !previous.has(factSourceKey(item))).map(factSourceKey));
  const quotes = [...new Set((version.checks.factCitations?.entries ?? [])
    .filter(citation => citation.source?.type === 'message' && added.has(factSourceKey({ ...citation.source, text: '' })))
    .flatMap(citation => {
      const original = version.factSourceSnapshot?.find(item => item.type === 'message' && factSourceKey(item) === factSourceKey({ ...citation.source!, text: '' }));
      return original ? originalQuotes(original.text, citation.quote) : [];
    }))];
  if (!quotes.length) return [];
  const hits: NonNullable<CodeVersion['stalePlaceholders']> = [];
  const isElement = (node: Dom.Node): node is Dom.Element => 'tagName' in node;
  const children = (node: Dom.ParentNode) => node.childNodes.filter(isElement);
  const text = (node: Dom.Node): string => node.nodeName === '#text' ? (node as Dom.TextNode).value
    : 'childNodes' in node && node.nodeName !== '#comment' ? node.childNodes.map(text).join('') : '';
  const snapshot = (node: Dom.Node) => text(node).replace(/\s+/g, ' ').trim().slice(0, 1000);
  const contains = (path: number[], child: number[]) => path.every((value, i) => child[i] === value);
  const editable = /^(section|article|div|header|aside|footer)$/;
  for (const page of version.code.pages) {
    if (page.id === scope.pageId) continue;
    const fragment = parseFragment(page.html);
    const mains: Dom.Element[] = [];
    const find = (node: Dom.ParentNode) => { for (const child of children(node)) { if (child.tagName === 'main') mains.push(child); find(child); } };
    find(fragment);
    if (mains.length !== 1) continue;
    const main = mains[0];
    const heading = (node: Dom.Element): string => {
      for (const child of children(node)) { if (/^h[1-3]$/.test(child.tagName) && snapshot(child)) return snapshot(child); const nested = heading(child); if (nested) return nested; }
      return '';
    };
    const visit = (element: Dom.Element, path: number[], ancestors: Array<{ node: Dom.Element; path: number[] }>) => {
      if (['style', 'script', 'template', 'svg'].includes(element.tagName)
        || element.attrs.some(attr => attr.name === 'data-system-icon' || (attr.name === 'class' && attr.value.split(/\s+/).includes('sc-image-credits')))) return;
      if (scope.targets.some(target => target.pageId === page.id && contains(target.path, path))) return;
      // Same block choice as preview capture: nearest section/article, otherwise
      // a direct child of main. Element indices and snapshots use its contract.
      const chain = [...ancestors, { node: element, path }];
      const block = [...chain].reverse().find(item => /^(section|article)$/.test(item.node.tagName)) ?? chain.find(item => item.path.length === 1);
      if (block && editable.test(block.node.tagName)) for (const node of element.childNodes) {
        if (node.nodeName !== '#text') continue;
        const value = (node as Dom.TextNode).value;
        for (const match of value.matchAll(/待补充/g)) {
          // Never join across punctuation, line breaks or element boundaries.
          const item = value.slice(0, match.index).split(/[\p{P}\r\n\u2028\u2029]/u).at(-1)!.trim();
          if ([...item].length < 2) continue;
          const quote = quotes.find(quote => quote.includes(item));
          if (!quote) continue;
          const targetText = snapshot(block.node);
          const lineStart = value.lastIndexOf('\n', match.index) + 1, lineEnd = value.indexOf('\n', match.index);
          const start = Math.max(lineStart, match.index - 80), end = Math.min(lineEnd < 0 ? value.length : lineEnd, match.index + 83);
          const target = annotationTargetSchema.safeParse({ kind: 'dom', pageId: page.id, versionId: version.id, path: block.path, text: targetText,
            label: (heading(block.node) || targetText).slice(0, 80),
            element: { path: path.slice(block.path.length), tag: element.tagName, text: snapshot(element) } });
          hits.push({ pageTitle: page.title, snippet: value.slice(start, end).trim(), quote,
            ...(target.success ? { target: target.data } : {}) });
        }
      }
      children(element).forEach((child, index) => visit(child, [...path, index], chain));
    };
    visit(main, [], []);
  }
  return hits;
}
