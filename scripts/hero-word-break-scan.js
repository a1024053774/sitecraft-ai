// Browser expression shared by check-published and visitor-layout-scan.
// It returns both checks so wrapped DOM spans and repeated occurrences use the same rectangles.
(root) => {
  const title = root?.matches?.("h1") ? root : root?.querySelector?.("h1");
  const result = { heroOrphan: false, heroTitleWordBreak: false };
  if (!title || typeof Intl?.Segmenter !== "function") return result;
  const range = document.createRange();
  const walker = document.createTreeWalker(title, NodeFilter.SHOW_TEXT);
  const chars = [];
  let offset = 0;
  while (walker.nextNode()) {
    const node = walker.currentNode;
    const text = node.textContent || "";
    for (let index = 0; index < text.length; index += 1) {
      range.setStart(node, index);
      range.setEnd(node, index + 1);
      const rect = range.getClientRects()[0] || range.getBoundingClientRect();
      if (rect.width > 0.5 && rect.height > 0.5) chars.push({ offset: offset + index, char: text[index], parent: node.parentElement, rect });
    }
    offset += text.length;
  }
  const lines = new Map();
  for (const item of chars) {
    if (!item.char.trim()) continue;
    const top = Math.round(item.rect.top);
    lines.set(top, [...(lines.get(top) || []), item.char]);
  }
  const tops = [...lines.keys()].sort((a, b) => a - b);
  const lastLine = tops.length > 1 ? lines.get(tops[tops.length - 1]) || [] : [];
  const lastItems = chars.filter((item) => Math.round(item.rect.top) === tops[tops.length - 1] && item.char.trim());
  const shortWord = lastLine.length <= 2 && /^[\u3400-\u9fff]+$/.test(lastLine.join("")) && lastItems.every((item) => item.parent?.getAttribute("data-sitecraft-hero-word") === "true");
  result.heroOrphan = (lastLine.length === 1 && /[\u3400-\u9fff]/.test(lastLine[0])) || shortWord;

  const lineWidth = title.clientWidth || title.getBoundingClientRect().width;
  const segments = Array.from(new Intl.Segmenter("zh", { granularity: "word" }).segment(title.textContent || ""));
  // Segmenter can leave a final one-character CJK segment (件). Keep that tail with the preceding
  // word so balancing has a meaningful unit and never strands one glyph on its own line.
  const tail = segments[segments.length - 1];
  const previous = segments[segments.length - 2];
  if (tail && previous && tail.isWordLike && previous.isWordLike && tail.segment.length === 1 && /[\u3400-\u9fff]/.test(tail.segment) && /[\u3400-\u9fff]$/.test(previous.segment)) {
    previous.segment += tail.segment;
    segments.pop();
  }
  const naturalWidth = (word) => {
    const probe = document.createElement("span");
    const style = getComputedStyle(title);
    probe.textContent = word;
    probe.style.cssText = `position:absolute;left:-100000px;top:0;visibility:hidden;white-space:nowrap;font:${style.font};letter-spacing:${style.letterSpacing};font-weight:${style.fontWeight}`;
    document.body.appendChild(probe);
    const width = probe.getBoundingClientRect().width;
    probe.remove();
    return width;
  };
  for (const part of segments) {
    const word = String(part.segment || "");
    if (!part.isWordLike || word.length < 2 || /^\s+$/.test(word)) continue;
    const own = chars.filter((item) => item.offset >= part.index && item.offset < part.index + word.length);
    if (own.length < 2 || naturalWidth(word) > lineWidth + 1) continue;
    const top = own[0].rect.top;
    if (own.some((item) => Math.abs(item.rect.top - top) > 1)) result.heroTitleWordBreak = true;
  }
  return result;
}
