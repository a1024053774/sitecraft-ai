import type { Locale } from "../site-model.ts";
import type { TemplateManifest, TemplateContentTarget, TemplateSlotBinding, TemplateNonContentSlot, TemplateUiSurface } from "./types.ts";

/**
 * 每模板 manifest 共享构建件：types（经 ./types 再导出）+ 常量 + contentSlots 工厂。
 * 每模板 manifest 数据放 lib/template-manifests/<id>.ts，import 本模块拼装。
 */

export const ALL_UI_SURFACES = ["navigation", "faq", "form", "footer"] as const satisfies readonly TemplateUiSurface[];
export const BOTH_LOCALES = ["zh", "en"] as const satisfies readonly Locale[];

export const NON_CONTENT_SLOTS: readonly TemplateNonContentSlot[] = [
  {
    target: "brand.logo",
    selector: "header img, nav img",
    slotType: "asset",
    coverage: "excluded",
    support: "template-owned",
  },
  {
    target: "hero.image",
    selector: "main section:first-of-type img, [id*='hero'] img",
    slotType: "asset",
    coverage: "excluded",
    support: "template-owned",
  },
  {
    target: "contact.formAction",
    selector: "#contact form, section[id*='contact'] form",
    slotType: "behavior",
    coverage: "excluded",
    support: "unsupported",
  },
] as const;

export function contentSlots(
  demoFingerprints: Partial<Record<TemplateContentTarget, readonly string[]>>,
  selectors: Partial<Record<TemplateContentTarget, string>> = {},
): readonly TemplateSlotBinding[] {
  const slots = [
    {
      target: "hero.title",
      selector: "main h1, header h1",
      contentType: "text",
      required: true,
      maxLength: 160,
      demoFingerprints: demoFingerprints["hero.title"] ?? [],
    },
    {
      target: "about.body",
      selector: "#about p, section[id*='about'] p",
      contentType: "text",
      required: true,
      maxLength: 800,
      demoFingerprints: demoFingerprints["about.body"] ?? [],
    },
    {
      target: "features.items",
      selector: "#features article, section[id*='feature'] article",
      contentType: "collection",
      required: true,
      maxLength: 1800,
      demoFingerprints: demoFingerprints["features.items"] ?? [],
    },
    {
      target: "services.items",
      selector: "#services article, section[id*='service'] article",
      contentType: "collection",
      required: true,
      maxLength: 1800,
      demoFingerprints: demoFingerprints["services.items"] ?? [],
    },
    {
      target: "products",
      selector: "#products article, #pricing article, section[id*='product'] article",
      contentType: "collection",
      required: true,
      maxLength: 2400,
      demoFingerprints: demoFingerprints.products ?? [],
    },
    {
      target: "contact.title",
      selector: "#contact h2, section[id*='contact'] h2",
      contentType: "text",
      required: true,
      maxLength: 160,
      demoFingerprints: demoFingerprints["contact.title"] ?? [],
    },
    {
      target: "contact.body",
      selector: "#contact p, section[id*='contact'] p",
      contentType: "text",
      required: true,
      maxLength: 800,
      demoFingerprints: demoFingerprints["contact.body"] ?? [],
    },
    {
      target: "contact.email",
      selector: "#contact a[href^='mailto:'], section[id*='contact'] a[href^='mailto:']",
      contentType: "text",
      required: true,
      maxLength: 240,
      demoFingerprints: demoFingerprints["contact.email"] ?? [],
    },
    {
      target: "contact.phone",
      selector: "#contact a[href^='tel:'], section[id*='contact'] a[href^='tel:']",
      contentType: "text",
      required: true,
      maxLength: 80,
      demoFingerprints: demoFingerprints["contact.phone"] ?? ["待补充"],
    },
    {
      target: "contact.address",
      selector: "#contact address, section[id*='contact'] address",
      contentType: "text",
      required: true,
      maxLength: 1000,
      demoFingerprints: demoFingerprints["contact.address"] ?? ["地址待补充", "Address to be completed"],
    },
  ] as const;
  const semanticTypes: Record<TemplateContentTarget, string> = {
    "hero.title": "hero_headline",
    "about.body": "company_story",
    "features.items": "value_propositions",
    "services.items": "service_cards",
    products: "product_catalog",
    "contact.title": "contact_headline",
    "contact.body": "contact_description",
    "contact.email": "contact_email",
    "contact.phone": "contact_phone",
    "contact.address": "contact_address",
  };
  const aliases: Record<TemplateContentTarget, readonly string[]> = {
    "hero.title": ["首屏标题", "hero title", "headline"],
    "about.body": ["公司简介", "about", "company story"],
    "features.items": ["核心优势", "features", "value propositions"],
    "services.items": ["服务项目", "services", "service cards"],
    products: ["产品目录", "products", "catalog"],
    "contact.title": ["联系标题", "contact title"],
    "contact.body": ["联系说明", "contact body", "inquiry"],
    "contact.email": ["邮箱", "email"],
    "contact.phone": ["电话", "phone"],
    "contact.address": ["地址", "address"],
  };
  return slots.map((slot) => ({
    ...slot,
    selector: selectors[slot.target] ?? slot.selector,
    semanticType: semanticTypes[slot.target],
    aliases: aliases[slot.target],
    locales: BOTH_LOCALES,
    editable: true,
  }));
}

export type { TemplateManifest };
