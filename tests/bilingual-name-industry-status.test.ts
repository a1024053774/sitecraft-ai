import assert from "node:assert/strict";
import test from "node:test";
import { defaultDraft } from "../lib/site-document.ts";
import { applySiteOperations, validateAIOperations } from "../lib/site-operations.ts";
import { getTemplateAdapter } from "../lib/template-adapters/index.ts";
import { installPreviewBridge } from "../lib/template-adapters/preview-bridge.ts";
import { createDocument, createNode, visibleText } from "./fixtures/fake-dom.ts";

// T-037: the company name is the one written in the materials (never a model translation), a gap
// never replaces the neutral name, industry is per-language, and certification status is localized.

const templateIds = new Set(["forge", "screwfast", "landwind", "tailwind-landing"]);
const options = { templateIds, lastChange: "t037" };
const P3I = [
  "【公司资料】资料性质：模拟。",
  "公司名：忻州重载减速机P3I",
  "行业：工业制造 / 重载减速机",
].join("\n");

function applyFromModel(message: string, operations: unknown[]) {
  const validated = validateAIOperations(message, operations as never, templateIds);
  return { ...applySiteOperations(structuredClone(defaultDraft), validated.operations, options), rejected: validated.rejected };
}

test("a Chinese company name from the materials is kept, not the model's English translation", () => {
  const result = applyFromModel(P3I, [
    { op: "set_text", target: "companyName", value: { zh: "忻州重载减速机P3I", en: "Xinzhou Heavy-Duty Gearbox P3I" } },
    { op: "set_text", target: "siteName", value: { zh: "忻州重载减速机P3I", en: "Xinzhou Heavy-Duty Gearbox P3I" } },
  ]);
  assert.equal(result.draft.companyName, "忻州重载减速机P3I");
  assert.equal(result.draft.siteName, "忻州重载减速机P3I");
});

test("an English company name written in the materials is kept", () => {
  const result = applyFromModel("Company: Acme Fittings Ltd.\nWe make hydraulic fittings.", [
    { op: "set_text", target: "companyName", value: { zh: "阿克米管件", en: "Acme Fittings Ltd." } },
  ]);
  assert.equal(result.draft.companyName, "Acme Fittings Ltd.");
});

test("a missing company name never replaces the neutral name with To be provided", () => {
  const result = applyFromModel("我们做重载减速机，想做官网。", [
    { op: "set_text", target: "companyName", value: { zh: "待补充", en: "To be provided" } },
    { op: "set_text", target: "siteName", value: "To be provided" },
  ]);
  assert.equal(result.draft.companyName, defaultDraft.companyName);
  assert.equal(result.draft.siteName, defaultDraft.siteName);
  assert.ok(result.rejected.length >= 2);
});

function renderEyebrowAndCert(draft: typeof defaultDraft, locale: "zh" | "en") {
  const adapter = getTemplateAdapter("screwfast");
  assert.ok(adapter);
  const { document, body } = createDocument();
  const eyebrow = createNode("p");
  eyebrow.setAttribute("data-sitecraft-optional", "industry");
  const certifications = createNode("section");
  certifications.setAttribute("data-sitecraft-section", "certifications");
  const grid = createNode("div");
  grid.setAttribute("data-sitecraft-catalog-grid", "certifications");
  certifications.appendChild(grid);
  body.appendChild(eyebrow);
  body.appendChild(certifications);
  const globalObject: Record<string, unknown> = { document, parent: { postMessage() {} }, addEventListener() {} };
  globalObject.window = globalObject;
  installPreviewBridge(globalObject, "screwfast", adapter).applyDeclaredContent(structuredClone(draft), locale, [], "published");
  return { eyebrow: eyebrow.hidden ? "" : visibleText(eyebrow).trim(), certs: visibleText(grid) };
}

test("industry shows Chinese on the Chinese page and English on the English page", () => {
  const result = applyFromModel(P3I, [
    { op: "set_text", target: "industry", value: { zh: "工业制造 / 重载减速机", en: "Industrial manufacturing / heavy-duty gearboxes" } },
  ]);
  assert.equal(renderEyebrowAndCert(result.draft, "zh").eyebrow, "工业制造 / 重载减速机");
  assert.equal(renderEyebrowAndCert(result.draft, "en").eyebrow, "Industrial manufacturing / heavy-duty gearboxes");
  const undone = applySiteOperations(result.draft, result.inverseOperations, options).draft;
  assert.deepEqual(undone.industry, defaultDraft.industry);
});

test("a new draft has no industry fact, and an old single-language industry still shows", () => {
  assert.equal(renderEyebrowAndCert(defaultDraft, "zh").eyebrow, "");
  assert.equal(renderEyebrowAndCert(defaultDraft, "en").eyebrow, "");
  const legacy = structuredClone(defaultDraft) as typeof defaultDraft & { industry: unknown };
  legacy.industry = "减速机";
  assert.equal(renderEyebrowAndCert(legacy as typeof defaultDraft, "zh").eyebrow, "减速机");
});

test("certification status is shown in the page language", () => {
  const draft = structuredClone(defaultDraft) as typeof defaultDraft & { content: Record<string, unknown> };
  (draft.content as Record<string, unknown>).certifications = {
    items: [
      { id: "iso", title: { zh: "ISO 9001", en: "ISO 9001" }, body: { zh: "质量管理体系", en: "Quality management" }, status: "认证中" },
      { id: "ce", title: { zh: "CE", en: "CE" }, body: { zh: "欧盟符合性", en: "EU conformity" }, status: "已有" },
    ],
  };
  const zh = renderEyebrowAndCert(draft, "zh").certs;
  const en = renderEyebrowAndCert(draft, "en").certs;
  assert.match(zh, /认证中/);
  assert.match(zh, /已有/);
  assert.match(en, /In progress/);
  assert.match(en, /Certified/);
  assert.doesNotMatch(en, /[\u4e00-\u9fff]/, `English page still has Chinese: ${en}`);
});
