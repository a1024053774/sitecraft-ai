import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { englishSiteCode, renderSiteCode, type CodeSiteRecord, type CodeVersion, type SiteCode } from './code-site.ts';
import { listSiteImages, readSiteImage, type SiteImageRecord } from './site-images.ts';
import { systemBackdrops, systemBackdropLicense } from './code-site-backdrops.ts';
import { systemIconLicense } from './code-site-icons.ts';

type ZipEntry = { name: string; data: Uint8Array };
type ExportAsset = { url: string; file: string };

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

function assetName(originalName: string, index: number, used: Set<string>) {
  const basename = path.posix.basename(originalName).replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || `image-${index + 1}`;
  const dot = basename.lastIndexOf('.');
  const stem = dot > 0 ? basename.slice(0, dot) : basename;
  const ext = dot > 0 ? basename.slice(dot) : '';
  let name = `assets/images/${stem}${ext}`;
  let suffix = 2;
  while (used.has(name)) name = `assets/images/${stem}-${suffix++}${ext}`;
  used.add(name); return name;
}
function relative(from: string, to: string) {
  const result = path.posix.relative(path.posix.dirname(from), to);
  return result || path.posix.basename(to);
}
function fileFor(language: 'zh' | 'en', pageId: string) {
  const name = pageId === 'home' ? 'index.html' : `${pageId}.html`;
  return language === 'en' ? `en/${name}` : name;
}
function stripLicenseComment(value: string) { return value.replace(/^<!--\s*|\s*-->$/g, '').trim(); }

function imageCredits(images: SiteImageRecord[]) {
  return images.map(image => image.attribution).filter(Boolean);
}

function collectBackdropUrls(code: SiteCode) {
  const source = code.css + code.header + code.footer + code.pages.map(page => page.html).join('');
  return [...new Set(Object.values(systemBackdrops).flatMap(entry => Object.values(entry.urls)).filter(url => source.includes(url) || source.includes(`data-system-backdrop="${Object.entries(systemBackdrops).find(([, candidate]) => Object.values(candidate.urls).includes(url))?.[0]}"`)))];
}

export async function buildStaticSitePackage(site: CodeSiteRecord, version: CodeVersion) {
  const languages: Array<{ language: 'zh' | 'en'; code: SiteCode }> = [{ language: 'zh', code: version.code }];
  const english = englishSiteCode(site, version);
  if (english) languages.push({ language: 'en', code: english });
  const source = languages.map(item => item.code).flatMap(code => [code.css, code.header, code.footer, ...code.pages.map(page => page.html)]).join('');
  const imageIds = [...new Set(source.match(/img_[a-z0-9]{16,40}/g) || [])];
  const records = (await listSiteImages(site.siteId)).filter(record => imageIds.includes(record.imageId));
  if (records.length !== imageIds.length) throw new Error('当前版本引用的图片无法完整读取，导出已停止。');
  const byId = new Map(records.map(record => [record.imageId, record]));
  const names = new Set<string>(), imageAssets = new Map<string, ExportAsset>();
  const files: ZipEntry[] = [];
  for (const [index, id] of imageIds.entries()) {
    const record = byId.get(id)!;
    const loaded = await readSiteImage(site.siteId, id);
    if (!loaded) throw new Error(`当前版本引用的图片无法读取：${id}`);
    const file = assetName(record.originalName, index, names);
    imageAssets.set(id, { url: `/api/sites/${site.siteId}/images/${id}`, file });
    files.push({ name: file, data: loaded.bytes });
  }
  const backdropUrls = [...new Set(languages.flatMap(item => collectBackdropUrls(item.code)))];
  const backdropAssets = new Map<string, ExportAsset>();
  for (const url of backdropUrls) {
    const basename = path.posix.basename(url);
    const file = `assets/system-backdrops/${basename}`;
    const sourcePath = path.join(process.cwd(), 'public', url.replace(/^\//, ''));
    backdropAssets.set(url, { url, file });
    files.push({ name: file, data: new Uint8Array(await readFile(sourcePath)) });
  }
  const usesIcons = /data-system-icon="[^\"]+"/.test(source);
  const usesBackdrops = backdropUrls.length > 0;
  const assetUrl = (currentFile: string) => (url: string) => {
    const asset = imageAssets.get((url.match(/(img_[a-z0-9]{16,40})$/i) || [])[1]) ?? backdropAssets.get(url);
    return asset ? relative(currentFile, asset.file) : url;
  };
  const rendered: ZipEntry[] = [];
  for (const item of languages) for (const page of item.code.pages) {
    const currentFile = fileFor(item.language, page.id);
    const pageHref = (target: string, hash: string) => `${relative(currentFile, fileFor(item.language, target))}${hash}`;
    const languageLinks = english ? {
      zh: relative(currentFile, fileFor('zh', page.id)),
      en: relative(currentFile, fileFor('en', page.id)),
    } : undefined;
    const html = renderSiteCode(site.siteId, item.code, page.id, '', imageCredits(records), undefined, {
      language: item.language, languageLinks, pageHref, assetUrl: assetUrl(currentFile), stylesheetHref: relative(currentFile, 'styles.css'), stripInternalAttributes: true,
    });
    rendered.push({ name: currentFile, data: new TextEncoder().encode(html) });
  }
  files.push(...rendered);
  files.push({ name: 'styles.css', data: new TextEncoder().encode(itemCss(version.code.css, assetUrl('styles.css'))) });
  const licenseLines = ['SiteCraft static site package licenses', '', 'Images included in this package:'];
  if (!records.length) licenseLines.push('- None');
  for (const record of records) {
    const asset = imageAssets.get(record.imageId)!;
    licenseLines.push(`- ${asset.file} · ${record.originalName}`, `  Attribution: ${record.attribution}`, `  License: ${record.license}`);
    if (record.source === 'public-material') licenseLines.push(`  Source: ${record.sourceUrl}`);
    if (record.licenseUrl) licenseLines.push(`  License URL: ${record.licenseUrl}`);
  }
  if (usesIcons) licenseLines.push('', stripLicenseComment(systemIconLicense));
  if (usesBackdrops) licenseLines.push('', stripLicenseComment(systemBackdropLicense));
  files.push({ name: 'LICENSES.txt', data: new TextEncoder().encode(licenseLines.join('\n') + '\n') });
  files.sort((a, b) => a.name.localeCompare(b.name));
  return { bytes: createStoredZip(files), files: files.map(file => file.name), filename: `sitecraft-${site.siteId}.zip` };
}

function itemCss(css: string, asset: (url: string) => string) {
  return css.replace(/url\(\s*(["']?)(\/system-backdrops\/[^"')\s]+)\1\s*\)/gi, (_all, _quote: string, url: string) => `url("${asset(url)}")`);
}
