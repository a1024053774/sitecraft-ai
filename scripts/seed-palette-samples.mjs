#!/usr/bin/env node
/**
 * Seeds one sample site per (look, colour set) pair for palette review, copying the content of a
 * source draft and switching look and colour set through the whitelisted operations only:
 * replace_draft (content) → set_visual_brief (look) → set_palette (colour set).
 *
 *   node scripts/seed-palette-samples.mjs [sourceSiteId] [prefix-set ...]
 *
 * Defaults: source overlay-p3i-thick-20260925 and two colour sets per look. Prints the site ids, which
 * can be passed straight to scripts/check-published.mjs. Needs the dev server on 127.0.0.1:3034.
 */
const BASE = process.env.SITECRAFT_BASE || "http://127.0.0.1:3034";
const LOOKS = { industrial: "industrial", engineering: "engineering-industrial", export: "export-catalog", technical: "technical-product" };
const DEFAULT_PAIRS = [
  "industrial-porcelain", "industrial-morandi",
  "engineering-warm-orange", "engineering-patina",
  "export-porcelain", "export-turquoise",
  "technical-graphite", "technical-warm-orange",
];

const [source = "overlay-p3i-thick-20260925", ...pairArgs] = process.argv.slice(2);
const pairs = pairArgs.length ? pairArgs : DEFAULT_PAIRS;

async function readDraft(siteId) {
  const response = await fetch(`${BASE}/api/sites/${siteId}/draft`);
  if (!response.ok) throw new Error(`read ${siteId}: ${response.status}`);
  const payload = await response.json();
  return payload.draft ?? payload;
}

async function commit(siteId, baseRevision, operations, summary) {
  const response = await fetch(`${BASE}/api/sites/${siteId}/draft`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ baseRevision, operations, summary, source: "template" }),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(`commit ${siteId}: ${response.status} ${JSON.stringify(payload).slice(0, 300)}`);
  return (payload.draft ?? payload).revision;
}

const content = await readDraft(source);
for (const pair of pairs) {
  const prefix = pair.split("-")[0];
  const briefId = LOOKS[prefix];
  if (!briefId) throw new Error(`unknown look prefix in ${pair}`);
  const siteId = `palette-sample-${pair}`;
  let revision = (await readDraft(siteId)).revision;
  revision = await commit(siteId, revision, [{ op: "replace_draft", draft: { ...content, revision } }], `色板样板：复制 ${source} 的内容`);
  revision = await commit(siteId, revision, [{ op: "set_visual_brief", briefId }], `色板样板：样子 ${briefId}`);
  revision = await commit(siteId, revision, [{ op: "set_palette", paletteId: pair }], `色板样板：色彩集 ${pair}`);
  const check = await readDraft(siteId);
  if (check.paletteId !== pair || check.visualBrief.id !== briefId) throw new Error(`${siteId} ended with ${check.visualBrief.id}/${check.paletteId}`);
  console.log(siteId);
}
