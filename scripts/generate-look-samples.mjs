#!/usr/bin/env node
// Generates one site per look from a simulated materials pack through the real chat route:
// start 需求对齐 → answer the card (fixed look, recommended options elsewhere) → confirm.
// Used to prepare blind-review samples. Needs the dev server (default http://127.0.0.1:3034) and
// a configured DeepSeek key. Usage: node scripts/generate-look-samples.mjs [--pack industrial|export] [--out file]
import fs from "node:fs";

const origin = process.env.SITECRAFT_BASE || "http://127.0.0.1:3034";
const args = process.argv.slice(2);
const packId = args.includes("--pack") ? args[args.indexOf("--pack") + 1] : "industrial";
const out = args.includes("--out") ? args[args.indexOf("--out") + 1] : `artifacts/look-samples-${packId}.json`;
const looks = [
  { briefId: "industrial", templateId: "forge" },
  { briefId: "engineering-industrial", templateId: "screwfast" },
  { briefId: "export-catalog", templateId: "landwind" },
  { briefId: "technical-product", templateId: "tailwind-landing" },
];

async function sse(response) {
  const text = await response.text();
  const events = text.split("\n\n").map((chunk) => chunk.trim()).filter((line) => line.startsWith("data:"))
    .map((line) => JSON.parse(line.slice(5).trim()));
  const done = events.find((event) => event.type === "done");
  if (!done) throw new Error(`no done event (${response.status}): ${text.slice(0, 300)}`);
  return done;
}

async function chat(siteId, body) {
  const response = await fetch(`${origin}/api/sites/${siteId}/chat`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  return sse(response);
}

const { wrapCompanyMaterials, simulatedPacks } = await import("../lib/simulated-packs.ts");
const pack = simulatedPacks[packId];
if (!pack) throw new Error(`unknown pack ${packId}`);
const message = wrapCompanyMaterials(pack.body);

const results = [];
for (const look of looks) {
  const created = await fetch(`${origin}/api/sites`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "未命名站点", templateId: look.templateId, locales: ["zh", "en"] }),
  }).then((response) => response.json());
  const siteId = created.id;
  const started = await chat(siteId, { action: "start", message, baseRevision: created.draft.revision });
  const questions = started.questions ?? [];
  const selections = questions.map((question) => {
    if (question.field === "style") return { questionId: question.questionId, optionId: look.briefId };
    const recommended = question.options.find((option) => option.recommended) ?? question.options[0];
    return { questionId: question.questionId, optionId: recommended.id };
  });
  const submitted = await chat(siteId, {
    action: "select", conversationId: started.conversationId, questionId: started.questionId,
    questionRevision: started.questionRevision, selections,
  });
  if (!submitted.awaitingConfirmation) throw new Error(`${look.briefId}: no confirmation step (${submitted.status})`);
  const confirmed = await chat(siteId, {
    action: "confirm", conversationId: started.conversationId, questionId: submitted.questionId,
    questionRevision: submitted.questionRevision,
  });
  const draft = await fetch(`${origin}/api/sites/${siteId}/draft`, { cache: "no-store" }).then((response) => response.json());
  results.push({ look: look.briefId, siteId, status: confirmed.status, revision: draft.draft.revision, templateId: draft.draft.templateId, paletteId: draft.draft.paletteId, companyName: draft.draft.companyName });
  console.log(JSON.stringify(results.at(-1)));
}
fs.mkdirSync(out.replace(/\/[^/]+$/, ""), { recursive: true });
fs.writeFileSync(out, JSON.stringify(results, null, 2));
console.log(`wrote ${out}`);
