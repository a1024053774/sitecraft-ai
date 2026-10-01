// Evaluated in a visitor page: `(${source})(root)`, root defaults to document.body.
// Finds text a visitor cannot read in full:
//  - "overflow": a box's own text runs past the box (a value kept on one line in a narrow cell),
//    or a line of text runs past the block it belongs to;
//  - "ellipsis": text cut off by text-overflow: ellipsis or a line clamp;
//  - "clipped": text drawn past an ancestor that hides overflow;
//  - "viewport": text drawn outside the visitor viewport horizontally;
//  - "covered": another visible element sits over the text;
//  - "email": an email address that wraps anywhere but at the @ (after a hyphen, inside a name),
//    unless the part it wraps in is wider than its line on its own.
// Closed <details> outside the header are opened while measuring, so folded spec lists count,
// and closed again afterwards. Returns [{ kind, element, text }], one entry per element.
((root) => {
  root = root || document.body;
  const found = [];
  const reported = new Set();
  const shown = (el) => {
    const style = getComputedStyle(el);
    const box = el.getBoundingClientRect();
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0 || box.width <= 0 || box.height <= 0) return false;
    for (let ancestor = el; ancestor; ancestor = ancestor.parentElement) {
      if (ancestor.tagName === "DETAILS" && !ancestor.open && !ancestor.querySelector(":scope > summary")?.contains(el)) return false;
    }
    return true;
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
  const coverAtPoint = (x, y, chain) => {
    const hits = document.elementsFromPoint(x, y);
    const ownIndex = hits.findIndex((hit) => chain.has(hit));
    if (ownIndex >= 0 && hits.slice(0, ownIndex).some((hit) => shown(hit) && !hit.contains([...chain][0]))) return true;
    // elementsFromPoint omits pointer-events:none. Temporarily make each geometric candidate
    // hit-testable and compare its actual painted order with the text's own element.
    const candidates = [...document.querySelectorAll("*")].filter((candidate) => {
      const style = getComputedStyle(candidate);
      const rect = candidate.getBoundingClientRect();
      return style.pointerEvents === "none" && shown(candidate) && rect.left <= x && rect.right >= x && rect.top <= y && rect.bottom >= y && !chain.has(candidate);
    });
    for (const candidate of candidates) {
      const previous = candidate.style.pointerEvents;
      candidate.style.pointerEvents = "auto";
      const probeHits = document.elementsFromPoint(x, y);
      candidate.style.pointerEvents = previous;
      const candidateIndex = probeHits.indexOf(candidate);
      const probeOwnIndex = probeHits.findIndex((hit) => chain.has(hit));
      if (candidateIndex >= 0 && probeOwnIndex >= 0 && candidateIndex < probeOwnIndex) return true;
    }
    return false;
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
    // A catalog card body must have enough width to read as a sentence. The old two-column
    // treatment left only a few glyphs per line even though no pixel overflow was reported.
    for (const card of root.querySelectorAll(".sitecraft-catalog-cards .sitecraft-catalog-card")) {
      const body = card.querySelector("p");
      if (!body || !shown(body)) continue;
      const cardWidth = card.getBoundingClientRect().width;
      const bodyWidth = body.getBoundingClientRect().width;
      const fontSize = parseFloat(getComputedStyle(body).fontSize) || 16;
      if (cardWidth > 0 && bodyWidth / fontSize < 5 && (body.textContent || "").trim().length >= 6) add("narrow-body", body);
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
      if (rects.some((rect) => rect.left < -1 || rect.right > document.documentElement.clientWidth + 1)) {
        add("viewport", parent);
        continue;
      }
      const savedX = window.scrollX;
      const savedY = window.scrollY;
      parent.scrollIntoView({ block: "center", inline: "nearest" });
      range.selectNodeContents(node);
      const centeredRects = [...range.getClientRects()].filter((rect) => rect.width > 0.5 && rect.height > 0.5);
      const chain = new Set();
      for (let ancestor = parent; ancestor; ancestor = ancestor.parentElement) chain.add(ancestor);
      const covered = centeredRects.some((rect) => coverAtPoint(rect.left + rect.width / 2, rect.top + rect.height / 2, chain));
      window.scrollTo(savedX, savedY);
      if (covered) {
        add("covered", parent);
        continue;
      }
      let block = parent;
      while (block.parentElement && getComputedStyle(block).display === "inline") block = block.parentElement;
      const bounds = block.getBoundingClientRect();
      if (rects.some((rect) => rect.left < bounds.left - 1 || rect.right > bounds.right + 1)) add("overflow", block);
    }
    // Email addresses: find where each one wraps by the line each of its characters sits on.
    const EMAIL = /[\w.+\-\u200b\u2060]+@[\w\-\u200b\u2060]+(?:\.[\w\-\u200b\u2060]+)+/g;
    const emails = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (emails.nextNode()) {
      const node = emails.currentNode;
      const parent = node.parentElement;
      const text = node.textContent;
      if (!parent || text.indexOf("@") === -1 || ignored(parent) || !shown(parent)) continue;
      let line = parent;
      while (line.parentElement && ["inline", "inline-block", "contents"].includes(getComputedStyle(line).display)) line = line.parentElement;
      const lineStyle = getComputedStyle(line);
      const lineWidth = line.clientWidth - parseFloat(lineStyle.paddingLeft) - parseFloat(lineStyle.paddingRight);
      for (const match of text.matchAll(EMAIL)) {
        const chars = [];
        for (let i = match.index; i < match.index + match[0].length; i++) {
          const ch = text.charAt(i);
          if (ch === "\u200b" || ch === "\u2060") continue;
          range.setStart(node, i);
          range.setEnd(node, i + 1);
          const rect = [...range.getClientRects()].find((item) => item.width > 0.5) || range.getBoundingClientRect();
          chars.push({ ch, rect });
        }
        const at = chars.findIndex((item) => item.ch === "@");
        const partWidth = (from, to) => chars.slice(from, to).reduce((sum, item) => sum + item.rect.width, 0);
        for (let k = 1; k < chars.length; k++) {
          const before = chars[k - 1];
          const after = chars[k];
          if (after.rect.top < before.rect.bottom - 1) continue;
          if (before.ch === "@" || after.ch === "@") continue;
          const width = k <= at ? partWidth(0, at) : partWidth(at + 1, chars.length);
          if (width <= lineWidth + 1) add("email", parent);
        }
      }
    }
  } finally {
    for (const node of opened) node.open = false;
  }
  return found;
})
