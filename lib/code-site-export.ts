import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { englishSiteCode, renderSiteCode, renderSiteCodeCss, type CodeSiteRecord, type CodeVersion, type SiteCode } from './code-site.ts';
import { readSiteImage, type SiteImageRecord } from './site-images.ts';
import { systemBackdropLicense } from './code-site-backdrops.ts';
import { systemIconLicense } from './code-site-icons.ts';
import { siteCodeResources } from './code-site-dom.ts';

type ZipEntry = { name: string; data: Uint8Array };

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function concat(parts: Uint8Array[]) {
  const size = parts.reduce((total, part) => total + part.byteLength, 0);
  const output = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) { output.set(part, offset); offset += part.byteLength; }
  return output;
}

function u16(value: number) { const bytes = new Uint8Array(2); new DataView(bytes.buffer).setUint16(0, value, true); return bytes; }
function u32(value: number) { const bytes = new Uint8Array(4); new DataView(bytes.buffer).setUint32(0, value >>> 0, true); return bytes; }

// Store entries without compression. This keeps the package writer small, deterministic,
// and usable in the Node runtime without adding an archive dependency.
export function createStoredZip(entries: ZipEntry[]) {
  const names = new Set<string>();
  for (const { name } of entries) {
    if (!name || /[^a-zA-Z0-9._/-]/.test(name) || name.startsWith('/') || name.split('/').some(part => !part || part === '.' || part === '..')) {
      throw new Error(`ZIP 条目路径无效：${JSON.stringify(name)}`);
    }
    if (names.has(name)) throw new Error(`ZIP 条目重复：${name}`);
    names.add(name);
  }
  const encoder = new TextEncoder();
  const local: Uint8Array[] = [], central: Uint8Array[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = encoder.encode(entry.name), data = entry.data, crc = crc32(data);
    const header = concat([u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(data.byteLength), u32(data.byteLength), u16(name.byteLength), u16(0), name]);
    local.push(header, data);
    central.push(concat([u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(data.byteLength), u32(data.byteLength), u16(name.byteLength), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), name]));
    offset += header.byteLength + data.byteLength;
  }
  const centralBytes = concat(central), localBytes = concat(local);
  return concat([localBytes, centralBytes, u32(0x06054b50), u16(0), u16(0), u16(entries.length), u16(entries.length), u32(centralBytes.byteLength), u32(localBytes.byteLength), u16(0)]);
}

function assetName(record: SiteImageRecord) {
  const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[record.mime];
  return `assets/images/${record.imageId}.${extension}`;
}
function relative(from: string, to: string) {
  const result = path.posix.relative(path.posix.dirname(from), to);
  return result || path.posix.basename(to);
}
function pageFiles(code: SiteCode, language: 'zh' | 'en') {
  const files = new Map<string, string>(), used = new Set(['index.html']);
  const prefix = language === 'en' ? 'en/' : '';
  for (const page of code.pages) {
    if (!/^[a-z][a-z0-9-]{0,39}$/.test(page.id) || files.has(page.id)) throw new Error('站点包页面编号无效或重复。');
    if (page.id === 'home') { files.set(page.id, `${prefix}index.html`); continue; }
    let name = `${page.id}.html`, suffix = 2;
    while (used.has(name)) name = `${page.id}-${suffix++}.html`;
    used.add(name); files.set(page.id, prefix + name);
  }
  return files;
}
function stripLicenseComment(value: string) { return value.replace(/^<!--\s*|\s*-->$/g, '').trim(); }

function imageCredits(images: SiteImageRecord[]) {
  return images.map(image => image.attribution).filter(Boolean);
}

export async function buildStaticSitePackage(site: CodeSiteRecord, version: CodeVersion) {
  const codes: Array<{ language: 'zh' | 'en'; code: SiteCode }> = [{ language: 'zh', code: version.code }];
  const english = englishSiteCode(site, version);
  if (english) codes.push({ language: 'en', code: english });
  const languages = codes.map(item => ({ ...item, resources: siteCodeResources(item.code), pages: pageFiles(item.code, item.language) }));
  const imageIds = [...new Set(languages.flatMap(item => item.resources.imageIds))];
  const records: SiteImageRecord[] = [];
  const assets = new Map<string, string>();
  const files: ZipEntry[] = [];
  for (const id of imageIds) {
    const loaded = await readSiteImage(site.siteId, id, { readOnly: true });
    if (!loaded) throw new Error(`当前版本引用的图片无法读取：${id}`);
    if (loaded.record.usageScope === 'docs-only') throw new Error('当前版本引用的图片没有站点使用授权。');
    records.push(loaded.record);
    const file = assetName(loaded.record);
    assets.set(`/api/sites/${encodeURIComponent(site.siteId)}/images/${id}`, file);
    files.push({ name: file, data: loaded.bytes });
  }
  records.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const backdropUrls = [...new Set(languages.flatMap(item => item.resources.backdropUrls))];
  for (const url of backdropUrls) {
    const basename = path.posix.basename(url);
    const file = `assets/system-backdrops/${basename}`;
    const sourcePath = path.join(process.cwd(), 'public', url.replace(/^\//, ''));
    assets.set(url, file);
    files.push({ name: file, data: new Uint8Array(await readFile(sourcePath)) });
  }
  const usesIcons = languages.some(item => item.resources.usesIcons);
  const usesBackdrops = backdropUrls.length > 0;
  const assetUrl = (currentFile: string) => (url: string) => {
    const file = assets.get(url);
    if (!file) throw new Error('站点包引用了未登记的资源。');
    return relative(currentFile, file);
  };
  const chineseCss = renderSiteCodeCss(version.code, assetUrl('styles.css'));
  files.push({ name: 'styles.css', data: new TextEncoder().encode(chineseCss) });
  const rendered: ZipEntry[] = [];
  for (const item of languages) {
    let stylesheet = 'styles.css';
    if (item.language === 'en' && renderSiteCodeCss(item.code, assetUrl('styles.css')) !== chineseCss) {
      stylesheet = 'en/styles.css';
      files.push({ name: stylesheet, data: new TextEncoder().encode(renderSiteCodeCss(item.code, assetUrl(stylesheet))) });
    }
    for (const page of item.code.pages) {
      const currentFile = item.pages.get(page.id)!;
      const pageHref = (target: string, hash: string) => `${relative(currentFile, item.pages.get(target)!)}${hash}`;
      const languageLinks = english ? {
        zh: relative(currentFile, languages[0].pages.get(page.id) ?? languages[0].pages.get('home')!),
        en: relative(currentFile, languages[1].pages.get(page.id) ?? languages[1].pages.get('home')!),
      } : undefined;
      const html = renderSiteCode(site.siteId, item.code, page.id, '', imageCredits(records.filter(record => item.resources.imageIds.includes(record.imageId))), undefined, {
        language: item.language, languageLinks, pageHref, assetUrl: assetUrl(currentFile), stylesheetHref: relative(currentFile, stylesheet),
      });
      rendered.push({ name: currentFile, data: new TextEncoder().encode(html) });
    }
  }
  files.push(...rendered);
  const licenseLines = ['SiteCraft static site package licenses', '', 'Images included in this package:'];
  if (!records.length) licenseLines.push('- None');
  for (const record of records) {
    licenseLines.push(`- ${assetName(record)}`, `  Attribution: ${record.attribution}`, `  License: ${record.license}`);
    if (record.source === 'public-material') licenseLines.push(`  Source: ${record.sourceUrl}`);
    if (record.licenseUrl) licenseLines.push(`  License URL: ${record.licenseUrl}`);
  }
  if (usesIcons) licenseLines.push('', stripLicenseComment(systemIconLicense));
  if (usesBackdrops) licenseLines.push('', stripLicenseComment(systemBackdropLicense));
  files.push({ name: 'LICENSES.txt', data: new TextEncoder().encode(licenseLines.join('\n') + '\n') });
  files.sort((a, b) => a.name.localeCompare(b.name));
  return { bytes: createStoredZip(files), files: files.map(file => file.name), filename: `sitecraft-${site.siteId}.zip` };
}
