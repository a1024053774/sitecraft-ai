/**
 * First-party font registry for published block-library pages.
 *
 * The ids are kit data, rather than model input. Each face points at a public Latin-only
 * subset in this repository; Chinese text continues through the system fallback in the kit token.
 */
export type SiteFontFamilyId =
  | "engineering-geist"
  | "engineering-geist-mono"
  | "catalog-manrope"
  | "catalog-jetbrains-mono"
  | "bright-manrope"
  | "bright-sora"
  | "bright-jetbrains-mono"
  | "short-path-geist"
  | "short-path-geist-mono";

type FontAsset = {
  family: string;
  directory: string;
  fileStem: string;
  weights: readonly number[];
};

const FONT_ASSETS: Readonly<Record<SiteFontFamilyId, FontAsset>> = {
  "engineering-geist": { family: "Geist", directory: "geist", fileStem: "geist", weights: [400, 500, 600, 700] },
  "engineering-geist-mono": { family: "Geist Mono", directory: "geist-mono", fileStem: "geist-mono", weights: [400, 500, 600, 700] },
  "catalog-manrope": { family: "Manrope", directory: "manrope", fileStem: "manrope", weights: [400, 500, 600, 700] },
  "catalog-jetbrains-mono": { family: "JetBrains Mono", directory: "jetbrains-mono", fileStem: "jetbrains-mono", weights: [400, 500, 600, 700] },
  "bright-manrope": { family: "Manrope", directory: "manrope", fileStem: "manrope", weights: [400, 500, 600, 700] },
  "bright-sora": { family: "Sora", directory: "sora", fileStem: "sora", weights: [700] },
  "bright-jetbrains-mono": { family: "JetBrains Mono", directory: "jetbrains-mono", fileStem: "jetbrains-mono", weights: [400, 500, 600, 700] },
  "short-path-geist": { family: "Geist", directory: "geist", fileStem: "geist", weights: [400, 500, 600, 700] },
  "short-path-geist-mono": { family: "Geist Mono", directory: "geist-mono", fileStem: "geist-mono", weights: [400, 500, 600, 700] },
};

const TEMPLATE_FONT_IDS: Readonly<Record<string, readonly SiteFontFamilyId[]>> = {
  screwfast: ["engineering-geist", "engineering-geist-mono"],
  landwind: ["catalog-manrope", "catalog-jetbrains-mono"],
  forge: ["bright-manrope", "bright-jetbrains-mono", "bright-sora"],
  "tailwind-landing": ["short-path-geist", "short-path-geist-mono"],
};

function faceCss(asset: FontAsset, weight: number) {
  const path = `/fonts/sitecraft/${asset.directory}/${asset.fileStem}-${weight}-latin.woff2`;
  return `@font-face { font-family: "${asset.family}"; font-style: normal; font-weight: ${weight}; font-display: swap; src: url("${path}") format("woff2"); }`;
}

export function fontFaceCssForFamilies(fontFamilyId: string | undefined, dataFontFamilyId: string | undefined, headingFontFamilyId?: string) {
  const ids = [fontFamilyId, dataFontFamilyId, headingFontFamilyId].filter((id): id is SiteFontFamilyId => Boolean(id && id in FONT_ASSETS));
  const seen = new Set<string>();
  return ids
    .flatMap((id) => {
      const asset = FONT_ASSETS[id];
      const key = `${asset.family}:${asset.directory}`;
      if (seen.has(key)) return [];
      seen.add(key);
      return asset.weights.map((weight) => faceCss(asset, weight));
    })
    .join("\n");
}

export function fontFaceCssForTemplate(templateId: string) {
  const ids = TEMPLATE_FONT_IDS[templateId];
  return ids ? fontFaceCssForFamilies(ids[0], ids[1], ids[2]) : "";
}

export function fontAssetPath(familyId: SiteFontFamilyId, weight: number) {
  const asset = FONT_ASSETS[familyId];
  if (!asset.weights.includes(weight)) throw new Error(`Font weight ${weight} is not declared for ${familyId}`);
  return `/fonts/sitecraft/${asset.directory}/${asset.fileStem}-${weight}-latin.woff2`;
}
