import { z } from "zod";

const hexColor = z.string().regex(/^#[0-9a-f]{6}$/i);

export const customPaletteSchema = z.object({
  source: z.enum(["color", "logo"]),
  sourceColor: hexColor,
  adjusted: z.boolean(),
  adjustmentNote: z.string().max(240),
  background: hexColor,
  surface: hexColor,
  text: hexColor,
  muted: hexColor,
  accent: hexColor,
  accentStrong: hexColor,
  accentSoft: hexColor,
  border: hexColor,
  diagram: hexColor,
  tint: hexColor,
});
export type CustomPalette = z.infer<typeof customPaletteSchema>;

function normalizeHex(value: string) {
  const input = value.trim().toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(input)) return `#${input.slice(1).split("").map((char) => char + char).join("")}`;
  if (/^#[0-9a-f]{6}$/i.test(input)) return input;
  throw new Error("品牌色必须是 6 位十六进制颜色值，例如 #1f5aa6");
}

function rgb(hex: string) {
  return [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255) as [number, number, number];
}

function toHex(value: number) {
  return Math.round(Math.max(0, Math.min(1, value)) * 255).toString(16).padStart(2, "0");
}

function mix(left: string, right: string, amount: number) {
  const a = rgb(left);
  const b = rgb(right);
  return `#${toHex(a[0] * (1 - amount) + b[0] * amount)}${toHex(a[1] * (1 - amount) + b[1] * amount)}${toHex(a[2] * (1 - amount) + b[2] * amount)}`;
}

function hsl(hex: string) {
  const [r, g, b] = rgb(hex);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: lightness };
  const delta = max - min;
  const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  let hue = 0;
  if (max === r) hue = (g - b) / delta + (g < b ? 6 : 0);
  else if (max === g) hue = (b - r) / delta + 2;
  else hue = (r - g) / delta + 4;
  return { h: hue / 6, s: saturation, l: lightness };
}

function fromHsl(hue: number, saturation: number, lightness: number) {
  if (saturation === 0) return `#${toHex(lightness)}${toHex(lightness)}${toHex(lightness)}`;
  const hueToRgb = (p: number, q: number, t: number) => {
    let next = t;
    if (next < 0) next += 1;
    if (next > 1) next -= 1;
    if (next < 1 / 6) return p + (q - p) * 6 * next;
    if (next < 1 / 2) return q;
    if (next < 2 / 3) return p + (q - p) * (2 / 3 - next) * 6;
    return p;
  };
  const q = lightness < 0.5 ? lightness * (1 + saturation) : lightness + saturation - lightness * saturation;
  const p = 2 * lightness - q;
  return `#${toHex(hueToRgb(p, q, hue + 1 / 3))}${toHex(hueToRgb(p, q, hue))}${toHex(hueToRgb(p, q, hue - 1 / 3))}`;
}

function darken(hex: string, amount: number) {
  const color = hsl(hex);
  return fromHsl(color.h, color.s, Math.max(0.08, color.l - amount));
}

export function contrastRatio(left: string, right: string) {
  const luminance = (hex: string) => {
    const channels = rgb(normalizeHex(hex)).map((channel) => channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  };
  const a = luminance(left);
  const b = luminance(right);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function readableAccent(source: string) {
  let accent = source;
  let amount = 0;
  while (contrastRatio("#ffffff", accent) < 4.5 && amount < 0.85) {
    amount += 0.05;
    accent = darken(source, amount);
  }
  return { accent, adjusted: accent !== source };
}

export function generateCustomPalette(sourceColor: string, source: "color" | "logo" = "color") {
  const normalized = normalizeHex(sourceColor);
  const { accent, adjusted } = readableAccent(normalized);
  const accentStrong = readableAccent(darken(accent, 0.1)).accent;
  const palette: CustomPalette = {
    source,
    sourceColor: normalized,
    adjusted,
    adjustmentNote: adjusted
      ? "主色偏浅，已自动压暗强调色，确保白字按钮达到可读对比度。"
      : "主色对比度足够，已生成配套背景、边框和文字色。",
    background: "#ffffff",
    surface: "#ffffff",
    text: "#111827",
    muted: "#4b5563",
    accent,
    accentStrong,
    accentSoft: mix(accent, "#ffffff", 0.88),
    border: mix(accent, "#ffffff", 0.78),
    diagram: mix(accent, "#ffffff", 0.84),
    tint: mix(accent, "#ffffff", 0.94),
  };
  return { palette, swatches: [palette.background, palette.surface, palette.text, palette.accent, palette.accentStrong, palette.border] };
}

