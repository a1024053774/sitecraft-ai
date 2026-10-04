// T-053: the material facts a visitor must be able to read on a published home page, taken from the
// draft without asking the renderer: each shown product's name, description and specs (name and
// value, where the value is not a gap), as many FAQ entries and cooperation steps as the look has room
// for (the first ones that have a title or a body, in draft order), every industry and capability
// with its body, every certificate by name (and the body when the cards or table variant is mounted), and the
// contact email and phone. Badge variants show name and status only. Sections the
// draft hides are skipped, and so are gaps (待补充 / To be provided). The page is read with folded spec
// lists and answers opened (scripts/visitor-readable-text.js), so a fact behind 全部参数 or a closed
// question still counts.

// FAQ and step entries each look shows; tests/published-facts.test.ts keeps this in step with the
// adapters.
export const ENTRY_SLOTS = {
  screwfast: { faq: 6, services: 6 },
  forge: { faq: 6, services: 6 },
  landwind: { faq: 6, services: 6 },
  "tailwind-landing": { faq: 6, services: 6 },
};

// Certification cards and the status table show the material body; badge variants intentionally show only the name and
// status. Keep the default in this visitor-facts table so a missing card body is observable.
const DEFAULT_CERTIFICATION_VARIANTS = {
  screwfast: "badges",
  forge: "badges",
  landwind: "badges",
  "tailwind-landing": "cards",
};

const GAP = /^(待补充|To be provided|To be completed)$/;
const isGap = (value) => !value || GAP.test(String(value).trim());
const localize = (value, locale) => (value && typeof value === "object" ? value[locale] : value) ?? "";

// The break marks the bridge adds (U+200B, U+2060) are not part of a fact; white space counts once.
export function normalizeReadable(text) {
  return String(text ?? "").replace(/[\u200b\u2060]/g, "").replace(/\s+/g, " ").trim();
}

export function expectedFacts(draft, locale = "zh") {
  const facts = [];
  const add = (kind, value) => {
    const text = normalizeReadable(value);
    if (!isGap(text)) facts.push({ kind, text });
  };
  const hidden = new Set(Array.isArray(draft?.hiddenSections) ? draft.hiddenSections : []);
  const content = draft?.content ?? {};
  if (!hidden.has("products")) {
    for (const product of Array.isArray(draft?.products) ? draft.products : []) {
      // A product with neither a name nor a description is not shown.
      if (!product || (isGap(localize(product.name, locale)) && isGap(localize(product.summary, locale)))) continue;
      add("product name", localize(product.name, locale));
      add("product description", localize(product.summary, locale));
      for (const spec of Array.isArray(product.specs) ? product.specs : []) {
        if (!spec || isGap(spec.value)) continue;
        const value = localize(spec.value, locale);
        if (isGap(value)) continue;
        add("spec name", localize(spec.name, locale));
        add("spec value", value);
      }
    }
  }
  const entries = ENTRY_SLOTS[draft?.templateId] ?? { faq: 0, services: 0 };
  for (const [key, question, answer] of [["faq", "FAQ question", "FAQ answer"], ["services", "step title", "step body"]]) {
    if (hidden.has(key)) continue;
    const items = Array.isArray(content[key]?.items) ? content[key].items : [];
    const provided = items.filter((item) => item && !(isGap(localize(item.title, locale)) && isGap(localize(item.body, locale))));
    for (const item of provided.slice(0, entries[key])) {
      add(question, localize(item.title, locale));
      add(answer, localize(item.body, locale));
    }
  }
  for (const key of ["industries", "capabilities", "certifications"]) {
    if (hidden.has(key)) continue;
    for (const item of Array.isArray(content[key]?.items) ? content[key].items : []) {
      if (!item) continue;
      const title = localize(item.title, locale);
      const body = localize(item.body, locale);
      if (isGap(title) && isGap(body)) continue;
      // Visitors see no certificate that is still a gap.
      if (key === "certifications" && item.status === "待补充") continue;
      add(`${key} entry`, title);
      const certificationVariant = draft?.blockVariants?.certifications ?? DEFAULT_CERTIFICATION_VARIANTS[draft?.templateId] ?? "badges";
      if (key !== "certifications" || certificationVariant === "cards" || certificationVariant === "table") add(`${key} body`, body);
    }
  }
  if (!hidden.has("commercialTerms")) {
    for (const term of Array.isArray(content.commercialTerms) ? content.commercialTerms : []) {
      if (!term || !term.value) continue;
      add("commercial term value", localize(term.value, locale));
    }
  }
  if (!hidden.has("equipment")) {
    for (const item of Array.isArray(content.equipment) ? content.equipment : []) {
      if (!item) continue;
      const name = localize(item.name, locale);
      if (isGap(name)) continue;
      add("equipment name", name);
      if (Number.isInteger(item.quantity) && item.quantity >= 0) add("equipment quantity", String(item.quantity));
      const spec = localize(item.spec, locale);
      if (!isGap(spec)) add("equipment specification", spec);
    }
  }
  if (!hidden.has("qualityProcess")) {
    for (const step of Array.isArray(content.qualityProcess) ? content.qualityProcess : []) {
      if (!step) continue;
      const title = localize(step.title, locale);
      if (isGap(title)) continue;
      add("quality process title", title);
      const body = localize(step.body, locale);
      if (!isGap(body)) add("quality process body", body);
    }
  }
  if (!hidden.has("history")) {
    for (const item of Array.isArray(content.history) ? content.history : []) {
      if (!item || !Number.isInteger(item.year) || item.year < 1000 || item.year > 9999) continue;
      add("history year", String(item.year));
      const event = localize(item.event, locale);
      if (!isGap(event)) add("history event", event);
    }
  }
  add("contact email", content.contact?.email);
  add("contact phone", content.contact?.phone);
  return facts;
}

// The facts the page text does not contain, in draft order.
export function missingFacts(facts, readable) {
  const page = normalizeReadable(readable);
  return facts.filter((fact) => !page.includes(normalizeReadable(fact.text)));
}
