import { readFileSync } from "node:fs";
import path from "node:path";
import { getTemplateAdapter } from "./registry.ts";

export const NORDIC_STORE_SHA = "b64edb872ec70d40297eb3aacb1fb4dfbb3a68c3";
export const NORDIC_STORE_REPO = "https://github.com/tailwindtoolbox/Nordic-Store";
export const NORDIC_STORE_LOCAL_PATH = "vendor/open-source-templates/nordic-store";

const PRODUCT_GRID_MARKER = 'data-sitecraft-kit="product-grid"';

const HOST_GRID_STYLE = `<style>
[data-sitecraft-kit="product-grid"]{
  background:#ffffff;
  color:#111827;
  font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Sans",sans-serif;
}
[data-sitecraft-kit="product-grid"] .sitecraft-catalog-grid{
  display:flex;
  flex-wrap:wrap;
  max-width:72rem;
  margin:0 auto;
  padding:1rem 0 3rem;
}
[data-sitecraft-kit="product-grid"] .sitecraft-catalog-card{
  width:100%;
  padding:1.5rem;
  box-sizing:border-box;
}
@media (min-width:768px){
  [data-sitecraft-kit="product-grid"] .sitecraft-catalog-card{width:33.333%;}
}
@media (min-width:1280px){
  [data-sitecraft-kit="product-grid"] .sitecraft-catalog-card{width:25%;}
}
[data-sitecraft-kit="product-grid"] img[data-sitecraft-stock="unsplash"]{display:none;}
</style>`;

export function extractNordicProductGrid(html: string) {
  const marker = 'id="store"';
  const at = html.indexOf(marker);
  if (at < 0) return null;
  const sectionStart = html.lastIndexOf("<section", at);
  if (sectionStart < 0) return null;
  const sectionEnd = html.indexOf("</section>", at);
  if (sectionEnd < 0) return null;
  return html.slice(sectionStart, sectionEnd + "</section>".length);
}

/** Drop Unsplash hotlinks and retail £ prices; restyle structure onto host tokens. */
export function restyleAdmittedCatalogGrid(fragment: string) {
  let html = fragment.replace(/<section\b/i, `<section ${PRODUCT_GRID_MARKER} data-sitecraft-family="export-catalog"`);
  html = html.replace(/src="https:\/\/images\.unsplash\.com[^"]*"/gi, 'src="" data-sitecraft-stock="unsplash"');
  html = html.replace(/<p class="pt-1 text-gray-900">£9\.99<\/p>/g, "");
  html = html.replace(/class="w-full md:w-1\/3 xl:w-1\/4 p-6 flex flex-col"/g, 'class="sitecraft-catalog-card"');
  html = html.replace(
    /class="container mx-auto flex items-center flex-wrap pt-4 pb-12"/,
    'class="sitecraft-catalog-grid"',
  );
  return `${html}${HOST_GRID_STYLE}`;
}

export function injectProductGrid(hostHtml: string, fragment: string) {
  if (hostHtml.includes(PRODUCT_GRID_MARKER)) return hostHtml;
  const footer = hostHtml.search(/<footer\b/i);
  if (footer < 0) return `${hostHtml}${fragment}`;
  return `${hostHtml.slice(0, footer)}${fragment}${hostHtml.slice(footer)}`;
}

export function readNordicStoreHtml() {
  const root = path.resolve(/* turbopackIgnore: true */ process.cwd(), NORDIC_STORE_LOCAL_PATH);
  return readFileSync(path.join(root, "index.html"), "utf8");
}

export function applyAdmittedKitFragments(hostHtml: string, templateId: string) {
  const adapter = getTemplateAdapter(templateId);
  const guest = adapter?.kit?.modules.find((module) => module.sourceTemplateId === "nordic-store" && module.key === "products");
  if (!guest) return hostHtml;
  const grid = extractNordicProductGrid(readNordicStoreHtml());
  if (!grid) return hostHtml;
  return injectProductGrid(hostHtml, restyleAdmittedCatalogGrid(grid));
}
