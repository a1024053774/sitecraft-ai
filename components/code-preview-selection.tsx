'use client';

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import type { AnnotationTarget } from '@/lib/annotations';

type Props = { frame: RefObject<HTMLIFrameElement | null>; ready: boolean; picking: boolean; selected: AnnotationTarget | null;
  pageId: string; versionId: string; html: string; scale: number; onSelect: (target: AnnotationTarget) => void;
  onKey: (event: KeyboardEvent) => void; reveal: number; numbered: AnnotationTarget | null; onReveal: () => void; children?: ReactNode };
export function CodePreviewSelection({ frame, ready, picking, selected, pageId, versionId, html, scale, onSelect, onKey, reveal, numbered, onReveal, children }: Props) {
  const [rect, setRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [numberRect, setNumberRect] = useState<{ x: number; y: number } | null>(null);
  const [position, setPosition] = useState({ left: 8, top: 8 });
  const panel = useRef<HTMLDivElement>(null);
  const lastReveal = useRef('');
  useEffect(() => {
    const doc = ready ? frame.current?.contentDocument : null;
    if (!doc) { setRect(null); setNumberRect(null); return; }
    const source = new DOMParser().parseFromString(html, 'text/html').querySelector('main');
    const main = doc.querySelector('main');
    let hovered: Element | null = null;
    const locate = (target: AnnotationTarget | null) => {
      if (!target || target.versionId !== versionId || target.pageId !== pageId) return null;
      let node: Element | undefined = main ?? undefined; for (const index of target.path) node = node?.children[index]; return node;
    };
    const refresh = () => {
      const r = (locate(selected) || hovered)?.getBoundingClientRect();
      setRect(r && r.width && r.height ? { x: r.x, y: r.y, width: r.width, height: r.height } : null);
      const pin = locate(numbered)?.getBoundingClientRect();
      setNumberRect(pin && pin.bottom > 0 && pin.top < 1000 ? { x: Math.max(0, pin.x), y: Math.max(0, pin.y) } : null);
    };
    const capture = (event: Event) => {
      const hit = event.target as Element | null;
      if (!main || !source || !hit?.closest || !main.contains(hit) || hit.closest('.sc-inquiry,.sc-image-credits,svg,[data-system-icon]')) return null;
      let block = hit.closest('section,article');
      if (!block || !main.contains(block)) { block = hit; while (block.parentElement && block.parentElement !== main) block = block.parentElement; }
      if (!/^(SECTION|ARTICLE|DIV|HEADER|ASIDE|FOOTER)$/.test(block.tagName) || block === main) return null;
      const path: number[] = []; let node = block;
      while (node !== main && node.parentElement) { path.unshift([...node.parentElement.children].indexOf(node)); node = node.parentElement; }
      let original: Element | undefined = source;
      for (const index of path) original = original?.children[index];
      const text = original?.textContent?.replace(/\s+/g, ' ').trim().slice(0, 1000);
      if (!text || !original || original.tagName !== block.tagName) return null;
      const label = (original.querySelector('h1,h2,h3')?.textContent || text).replace(/\s+/g, ' ').trim().slice(0, 80);
      const elementPath: number[] = []; let pointed = hit;
      while (pointed !== block && pointed.parentElement) { elementPath.unshift([...pointed.parentElement.children].indexOf(pointed)); pointed = pointed.parentElement; }
      let element: Element | undefined = original; for (const index of elementPath) element = element?.children[index];
      if (!element || element.tagName !== hit.tagName) return null;
      const snapshot = element.tagName === 'IMG' ? element.getAttribute('alt') || '' : element.textContent || '';
      return { block, target: { kind: 'dom' as const, pageId, versionId, path, text, label,
        element: { path: elementPath, tag: element.tagName.toLowerCase(), text: snapshot.replace(/\s+/g, ' ').trim().slice(0, 1000) } } };
    };
    const move = (event: Event) => { if (!picking || locate(selected)) return; hovered = capture(event)?.block ?? null; refresh(); };
    const click = (event: Event) => {
      if (!picking) return;
      event.preventDefault(); event.stopPropagation();
      const result = capture(event); if (result) { hovered = result.block; onSelect(result.target); }
    };
    const revealIdentity = `${versionId}:${pageId}:${reveal}`;
    if (reveal && selected && lastReveal.current !== revealIdentity) {
      const target = locate(selected);
      const snapshot = target?.textContent?.replace(/\s+/g, ' ').trim().slice(0, 1000);
      if (snapshot === selected.text) { target?.scrollIntoView({ block: 'center' }); frame.current?.scrollIntoView({ block: 'nearest' }); lastReveal.current = revealIdentity; }
    }
    doc.addEventListener('pointermove', move); doc.addEventListener('click', click, true); doc.addEventListener('scroll', refresh, true);
    doc.addEventListener('keydown', onKey); window.addEventListener('resize', refresh); window.addEventListener('scroll', refresh, true);
    const observer = new ResizeObserver(refresh); if (main) observer.observe(main); if (panel.current) observer.observe(panel.current);
    refresh();
    return () => { doc.removeEventListener('pointermove', move); doc.removeEventListener('click', click, true); doc.removeEventListener('scroll', refresh, true);
      doc.removeEventListener('keydown', onKey); window.removeEventListener('resize', refresh); window.removeEventListener('scroll', refresh, true); observer.disconnect(); };
  }, [frame, ready, picking, selected, pageId, versionId, html, onSelect, onKey, reveal, numbered, scale, children]);
  useLayoutEffect(() => {
    if (!rect || !frame.current || !panel.current) return;
    const f = frame.current.getBoundingClientRect(), p = panel.current.getBoundingClientRect();
    setPosition({ left: Math.max(8, Math.min(f.x + rect.x * scale, window.innerWidth - p.width - 8)),
      top: Math.max(8, Math.min(f.y + (rect.y + rect.height) * scale + 8, window.innerHeight - p.height - 8)) });
  }, [rect, scale, frame, children]);
  const top = Math.max(0, rect?.y ?? 0), bottom = Math.min(1000, (rect?.y ?? 0) + (rect?.height ?? 0));
  return <>
    {rect && bottom > top && (picking || selected) && <div className="code-selection-outline" aria-hidden="true" style={{ left: rect.x * scale, top: top * scale, width: rect.width * scale, height: (bottom - top) * scale }} />}
    {numberRect && <button className="code-annotation-number" data-testid="annotation-number" aria-label="回看批注 1" style={{ left: numberRect.x * scale, top: numberRect.y * scale }} onClick={onReveal}>1</button>}
    {ready && rect && selected?.versionId === versionId && selected.pageId === pageId && children && <div ref={panel} className="code-annotation-position" style={position}>{children}</div>}
  </>;
}
