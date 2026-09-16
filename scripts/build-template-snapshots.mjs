#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PNPM = ["npx", "--yes", "pnpm@9.15.9"];

const PASS_ENV = [
  "PATH",
  "HOME",
  "USER",
  "LOGNAME",
  "LANG",
  "LC_ALL",
  "LC_CTYPE",
  "TERM",
  "TMPDIR",
  "TMP",
  "TEMP",
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "NO_PROXY",
  "http_proxy",
  "https_proxy",
  "no_proxy",
  "npm_config_cache",
  "npm_config_registry",
  "NPM_CONFIG_CACHE",
  "PNPM_HOME",
  "XDG_CACHE_HOME",
  "XDG_CONFIG_HOME",
  "SSL_CERT_FILE",
  "NODE_EXTRA_CA_CERTS",
];

/** @typedef {"snapshot" | "static-source" | "inspect-spa"} TemplateMode */

/** @type {Record<string, {
 *   dir: string;
 *   expectedSha: string;
 *   runtime: string;
 *   mode: TemplateMode;
 *   lockfile: string | null;
 *   install: string[] | null;
 *   build: string[] | null;
 * }>} */
const ALLOWLIST = {
  screwfast: {
    dir: "vendor/open-source-templates/screwfast",
    expectedSha: "b47bd042bfd9556046fc10993ab47d8e25217892",
    runtime: "astro-static",
    mode: "snapshot",
    lockfile: "pnpm-lock.yaml",
    install: [...PNPM, "install", "--frozen-lockfile"],
    build: [...PNPM, "run", "build"],
  },
  fresh: {
    dir: "vendor/open-source-templates/fresh",
    expectedSha: "435abd4e78d9a2936866a14028d4f109d45470a3",
    runtime: "astro-static",
    mode: "snapshot",
    lockfile: "pnpm-lock.yaml",
    install: [...PNPM, "install", "--frozen-lockfile"],
    build: [...PNPM, "run", "build"],
  },
  "nextjs-landing": {
    dir: "vendor/open-source-templates/nextjs-landing",
    expectedSha: "cd6694e6c69efad1128c1ed732188389182789df",
    runtime: "next-static",
    mode: "snapshot",
    lockfile: "package-lock.json",
    install: ["npm", "ci"],
    build: ["npm", "run", "build"],
  },
  "shadcn-landing2": {
    dir: "vendor/open-source-templates/shadcn-landing2",
    expectedSha: "ec8e18e8ed56ed6636023ced09948515c19258cc",
    runtime: "next-static",
    mode: "snapshot",
    lockfile: "package-lock.json",
    install: ["npm", "ci"],
    build: ["npm", "run", "build"],
  },
  forge: {
    dir: "vendor/open-source-templates/small-bis",
    expectedSha: "f85328e72cefe20750f14e4990fe36b28bce2830",
    runtime: "astro-static",
    mode: "snapshot",
    lockfile: "package-lock.json",
    install: ["npm", "ci"],
    build: ["npm", "run", "build"],
  },
  "tailwind-landing": {
    dir: "vendor/open-source-templates/tailwind-landing",
    expectedSha: "545f89eb26e0997d7cdd15fe77dda35df73e575a",
    runtime: "static-html",
    mode: "static-source",
    lockfile: null,
    install: null,
    build: null,
  },
  "shadcn-landing": {
    dir: "vendor/open-source-templates/shadcn-landing",
    expectedSha: "ae3716dbce5c8a26815222bb743994b5717938f1",
    runtime: "spa-bundle",
    mode: "inspect-spa",
    lockfile: "package-lock.json",
    install: ["npm", "ci"],
    build: ["npm", "run", "build"],
  },
};

function childEnv() {
  const env = {};
  for (const key of PASS_ENV) {
    if (process.env[key]) env[key] = process.env[key];
  }
  env.CI = "1";
  env.HUSKY = "0";
  env.npm_config_fund = "false";
  env.npm_config_audit = "false";
  env.npm_config_update_notifier = "false";
  return env;
}

function spawnExit(result) {
  if (result.error) return 1;
  if (result.signal) return 1;
  if (typeof result.status === "number") return result.status;
  return 1;
}

function run(command, cwd) {
  const started = Date.now();
  const result = spawnSync(command[0], command.slice(1), {
    cwd,
    env: childEnv(),
    encoding: "utf8",
    timeout: 20 * 60 * 1000,
    maxBuffer: 8 * 1024 * 1024,
  });
  const output = `${result.stdout || ""}${result.stderr || ""}`.trim();
  return {
    command: command.join(" "),
    exit: spawnExit(result),
    ms: Date.now() - started,
    output: output.slice(-8000),
    error: result.error ? String(result.error.message) : null,
    signal: result.signal || null,
  };
}

function gitStdout(args, cwd = ROOT) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (spawnExit(result) !== 0) return "";
  return (result.stdout || "").trim();
}

function gitlinkSha(relDir) {
  const line = gitStdout(["ls-files", "-s", "--", relDir]);
  const match = line.match(/^[0-7]+\s+([0-9a-f]{40})/);
  return match ? match[1] : "";
}

function trackedSourceDirty(abs) {
  return gitStdout(["status", "--porcelain", "--untracked-files=no"], abs);
}

const EMPTY_MOUNT = /<(?:div|main)([^>]*\bid=["'](?:root|app|__next)["'][^>]*)>(\s*)<\/(?:div|main)>/i;

export function isSpaShellHtml(html) {
  const withoutComments = html.replace(/<!--[\s\S]*?-->/g, "");
  const withoutAssets = withoutComments
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<link\b[^>]*>/gi, "")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, "");
  const bodyMatch = withoutAssets.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  const body = bodyMatch ? bodyMatch[1] : withoutAssets;
  const text = body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const hasHeading = /<h[1-6]\b[^>]*>\s*\S/i.test(body);
  if (hasHeading && text.length >= 20) return false;
  if (EMPTY_MOUNT.test(body) && text.length < 80) return true;
  return text.length < 40 && /<(?:div|main)[^>]*id=["'](?:root|app|__next)["']/i.test(body);
}

export function isUsableStaticHtml(html) {
  if (!/<(?:!doctype\s+html|html\b)/i.test(html)) return false;
  if (isSpaShellHtml(html)) return false;
  const withoutComments = html.replace(/<!--[\s\S]*?-->/g, "");
  const withoutAssets = withoutComments
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<link\b[^>]*>/gi, "")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, "")
    .replace(/<title\b[^>]*>[\s\S]*?<\/title>/gi, "");
  const bodyMatch = withoutAssets.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  const body = bodyMatch ? bodyMatch[1] : withoutAssets;
  const text = body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return text.length >= 40;
}

function collectRefs(html) {
  const refs = [];
  const attr = /\b(?:src|href)=["']([^"']+)["']/gi;
  let match;
  while ((match = attr.exec(html))) refs.push(match[1]);
  const srcset = /\bsrcset=["']([^"']+)["']/gi;
  while ((match = srcset.exec(html))) {
    for (const part of match[1].split(",")) {
      const url = part.trim().split(/\s+/)[0];
      if (url) refs.push(url);
    }
  }
  return refs;
}

function classifyRef(value) {
  const url = value.trim().replace(/^\\'/, "").replace(/\\'$/, "").replace(/^\\"/, "").replace(/\\"$/, "");
  if (!url || url.startsWith("#") || url.startsWith("data:") || url.startsWith("mailto:") || url.startsWith("tel:") || url.startsWith("javascript:")) {
    return { kind: "skip", url };
  }
  if (url.startsWith("//") || /^https?:/i.test(url)) return { kind: "remote", url };
  return { kind: "local", url };
}

function localPath(root, fromDir, url) {
  const clean = url.split("#")[0].split("?")[0].replace(/\\/g, "");
  if (!clean || clean === "/") return null;
  if (clean.startsWith("/")) return path.resolve(root, clean.replace(/^\/+/, ""));
  return path.resolve(fromDir, clean);
}

function inspectAssets(root, html) {
  const remote = [];
  const missing = [];
  const local = [];
  const seen = new Set();
  const cssFiles = [];
  const refs = [...collectRefs(html)];
  const quotedUrl = /\burl\(\s*\\?['"](\/[^'"]+)\\?['"]\s*\)/gi;
  let quotedMatch;
  while ((quotedMatch = quotedUrl.exec(html))) refs.push(quotedMatch[1]);
  for (const raw of refs) {
    const { kind, url } = classifyRef(raw);
    if (kind === "skip" || seen.has(url)) continue;
    seen.add(url);
    if (kind === "remote") {
      remote.push(url);
      continue;
    }
    const filePath = localPath(root, root, url);
    if (!filePath) continue;
    if (!/[.][a-z0-9]{1,8}$/i.test(filePath.split("?")[0]) && !filePath.includes(`${path.sep}_astro${path.sep}`)) continue;
    if (!filePath.startsWith(root)) {
      missing.push(url);
      continue;
    }
    if (!existsSync(filePath)) missing.push(url);
    else {
      local.push(url);
      if (/\.css$/i.test(url.split("?")[0])) cssFiles.push(filePath);
    }
  }
  for (const cssPath of cssFiles) {
    const css = readFileSync(cssPath, "utf8");
    const urlRe = /url\((['"]?)([^'")]+)\1\)/gi;
    let match;
    while ((match = urlRe.exec(css))) {
      const { kind, url } = classifyRef(match[2]);
      if (kind === "skip" || seen.has(url)) continue;
      seen.add(url);
      if (kind === "remote") {
        remote.push(url);
        continue;
      }
      const filePath = localPath(root, path.dirname(cssPath), url);
      if (!filePath) continue;
      if (!existsSync(filePath)) missing.push(url);
      else local.push(url);
    }
  }
  return { remote, missing, local };
}

function findSnapshot(sourceRoot) {
  let first = null;
  for (const rel of ["dist", "out", "."]) {
    const root = rel === "." ? sourceRoot : path.join(sourceRoot, rel);
    const indexPath = path.join(root, "index.html");
    if (!existsSync(indexPath)) continue;
    const html = readFileSync(indexPath, "utf8");
    const candidate = {
      root,
      rel: rel === "." ? "source" : rel,
      html,
      usable: isUsableStaticHtml(html),
      spaShell: isSpaShellHtml(html),
    };
    if (!first) first = candidate;
    if (candidate.usable) return candidate;
  }
  return first;
}

function sourceInspection(abs) {
  const snapshot = findSnapshot(abs);
  if (!snapshot) return { result: "none", loaderWouldServe: false, output: null };
  return {
    result: snapshot.usable ? "rendered" : snapshot.spaShell ? "spa-shell" : "unusable-html",
    loaderWouldServe: snapshot.usable,
    output: path.relative(ROOT, snapshot.root),
  };
}

function nextConfigHasExport(sourceRoot) {
  const files = ["next.config.js", "next.config.mjs", "next.config.ts"];
  for (const name of files) {
    const full = path.join(sourceRoot, name);
    if (!existsSync(full)) continue;
    if (/output:\s*['"]export['"]/.test(readFileSync(full, "utf8"))) return true;
  }
  return false;
}

function nextExportHint(sourceRoot) {
  const files = ["next.config.js", "next.config.mjs", "next.config.ts"];
  for (const name of files) {
    const full = path.join(sourceRoot, name);
    if (!existsSync(full)) continue;
    return `BLOCKED: ${name} has no output: 'export'. next build writes .next, not out/index.html. Fixed snapshots for this template require a source config change (output: 'export' and images.unoptimized: true). Not applied. GET/static loader cannot serve it.`;
  }
  return "BLOCKED: Next static export HTML was not found under out/ or dist/. GET/static loader cannot serve it.";
}

function applyAssetReport(report, snapshot) {
  report.output = path.relative(ROOT, snapshot.root);
  const assets = inspectAssets(snapshot.root, snapshot.html);
  const cssRemote = assets.remote.some((url) => /\.css(\?|$)/i.test(url) || /fonts\.googleapis|fontsource/i.test(url));
  const fontsRemote = assets.remote.some((url) => /font/i.test(url));
  const localCss = assets.local.some((url) => /\.css(\?|$)/i.test(url));
  report.assets = {
    cssImagesFontsLocal: assets.missing.length === 0 && localCss && !cssRemote && !fontsRemote,
    missingLocal: assets.missing,
    remote: assets.remote.slice(0, 20),
  };
  if (assets.remote.length) {
    report.networkOrLicense.push(`HTML/CSS references ${assets.remote.length} remote URL(s); first: ${assets.remote[0]}`);
  }
  return assets;
}

function printReport(report) {
  console.log(JSON.stringify(report, null, 2));
}

function failCommand(report, step, ran) {
  report.result = "failed";
  report.exit = ran.exit || 1;
  report.limitation = `${step} failed (exit ${ran.exit}${ran.signal ? `, signal ${ran.signal}` : ""}): ${ran.error || ran.output.slice(-400)}`;
  report.sourceInspection = sourceInspection(path.join(ROOT, report.dir));
  return report;
}

function buildOne(id) {
  const spec = ALLOWLIST[id];
  console.error(`\n==> ${id} (${spec.runtime}, ${spec.dir})`);
  const abs = path.join(ROOT, spec.dir);
  const report = {
    id,
    runtime: spec.runtime,
    mode: spec.mode,
    dir: spec.dir,
    expectedSha: spec.expectedSha,
    sha: null,
    lockfile: spec.lockfile,
    install: spec.install ? spec.install.join(" ") : null,
    build: spec.build ? spec.build.join(" ") : null,
    output: null,
    exit: 0,
    result: "pending",
    loaderWouldServe: false,
    sourceInspection: null,
    assets: { cssImagesFontsLocal: false, missingLocal: [], remote: [] },
    networkOrLicense: [],
    limitation: null,
    commands: [],
  };

  if (!existsSync(abs)) {
    report.result = "failed";
    report.exit = 1;
    report.limitation = `missing checkout ${spec.dir}`;
    return report;
  }

  const sha = gitStdout(["rev-parse", "HEAD"], abs);
  const parentSha = gitlinkSha(spec.dir);
  report.sha = sha;
  if (sha !== spec.expectedSha || (parentSha && parentSha !== spec.expectedSha)) {
    report.result = "failed";
    report.exit = 1;
    report.limitation = `SHA mismatch checkout=${sha || "unknown"} gitlink=${parentSha || "unknown"} expected=${spec.expectedSha}; not a fixed-source snapshot`;
    return report;
  }

  const dirty = trackedSourceDirty(abs);
  if (dirty) {
    report.result = "failed";
    report.exit = 1;
    report.limitation = `tracked source is dirty; refusing to claim fixed-source reproducibility:\n${dirty}`;
    return report;
  }

  if (spec.lockfile && !existsSync(path.join(abs, spec.lockfile))) {
    report.result = "failed";
    report.exit = 1;
    report.limitation = `expected lockfile ${spec.lockfile} is missing; install was not run`;
    return report;
  }
  if (!spec.lockfile && spec.install) {
    report.limitation = "no lockfile; install is not allowlisted without one";
  }

  if (spec.runtime === "next-static" && !nextConfigHasExport(abs)) {
    report.result = "blocked";
    report.exit = 1;
    report.loaderWouldServe = false;
    report.sourceInspection = sourceInspection(abs);
    report.limitation = nextExportHint(abs);
    console.error("    blocked: next.config has no output: 'export'; install/build not run");
    return report;
  }

  if (spec.install) {
    console.error(`    install: ${spec.install.join(" ")}`);
    const installed = run(spec.install, abs);
    report.commands.push(installed);
    console.error(`    install exit ${installed.exit} (${installed.ms}ms)`);
    if (installed.exit !== 0) return failCommand(report, "install", installed);
  }

  if (spec.build) {
    console.error(`    build: ${spec.build.join(" ")}`);
    const built = run(spec.build, abs);
    report.commands.push(built);
    console.error(`    build exit ${built.exit} (${built.ms}ms)`);
    if (built.exit !== 0) return failCommand(report, "build", built);
  }

  const snapshot = findSnapshot(abs);
  report.sourceInspection = sourceInspection(abs);
  if (!snapshot) {
    const nextOnly = spec.runtime === "next-static" && existsSync(path.join(abs, ".next"));
    report.result = nextOnly || spec.runtime === "next-static" ? "blocked" : "failed";
    report.exit = 1;
    report.limitation = nextOnly || spec.runtime === "next-static"
      ? `${nextExportHint(abs)}${nextOnly ? " Found .next only, not a static HTML export." : ""}`
      : "no dist/index.html, out/index.html, or source index.html after the allowlisted command";
    return report;
  }

  const assets = applyAssetReport(report, snapshot);

  if (snapshot.spaShell || !snapshot.usable) {
    report.loaderWouldServe = false;
    if (spec.mode === "inspect-spa") {
      report.result = "spa-shell";
      report.exit = 0;
      report.limitation = "Vite SPA index is a mount shell; GET/static loader must not serve it as a rendered snapshot";
      return report;
    }
    if (spec.runtime === "next-static") {
      report.result = "blocked";
      report.exit = 1;
      report.limitation = nextExportHint(abs);
      return report;
    }
    report.result = "failed";
    report.exit = 1;
    report.limitation = snapshot.spaShell ? "index.html is an SPA shell, not a rendered snapshot" : "index.html is not meaningful rendered HTML";
    return report;
  }

  report.loaderWouldServe = true;
  report.result = spec.mode === "static-source" ? "static-source" : "snapshot-ready";
  if (assets.missing.length) {
    report.result = "verify-failed";
    report.exit = 1;
    report.loaderWouldServe = true;
    report.limitation = `rendered HTML exists but missing local assets: ${assets.missing.slice(0, 8).join(", ")}`;
  }
  return report;
}

function main() {
  const requested = process.argv.slice(2);
  if (requested.length === 0) {
    console.error(`usage: node scripts/build-template-snapshots.mjs <ids...>\nallowlisted: ${Object.keys(ALLOWLIST).join(" ")}`);
    process.exit(2);
  }

  const unknown = requested.filter((id) => !ALLOWLIST[id]);
  if (unknown.length) {
    console.error(`not allowlisted: ${unknown.join(", ")}`);
    process.exit(2);
  }

  const reports = requested.map((id) => buildOne(id));
  printReport({ ok: reports.every((item) => item.exit === 0), reports });
  process.exit(reports.every((item) => item.exit === 0) ? 0 : 1);
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) main();
