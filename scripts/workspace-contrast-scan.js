(() => {
  // Evaluated inside the workspace page by tests/workspace-dark-contrast.test.ts, which splices this file
  // after `return`, so it must stay one expression with nothing before the opening parenthesis.
  // Every visible text node in .builder-shell (iframes and disabled controls excluded) must reach 4.5:1
  // against its composited background, counting the text colour's alpha and ancestor opacity.
  // Background images and gradients are not sampled; only background colours are composited.
  const root = document.querySelector(".builder-shell") || document.body;
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  // Canvas normalises any CSS colour syntax (rgb, oklch, color-mix results) to sRGB bytes.
  const rgba = (value) => {
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = "rgba(0, 0, 0, 0)";
    ctx.fillStyle = value;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    return [r, g, b, a / 255];
  };
  const over = (top, bottom) => {
    const alpha = top[3] + bottom[3] * (1 - top[3]);
    if (!alpha) return [0, 0, 0, 0];
    const mix = (i) => (top[i] * top[3] + bottom[i] * bottom[3] * (1 - top[3])) / alpha;
    return [mix(0), mix(1), mix(2), alpha];
  };
  const luminance = ([r, g, b]) => {
    const channel = (v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  };
  const background = (element) => {
    const layers = [];
    for (let node = element; node; node = node.parentElement) {
      const color = rgba(getComputedStyle(node).backgroundColor);
      if (color[3] > 0) layers.push(color);
      if (color[3] >= 1) break;
    }
    let result = [255, 255, 255, 1];
    for (let i = layers.length - 1; i >= 0; i -= 1) result = over(layers[i], result);
    return result;
  };
  const opacity = (element) => {
    let value = 1;
    for (let node = element; node; node = node.parentElement) value *= Number(getComputedStyle(node).opacity) || 0;
    return value;
  };

  const low = [];
  let checked = 0;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => (node.data.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
  });
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const element = node.parentElement;
    if (!element || element.closest("iframe, [disabled], [aria-disabled='true'], :disabled")) continue;
    const style = getComputedStyle(element);
    if (style.visibility !== "visible") continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    const visible = [...range.getClientRects()].some((rect) => rect.width > 1 && rect.height > 1);
    if (!visible) continue;
    const alpha = opacity(element);
    if (alpha <= 0) continue;
    const back = background(element);
    const text = rgba(style.color);
    const fore = over([text[0], text[1], text[2], text[3] * alpha], back);
    const [lighter, darker] = [luminance(fore), luminance(back)].sort((a, b) => b - a);
    const ratio = (lighter + 0.05) / (darker + 0.05);
    checked += 1;
    if (ratio < 4.5) low.push(`${node.data.trim().slice(0, 24)} ${ratio.toFixed(2)}`);
  }
  return { lowCount: low.length, low, checked };
})()
