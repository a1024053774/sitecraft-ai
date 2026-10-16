import { defaultTreeAdapter, html as htmlNamespaces, parseFragment, serialize, type DefaultTreeAdapterTypes as Dom } from 'parse5';
import { parse as parseCss } from 'postcss';
import valueParser from 'postcss-value-parser';
import type { SiteCode } from './code-site.ts';
import { systemBackdrops } from './code-site-backdrops.ts';
import { systemIconSvg } from './code-site-icons.ts';

function fragment(html: string) {
  const body = defaultTreeAdapter.createElement('body', htmlNamespaces.NS.HTML, []);
  return parseFragment(body, html, {});
}
function elements(parent: Dom.ParentNode, visit: (element: Dom.Element) => void) {
  for (const node of parent.childNodes) if ('tagName' in node) {
    visit(node); elements(node, visit);
  }
}
function attribute(element: Dom.Element, name: string) { return element.attrs.find(attr => attr.name === name)?.value; }
function setAttribute(element: Dom.Element, name: string, value: string) {
  const current = element.attrs.find(attr => attr.name === name);
  if (current) current.value = value; else element.attrs.push({ name, value });
}

// Only URL functions in CSS declaration values are resources. Literal prose,
// selectors, comments and content:"url(...)" strings are never resource references.
export function mapSiteCodeCss(css: string, map: (url: string) => string) {
  const root = parseCss(css, { from: undefined });
  root.walkDecls(declaration => {
    const value = valueParser(declaration.value);
    value.walk(node => {
      if (node.type !== 'function' || node.value.toLowerCase() !== 'url') return;
      const argument = node.nodes.filter(child => child.type !== 'space' && child.type !== 'comment');
      if (argument.length !== 1 || !['string', 'word'].includes(argument[0].type)) throw new Error('站点 CSS 资源无法解析。');
      const url = map(argument[0].value);
      if (url !== argument[0].value) argument[0].value = url;
      return false;
    });
    declaration.value = value.toString();
  });
  return root.toString();
}

export function siteCodeResources(code: SiteCode) {
  const imageIds = new Set<string>(), backdropIds = new Set<string>(), backdropUrls = new Set<string>();
  const registeredUrls = new Set<string>(Object.values(systemBackdrops).flatMap(entry => Object.values(entry.urls)));
  let usesIcons = false;
  const readUrl = (url: string) => { if (registeredUrls.has(url)) backdropUrls.add(url); return url; };
  mapSiteCodeCss(code.css, readUrl);
  for (const html of [code.header, code.footer, ...code.pages.map(page => page.html)]) elements(fragment(html), node => {
    const image = attribute(node, 'data-image-id');
    if (node.tagName === 'img' && image && /^img_[a-z0-9]{16,40}$/.test(image)) imageIds.add(image);
    const backdrop = attribute(node, 'data-system-backdrop');
    if (backdrop && Object.hasOwn(systemBackdrops, backdrop)) {
      backdropIds.add(backdrop);
      for (const url of Object.values(systemBackdrops[backdrop as keyof typeof systemBackdrops].urls)) backdropUrls.add(url);
    }
    if (node.tagName === 'span' && attribute(node, 'data-system-icon')) usesIcons = true;
    const inline = attribute(node, 'style');
    if (inline) mapSiteCodeCss(inline, readUrl);
  });
  return { imageIds: [...imageIds], backdropIds: [...backdropIds], backdropUrls: [...backdropUrls], usesIcons };
}

// Publishing and exporting transform the same parsed element tree. System image
// attributes remain intact because generated CSS can use them as selectors.
export function renderCodeFragment(html: string, options: {
  pageHref: (pageId: string, hash: string) => string | undefined;
  imageUrl: (imageId: string) => string;
  assetUrl?: (url: string) => string;
}) {
  const tree = fragment(html);
  elements(tree, node => {
    const href = attribute(node, 'href');
    const target = href?.match(/^\/([a-z][a-z0-9-]*)(#.*)?$/);
    if (node.tagName === 'a' && target) {
      const next = options.pageHref(target[1], target[2] ?? '');
      if (next !== undefined) setAttribute(node, 'href', next);
    }
    const image = attribute(node, 'data-image-id');
    if (node.tagName === 'img' && image && /^img_[a-z0-9]{16,40}$/.test(image)) setAttribute(node, 'src', options.imageUrl(image));
    const icon = attribute(node, 'data-system-icon');
    if (node.tagName === 'span' && icon) {
      node.attrs = node.attrs.filter(attr => attr.name !== 'data-system-icon');
      node.childNodes = fragment(systemIconSvg(icon)).childNodes;
      for (const child of node.childNodes) child.parentNode = node;
    }
    const inline = attribute(node, 'style');
    if (inline && options.assetUrl) setAttribute(node, 'style', mapSiteCodeCss(inline, options.assetUrl));
  });
  return serialize(tree);
}
