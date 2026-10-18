'use client';

// 拖框阈值、矩形归一化与取消生命周期改编自 BaoCut（JimLiu/baocut@7aa049e8），BaoCut Community License。
// 仅画板批注，无缩放手柄；DOM 范围仍由 SiteCraft 单区块合同核对。见 resources/baocut-annotation/SOURCE.md。

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import type { AnnotationTarget } from '@/lib/annotations';

type Props = { frame: RefObject<HTMLIFrameElement | null>; ready: boolean; picking: boolean; selected: AnnotationTarget | null;
  pageId: string; versionId: string; html: string; scale: number; onSelect: (target: AnnotationTarget) => void;
  onKey: (event: KeyboardEvent) => void; reveal: number; numbered: Array<{ id: string; target: AnnotationTarget; number: number }>; onReveal: (id: string) => void;
  onArea: (targets: AnnotationTarget[]) => void; areaChoosing: boolean;
  bottomSpace: number; onBottomSpace: (height: number) => void; collapsed: boolean; children?: ReactNode };
export function CodePreviewSelection({ frame, ready, picking, selected, pageId, versionId, html, scale, onSelect, onArea, areaChoosing, onKey, reveal, numbered, onReveal, bottomSpace, onBottomSpace, collapsed, children }: Props) {
  const [rect, setRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [numberRects, setNumberRects] = useState<Array<{id: string; number: number; x: number; y: number}>>([]);
  const [areaRect, setAreaRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [position, setPosition] = useState({ left: 8, top: 8 });
  const panel = useRef<HTMLDivElement>(null);
  const lastReveal = useRef('');
  // Scroll events also follow our own reveal. Only native input hands the
  // reading position to the user; a new selection/open starts another reveal.
  const userScrolled = useRef(false);
  useLayoutEffect(() => { if (!collapsed) userScrolled.current = false; }, [selected, reveal, collapsed, areaChoosing]);
  useEffect(() => {
    const doc = ready ? frame.current?.contentDocument : null, stage = frame.current?.closest('.code-preview-stage');
    if (!doc || !stage) return;
    const manual = (event: Event) => {
      if (!event.isTrusted) return;
      if (event.type === 'keydown') {
        const key = event as KeyboardEvent, target = event.target as Element | null;
        if (!['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(key.key)
          || key.metaKey || key.ctrlKey || key.altKey || target?.closest('input,textarea,select,[contenteditable]')) return;
      }
      if (event.type === 'wheel' && !(event as WheelEvent).deltaY) return;
      if (event.type === 'pointerdown') {
        const pointer = event as PointerEvent;
        const edge = event.currentTarget === doc ? doc.documentElement.clientWidth : stage.getBoundingClientRect().left + stage.clientLeft + stage.clientWidth;
        if (pointer.clientX < edge) return;
      }
      userScrolled.current = true;
    };
    const events = ['wheel', 'touchmove', 'keydown', 'pointerdown'];
    for (const surface of [doc, stage]) for (const name of events) surface.addEventListener(name, manual, { capture: true, passive: true });
    return () => { for (const surface of [doc, stage]) for (const name of events) surface.removeEventListener(name, manual, true); };
  }, [frame, ready]);
  useEffect(() => {
    const doc = ready ? frame.current?.contentDocument : null;
    if (!doc) { setRect(null); setNumberRects([]); setAreaRect(null); return; }
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
      const offsets = new Map<string, number>();
      setNumberRects(numbered.flatMap(item => {
        const pin = locate(item.target)?.getBoundingClientRect();
        if (!pin || pin.bottom <= 0 || pin.top >= 1000) return [];
        const key = item.target.path.join('-'), offset = offsets.get(key) ?? 0; offsets.set(key, offset + 1);
        return [{id: item.id, number: item.number, x: Math.max(0, pin.x) + (offset % Math.max(1, Math.floor(pin.width * scale / 32))) * 32 / scale,
          y: Math.max(0, pin.y) + Math.floor(offset / Math.max(1, Math.floor(pin.width * scale / 32))) * 32 / scale}];
      }));
    };
    const capture = (hit: Element | null) => {
      if (!main || !source || !hit?.closest || !main.contains(hit) || hit.closest('.sc-image-credits,svg,[data-system-icon]')) return null;
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
    let drag: { id: number; x: number; y: number; moved: boolean; viewportWidth: number; viewportHeight: number; frameWidth: number } | null = null;
    const geometryChanged = () => !!drag && (window.innerWidth !== drag.viewportWidth || window.innerHeight !== drag.viewportHeight
      || frame.current?.getBoundingClientRect().width !== drag.frameWidth);
    const cancel = () => {
      const active = drag; drag = null; setAreaRect(null);
      if (active && doc.documentElement.hasPointerCapture(active.id)) doc.documentElement.releasePointerCapture(active.id);
    };
    const bounds = (x: number, y: number) => ({ x: Math.min(drag!.x,x), y: Math.min(drag!.y,y), width: Math.abs(x-drag!.x), height: Math.abs(y-drag!.y) });
    const down = (event: PointerEvent) => {
      if (!picking || event.button !== 0) return;
      event.preventDefault(); cancel();
      drag = {id:event.pointerId,x:event.clientX,y:event.clientY,moved:false,viewportWidth:window.innerWidth,viewportHeight:window.innerHeight,frameWidth:frame.current!.getBoundingClientRect().width};
      doc.documentElement.setPointerCapture(event.pointerId);
    };
    const move = (event: PointerEvent) => {
      if (!picking) return;
      if (drag) {
        if (event.pointerId !== drag.id) return;
        if (geometryChanged()) { cancel(); return; }
        if (!(event.buttons & 1)) { cancel(); return; }
        if (Math.hypot((event.clientX-drag.x)*scale,(event.clientY-drag.y)*scale) > 6) drag.moved = true;
        if (drag.moved) setAreaRect(bounds(event.clientX,event.clientY));
        return;
      }
      if (locate(selected)) return; hovered = capture(event.target as Element | null)?.block ?? null; refresh();
    };
    const up = (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.id) return;
      if (geometryChanged()) { cancel(); return; }
      const drawn = bounds(event.clientX,event.clientY), moved = drag.moved;
      cancel();
      if (!moved) { const result = capture(doc.elementFromPoint(event.clientX,event.clientY)); if (result) onSelect(result.target); return; }
      // Group actual intersecting content by its nearest editable block. An
      // ancestor's box must not turn one nested article into multiple ranges.
      const groups = new Map<Element, AnnotationTarget>();
      const textBlocks = 'h1,h2,h3,h4,h5,h6,p,li,dt,dd,td,th,figcaption,label,blockquote,address';
      for (const hit of main?.querySelectorAll('*') ?? []) {
        const ownText = [...hit.childNodes].some(node => node.nodeType === 3 && node.textContent?.trim());
        if (!ownText && hit.tagName !== 'IMG' && !hit.matches(textBlocks)) continue;
        // Skip nested text blocks, but keep inline elements inside a text
        // block: two identical links in one paragraph still need distinct
        // child paths for the element hint.
        if (hit.matches(textBlocks) && hit.parentElement?.closest(textBlocks)) continue;
        if (!hit.checkVisibility({checkOpacity:true,checkVisibilityCSS:true})) continue;
        if (![...hit.getClientRects()].some(r => r.width && r.height && r.right > drawn.x && r.left < drawn.x+drawn.width && r.bottom > drawn.y && r.top < drawn.y+drawn.height)) continue;
        const result = capture(hit); if (!result?.target.element) continue;
        const existing = groups.get(result.block);
        if (existing) existing.elements!.push(result.target.element);
        else { const {element,...target} = result.target; groups.set(result.block,{...target,elements:[element]}); }
      }
      setAreaRect(drawn); onArea([...groups.values()]);
    };
    const interrupted = () => { cancel(); refresh(); };
    const blur = () => cancel();
    const key = (event: KeyboardEvent) => {
      if (drag && event.key === 'Escape' && !event.isComposing) { event.preventDefault(); event.stopPropagation(); cancel(); return; }
      onKey(event);
    };
    const hostKey = (event: KeyboardEvent) => { if (drag && event.key === 'Escape' && !event.isComposing) key(event); };
    const click = (event: Event) => {
      if (!picking) return;
      event.preventDefault(); event.stopPropagation();
    };
    const revealIdentity = `${versionId}:${pageId}:${reveal}:${bottomSpace}`;
    if (reveal && selected && !userScrolled.current && lastReveal.current !== revealIdentity) {
      const target = locate(selected);
      const snapshot = target?.textContent?.replace(/\s+/g, ' ').trim().slice(0, 1000);
      if (snapshot === selected.text) {
        target?.scrollIntoView({ block: 'center' }); frame.current?.scrollIntoView({ block: 'nearest' });
        // The phone sheet reduces the host's visible stage, not the generated
        // document. Scroll that stage as well, including targets near page end.
        const stage = frame.current?.closest('.code-preview-stage');
        if (bottomSpace && target && frame.current && stage) {
          const r = target.getBoundingClientRect(), f = frame.current.getBoundingClientRect(), visible = stage.getBoundingClientRect();
          const center = f.top + (r.top + r.height / 2) * scale;
          stage.scrollBy({ top: center - (visible.top + visible.bottom) / 2 });
        }
        lastReveal.current = revealIdentity;
      }
    }
    const previousTouchAction = doc.documentElement.style.touchAction;
    if (picking) doc.documentElement.style.touchAction = 'none';
    doc.addEventListener('pointerdown', down, true); doc.addEventListener('pointermove', move); doc.addEventListener('pointerup', up, true);
    doc.addEventListener('pointercancel', cancel, true); doc.addEventListener('click', click, true); doc.addEventListener('scroll', interrupted, true); doc.addEventListener('wheel', cancel, true);
    doc.addEventListener('keydown', key, true); window.addEventListener('keydown', hostKey, true); window.addEventListener('resize', interrupted); window.addEventListener('scroll', interrupted, true);
    window.addEventListener('blur', blur); doc.defaultView?.addEventListener('blur', blur);
    const observer = new ResizeObserver(refresh); if (main) observer.observe(main); if (panel.current) observer.observe(panel.current);
    refresh();
    return () => { cancel(); doc.documentElement.style.touchAction = previousTouchAction;
      doc.removeEventListener('pointerdown', down, true); doc.removeEventListener('pointermove', move); doc.removeEventListener('pointerup', up, true);
      doc.removeEventListener('pointercancel', cancel, true); doc.removeEventListener('click', click, true); doc.removeEventListener('scroll', interrupted, true); doc.removeEventListener('wheel', cancel, true);
      doc.removeEventListener('keydown', key, true); window.removeEventListener('keydown', hostKey, true); window.removeEventListener('resize', interrupted); window.removeEventListener('scroll', interrupted, true);
      window.removeEventListener('blur', blur); doc.defaultView?.removeEventListener('blur', blur); observer.disconnect(); };
  }, [frame, ready, picking, selected, pageId, versionId, html, onSelect, onArea, onKey, reveal, numbered, scale, bottomSpace]);
  useLayoutEffect(() => {
    const wrapper = panel.current;
    const measure = () => onBottomSpace(wrapper && getComputedStyle(wrapper).getPropertyValue('--code-annotation-reserve').trim() === '1'
      ? Math.ceil(wrapper.getBoundingClientRect().height) + 16 : 0);
    const observer = new ResizeObserver(measure); if (wrapper) observer.observe(wrapper);
    window.addEventListener('resize', measure); measure();
    return () => { observer.disconnect(); window.removeEventListener('resize', measure); };
  }, [ready, rect, children, onBottomSpace]);
  useEffect(() => () => onBottomSpace(0), [onBottomSpace]);
  useLayoutEffect(() => {
    const anchor = rect ?? areaRect;
    if (!anchor || !frame.current || !panel.current) return;
    // The phone sheet already reserves its measured height below the preview.
    if (getComputedStyle(panel.current).getPropertyValue('--code-annotation-reserve').trim() === '1') return;
    const iframe = frame.current, stage = iframe.closest('.code-preview-stage');
    const f = iframe.getBoundingClientRect(), p = panel.current.getBoundingClientRect();
    // The preview's toolbar includes the historical-version return control.
    // A panel above the target must stay below that toolbar as well as onscreen.
    const minimumTop = Math.max(8, stage?.getBoundingClientRect().top ?? 8);
    const maximumTop = Math.max(minimumTop, window.innerHeight - p.height - 8);
    let below = f.y + (anchor.y + anchor.height) * scale + 8, above = f.y + anchor.y * scale - p.height - 8;
    const visible = f.y + anchor.y * scale < Math.min(f.bottom, window.innerHeight)
      && below - 8 > Math.max(f.top, minimumTop);
    if (!userScrolled.current && visible && below > maximumTop && above < minimumTop) {
      // Make room below the visible target instead of clamping onto it or the
      // history bar. Only scroll the preview; generated HTML/CSS stays intact.
      const viewport = iframe.contentWindow!;
      const scroll = viewport.scrollY;
      viewport.scrollBy({ top: (below - maximumTop) / scale, behavior: 'instant' });
      const shifted = (viewport.scrollY - scroll) * scale;
      below -= shifted; above -= shifted;
      if (stage && below > maximumTop) {
        const before = stage.scrollTop;
        stage.scrollBy({ top: below - maximumTop, behavior: 'instant' });
        below -= stage.scrollTop - before; above -= stage.scrollTop - before;
      }
    }
    const preferredTop = below <= maximumTop ? below : above >= minimumTop ? above : maximumTop;
    setPosition({ left: Math.max(8, Math.min(f.x + anchor.x * scale, window.innerWidth - p.width - 8)),
      top: Math.max(minimumTop, Math.min(preferredTop, maximumTop)) });
  }, [rect, areaRect, scale, frame, children]);
  const top = Math.max(0, rect?.y ?? 0), bottom = Math.min(1000, (rect?.y ?? 0) + (rect?.height ?? 0));
  return <>
    {rect && bottom > top && (picking || selected) && <div className="code-selection-outline" aria-hidden="true" style={{ left: rect.x * scale, top: top * scale, width: rect.width * scale, height: (bottom - top) * scale }} />}
    {areaRect && picking && <div className="code-annotation-area" data-testid="annotation-area-outline" aria-hidden="true" style={{left:areaRect.x*scale,top:areaRect.y*scale,width:areaRect.width*scale,height:areaRect.height*scale}} />}
    {numberRects.map(pin => <button key={pin.id} className="code-annotation-number" data-testid="annotation-number" aria-label={`回看批注 ${pin.number}`} style={{left:pin.x*scale,top:pin.y*scale}} onClick={() => onReveal(pin.id)}>{pin.number}</button>)}
    {ready && (areaChoosing || (rect && selected?.versionId === versionId && selected.pageId === pageId)) && children && <div ref={panel} className="code-annotation-position" style={position}>{children}</div>}
  </>;
}
