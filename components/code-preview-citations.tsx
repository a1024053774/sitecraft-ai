'use client';

import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import type { CodeCheck } from '@/lib/code-site';
import type { CodeFactCitation } from '@/lib/code-site-fact-segments';

type Mark = { key: string; number: number; citation: CodeFactCitation; x: number; y: number };
export function CodePreviewCitations({ frame, stage, ready, record, versionId, pageId, scale, header, languageLinks }: {
  frame: RefObject<HTMLIFrameElement | null>; stage: RefObject<HTMLElement | null>; ready: boolean; record: CodeCheck['factCitations']; versionId: string; pageId: string; scale: number; header: string; languageLinks: boolean;
}) {
  const [marks, setMarks] = useState<Mark[]>([]), [active, setActive] = useState<string | null>(null), [pinned, setPinned] = useState(false);
  const [position, setPosition] = useState({ left: 8, top: 8, maxHeight: 'calc(100dvh - 16px)' });
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const doc = ready ? frame.current?.contentDocument : null;
    if (!doc || !record) { setMarks([]); return; }
    // Each saved check belongs to one immutable version. A different iframe,
    // page or text snapshot can never borrow its markers.
    const refresh = () => {
      const loaded = new URL(frame.current!.contentWindow!.location.href);
      if (loaded.searchParams.get('version') !== versionId || (loaded.searchParams.get('page') || 'home') !== pageId || loaded.searchParams.get('language') === 'en') { setMarks([]); return; }
      const next: Mark[] = [];
      const seen = new Set<string>();
      const headerRoots = new DOMParser().parseFromString(`<body>${header}</body>`, 'text/html').body.children.length;
      record.entries.forEach((citation, i) => citation.targets?.filter(target => target.pageId === pageId).forEach(target => {
        let node: Element | undefined = target.root === 'main' ? doc.querySelector('main') ?? undefined : doc.body;
        // The shared renderer adds its language nav after the authored header.
        // It is not part of the saved body path; never identify it by a CSS class.
        for (const [depth, index] of target.path.entries()) node = node?.children[index + (target.root !== 'main' && depth === 0 && languageLinks && index >= headerRoots ? 1 : 0)];
        if (!node || (node.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 1000) !== target.text) return;
        const style = doc.defaultView!.getComputedStyle(node), r = node.getBoundingClientRect();
        if (style.visibility !== 'visible' || style.display === 'none' || !node.getClientRects().length || r.bottom <= 0 || r.top >= 1000) return;
        const identity = JSON.stringify([target.root, target.path, citation.claim, citation.quote]);
        if (seen.has(identity)) return; seen.add(identity);
        const siblings = next.filter(mark => mark.y === Math.max(0, r.y) * scale).length;
        next.push({ key: identity, number: i + 1, citation, x: Math.max(0, Math.min(frame.current!.offsetWidth * scale - 26, r.right * scale + 4 - siblings * 26)), y: Math.max(0, r.y) * scale });
      }));
      setMarks(next);
    };
    const observer = new ResizeObserver(refresh); observer.observe(doc.body);
    const outer = stage.current;
    doc.addEventListener('scroll', refresh, true); outer?.addEventListener('scroll', refresh, { passive: true }); window.addEventListener('resize', refresh); window.addEventListener('scroll', refresh, true);
    refresh();
    return () => { observer.disconnect(); doc.removeEventListener('scroll', refresh, true); outer?.removeEventListener('scroll', refresh); window.removeEventListener('resize', refresh); window.removeEventListener('scroll', refresh, true); };
  }, [frame, stage, ready, record, versionId, pageId, scale, header, languageLinks]);
  const selected = marks.find(mark => mark.key === active);
  const sourceLabel = selected?.citation.source
    ? selected.citation.source.type === 'upload' ? `上传资料 · ${selected.citation.source.name}` : `你的第 ${selected.citation.source.messageIndex} 条消息`
    : '未提供可引用的原句';
  useLayoutEffect(() => {
    if (!selected || !panel.current || !frame.current) return;
    const f = frame.current.getBoundingClientRect(), area = stage.current?.getBoundingClientRect();
    const maxHeight = area ? `${Math.max(120, area.height - 16)}px` : 'calc(100dvh - 16px)';
    panel.current.style.maxHeight = maxHeight;
    const p = panel.current.getBoundingClientRect();
    if (area && (f.y + selected.y + 28 < area.top || f.y + selected.y > area.bottom)) { setActive(null); setPinned(false); return; }
    const below = f.y + selected.y + 28;
    const leftMin = area ? area.left + 8 : 8, leftMax = area ? area.right - p.width - 8 : window.innerWidth - p.width - 8;
    const topMin = area ? area.top + 8 : 8, topMax = area ? area.bottom - p.height - 8 : window.innerHeight - p.height - 8;
    setPosition({ left: Math.max(leftMin, Math.min(f.x + selected.x, leftMax)), top: Math.max(topMin, Math.min(below, topMax)), maxHeight });
  }, [selected, frame, stage]);
  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') { setActive(null); setPinned(false); } };
    document.addEventListener('keydown', close); frame.current?.contentDocument?.addEventListener('keydown', close);
    return () => { document.removeEventListener('keydown', close); frame.current?.contentDocument?.removeEventListener('keydown', close); };
  }, [frame, ready]);
  return <>
    {marks.map(mark => <button key={mark.key} className="code-fact-marker" data-testid="fact-citation-marker" data-claim={mark.citation.claim}
      aria-label={`查看资料出处 ${mark.number}`} aria-expanded={mark.key === active} aria-controls={mark.key === active ? 'code-fact-source' : undefined}
      style={{ left: mark.x, top: mark.y }} onMouseEnter={() => { if (!pinned) setActive(mark.key); }} onMouseLeave={() => { if (!pinned) setActive(null); }}
      onFocus={() => { if (!pinned) setActive(mark.key); }} onClick={() => { setActive(mark.key); setPinned(true); }}>{mark.number}</button>)}
    {selected && <div ref={panel} id="code-fact-source" role="region" aria-label="资料原句" data-testid="fact-citation-source" className="code-fact-source" style={position}>
      <div><strong>资料原句</strong><button aria-label="关闭资料原句" onClick={() => { setActive(null); setPinned(false); }}>关闭</button></div>
      <small>{selected.citation.category} · {sourceLabel}</small><p>{selected.citation.claim}</p><blockquote>{selected.citation.quote}</blockquote>
    </div>}
  </>;
}
