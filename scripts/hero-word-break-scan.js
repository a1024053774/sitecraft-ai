// Browser expression. Return true when one Intl.Segmenter word occupies more than one line.
// The offsets pair a segment with its own occurrence, so repeated words cannot borrow the first
// occurrence's rectangles. A segment wider than the title line is allowed to break by itself.
(root) => {
  const title = root?.matches?.("h1") ? root : root?.querySelector?.("h1");
  if (!title || typeof Intl?.Segmenter !== "function") return false;
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
      if (rect.width > 0.5 && rect.height > 0.5) chars.push({ offset: offset + index, rect });
    }
    offset += text.length;
  }
  const lineWidth = title.clientWidth || title.getBoundingClientRect().width;
  const segments = new Intl.Segmenter("zh", { granularity: "word" }).segment(title.textContent || "");
  for (const part of segments) {
    const word = String(part.segment || "");
    if (!part.isWordLike || word.length < 2 || /^\s+$/.test(word)) continue;
    const own = chars.filter((item) => item.offset >= part.index && item.offset < part.index + word.length);
    if (own.length < 2) continue;
    const left = Math.min(...own.map((item) => item.rect.left));
    const right = Math.max(...own.map((item) => item.rect.right));
    if (right - left > lineWidth + 1) continue;
    const top = own[0].rect.top;
    if (own.some((item) => Math.abs(item.rect.top - top) > 1)) return true;
  }
  return false;
}
