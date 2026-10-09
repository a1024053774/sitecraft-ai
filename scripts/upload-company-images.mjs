#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const fixtureRoot = path.join(repoRoot, "tests", "fixtures", "company-images");
const allowedPacks = new Set(["industrial", "export", "molding"]);

function usage(message) {
  if (message) console.error(`错误：${message}\n`);
  console.error([
    "用法：node scripts/upload-company-images.mjs --pack <industrial|export|molding> [选项]",
    "",
    "无 --site-id 时，脚本会先 POST /api/sites 新建一个站点；给出 --site-id 时复用指定站点。",
    "选项：",
    "  --base-url <url>       默认 http://127.0.0.1:3071",
    "  --site-id <id>         上传到已经存在的站点，不创建新站点",
    "  --name <name>          新建站点的名称",
    "  --help",
  ].join("\n"));
  process.exit(message ? 2 : 0);
}

function parseArgs(argv) {
  const args = { baseUrl: "http://127.0.0.1:3071" };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help") usage();
    if (arg === "--pack" || arg === "--base-url" || arg === "--site-id" || arg === "--name") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) usage(`${arg} 缺少值`);
      const key = arg.slice(2).replaceAll("-", "");
      args[key === "baseurl" ? "baseUrl" : key === "siteid" ? "siteId" : key] = value;
      index += 1;
      continue;
    }
    usage(`未知参数 ${arg}`);
  }
  if (!args.pack || !allowedPacks.has(args.pack)) usage("--pack 必须是 industrial、export 或 molding");
  return args;
}

function jsonHeaders() {
  return { "Content-Type": "application/json", Accept: "application/json" };
}

async function readJson(response, label) {
  const text = await response.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`${label} 返回了非 JSON（HTTP ${response.status}）：${text.slice(0, 240)}`);
  }
  if (!response.ok) {
    throw new Error(`${label} 失败（HTTP ${response.status}）：${JSON.stringify(payload)}`);
  }
  return payload;
}

function gitSha() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { cwd: repoRoot, encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

function now() {
  return new Date().toISOString();
}

function normalizedLicense(image) {
  if (image.apiLicense && ["CC0", "Public Domain", "CC BY", "CC BY-SA"].includes(image.apiLicense)) return image.apiLicense;
  if (image.license.startsWith("CC0")) return "CC0";
  if (image.license.toLowerCase().startsWith("public domain")) return "Public Domain";
  if (image.license.startsWith("CC BY-SA")) return "CC BY-SA";
  if (image.license.startsWith("CC BY")) return "CC BY";
  throw new Error(`${image.file} 的许可证无法映射到图片上传接口：${image.license}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const baseUrl = args.baseUrl.replace(/\/$/, "");
  const manifestPath = path.join(fixtureRoot, args.pack, "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  if (manifest.pack !== args.pack || !Array.isArray(manifest.images) || manifest.images.length < 6 || manifest.images.length > 10) {
    throw new Error(`manifest 不符合 T-106 约束：${manifestPath}`);
  }
  for (const image of manifest.images) {
    if (!["product", "equipment", "facility", "inspection"].includes(image.category)) throw new Error(`${image.file} 缺少有效类别`);
    if (!image.sourceUrl || !image.licenseUrl || !image.author || !image.attribution || !image.downloadedAt) throw new Error(`${image.file} 缺少来源、许可、作者、署名或下载时间`);
    await readFile(path.join(fixtureRoot, args.pack, image.file));
  }

  const command = process.argv.map((token) => token.includes(" ") ? JSON.stringify(token) : token).join(" ");
  console.log(`SHA=${gitSha()} | command=${command} | time=${now()}`);

  let siteId = args.siteId;
  let created = false;
  if (!siteId) {
    const name = args.name || `T-106 ${manifest.packLabel}图片验证`;
    const response = await fetch(`${baseUrl}/api/sites`, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ name }),
    });
    const payload = await readJson(response, "创建站点");
    siteId = payload.id;
    created = true;
    console.log(`SITE_CREATED id=${siteId} name=${JSON.stringify(name)}`);
  } else {
    console.log(`SITE_REUSED id=${siteId}`);
  }

  const uploaded = [];
  for (const image of manifest.images) {
    const bytes = await readFile(path.join(fixtureRoot, args.pack, image.file));
    const form = new FormData();
    form.append("file", new Blob([bytes], { type: "image/jpeg" }), image.file);
    form.set("license", normalizedLicense(image));
    form.set("sourceUrl", image.sourceUrl);
    form.set("licenseUrl", image.licenseUrl);
    form.set("author", image.author);
    form.set("attribution", image.attribution);
    form.set("usageScope", image.usageScope || "current-site-only");
    form.set("usageCategory", image.category);
    form.set("retrievedAt", image.downloadedAt);
    const response = await fetch(`${baseUrl}/api/sites/${encodeURIComponent(siteId)}/images`, { method: "POST", body: form });
    const payload = await readJson(response, `上传 ${image.file}`);
    if (!payload?.ok || !payload.image?.imageId) throw new Error(`上传 ${image.file} 返回缺少 imageId`);
    uploaded.push(payload.image);
    console.log(`UPLOADED file=${image.file} imageId=${payload.image.imageId} license=${payload.image.license} bytes=${payload.image.byteLength}`);
  }

  const listResponse = await fetch(`${baseUrl}/api/sites/${encodeURIComponent(siteId)}/images`, { headers: { Accept: "application/json" } });
  const listed = await readJson(listResponse, "列出站点图片");
  const names = new Set((listed.images || []).map((image) => image.originalName));
  const missing = manifest.images.map((image) => image.file).filter((file) => !names.has(file));
  if (missing.length || (listed.images || []).length < uploaded.length) {
    throw new Error(`上传后回读不完整：expected=${uploaded.length} listed=${(listed.images || []).length} missing=${missing.join(",")}`);
  }
  console.log(`VERIFY_PASS pack=${args.pack} siteId=${siteId} created=${created} uploaded=${uploaded.length} listed=${listed.images.length}`);
}

main().catch((error) => {
  console.error(`RESULT FAIL ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
