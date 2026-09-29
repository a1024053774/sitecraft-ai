// Evaluated in the workspace page: `(${source})(".builder-shell")`.
// Measures every visible text node, input value and placeholder under the root against
// the background actually painted behind it (ancestor backgrounds composited, element
// opacity applied). Disabled controls are exempt, as in WCAG 1.4.3. The preview iframe
// is a different document and is not scanned.
((rootSelector) => {
  const root = document.querySelector(rootSelector);
  if (!root) return { checked: 0, lowCount: 1, low: [`missing ${rootSelector}`], unmeasured: [] };
  const parse = (value) => {
    if (!value || value === "transparent") return [0, 0, 0, 0];
    let match = value.match(/rgba?\(([^)]+)\)/);
    if (match) {
      const parts = match[1].split(/[\s,/]+/).filter(Boolean).map(Number);
      return [parts[0], parts[1], parts[2], parts.length > 3 ? parts[3] : 1];
    }
    match = value.match(/color\(srgb ([^)]+)\)/);
    if (match) {
      const parts = match[1].split(/[\s/]+/).filter(Boolean).map(Number);
      return [parts[0] * 255, parts[1] * 255, parts[2] * 255, parts.length > 3 ? parts[3] : 1];
    }
    return null;
  };
  const over = (top, bottom) => {
    const alpha = top[3] + bottom[3] * (1 - top[3]);
    if (!alpha) return [0, 0, 0, 0];
    return [0, 1, 2].map((index) => (top[index] * top[3] + bottom[index] * bottom[3] * (1 - top[3])) / alpha).concat(alpha);
  };
  const luminance = (color) => {
    const [r, g, b] = color.slice(0, 3).map((value) => {
      const channel = value / 255;
      return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (a, b) => {
    const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (light + 0.05) / (dark + 0.05);
  };
  const hex = (color) => `#${color.slice(0, 3).map((value) => Math.round(value).toString(16).padStart(2, "0")).join("")}`;
  const unmeasured = new Set();
  // Background painted behind an element: its own and its ancestors' backgrounds, composited.
  const backgroundOf = (element) => {
    const layers = [];
    for (let node = element; node && node.nodeType === 1; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.backgroundImage && style.backgroundImage !== "none" && !/^url\(/.test(style.backgroundImage)) {
        unmeasured.add(`${node.className || node.tagName}: gradient background`);
      }
      const color = parse(style.backgroundColor);
      if (color && color[3] > 0) {
        layers.push(color);
        if (color[3] >= 1) break;
      }
    }
    let painted = [255, 255, 255, 1];
    for (let index = layers.length - 1; index >= 0; index -= 1) painted = over(layers[index], painted);
    return painted;
  };
  const opacityOf = (element) => {
    let opacity = 1;
    for (let node = element; node && node.nodeType === 1; node = node.parentElement) opacity *= Number(getComputedStyle(node).opacity || 1);
    return opacity;
  };
  const visible = (element) => {
    if (!element.getClientRects().length) return false;
    const style = getComputedStyle(element);
    if (style.visibility === "hidden" || style.display === "none") return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };
  const disabled = (element) => Boolean(element.closest(":disabled, [aria-disabled='true']"));
  const pathOf = (element) => {
    const parts = [];
    for (let node = element; node && node !== root && parts.length < 3; node = node.parentElement) {
      const cls = typeof node.className === "string" && node.className.trim() ? `.${node.className.trim().split(/\s+/).slice(0, 2).join(".")}` : "";
      parts.unshift(`${node.tagName.toLowerCase()}${cls}`);
    }
    return parts.join(" > ");
  };
  const low = [];
  let checked = 0;
  const measure = (element, colorValue, label) => {
    const text = parse(colorValue);
    if (!text) { unmeasured.add(`${pathOf(element)}: ${colorValue}`); return; }
    const background = backgroundOf(element);
    const fg = over([text[0], text[1], text[2], text[3] * opacityOf(element)], background);
    const value = ratio(fg, background);
    checked += 1;
    if (value < 4.5) low.push(`${label.slice(0, 28)} ${value.toFixed(2)} ${hex(fg)}/${hex(background)} <${pathOf(element)}>`);
  };
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const content = node.textContent.trim();
    const element = node.parentElement;
    if (!content || !element || element.closest("script, style, option, textarea") || !visible(element) || disabled(element)) continue;
    measure(element, getComputedStyle(element).color, content);
  }
  for (const field of root.querySelectorAll("input:not([type=radio]):not([type=checkbox]):not([type=color]):not([type=file]):not([hidden]), textarea, select")) {
    if (!visible(field) || disabled(field)) continue;
    if (field.value) measure(field, getComputedStyle(field).color, `值:${field.value}`);
    else if (field.placeholder) measure(field, getComputedStyle(field, "::placeholder").color, `占位:${field.placeholder}`);
  }
  return { checked, lowCount: low.length, low, unmeasured: [...unmeasured] };
})
