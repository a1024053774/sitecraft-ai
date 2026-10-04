const HEX_RE = /^#[0-9a-f]{6}$/i;

export type ColorScaleTokens = {
  sourceColor: string;
  background: string;
  surface: string;
  text: string;
  muted: string;
  accent: string;
  accentStrong: string;
  accentText: string;
  accentSoft: string;
  border: string;
  diagram: string;
  tint: string;
};

export type ColorScaleChecks = {
  textBackground: number;
  textSurface: number;
  mutedBackground: number;
  mutedSurface: number;
  whiteAccent: number;
  whiteAccentStrong: number;
  accentText: number;
  accentTextStrong: number;
  engineeringPlate: number;
  lightPlate: number;
  secondaryButton: number;
  link: number;
  label: number;
};

export type ColorScaleSuccess = {
  ok: true;
  palette: ColorScaleTokens;
  neutral: string[];
  primary: string[];
  checks: ColorScaleChecks;
};

export type ColorScaleFailure = {
  ok: false;
  reason: string;
  failures?: string[];
};

export type ColorScaleResult = ColorScaleSuccess | ColorScaleFailure;

export type Oklch = { L: number; C: number; h: number };
type LinearRgb = [number, number, number];

function normalizeHex(value: string) {
  const input = value.trim().toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(input)) return "#" + input.slice(1).split("").map((char) => char + char).join("");
  if (HEX_RE.test(input)) return input;
  throw new Error("品牌色必须是 6 位十六进制颜色值，例如 #1f5aa6");
}

function srgbToLinear(value: number) {
  const channel = value / 255;
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

function linearToSrgb(value: number) {
  return 255 * (value <= 0.0031308 ? 12.92 * value : 1.055 * Math.max(0, value) ** (1 / 2.4) - 0.055);
}

function hexToLinearRgb(hex: string): LinearRgb {
  return [1, 3, 5].map((offset) => srgbToLinear(Number.parseInt(hex.slice(offset, offset + 2), 16))) as LinearRgb;
}

function linearRgbToOklch([red, green, blue]: LinearRgb): Oklch {
  const l = 0.4122214708 * red + 0.5363325363 * green + 0.0514459929 * blue;
  const m = 0.2119034982 * red + 0.6806995451 * green + 0.1073969566 * blue;
  const s = 0.0883024619 * red + 0.2817188376 * green + 0.6299787005 * blue;
  const lRoot = Math.cbrt(l);
  const mRoot = Math.cbrt(m);
  const sRoot = Math.cbrt(s);
  const L = 0.2104542553 * lRoot + 0.793617785 * mRoot - 0.0040720468 * sRoot;
  const a = 1.9779984951 * lRoot - 2.428592205 * mRoot + 0.4505937099 * sRoot;
  const b = 0.0259040371 * lRoot + 0.7827717662 * mRoot - 0.808675766 * sRoot;
  const C = Math.hypot(a, b);
  const hue = (Math.atan2(b, a) * 180) / Math.PI;
  return { L, C, h: C < 1e-7 ? 0 : hue < 0 ? hue + 360 : hue };
}

function oklchToLinearRgb({ L, C, h }: Oklch): LinearRgb {
  const radians = (h * Math.PI) / 180;
  const a = C * Math.cos(radians);
  const b = C * Math.sin(radians);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186173 * m + 1.707614701 * s,
  ];
}

function inSrgb(rgb: LinearRgb) {
  return rgb.every((value) => {
    const channel = linearToSrgb(value);
    return channel >= -0.0001 && channel <= 255.0001;
  });
}

function toHex(value: number) {
  return Math.round(Math.max(0, Math.min(255, value))).toString(16).padStart(2, "0");
}

export function oklchToHex(input: Oklch) {
  const base = { ...input, L: Math.max(0, Math.min(1, input.L)), C: Math.max(0, input.C) };
  let rgb = oklchToLinearRgb(base);
  if (!inSrgb(rgb)) {
    let low = 0;
    let high = base.C;
    for (let index = 0; index < 32; index += 1) {
      const middle = (low + high) / 2;
      const candidate = oklchToLinearRgb({ ...base, C: middle });
      if (inSrgb(candidate)) {
        low = middle;
        rgb = candidate;
      } else {
        high = middle;
      }
    }
    rgb = oklchToLinearRgb({ ...base, C: low });
  }
  return "#" + toHex(linearToSrgb(rgb[0])) + toHex(linearToSrgb(rgb[1])) + toHex(linearToSrgb(rgb[2]));
}

export function hexToOklch(hex: string): Oklch {
  return linearRgbToOklch(hexToLinearRgb(normalizeHex(hex)));
}

function relativeLuminance(hex: string) {
  const [red, green, blue] = hexToLinearRgb(normalizeHex(hex));
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

export function contrastRatio(left: string, right: string) {
  const a = relativeLuminance(left);
  const b = relativeLuminance(right);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const LIGHTNESS_STOPS = [0.97, 0.92, 0.84, 0.74, 0.64, 0.56, 0.48, 0.4, 0.32, 0.22, 0.14];

function buildNeutralScale(seed: Oklch) {
  return LIGHTNESS_STOPS.map((L, index) => oklchToHex({ L, C: 0.012 - index * 0.0008, h: seed.h }));
}

function buildPrimaryScale(seed: Oklch) {
  return LIGHTNESS_STOPS.map((L) => {
    const distance = Math.abs(L - 0.56);
    const chroma = seed.C * (0.35 + 0.65 * (1 - Math.min(1, distance)));
    return oklchToHex({ L, C: chroma, h: seed.h });
  });
}

function oklchDistance(left: Oklch, right: Oklch) {
  const hueDistance = Math.min(Math.abs(left.h - right.h), 360 - Math.abs(left.h - right.h));
  return Math.hypot(left.L - right.L, left.C - right.C, hueDistance / 360);
}

function chooseAccent(seed: Oklch, sourceColor: string, primary: string[], textColor: string) {
  const text = hexToOklch(textColor);
  const sourcePasses = contrastRatio("#ffffff", sourceColor) >= 4.5;
  const sourceIsDark = seed.L <= 0.35;
  const sourceTooCloseToText = oklchDistance(seed, text) < 0.035;
  const candidates = primary
    .map((color, index) => ({ color, index, value: hexToOklch(color) }))
    .filter(({ color }) => contrastRatio("#ffffff", color) >= 4.5);
  if (!candidates.length) return null;
  // A dark seed that already supports white text is the user's brand color. Keep it
  // intact; the nearest lightness candidate is only needed when the seed is too light
  // or does not meet the button-text contrast requirement.
  if (sourcePasses && (sourceIsDark || !sourceTooCloseToText)) {
    const nearest = candidates.reduce((best, candidate) => Math.abs(candidate.value.L - seed.L) < Math.abs(best.value.L - seed.L) ? candidate : best);
    return { accent: sourceColor, accentIndex: nearest.index, sourceTooCloseToText };
  }
  const lighter = sourceTooCloseToText ? candidates.filter(({ value }) => value.L > seed.L + 0.01) : candidates;
  const pool = lighter.length ? lighter : candidates;
  const nearest = pool.reduce((best, candidate) => Math.abs(candidate.value.L - seed.L) < Math.abs(best.value.L - seed.L) ? candidate : best);
  return { accent: nearest.color, accentIndex: nearest.index, sourceTooCloseToText };
}

function checksFor(palette: ColorScaleTokens): ColorScaleChecks {
  return {
    textBackground: contrastRatio(palette.text, palette.background),
    textSurface: contrastRatio(palette.text, palette.surface),
    mutedBackground: contrastRatio(palette.muted, palette.background),
    mutedSurface: contrastRatio(palette.muted, palette.surface),
    whiteAccent: contrastRatio("#ffffff", palette.accent),
    whiteAccentStrong: contrastRatio("#ffffff", palette.accentStrong),
    accentText: contrastRatio(palette.accentText, palette.accent),
    accentTextStrong: contrastRatio(palette.accentText, palette.accentStrong),
    engineeringPlate: contrastRatio(palette.accentText, palette.text),
    lightPlate: contrastRatio(palette.text, palette.tint),
    secondaryButton: contrastRatio(palette.text, palette.surface),
    link: contrastRatio(palette.accentStrong, palette.background),
    label: contrastRatio(palette.accentStrong, palette.accentSoft),
  };
}

function failedChecks(checks: ColorScaleChecks) {
  return Object.entries(checks)
    .filter(([, ratio]) => ratio < 4.5)
    .map(([name, ratio]) => name + "=" + ratio.toFixed(2) + "（需要 ≥4.5）");
}

export function validateColorPalette(input: Partial<ColorScaleTokens>): { ok: true; checks: ColorScaleChecks } | { ok: false; reason: string; failures: string[] } {
  const roles = ["background", "surface", "text", "muted", "accent", "accentStrong", "accentText", "accentSoft", "border", "diagram", "tint"] as const;
  const missing = roles.filter((role) => typeof input[role] !== "string" || !HEX_RE.test(input[role] as string));
  if (missing.length) return { ok: false, reason: "自定义色板缺少有效颜色角色", failures: missing.map((role) => role + " 无效") };
  const checks = checksFor(input as ColorScaleTokens);
  const failures = failedChecks(checks);
  return failures.length ? { ok: false, reason: "自定义色板未通过实际落点的 WCAG 对比度检查", failures } : { ok: true, checks };
}

export function buildColorScale(sourceColor: string): ColorScaleResult {
  let normalized: string;
  try {
    normalized = normalizeHex(sourceColor);
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : "品牌色格式无效" };
  }
  const seed = hexToOklch(normalized);
  const neutral = buildNeutralScale(seed);
  const primary = buildPrimaryScale(seed);
  const accentChoice = chooseAccent(seed, normalized, primary, neutral[9]);
  if (!accentChoice) return { ok: false, reason: "无法从该品牌色生成满足白字按钮对比度的强调色", failures: ["whiteAccent<4.5"] };
  const darkerCandidates = primary
    .map((color, index) => ({ color, index, L: hexToOklch(color).L }))
    .filter(({ color, L }) => L < hexToOklch(accentChoice.accent).L - 0.005 && contrastRatio("#ffffff", color) >= 4.5);
  const accentStrongIndex = darkerCandidates.length
    ? darkerCandidates.reduce((best, candidate) => Math.abs(candidate.L - seed.L) < Math.abs(best.L - seed.L) ? candidate : best).index
    : accentChoice.accentIndex;
  const accentText = contrastRatio("#ffffff", accentChoice.accent) >= 4.5 && contrastRatio("#ffffff", primary[accentStrongIndex]) >= 4.5
    ? "#ffffff"
    : "#111827";
  const palette: ColorScaleTokens = {
    sourceColor: normalized,
    background: neutral[0],
    surface: neutral[0],
    text: neutral[9],
    muted: neutral[6],
    accent: accentChoice.accent,
    accentStrong: primary[accentStrongIndex],
    accentText,
    accentSoft: primary[0],
    border: neutral[3],
    diagram: neutral[2],
    tint: neutral[1],
  };
  const checks = checksFor(palette);
  const failures = failedChecks(checks);
  if (failures.length) return { ok: false, reason: "生成的色阶未通过 WCAG 对比度检查", failures };
  return { ok: true, palette, neutral, primary, checks };
}
