import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { defaultDraft } from "../lib/site-document.ts";
import { composedPageForTemplate } from "../lib/blocks/compose.ts";
import { getTemplateAdapter } from "../lib/template-adapters/registry.ts";
import { installPreviewBridge } from "../lib/template-adapters/preview-bridge.ts";
import { expectedFacts, missingFacts } from "../scripts/published-facts.mjs";
import { parseHtmlDocument } from "./fixtures/html-dom.ts";

// Failure cases: exact/terminal-punctuation repeats, a real extra fact, case/internal-space
// differences, ambiguous hosts, losing a source link, and reporting a field without a DOM landing.
const text = (zh: string, en: string) => ({ zh, en });
const entries = [
  { id: "exact", title: text("来料检验", "Incoming inspection"), body: text("来料检验", "Incoming inspection") },
  { id: "punctuation", title: text("全尺寸检测", "Dimensional inspection"), body: text("全尺寸检测。", "Dimensional inspection.") },
  { id: "different", title: text("过程巡检", "Patrol inspection"), body: text("每 2 小时抽检并记录。", "Sample every 2 hours and record it.") },
  { id: "case", title: text("检验 A", "Inspect A"), body: text("检验 a", "Inspect a") },
  { id: "space", title: text("尺寸 检验", "Inspect dimensions"), body: text("尺寸  检验", "Inspect  dimensions") },
  { id: "question", title: text("检验", "Inspect"), body: text("检验？", "Inspect?") },
  { id: "exclamation", title: text("检查", "Check"), body: text("检查！", "Check!") },
  { id: "range", title: text("范围 2–4 mm", "Range 2–4 mm"), body: text("范围 2-4 mm", "Range 2-4 mm") },
  { id: "model", title: text("型号 A.1", "Model A.1"), body: text("型号 A1", "Model A1") },
  { id: "unit", title: text("扭矩 N·m", "Torque N·m"), body: text("扭矩 Nm", "Torque Nm") },
  { id: "trim", title: text(" 首件检查 ", " First article check "), body: text("\t首件检查。\n", "\tFirst article check.\n") },
  { id: "ellipsis", title: text("范围说明", "Range note"), body: text("范围说明……", "Range note...") },
];

function render(templateId: string, locale: string, qualityVariant = "rows", images: unknown[] = []) {
  const draft = {
    ...structuredClone(defaultDraft), templateId,
    visualBrief: { ...structuredClone(defaultDraft.visualBrief), id: getTemplateAdapter(templateId)?.kit?.familyId },
    blockVariants: { qualityProcess: qualityVariant },
    content: { ...structuredClone(defaultDraft.content), capabilities: { title: text("加工能力", "Capabilities"), intro: text("待补充", "To be provided"), items: entries }, qualityProcess: entries },
  };
  const html = composedPageForTemplate(templateId);
  const adapter = getTemplateAdapter(templateId);
  assert.ok(html && adapter);
  const document = parseHtmlDocument(html);
  const globalObject: Record<string, unknown> = { document, parent: { postMessage() {} }, addEventListener() {} };
  globalObject.window = globalObject;
  const targets = ["capabilities", "qualityProcess"].flatMap(key => entries.flatMap(item => ["title", "body"].map(field => `${key}.items.${item.id}.${field}.${locale}`)));
  const report = installPreviewBridge(globalObject, templateId, adapter).applyDeclaredContent(draft, locale, targets, "published", undefined, true, images as never);
  return { document, report, draft };
}

test("T-113 list and quality entries show repeated copy once with two real field landings", () => {
  for (const template of ["screwfast", "forge", "landwind", "tailwind-landing"]) {
    for (const variant of ["rows", "checklist", "flow"]) for (const locale of ["zh", "en"]) {
      const { document, report } = render(template, locale, variant);
      for (const key of ["capabilities", "qualityProcess"]) for (const item of entries) {
        const titleTarget = `${key}.items.${item.id}.title.${locale}`;
        const bodyTarget = `${key}.items.${item.id}.body.${locale}`;
        const title = document.querySelector(`[data-sitecraft-slot="${titleTarget}"]`);
        const body = document.querySelector(`[data-sitecraft-slot="${bodyTarget}"]`);
        assert.ok(title && body, `${template}/${variant}/${locale}/${item.id} keeps both DOM landings`);
        assert.ok(report.appliedSlots.includes(titleTarget) && report.appliedSlots.includes(bodyTarget));
        const row = title.closest("article");
        assert.ok(row);
        const repeated = ["exact", "punctuation", "trim"].includes(item.id);
        assert.equal(row.querySelectorAll("p").length, repeated ? 0 : 1, `${template}/${variant}/${locale}/${item.id} copy count`);
        if (repeated) {
          assert.equal(body.closest("h3"), title, "the shared, visible heading represents both fields");
          assert.equal(row.textContent, item.title[locale as "zh" | "en"]);
        } else assert.equal(body.textContent, item.body[locale as "zh" | "en"]);
      }
      assert.deepEqual(report.missingSlots, []);
    }
  }
});

test("T-113 fact checking retains original title/body obligations and detects loss after display merging", () => {
  for (const locale of ["zh", "en"] as const) {
    const { draft } = render("screwfast", locale);
    const facts = expectedFacts(draft, locale).filter((fact: { kind: string }) => /^(capabilities|quality process)/.test(fact.kind));
    assert.equal(facts.length, 48, "twelve title/body pairs in each of two sections remain forty-eight obligations");
    assert.equal(facts.filter((fact: { text: string }) => fact.text === entries[1].body[locale]).length, 2, "original punctuated bodies remain in the evidence");
    const readable = entries.map(item => [item.title[locale], ["exact", "punctuation", "trim"].includes(item.id) ? "" : item.body[locale]].join(" ")).join("\n");
    assert.deepEqual(missingFacts(facts, readable), [], "a shared title proves the precisely repeated body");
    assert.equal(missingFacts(facts, readable.replace(entries[1].title[locale], "")).length, 4, "losing the shared text fails both fields in both sections");
    assert.equal(missingFacts(facts, readable.replace(entries[2].body[locale], "")).length, 2, "a different explanation is still required");
    assert.equal(missingFacts([{ kind: "capabilities body", text: entries[1].body[locale] }], entries[1].title[locale]).length, 1, "ordinary facts do not acquire punctuation tolerance without a repeated pair");
  }
});

test("T-113 image credits occupy an independent region and keep each original author, licence and link", () => {
  const images = [
    { imageId: "one", url: "/one.jpg", usageCategory: "inspection", credit: text("Author A / CC BY-SA / 来源一 / JPEG re-encoded/resized (modified from source).", "Author A / CC BY-SA / Source one / JPEG re-encoded/resized (modified from source)."), author: "Author A", license: "CC BY-SA", sourceUrl: "https://example.test/one" },
    { imageId: "two", url: "/two.jpg", usageCategory: "inspection", credit: text("Author B / CC BY / 来源二", "Author B / CC BY / Source two"), author: "Author B", license: "CC BY", sourceUrl: "https://example.test/two" },
    { imageId: "three", url: "/three.jpg", usageCategory: "inspection", credit: text("Author A / CC BY-SA / 来源一 / JPEG re-encoded/resized (modified from source).", "Author A / CC BY-SA / Source one / JPEG re-encoded/resized (modified from source)."), author: "Author A", license: "CC BY-SA", sourceUrl: "https://example.test/three" },
  ];
  for (const template of ["screwfast", "forge", "landwind", "tailwind-landing"]) for (const locale of ["zh", "en"]) {
    const { document, report } = render(template, locale, "rows", images);
    const host = document.querySelector("[data-sitecraft-image-credits]");
    assert.ok(host && !host.hidden);
    assert.equal(host.parentElement?.className, "sitecraft-container", "credits are separate from the footer navigation/contact layout");
    assert.equal(host.querySelectorAll("li").length, 3, "credits are individually listed; equal attribution cannot swallow a different original source");
    for (const image of images) {
      const link = host.querySelectorAll("a").find(node => (node as unknown as { href: string }).href === image.sourceUrl);
      assert.ok(link, "original source remains clickable");
      const item = link.closest("li");
      assert.ok(item?.textContent.includes(image.author) && item.textContent.includes(image.license));
      assert.ok(item?.textContent.includes(image.credit[locale as "zh" | "en"]), "the entire supplied credit, including modification statements, stays visible");
    }
    assert.ok(report.appliedSlots.includes("images.credits"));
  }
});

test("T-113 screenshot evidence rejects a clipped footer, incomplete geometry and a development badge", () => {
  const source = readFileSync("scripts/check-published.mjs", "utf8");
  const start = source.indexOf("function screenshotFailures(");
  assert.ok(start >= 0, "the real capture path needs a screenshot completeness gate");
  const end = source.indexOf("\n}", start) + 2;
  const check = new Function(`${source.slice(start, end)}; return screenshotFailures;`)();
  const complete = { width: 375, pageHeight: 6306, frameTop: 0, frameHeight: 6306, frameDocumentHeight: 6306, footerBottom: 6305.5, pngWidth: 375, pngHeight: 6306, devIndicatorVisible: false };
  assert.deepEqual(check(complete), []);
  assert.ok(check({ ...complete, pngHeight: 6241 }).some((failure: string) => /incomplete|clipped/.test(failure)), "the reproduced B capture must fail at its old height");
  assert.ok(check({ ...complete, frameHeight: 6241 }).some((failure: string) => /incomplete|clipped/.test(failure)), "a full outer PNG cannot prove an internally clipped iframe");
  assert.ok(check({ ...complete, footerBottom: 6400 }).length, "the footer must lie inside the captured bitmap");
  assert.ok(check({ ...complete, footerBottom: undefined }).length, "unmeasured bottom is incomplete evidence");
  assert.ok(check({ ...complete, devIndicatorVisible: true }).some((failure: string) => /development/.test(failure)));
});
