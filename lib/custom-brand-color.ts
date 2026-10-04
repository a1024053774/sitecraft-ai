import { z } from "zod";
import { buildColorScale, contrastRatio, hexToOklch } from "./color-scale.ts";

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
  accentText: hexColor.default("#ffffff"),
  accentSoft: hexColor,
  border: hexColor,
  diagram: hexColor,
  tint: hexColor,
});
export type CustomPalette = z.infer<typeof customPaletteSchema>;

export { contrastRatio };

export function generateCustomPalette(sourceColor: string, source: "color" | "logo" = "color") {
  const generated = buildColorScale(sourceColor);
  if (!generated.ok) {
    const reason = generated.failures?.length ? generated.reason + "：" + generated.failures.join("、") : generated.reason;
    throw new Error(reason);
  }
  const { palette } = generated;
  const sourceLightness = hexToOklch(palette.sourceColor).L;
  const accentLightness = hexToOklch(palette.accent).L;
  const adjustment = accentLightness - sourceLightness;
  const adjusted = palette.accent !== palette.sourceColor;
  const customPalette: CustomPalette = {
    source,
    sourceColor: palette.sourceColor,
    adjusted,
    adjustmentNote: adjusted
      ? adjustment < -0.015
        ? "已按你的主色生成整套配色，并把按钮颜色调深一点，保证白字看得清。"
        : adjustment > 0.015
          ? "已按你的主色生成整套配色，并把按钮颜色调浅一点，让它和正文更容易区分。"
          : "已按你的主色生成整套配色，并微调按钮颜色，保证白字看得清。"
      : "已按你的主色生成整套配色，按钮和文字都保持清晰可读。",
    background: palette.background,
    surface: palette.surface,
    text: palette.text,
    muted: palette.muted,
    accent: palette.accent,
    accentStrong: palette.accentStrong,
    accentText: palette.accentText,
    accentSoft: palette.accentSoft,
    border: palette.border,
    diagram: palette.diagram,
    tint: palette.tint,
  };
  return { palette: customPalette, swatches: [customPalette.background, customPalette.surface, customPalette.text, customPalette.accent, customPalette.accentStrong, customPalette.border] };
}
