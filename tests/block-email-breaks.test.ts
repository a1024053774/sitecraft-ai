import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { contactFragment, footerFragment } from "../lib/blocks/fragments/contact.ts";
import { installPreviewBridge } from "../lib/template-adapters/preview-bridge.ts";
import { getTemplateAdapter } from "../lib/template-adapters/registry.ts";
import { cssRules } from "./fixtures/css-rules.ts";
import { HtmlDocument, parseHtmlDocument, parseHtmlFragment } from "./fixtures/html-dom.ts";
import { servedHomeHtml } from "./fixtures/look-pages.ts";
import { packDraft, withLayouts } from "./fixtures/pack-drafts.ts";

// T-053: a contact email on a block-library page wraps only at the @. Left alone, a browser
// breaks it after a hyphen (inquiry@p3i- / sim.test in the phone footer). The bridge writes a
// word joiner (U+2060) after each hyphen and a zero-width space on both sides of the @; a part
// wider than its line still breaks (overflow-wrap: anywhere) instead of running out. The draft,
// the mailto link and a visitor's copy keep the address as written.

const Z = "\u200b";
const J = "\u2060";
const EMAIL_SLOTS = '[data-sitecraft-contact="email"], [data-sitecraft-contact="footer-email"]';

function render(templateId: string, draft: unknown, locale = "zh"): HtmlDocument {
  const adapter = getTemplateAdapter(templateId);
  assert.ok(adapter, templateId);
  const document = parseHtmlDocument(servedHomeHtml(templateId));
  const globalObject: Record<string, unknown> = { document, parent: { postMessage() {} }, addEventListener() {} };
  globalObject.window = globalObject;
  installPreviewBridge(globalObject, templateId, adapter).applyDeclaredContent(draft, locale, [], "published");
  return document;
}

const shownEmails = (document: HtmlDocument) => document.querySelectorAll(EMAIL_SLOTS).map((node) => node.textContent);

test("the contact and footer email break only at the @ on block-library pages", () => {
  const draft = packDraft("industrial");
  const expected = `inquiry${Z}@${Z}p3i-${J}sim.test`;
  assert.deepEqual(shownEmails(render("screwfast", draft)), [expected, expected]);
  assert.deepEqual(shownEmails(render("screwfast", draft, "en")), [expected, expected]);
  assert.deepEqual(shownEmails(render("screwfast", withLayouts(draft, { contact: "band" }))), [expected, expected]);
  const other = structuredClone(draft);
  other.content.contact.email = "sales-cn@xin-zhou.example.com";
  const otherShown = `sales-${J}cn${Z}@${Z}xin-${J}zhou.example.com`;
  assert.deepEqual(shownEmails(render("screwfast", other)), [otherShown, otherShown]);
  assert.equal(draft.content.contact.email, "inquiry@p3i-sim.test", "the draft keeps the address as written");
});

// The model often writes the address into a sentence ("规格发到 catalog@p3e-sim.test，…"); it wraps
// the same way there: at the @, not after the hyphen (seen on a P3E page at 1440, 2026-09-30).
test("an email inside a sentence also breaks only at its @", () => {
  const draft = packDraft("export");
  draft.content.contact.body = { zh: "把接头规格与批量数量发到 catalog@p3e-sim.test，交期在批量确认后回复。", en: "Send specifications to catalog@p3e-sim.test; lead time follows." };
  draft.content.faq.items[0] = { ...draft.content.faq.items[0], title: { zh: "图纸发到哪里？", en: "Where do drawings go?" }, body: { zh: "图纸请发到 rfq-cn@p3e-sim.test 或 catalog@p3e-sim.test。", en: "Send drawings to rfq-cn@p3e-sim.test." } };
  const bodyOf = (document: HtmlDocument, key: string) => document.querySelector(`[data-sitecraft-benchmark="${key}"]`)?.textContent;
  const zh = render("screwfast", draft);
  assert.equal(bodyOf(zh, "contact-body"), `把接头规格与批量数量发到 catalog${Z}@${Z}p3e-${J}sim.test，交期在批量确认后回复。`);
  assert.equal(bodyOf(zh, "faq-item-0-body"), `图纸请发到 rfq-${J}cn${Z}@${Z}p3e-${J}sim.test 或 catalog${Z}@${Z}p3e-${J}sim.test。`);
  assert.equal(bodyOf(zh, "faq-item-0-title"), "图纸发到哪里？", "text without an email is written as is");
  assert.equal(bodyOf(render("screwfast", draft, "en"), "contact-body"), `Send specifications to catalog${Z}@${Z}p3e-${J}sim.test; lead time follows.`);
  for (const templateId of ["forge", "landwind", "tailwind-landing"]) {
    const selector = getTemplateAdapter(templateId)?.slots.find((slot) => slot.target === "contact.body")?.selector;
    assert.ok(selector, `${templateId} declares the contact body`);
    const shown = render(templateId, draft).querySelector(selector)?.textContent;
    assert.equal(shown, `把接头规格与批量数量发到 catalog${Z}@${Z}p3e-${J}sim.test，交期在批量确认后回复。`, `${templateId} uses block email breaks`);
  }
  assert.equal(draft.content.contact.body.zh, "把接头规格与批量数量发到 catalog@p3e-sim.test，交期在批量确认后回复。", "the draft keeps the sentence as written");
});

test("copying an email from the page gives the address without the break marks", () => {
  const copy = (templateId: string, selected: string) => {
    const adapter = getTemplateAdapter(templateId);
    assert.ok(adapter);
    const document = parseHtmlDocument(servedHomeHtml(templateId));
    const globalObject: Record<string, unknown> = { document, parent: { postMessage() {} }, addEventListener() {}, getSelection: () => ({ toString: () => selected }) };
    globalObject.window = globalObject;
    installPreviewBridge(globalObject, templateId, adapter);
    const listener = document.listeners.find((item) => item.type === "copy");
    const written: Array<[string, string]> = [];
    let prevented = false;
    const event = { clipboardData: { setData: (type: string, value: string) => written.push([type, value]) }, preventDefault: () => { prevented = true; } };
    if (listener) (listener.fn as (event: unknown) => void)(event);
    return { written, prevented };
  };
  assert.deepEqual(copy("screwfast", `邮箱：inquiry${Z}@${Z}p3i-${J}sim.test`), { written: [["text/plain", "邮箱：inquiry@p3i-sim.test"]], prevented: true });
  assert.deepEqual(copy("screwfast", `p3i-${J}sim.test`), { written: [["text/plain", "p3i-sim.test"]], prevented: true }, "a selection with only the word joiner");
});

test("an email part wider than its line still breaks instead of running out", () => {
  // overflow-wrap is inherited: each email slot sits in (or is) an element whose rule allows it.
  const rules = [...cssRules(contactFragment.css), ...cssRules(footerFragment.css)];
  const anywhere = (selector: string) => {
    const rule = rules.find((item) => item.context === "" && item.selector === selector);
    assert.ok(rule, `a rule for ${selector}`);
    assert.ok(rule.declarations.includes("overflow-wrap: anywhere"), `${selector}: ${rule.declarations.join("; ")}`);
  };
  const split = parseHtmlFragment(contactFragment.variants.split).querySelector('[data-sitecraft-contact="email"]');
  const splitLine = split?.parentElement;
  assert.ok(split && splitLine, "左右布局: the email sits in a contact line");
  assert.ok(splitLine.closest(".sitecraft-inquiry-lines"), "左右布局: the email is a contact line value");
  assert.equal(splitLine.children.at(-1), split, "左右布局: the value is the last span of its line");
  anywhere(".sitecraft-inquiry-lines li > span:last-child");
  const band = parseHtmlFragment(contactFragment.variants.band).querySelector('[data-sitecraft-contact="email"]');
  assert.equal(band?.localName, "dd");
  assert.ok(band.closest(".sitecraft-band-line"), "联系条: the email is a band cell value");
  anywhere(".sitecraft-band-line dd");
  const footer = parseHtmlFragment(footerFragment.variants.columns).querySelector('[data-sitecraft-contact="footer-email"]');
  assert.ok(footer?.closest(".sitecraft-footer-contact"), "footer: the email sits in the contact column");
  anywhere(".sitecraft-footer-contact");
});

test("check-published fails a page whose email wraps at a hyphen or inside a name", () => {
  const check = readFileSync(new URL("../scripts/check-published.mjs", import.meta.url), "utf8");
  assert.ok(check.includes('["email", "an email address wraps at a hyphen or inside a name instead of at the @"]'));
  const scan = readFileSync(new URL("../scripts/visitor-text-fit-scan.js", import.meta.url), "utf8");
  assert.match(scan, /add\("email"/, "the in-page scan reports emails that wrap in the wrong place");
});
