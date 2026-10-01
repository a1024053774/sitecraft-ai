// Test fixture: the home page the preview route serves for a look's template, as markup.
import { readFileSync } from "node:fs";
import { composedPageForTemplate } from "../../lib/blocks/compose.ts";

/** All admitted visual looks are composed from lib/blocks; legacy template fixtures remain vendor-backed. */
export function servedHomeHtml(templateId: string) {
  const composed = composedPageForTemplate(templateId);
  if (composed) return composed;
  return readFileSync(new URL(`../../vendor/open-source-templates/${templateId}/dist/index.html`, import.meta.url), "utf8");
}

/** The page without its <template> copies: what the document tree holds before the bridge runs. */
export function withoutTemplates(html: string) {
  return html.replace(/<template\b[^>]*>[\s\S]*?<\/template>/gi, "");
}
