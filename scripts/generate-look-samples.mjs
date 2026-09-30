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

const results = [];

function writeReport() {
  fs.mkdirSync(out.replace(/\/[^/]+$/, ""), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(results, null, 2));
}

function detail(payload) {
  return {
    code: payload?.code ?? "(no code)",
    error: payload?.error ?? "(no error)",
    userMessage: payload?.userMessage ?? null,
  };
}

function failStep(look, step, siteId, conversationId, payload, reason) {
  const fields = detail(payload);
  const record = {
    look: look.briefId,
    siteId: siteId ?? null,
    conversationId: conversationId ?? payload?.conversationId ?? null,
    step,
    status: payload?.status ?? "error",
    code: payload?.code ?? null,
    error: payload?.error ?? null,
    userMessage: payload?.userMessage ?? null,
    reason,
  };
  results.push(record);
  writeReport();
  console.log(JSON.stringify(record));
  const where = `${look.briefId}: ${reason}; site ${record.siteId}; conversation ${record.conversationId}; step ${step}; code ${fields.code}; error ${fields.error}`;
  const userMessage = fields.userMessage ? `; userMessage ${fields.userMessage}` : "";
  throw new Error(`${where}${userMessage}`);
}

async function sse(response, context) {
  const text = await response.text();
  let events;
  try {
    events = text.split("\n\n").map((chunk) => chunk.trim()).filter((line) => line.startsWith("data:"))
      .map((line) => JSON.parse(line.slice(5).trim()));
  } catch (parseError) {
    failStep(context.look, context.step, context.siteId, context.conversationId, {
      status: "error",
      code: "(no code)",
      error: `SSE parse failed (${response.status}): ${parseError.message}`,
    }, `${context.step} failed`);
  }
  const done = events.find((event) => event.type === "done");
  if (!done) {
    failStep(context.look, context.step, context.siteId, context.conversationId, {
      status: "error",
      code: "(no code)",
      error: `no done event (${response.status}): ${text.slice(0, 300)}`,
    }, `${context.step} failed`);
  }
  return done;
}

async function chat(siteId, body, look, step) {
  const response = await fetch(`${origin}/api/sites/${siteId}/chat`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const done = await sse(response, { look, step, siteId, conversationId: body.conversationId ?? null });
  if (done.status === "error") failStep(look, step, siteId, done.conversationId ?? body.conversationId, done, `${step} failed`);
  return done;
}

const { wrapCompanyMaterials, simulatedPacks } = await import("../lib/simulated-packs.ts");
const pack = simulatedPacks[packId];
if (!pack) throw new Error(`unknown pack ${packId}; code (no code); error unknown pack`);
const message = wrapCompanyMaterials(pack.body);

for (const look of looks) {
  const created = await fetch(`${origin}/api/sites`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "未命名站点", templateId: look.templateId, locales: ["zh", "en"] }),
  }).then((response) => response.json());
  if (!created.id || created.status === "error") failStep(look, "create", created.id ?? null, null, created, "create failed");
  const siteId = created.id;
  const started = await chat(siteId, { action: "start", message, baseRevision: created.draft.revision }, look, "start");
  const questions = Array.isArray(started.questions) ? started.questions : null;
  if (!questions) failStep(look, "start", siteId, started.conversationId, started, "start failed");
  const selections = questions.map((question) => {
    if (question.field === "style") return { questionId: question.questionId, optionId: look.briefId };
    const recommended = question.options.find((option) => option.recommended) ?? question.options[0];
    return { questionId: question.questionId, optionId: recommended.id };
  });
  const submitted = await chat(siteId, {
    action: "select", conversationId: started.conversationId, questionId: started.questionId,
    questionRevision: started.questionRevision, selections,
  }, look, "select");
  if (!submitted.awaitingConfirmation) {
    failStep(look, "select", siteId, submitted.conversationId ?? started.conversationId, submitted, `no confirmation step (${submitted.status})`);
  }
  const confirmed = await chat(siteId, {
    action: "confirm", conversationId: started.conversationId, questionId: submitted.questionId,
    questionRevision: submitted.questionRevision,
  }, look, "confirm");
  const draft = await fetch(`${origin}/api/sites/${siteId}/draft`, { cache: "no-store" }).then((response) => response.json());
  if (draft.status === "error" || !draft.draft) failStep(look, "draft", siteId, started.conversationId, draft, "draft failed");
  results.push({ look: look.briefId, siteId, conversationId: started.conversationId, status: confirmed.status, revision: draft.draft.revision, templateId: draft.draft.templateId, paletteId: draft.draft.paletteId, companyName: draft.draft.companyName });
  console.log(JSON.stringify(results.at(-1)));
}
writeReport();
console.log(`wrote ${out}`);
