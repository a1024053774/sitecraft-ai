import assert from "node:assert/strict";
import test from "node:test";
import { defaultDraft, normalizeDraft, type SiteDraft } from "../lib/site-document.ts";
import {
  applySiteOperations,
  validateAIOperations,
  type SiteOperation,
} from "../lib/site-operations.ts";

const templateIds = new Set(["forge", "screwfast"]);
const options = { templateIds, lastChange: "catalog-sections" };

test("set_catalog_section writes industries, capabilities and certifications with undo", () => {
  const original = structuredClone(defaultDraft);
  const result = applySiteOperations(original, [
    {
      op: "set_catalog_section",
      section: "industries",
      value: {
        title: { zh: "应用行业", en: "Industries" },
        intro: { zh: "面向批量工况选型。", en: "For batch duty selection." },
        items: [
          { id: "ind-mining", title: { zh: "矿山输送", en: "Mining conveyors" }, body: { zh: "重载启停与连续输送。", en: "Heavy start-stop conveyors." } },
        ],
      },
    },
    {
      op: "set_catalog_section",
      section: "capabilities",
      value: {
        title: { zh: "加工能力", en: "Process capability" },
        intro: { zh: "主要设备与工序。", en: "Main equipment and process." },
        items: [
          { id: "cap-hob", title: { zh: "滚齿与磨齿", en: "Hobbing and grinding" }, body: { zh: "中硬齿面精加工。", en: "Medium-hard tooth finishing." } },
        ],
      },
    },
    {
      op: "set_catalog_section",
      section: "certifications",
      value: {
        title: { zh: "认证状态", en: "Certifications" },
        intro: { zh: "仅列资料中的认证。", en: "Only certifications from materials." },
        items: [
          {
            id: "cert-iso",
            title: { zh: "ISO 9001", en: "ISO 9001" },
            body: { zh: "质量管理体系，认证中。", en: "QMS, certification in progress." },
            status: "待补充",
          },
          {
            id: "cert-ce",
            title: { zh: "CE", en: "CE" },
            body: { zh: "资料未提供证书编号。", en: "Certificate number not provided." },
            status: "待补充",
          },
        ],
      },
    },
  ] as SiteOperation[], options);

  assert.equal(result.changed, true);
  assert.equal(result.draft.content.industries?.items.length, 1);
  assert.equal(result.draft.content.capabilities?.items[0].title.zh, "滚齿与磨齿");
  assert.equal(result.draft.content.certifications?.items[0].status, "待补充");
  assert.equal(result.draft.content.certifications?.items[0].body.zh.includes("认证中"), true);

  const undone = applySiteOperations(result.draft, result.inverseOperations, options);
  assert.equal(undone.draft.content.industries, undefined);
  assert.equal(undone.draft.content.capabilities, undefined);
  assert.equal(undone.draft.content.certifications, undefined);
});

test("old drafts without catalog sections open and keep those blocks absent", () => {
  const legacy = structuredClone(defaultDraft) as SiteDraft & {
    content: Record<string, unknown>;
  };
  delete legacy.content.industries;
  delete legacy.content.capabilities;
  delete legacy.content.certifications;
  const restored = normalizeDraft(legacy);
  assert.equal(restored.content.industries, undefined);
  assert.equal(restored.content.capabilities, undefined);
  assert.equal(restored.content.certifications, undefined);
  assert.equal(restored.content.hero.title.zh, defaultDraft.content.hero.title.zh);
});

test("certification and catalog card facts missing from materials become 待补充", () => {
  const materials = [
    "【公司资料】模拟。",
    "应用行业：矿山输送。",
    "加工能力：滚齿与磨齿。",
    "认证：ISO 9001 认证中；CE 待补充。",
  ].join("\n");
  const validated = validateAIOperations(materials, [{
    op: "set_catalog_section",
    section: "industries",
    value: {
      title: { zh: "应用行业", en: "Industries" },
      intro: { zh: "面向批量工况选型。", en: "For batch duty selection." },
      items: [
        { id: "ind-mining", title: { zh: "矿山输送", en: "Mining" }, body: { zh: "重载启停。", en: "Heavy duty." } },
        { id: "ind-fake", title: { zh: "航天卫星", en: "Satellites" }, body: { zh: "年产能 9000 台。", en: "9000 units/year." } },
      ],
    },
  }], templateIds);

  assert.equal(validated.operations.length, 1);
  const op = validated.operations[0];
  assert.equal(op.op, "set_catalog_section");
  if (op.op !== "set_catalog_section" || !op.value) throw new Error("expected set_catalog_section");
  assert.equal(op.value.items[0].title.zh, "矿山输送");
  assert.equal(op.value.items[1].body.zh, "待补充");
  assert.ok(validated.rejected.some((item) => /资料|待补充/.test(item)));
});
