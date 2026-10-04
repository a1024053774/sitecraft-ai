import assert from "node:assert/strict";
import test from "node:test";
import { blockCatalog } from "../lib/blocks/catalog.ts";
import { composedPageForTemplate } from "../lib/blocks/compose.ts";
import { blockFragments } from "../lib/blocks/fragments/index.ts";
import { iconDefinitionFor, iconIds } from "../lib/blocks/icon-registry.ts";
import type { SiteDraft } from "../lib/site-document.ts";
import { installPreviewBridge } from "../lib/template-adapters/preview-bridge.ts";
import { getTemplateAdapter } from "../lib/template-adapters/registry.ts";
import { parseHtmlDocument, parseHtmlFragment, visibleText, type HtmlElement } from "./fixtures/html-dom.ts";
import { packDraft, withLayouts } from "./fixtures/pack-drafts.ts";
import { base, openBrowser } from "./helpers/workspace-browser.ts";

// T-093: 联系方式「图标联系」(contact:icons). The split layout with a low-contrast icon in front of the
// email, phone and address lines and on the send button. The icons are mounted by the block at fixed
// places from the icon registry; the draft only supplies the text. A contact line with no value is
// hidden together with its icon and leaves no empty slot; every icon has its text beside it.

const text = (node: Parameters<typeof visibleText>[0] | null | undefined) => (node ? visibleText(node).replace(/\s+/g, " ").trim() : "");
const LINES = ["email", "phone", "address"] as const;

function withContact(contact: { email?: string; phone?: string; address?: string }, variant: string | null = "icons", templateId?: string): SiteDraft {
  const draft = withLayouts(packDraft("molding"), variant ? { contact: variant } : {});
  draft.content.contact = { ...draft.content.contact, email: contact.email ?? "待补充", phone: contact.phone ?? "待补充", address: { zh: contact.address ?? "待补充", en: contact.address ? "1 Example Road, Shanghai" : "To be provided" } } as typeof draft.content.contact;
  return (templateId ? { ...draft, templateId } : draft) as SiteDraft;
}

function render(draft: unknown, locale: "zh" | "en" = "zh") {
  const html = composedPageForTemplate("screwfast");
  assert.ok(html);
  const adapter = getTemplateAdapter("screwfast");
  assert.ok(adapter?.blocks);
  const document = parseHtmlDocument(html);
  const globalObject: Record<string, unknown> = { document, parent: { postMessage() {} }, addEventListener() {} };
  globalObject.window = globalObject;
  installPreviewBridge(globalObject, "screwfast", adapter).applyDeclaredContent(draft, locale, [], "published");
  const entities = document.querySelectorAll('[data-sc-block="contact"]');
  assert.equal(entities.length, 1);
  return entities[0];
}

const hidden = (node: HtmlElement) => node.hidden === true || node.hasAttribute("hidden") || /display:\s*none/.test(node.getAttribute("style") ?? "");

test("图标联系 is in the catalog and declares every slot of the text layout plus the address line", () => {
  const spec = blockCatalog.contact.variants.icons;
  assert.ok(spec, "contact:icons missing from the catalog");
  assert.equal(spec.label, "图标联系");
  const split = blockCatalog.contact.variants.split;
  for (const slot of split.slots) assert.ok(spec.slots.some((own) => own.target === slot.target && own.selector === slot.selector), `${slot.target} is declared by both layouts`);
  assert.deepEqual(spec.slots.filter((own) => !split.slots.some((slot) => slot.target === own.target)).map((own) => own.target), ["contact.address"]);
  assert.deepEqual(spec.markers, split.markers);
  assert.ok(blockFragments.contact.variants.icons, "contact:icons has no markup");
  assert.ok(getTemplateAdapter("screwfast")?.blocks?.variants.contact.includes("icons"));
});

test("图标联系 mounts one registered icon per contact line and one on the send button, each beside its text", () => {
  const fragment = parseHtmlFragment(blockFragments.contact.variants.icons);
  assert.equal(fragment.children.length, 1);
  assert.equal(fragment.children[0].getAttribute("data-sc-variant"), "icons");
  const icons = fragment.querySelectorAll("[data-sitecraft-icon]");
  assert.deepEqual(icons.map((icon) => icon.getAttribute("data-sitecraft-icon")), ["contact-email", "contact-phone", "contact-address", "contact-submit"]);
  for (const icon of icons) {
    assert.ok(iconIds.includes(icon.getAttribute("data-sitecraft-icon") as never), "a registered id");
    assert.equal(icon.getAttribute("aria-hidden"), "true", "decorative: the text carries the meaning");
  }
  for (const concept of LINES) {
    const value = fragment.querySelectorAll(`[data-sitecraft-contact="${concept}"]`);
    assert.equal(value.length, 1, `${concept} value is declared once`);
    const line = value[0].closest("[data-sitecraft-line]");
    assert.ok(line, `${concept} sits in a hideable line`);
    assert.equal(line.querySelectorAll("[data-sitecraft-icon]").length, 1, `${concept}: exactly one icon in its line`);
    assert.equal(line.querySelector("[data-sitecraft-icon]")?.getAttribute("data-sitecraft-icon"), `contact-${concept}`);
    assert.ok(line.querySelector(`[data-sitecraft-ui="${concept}Prefix"]`), `${concept}: its label text is beside the icon`);
  }
  const button = fragment.querySelector('button[type="submit"]');
  assert.ok(button?.querySelector('[data-sitecraft-icon="contact-submit"]'));
  assert.equal(button?.getAttribute("data-sitecraft-ui"), null, "the label lives in a span so the bridge's label write cannot wipe the icon");
  assert.ok(button?.querySelector('span[data-sitecraft-ui="submit"]'));
});

test("every icon in the block is the registry's own geometry: nothing hand-written, nothing from the draft", () => {
  const fragment = parseHtmlFragment(blockFragments.contact.variants.icons);
  const icons = fragment.querySelectorAll("[data-sitecraft-icon]");
  assert.equal(icons.length, 4);
  for (const icon of icons) {
    const id = icon.getAttribute("data-sitecraft-icon") as string;
    const definition = iconDefinitionFor(id);
    assert.equal((icon.getAttribute("viewBox") ?? icon.getAttribute("viewbox")), definition.viewBox);
    assert.equal(icon.getAttribute("stroke-width"), String(definition.strokeWidth));
    assert.equal(icon.getAttribute("stroke-linecap"), definition.lineCap, "round caps in this batch");
    assert.ok(["16", "20"].includes(icon.getAttribute("width") as string), "an allowed size");
    const expectedPaths = definition.paths.filter((shape) => shape.kind === "path").map((shape) => (shape as { d: string }).d);
    assert.deepEqual(icon.querySelectorAll("path").map((node) => node.getAttribute("d")), expectedPaths, `${id}: the same path data as the registry`);
    assert.equal(icon.children.length, definition.paths.length, `${id}: the same number of shapes as the registry`);
  }
  assert.doesNotMatch(blockFragments.contact.variants.icons, /https?:|xlink|<script|\burl\(/i);
});

test("a contact line without a value is hidden with its icon, and the others keep theirs", () => {
  for (const [label, contact, shown] of [
    ["all three", { email: "a@b.test", phone: "+86 21 5555 0100", address: "上海市宝山区示例路 1 号" }, ["email", "phone", "address"]],
    ["email only", { email: "a@b.test" }, ["email"]],
    ["phone and address", { phone: "+86 21 5555 0100", address: "上海市宝山区示例路 1 号" }, ["phone", "address"]],
    ["none", {}, []],
  ] as const) {
    const block = render(withContact(contact));
    assert.equal(block.getAttribute("data-sc-variant"), "icons");
    for (const concept of LINES) {
      const line = block.querySelector(`[data-sitecraft-contact="${concept}"]`)!.closest("[data-sitecraft-line]")!;
      assert.equal(hidden(line), !(shown as readonly string[]).includes(concept), `${label}: the ${concept} line (and so its icon) is ${(shown as readonly string[]).includes(concept) ? "shown" : "hidden"}`);
    }
    const visibleIcons = block.querySelectorAll(".sitecraft-inquiry-lines [data-sitecraft-icon]").filter((icon) => !hidden(icon.closest("[data-sitecraft-line]") as HtmlElement));
    assert.deepEqual(visibleIcons.map((icon) => icon.getAttribute("data-sitecraft-icon")), shown.map((concept) => `contact-${concept}`), `${label}: one visible icon per visible line`);
    assert.doesNotMatch(text(block), /待补充|To be provided/);
  }
});

test("the icon layout and the text layout address the same contact targets", () => {
  const contact = { email: "a@b.test", phone: "+86 21 5555 0100", address: "上海市宝山区示例路 1 号" };
  const slots = (variant: string) => render(withContact(contact, variant)).querySelectorAll("[data-sitecraft-slot]").map((node) => node.getAttribute("data-sitecraft-slot") as string).filter((slot) => slot.startsWith("contact."));
  const textSlots = slots("split");
  const iconSlots = slots("icons");
  for (const slot of textSlots) assert.ok(iconSlots.includes(slot), `${slot} is on the icon layout too`);
  assert.deepEqual(iconSlots.filter((slot) => !textSlots.includes(slot)), ["contact.address.zh"], "the only extra target is the address line");
  assert.equal(new Set(iconSlots).size, iconSlots.length, "one node per target");
});

test("图标联系 on two looks: icons are small and quieter than the text, nothing overflows at 1440, 768 and 375", async () => {
  const browser = await openBrowser();
  const { targetId } = await browser.send("Target.createTarget", { url: "about:blank" }) as { targetId: string };
  const { sessionId } = await browser.send("Target.attachToTarget", { targetId, flatten: true }) as { sessionId: string };
  try {
    await browser.send("Page.enable", {}, sessionId);
    await browser.send("Runtime.enable", {}, sessionId);
    for (const templateId of ["screwfast", "landwind"]) {
      await browser.send("Page.navigate", { url: `${base}/api/templates/${templateId}/preview?contact-icons=${Date.now()}` }, sessionId);
      for (let waited = 0; waited < 30000; waited += 100) {
        if (await browser.eval<boolean>("document.readyState === 'complete' && typeof window.__sitecraftApplyDeclared === 'function'", sessionId).catch(() => false)) break;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      for (const contact of [{ email: "inquiry@example-molding.test", phone: "+86 21 5555 0100", address: "上海市宝山区示例路 1 号示例工业园 3 号厂房 2 层" }, { email: "inquiry-with-a-very-long-name@example-molding-industries.test" }]) {
        const draft = withContact(contact, "icons", templateId);
        for (const width of [1440, 768, 375]) {
          await browser.send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width < 500 }, sessionId);
          await browser.eval(`window.__sitecraftApplyDeclared(${JSON.stringify(draft)}, "zh", [], "published", null, false)`, sessionId);
          const result = await browser.eval<{ variant: string; pageWidth: number; viewport: number; outside: string[]; icons: Array<{ w: number; h: number; iconColor: string; valueColor: string; textLeft: number; iconRight: number }> }>(`(() => {
            const block = document.querySelector('[data-sc-block="contact"]');
            const vw = innerWidth;
            const outside = [...block.querySelectorAll('*')].filter((el) => !el.classList.contains('honeypot')).filter((el) => { const r = el.getBoundingClientRect(); return r.width > 1 && (r.right > vw + 1 || r.left < -1); }).map((el) => String(el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className || el.tagName));
            const icons = [...block.querySelectorAll('.sitecraft-inquiry-lines [data-sitecraft-icon]')].filter((icon) => icon.getBoundingClientRect().width > 0).map((icon) => { const line = icon.closest('[data-sitecraft-line]'); const label = line.querySelector('[data-sitecraft-ui]'); const r = icon.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), iconColor: getComputedStyle(icon).color, valueColor: getComputedStyle(line.querySelector('[data-sitecraft-contact]')).color, textLeft: Math.round(label.getBoundingClientRect().left), iconRight: Math.round(r.right) }; });
            return { variant: block.getAttribute('data-sc-variant'), pageWidth: document.documentElement.scrollWidth, viewport: vw, outside, icons };
          })()`, sessionId);
          const where = `${templateId} ${Object.keys(contact).length} lines @${width}`;
          assert.equal(result.variant, "icons", where);
          assert.ok(result.pageWidth <= result.viewport + 1, `${where}: page scrolls sideways`);
          assert.deepEqual(result.outside, [], `${where}: nodes outside the viewport`);
          assert.equal(result.icons.length, Object.keys(contact).length, `${where}: one icon per visible line`);
          for (const icon of result.icons) {
            assert.equal(icon.w, 20, `${where}: 20px icon`);
            assert.equal(icon.h, 20);
            assert.notEqual(icon.iconColor, icon.valueColor, `${where}: the icon is quieter than the value text`);
            assert.ok(icon.textLeft >= icon.iconRight, `${where}: the label text sits beside the icon, not under it`);
          }
        }
      }
    }
  } finally {
    await browser.send("Target.closeTarget", { targetId }).catch(() => {});
    try { browser.ws.send(JSON.stringify({ id: browser.id++, method: "Browser.close" })); } catch {}
    browser.ws.close();
  }
});
