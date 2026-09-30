// T-053: the material facts a visitor must be able to read on a published home page, taken from the
// draft without asking the renderer: each shown product's name, description and specs (name and
// value, where the value is not a gap), as many FAQ entries and cooperation steps as the look has room
// for (the first ones that have a title or a body, in draft order), every industry and capability
// with its body, every certificate by name, and the contact email and phone. A certificate's body is
// not expected: the engineering look shows certificates as badges, name and status only. Sections the
// draft hides are skipped, and so are gaps (待补充 / To be provided). The page is read with folded spec
// lists and answers opened (scripts/visitor-readable-text.js), so a fact behind 全部参数 or a closed
// question still counts.

// FAQ and step entries each look shows; tests/published-facts.test.ts keeps this in step with the
// adapters.
export const ENTRY_SLOTS = {
  screwfast: { faq: 6, services: 6 },
  forge: { faq: 3, services: 3 },
  landwind: { faq: 4, services: 3 },
  "tailwind-landing": { faq: 3, services: 3 },
};

const GAP = /^(待补充|To be provided|To be completed)$/;
const isGap = (value) => !value || GAP.test(String(value).trim());
const zh = (value) => (value && typeof value === "object" ? value.zh : value) ?? "";

// The break marks the bridge adds (U+200B, U+2060) are not part of a fact; white space counts once.
export function normalizeReadable(text) {
  return String(text ?? "").replace(/[\u200b\u2060]/g, "").replace(/\s+/g, " ").trim();
}

export function expectedFacts(draft) {
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
      if (!product || (isGap(zh(product.name)) && isGap(zh(product.summary)))) continue;
      add("product name", zh(product.name));
      add("product description", zh(product.summary));
      for (const spec of Array.isArray(product.specs) ? product.specs : []) {
        if (!spec || isGap(spec.value)) continue;
        add("spec name", zh(spec.name));
        add("spec value", spec.value);
      }
    }
  }
  const entries = ENTRY_SLOTS[draft?.templateId] ?? { faq: 0, services: 0 };
  for (const [key, question, answer] of [["faq", "FAQ question", "FAQ answer"], ["services", "step title", "step body"]]) {
    if (hidden.has(key)) continue;
    const items = Array.isArray(content[key]?.items) ? content[key].items : [];
    const provided = items.filter((item) => item && !(isGap(zh(item.title)) && isGap(zh(item.body))));
    for (const item of provided.slice(0, entries[key])) {
      add(question, zh(item.title));
      add(answer, zh(item.body));
    }
  }
  for (const key of ["industries", "capabilities", "certifications"]) {
    if (hidden.has(key)) continue;
    for (const item of Array.isArray(content[key]?.items) ? content[key].items : []) {
      if (!item) continue;
      const title = zh(item.title);
      const body = zh(item.body);
      if (isGap(title) && isGap(body)) continue;
      // Visitors see no certificate that is still a gap.
      if (key === "certifications" && item.status === "待补充") continue;
      add(`${key} entry`, title);
      if (key !== "certifications") add(`${key} body`, body);
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
