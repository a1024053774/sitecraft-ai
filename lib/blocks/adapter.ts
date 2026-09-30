import { blockCatalog, layoutBlocks, type BlockLook } from "./catalog.ts";
import type { TemplateAdapter, TemplateBlockRender, TemplateKit, TemplateKitModule, TemplateSection, TemplateSlot } from "../template-adapters/types.ts";

/**
 * The adapter for a look on the block library, built from the catalog: every variant's slots
 * (the bridge only writes the ones whose nodes are on the page), the visibility sections, the
 * kit modules, and which variant each block shows by default.
 */
export function blockAdapterFor(
  look: BlockLook,
  options: { kit: Omit<TemplateKit, "modules">; alternatives?: Record<string, string> },
): TemplateAdapter {
  const order = layoutBlocks(look);
  const slots: TemplateSlot[] = [];
  const sections: TemplateSection[] = [];
  const modules: TemplateKitModule[] = [];
  const variants: Record<string, string[]> = {};
  const render: Record<string, Record<string, TemplateBlockRender>> = {};
  for (const block of order) {
    const spec = blockCatalog[block];
    variants[block] = Object.keys(spec.variants);
    for (const [variantId, variant] of Object.entries(spec.variants)) {
      for (const slot of variant.slots) {
        if (!slots.some((item) => item.target === slot.target && item.selector === slot.selector)) slots.push({ ...slot });
      }
      if (variant.render) (render[block] ??= {})[variantId] = { ...variant.render };
    }
    if (spec.section) sections.push({ key: spec.section.key, selector: spec.section.selector });
    if (spec.kind === "shell") modules.push({ key: block, kind: "shell", selector: `[data-sc-block="${block}"]` });
    else if (spec.section) modules.push({ key: spec.section.key, kind: "content", selector: spec.section.selector });
  }
  return {
    templateId: look.templateId,
    runtime: "static-html",
    slots,
    sections,
    ...(options.alternatives ? { alternatives: { ...options.alternatives } } : {}),
    kit: { ...options.kit, modules },
    blocks: { order, defaults: { ...look.defaults }, variants, render },
  };
}
