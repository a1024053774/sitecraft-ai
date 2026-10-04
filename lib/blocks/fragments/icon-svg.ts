import { iconDefinitionFor, type IconGeometry } from "../icon-registry.ts";

/**
 * Markup for one registered icon (T-093). The geometry comes only from the icon registry; a block
 * mounts its icons in fixed places, so no icon id or SVG ever comes from the model or the draft.
 * The icon is decorative (the text beside it carries the meaning), so it is hidden from assistive tech.
 */
const element = (geometry: IconGeometry) => {
  switch (geometry.kind) {
    case "path": return `<path d="${geometry.d}"/>`;
    case "line": return `<line x1="${geometry.x1}" y1="${geometry.y1}" x2="${geometry.x2}" y2="${geometry.y2}"/>`;
    case "polyline": return `<polyline points="${geometry.points}"/>`;
    case "rect": return `<rect x="${geometry.x}" y="${geometry.y}" width="${geometry.width}" height="${geometry.height}"${geometry.rx !== undefined ? ` rx="${geometry.rx}"` : ""}${geometry.ry !== undefined ? ` ry="${geometry.ry}"` : ""}/>`;
    case "circle": return `<circle cx="${geometry.cx}" cy="${geometry.cy}" r="${geometry.r}"/>`;
  }
};

export function iconSvg(id: string, size: 16 | 20 | 24 = 20) {
  const icon = iconDefinitionFor(id);
  if (!icon.allowedSizes.includes(size)) throw new Error(`图标 ${id} 没有 ${size}px 尺寸`);
  return `<svg class="sitecraft-icon" data-sitecraft-icon="${id}" viewBox="${icon.viewBox}" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="${icon.strokeWidth}" stroke-linecap="${icon.lineCap}" stroke-linejoin="${icon.lineJoin}" aria-hidden="true" focusable="false">${icon.paths.map(element).join("")}</svg>`;
}
