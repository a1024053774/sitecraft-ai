import type { TemplateFamilyId, TemplateKit, TemplateKitModuleKind, TemplateKitTokens } from "./types.ts";

export type KitPart = {
  familyId: TemplateFamilyId | string;
  tokens: TemplateKitTokens;
  key: string;
  kind: TemplateKitModuleKind;
};

export type KitComposeResult =
  | { ok: true; familyId: string; selected: string[] }
  | { ok: false; reason: "cross-family" | "token-mismatch" | "empty"; families: string[]; selected: string[] };

export function sameFamilyTokens(left: TemplateKitTokens, right: TemplateKitTokens) {
  return (
    left.background === right.background &&
    left.text === right.text &&
    left.accent === right.accent &&
    left.border === right.border &&
    left.font === right.font &&
    left.radius === right.radius
  );
}

/** Content and shell from this kit; demo chrome is never selected. */
export function selectedKitParts(kit: TemplateKit, hiddenSections: readonly string[] = []): KitPart[] {
  return kit.modules
    .filter((module) => {
      if (module.kind === "demo") return false;
      if (module.kind === "content" && hiddenSections.includes(module.key)) return false;
      return true;
    })
    .map((module) => ({
      familyId: kit.familyId,
      tokens: kit.tokens,
      key: module.key,
      kind: module.kind,
    }));
}

/**
 * Sample B: one family, one token card. Sample C: borrowed structure already
 * restyled to the host card. Sample A: mixed family or leftover foreign skin.
 */
export function composeKitModules(input: { host: TemplateKit; parts: KitPart[] }): KitComposeResult {
  const hostFamily = input.host.familyId;
  if (!input.parts.length) {
    return { ok: false, reason: "empty", families: [hostFamily], selected: [] };
  }
  const families = [...new Set(input.parts.map((part) => String(part.familyId)))];
  if (families.some((familyId) => familyId !== hostFamily)) {
    return {
      ok: false,
      reason: "cross-family",
      families: [...new Set([hostFamily, ...families])],
      selected: [],
    };
  }
  for (const part of input.parts) {
    if (!sameFamilyTokens(part.tokens, input.host.tokens)) {
      return { ok: false, reason: "token-mismatch", families, selected: [] };
    }
  }
  return {
    ok: true,
    familyId: hostFamily,
    selected: input.parts.filter((part) => part.kind !== "demo").map((part) => part.key),
  };
}
