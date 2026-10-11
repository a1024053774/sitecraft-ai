'use client';

import { useEffect, useState, type RefObject } from 'react';
import type { AnnotationTarget } from '@/lib/annotations';

type Props = { frame: RefObject<HTMLIFrameElement | null>; ready: boolean; picking: boolean; selected: AnnotationTarget | null;
  pageId: string; versionId: string; html: string; scale: number; onSelect: (target: AnnotationTarget) => void };
export function CodePreviewSelection({ frame, ready, picking, selected, pageId, versionId, html, scale, onSelect }: Props) {
  const [rect, setRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  useEffect(() => {
    const doc = ready ? frame.current?.contentDocument : null;
    if (!doc) return;
    const source = new DOMParser().parseFromString(html, 'text/html').querySelector('main');
    const main = doc.querySelector('main');
    let hovered: Element | null = null;
    const locate = (path: number[]) => { let node: Element | undefined = main ?? undefined; for (const index of path) node = node?.children[index]; return node; };
    const outline = (element?: Element | null) => {
      const r = element?.getBoundingClientRect();
      setRect(r && r.width && r.height ? { x: r.x, y: r.y, width: r.width, height: r.height } : null);
    };
    const refresh = () => outline(hovered || (selected?.versionId === versionId && selected.pageId === pageId ? locate(selected.path) : null));
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
      return { block, target: { kind: 'dom' as const, pageId, versionId, path, text, label } };
    };
    const move = (event: Event) => { if (!picking) return; hovered = capture(event)?.block ?? null; refresh(); };
    const click = (event: Event) => {
      if (picking) {
        event.preventDefault(); event.stopPropagation();
        const result = capture(event); if (result) { hovered = result.block; onSelect(result.target); refresh(); }
        return;
      }
    };
    doc.addEventListener('pointermove', move); doc.addEventListener('click', click, true); doc.addEventListener('scroll', refresh, true);
    const observer = new ResizeObserver(refresh); if (main) observer.observe(main);
    refresh();
    return () => { doc.removeEventListener('pointermove', move); doc.removeEventListener('click', click, true); doc.removeEventListener('scroll', refresh, true); observer.disconnect(); };
  }, [frame, ready, picking, selected, pageId, versionId, html, onSelect]);
  return rect && (picking || selected) ? <div className="code-selection-outline" aria-hidden="true" style={{ left: rect.x * scale, top: rect.y * scale, width: rect.width * scale, height: rect.height * scale }} /> : null;
}
