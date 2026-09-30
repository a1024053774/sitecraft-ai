export function scanVisitorLayout(root = document) {
  const visible = (element) => {
    if (!element) return false;
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
  };
  const blockFor = (element) => element?.closest?.("[data-sc-block]")?.getAttribute("data-sc-block") || "页面";
  const overflowElements = [...root.querySelectorAll("body *")].map((element) => {
    if (!visible(element)) return null;
    const rect = element.getBoundingClientRect();
    const amount = Math.max(rect.right - innerWidth, -rect.left, 0);
    return amount > 1 ? { block: blockFor(element), amount: Math.ceil(amount) } : null;
  }).filter(Boolean);
  const textElements = [...root.querySelectorAll("body *")].filter((element) => visible(element) && !element.children.length && (element.textContent || "").trim());
  const rects = textElements.map((element) => ({ element, rect: element.getBoundingClientRect(), parent: element.parentElement }));
  const overlaps = [];
  for (let i = 0; i < rects.length; i += 1) for (let j = i + 1; j < rects.length; j += 1) {
    if (rects[i].parent === rects[j].parent) continue;
    const left = Math.max(rects[i].rect.left, rects[j].rect.left);
    const right = Math.min(rects[i].rect.right, rects[j].rect.right);
    const top = Math.max(rects[i].rect.top, rects[j].rect.top);
    const bottom = Math.min(rects[i].rect.bottom, rects[j].rect.bottom);
    if (right - left > 2 && bottom - top > 2) overlaps.push({ block: blockFor(rects[i].element), amount: Math.ceil(Math.min(right - left, bottom - top)) });
  }
  const slots = [...root.querySelectorAll("[data-sitecraft-slot]")].map((element) => {
    const rect = element.getBoundingClientRect();
    return { key: element.getAttribute("data-sitecraft-slot") || "", visible: visible(element) && rect.right > 0 && rect.left < innerWidth && rect.bottom > 0 && rect.top < innerHeight };
  });
  return {
    horizontalScroll: document.documentElement.scrollWidth > innerWidth + 1,
    overflowElements: overflowElements.slice(0, 20),
    textOverlaps: overlaps.slice(0, 20),
    slots,
    height: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight),
  };
}

export default scanVisitorLayout;
