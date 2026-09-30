// Test fixture: the home page the preview route serves for a look's template, as markup.
import { readFileSync } from "node:fs";
import { composedPageForTemplate } from "../../lib/blocks/compose.ts";

/** Block-library looks are composed from lib/blocks; the other looks still serve their overlay. */
export function servedHomeHtml(templateId: string) {
  return composedPageForTemplate(templateId)
    ?? readFileSync(new URL(`../../lib/template-adapters/overlays/${templateId}.index.html`, import.meta.url), "utf8");
}

/** The page without its <template> copies: what the document tree holds before the bridge runs. */
export function withoutTemplates(html: string) {
  return html.replace(/<template\b[^>]*>[\s\S]*?<\/template>/gi, "");
}
