// Evaluated in a visitor page: `(${source})(root)`, root defaults to document.body.
// Finds text a visitor cannot read in full:
//  - "overflow": a box's own text runs past the box (a value kept on one line in a narrow cell),
//    or a line of text runs past the block it belongs to;
//  - "ellipsis": text cut off by text-overflow: ellipsis or a line clamp;
//  - "clipped": text drawn past an ancestor that hides overflow (the page edge included).
// Closed <details> outside the header are opened while measuring, so folded spec lists count,
// and closed again afterwards. Returns [{ kind, element, text }], one entry per element.
((root) => {
  root = root || document.body;
  const found = [];
  const reported = new Set();
  const shown = (el) => {
    const style = getComputedStyle(el);
    const box = el.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && box.width > 0 && box.height > 0;
  };
  const describe = (el) => {
    const first = typeof el.className === "string" ? el.className.trim().split(/\s+/)[0] : "";
    return el.tagName.toLowerCase() + (first ? "." + first : "");
  };
  const add = (kind, el) => {
    if (reported.has(el)) return;
    reported.add(el);
    found.push({ kind, element: describe(el), text: (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 60) });
  };
  const ownText = (el) => [...el.childNodes].some((node) => node.nodeType === 3 && node.textContent.trim());
  const ignored = (el) => Boolean(el.closest("script, style, template, noscript"));
  const opened = [...root.querySelectorAll("details:not([open])")].filter((node) => !node.closest("header"));
  for (const node of opened) node.open = true;
  try {
    // A box whose own text is wider than the box: kept on one line, cut off, or clamped.
    for (const el of root.querySelectorAll("*")) {
      if (!ownText(el) || ignored(el) || !shown(el)) continue;
      const style = getComputedStyle(el);
      if (style.display === "inline" || style.display === "contents") continue;
      const wide = el.scrollWidth > el.clientWidth + 1;
      const clamp = style.webkitLineClamp && style.webkitLineClamp !== "none";
      if (wide && style.textOverflow === "ellipsis" && style.overflowX !== "visible") add("ellipsis", el);
      else if (clamp && el.scrollHeight > el.clientHeight + 1) add("ellipsis", el);
      else if (wide) add("overflow", el);
    }
    // Each line of text against the ancestors that clip it, then against the block it sits in.
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const parent = node.parentElement;
      if (!parent || !node.textContent.trim() || ignored(parent) || !shown(parent)) continue;
      range.selectNodeContents(node);
      const rects = [...range.getClientRects()].filter((rect) => rect.width > 0.5 && rect.height > 0.5);
      if (!rects.length) continue;
      let clipped = false;
      for (let ancestor = parent; ancestor && !clipped; ancestor = ancestor.parentElement) {
        const style = getComputedStyle(ancestor);
        const clipX = style.overflowX === "hidden" || style.overflowX === "clip";
        const clipY = style.overflowY === "hidden" || style.overflowY === "clip";
        if (!clipX && !clipY) continue;
        const edge = ancestor.getBoundingClientRect();
        clipped = rects.some((rect) => (clipX && (rect.left < edge.left - 1 || rect.right > edge.right + 1))
          || (clipY && (rect.top < edge.top - 1 || rect.bottom > edge.bottom + 1)));
      }
      if (clipped) {
        add("clipped", parent);
        continue;
      }
      let block = parent;
      while (block.parentElement && getComputedStyle(block).display === "inline") block = block.parentElement;
      const bounds = block.getBoundingClientRect();
      if (rects.some((rect) => rect.left < bounds.left - 1 || rect.right > bounds.right + 1)) add("overflow", block);
    }
  } finally {
    for (const node of opened) node.open = false;
  }
  return found;
})
