import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { defaultDraft, familyModuleInventory, visibilityKeys } from "../lib/site-document.ts";
import { applySiteOperations, siteOperationSchema } from "../lib/site-operations.ts";
import { getTemplateAdapter, templateAdapters } from "../lib/template-adapters/index.ts";

const SNAPSHOTS = {
  forge: new URL("../vendor/open-source-templates/small-bis/dist/index.html", import.meta.url),
  screwfast: new URL("../vendor/open-source-templates/screwfast/dist/index.html", import.meta.url),
  landwind: new URL("../lib/template-adapters/overlays/landwind.index.html", import.meta.url),
} as const;

const NAV_CHROME_IDS = ["home", "products", "services", "blog", "contact"];

/** Independent HTML probes from the local snapshots. Not copied from adapter data. */
const UNIQUE_SECTION_PROBES = {
  forge: {
    services: { kind: "class", tag: "section", classes: ["border-y-8", "border-blue-400"] },
    features: { kind: "class", tag: "div", classes: ["bg-opacity-30"] },
    faq: { kind: "id", id: "FAQ" },
  },
  screwfast: {
    partners: { kind: "class", tag: "h2", classes: ["leading-tight", "text-2xl"] },
    features: { kind: "attr", attr: "alt", value: "ScrewFast products in floating boxes" },
    solutions: { kind: "id", id: "tabs-with-card-item-1" },
    process: { kind: "class", tag: "h2", classes: ["mb-2", "text-3xl"] },
    faq: { kind: "class", tag: "div", classes: ["hs-accordion-group"] },
    contact: { kind: "class", tag: "section", classes: ["pt-10", "pb-24"] },
  },
  landwind: {
    solutions: { kind: "attr", attr: "alt", value: "dashboard feature image" },
    partners: { kind: "class", tag: "h2", classes: ["mt-3", "mb-4"] },
    faq: { kind: "id", id: "accordion-flush" },
    contact: { kind: "class", tag: "h2", classes: ["leading-tight"] },
  },
} as const;

const MISSING_ON_TEMPLATE = {
  forge: ["products", "contact", "solutions", "process", "partners", "industries", "about"],
  screwfast: ["products", "services", "industries", "about"],
  landwind: ["products", "services", "features", "process", "industries", "about"],
} as const;

function countId(html: string, id: string) {
  return (html.match(new RegExp(`\\sid="${id}"`, "g")) ?? []).length;
}

function countAttr(html: string, attr: string, value: string) {
  return (html.split(`${attr}="${value}"`).length - 1);
}

function countTagClasses(html: string, tag: string, classes: readonly string[]) {
  const matches = html.matchAll(new RegExp(`<${tag}\\b([^>]*)>`, "gi"));
  let count = 0;
  for (const match of matches) {
    const classMatch = match[1]?.match(/\bclass="([^"]*)"/);
    const present = new Set((classMatch?.[1] ?? "").split(/\s+/));
    if (classes.every((className) => present.has(className))) count += 1;
  }
  return count;
}

function probeCount(html: string, probe: { kind: string; tag?: string; classes?: readonly string[]; id?: string; attr?: string; value?: string }) {
  if (probe.kind === "id" && probe.id) return countId(html, probe.id);
  if (probe.kind === "attr" && probe.attr && probe.value) return countAttr(html, probe.attr, probe.value);
  if (probe.kind === "class" && probe.tag && probe.classes) return countTagClasses(html, probe.tag, probe.classes);
  return 0;
}

test("plan v0.6 family inventory is KonsTuck and Lozitick module lists", () => {
  assert.deepEqual(familyModuleInventory.konstuck, ["products", "services", "features", "faq", "contact"]);
  assert.deepEqual(familyModuleInventory.lozitick, ["solutions", "process", "partners", "industries", "faq"]);
  assert.deepEqual(
    [...familyModuleInventory.konstuck, ...familyModuleInventory.lozitick.filter((key) => key !== "faq")].sort(),
    ["contact", "features", "faq", "industries", "partners", "process", "products", "services", "solutions"].sort(),
  );
});

test("forge screwfast landwind snapshots have unique nodes for listed modules that exist", () => {
  for (const [templateId, probes] of Object.entries(UNIQUE_SECTION_PROBES)) {
    const html = readFileSync(SNAPSHOTS[templateId as keyof typeof SNAPSHOTS], "utf8");
    for (const [key, probe] of Object.entries(probes)) {
      assert.equal(probeCount(html, probe), 1, `${templateId} ${key} must uniquely exist in the snapshot`);
    }
    for (const id of NAV_CHROME_IDS) {
      if (templateId !== "screwfast") continue;
      assert.equal(countId(html, id), 1, `screwfast nav id #${id} exists as chrome`);
    }
  }
});

test("adapters declare only unique snapshot sections and leave the rest missing", () => {
  for (const templateId of ["forge", "screwfast", "landwind"] as const) {
    const adapter = getTemplateAdapter(templateId);
    assert.ok(adapter, `${templateId} adapter is required`);
    const declared = adapter.sections ?? [];
    const expected = UNIQUE_SECTION_PROBES[templateId];
    assert.deepEqual(
      declared.map((section) => section.key).sort(),
      Object.keys(expected).sort(),
      `${templateId} must declare exactly the uniquely targetable family modules`,
    );
    for (const section of declared) {
      assert.equal(section.selector.includes(","), false, `${templateId} ${section.key} must not use a fallback selector list`);
      assert.equal(
        NAV_CHROME_IDS.some((id) => section.selector === `#${id}`),
        false,
        `${templateId} must not hide nav chrome #${section.selector}`,
      );
    }
    for (const key of MISSING_ON_TEMPLATE[templateId]) {
      assert.equal(declared.some((section) => section.key === key), false, `${templateId} ${key} must stay missing`);
    }
  }
});

test("set_section_visibility hides and shows listed modules through the whitelist op", () => {
  const options = { templateIds: new Set(["forge", "screwfast", "landwind"]), lastChange: "family-modules" };
  const hidden = applySiteOperations(structuredClone(defaultDraft), [
    { op: "set_section_visibility", section: "faq", visible: false },
    { op: "set_section_visibility", section: "services", visible: false },
    { op: "set_section_visibility", section: "partners", visible: false },
  ], options);
  assert.equal(hidden.changed, true);
  assert.deepEqual(hidden.draft.hiddenSections, ["faq", "services", "partners"]);
  assert.deepEqual(hidden.appliedTargets, ["faq.visibility", "services.visibility", "partners.visibility"]);
  const shown = applySiteOperations(hidden.draft, [
    { op: "set_section_visibility", section: "faq", visible: true },
  ], options);
  assert.deepEqual(shown.draft.hiddenSections, ["services", "partners"]);
  const restored = applySiteOperations(shown.draft, shown.inverseOperations.concat(hidden.inverseOperations), options);
  assert.deepEqual(restored.draft.hiddenSections, defaultDraft.hiddenSections);
});

test("illegal hide/show keys are rejected and do not rewrite the draft", () => {
  const original = structuredClone(defaultDraft);
  for (const section of ["hero", "nav", "footer", "header", "pricing"]) {
    const parsed = siteOperationSchema.safeParse({ op: "set_section_visibility", section, visible: false });
    assert.equal(parsed.success, false, `${section} must not be a visibility key`);
  }
  assert.ok(visibilityKeys.includes("faq"));
  const result = applySiteOperations(original, [], { templateIds: new Set(["forge"]), lastChange: "none" });
  assert.equal(result.changed, false);
  assert.deepEqual(original.hiddenSections, []);
});

test("adapters stay data-only after declaring family sections", () => {
  for (const adapter of Object.values(templateAdapters)) {
    const serialized = JSON.stringify(adapter);
    assert.equal(serialized.includes("function"), false);
    assert.equal(serialized.includes("prepareFn"), false);
    if (adapter.sections) {
      assert.ok(Array.isArray(adapter.sections));
      for (const section of adapter.sections) {
        assert.equal(typeof section.key, "string");
        assert.equal(typeof section.selector, "string");
        assert.equal("hideFn" in section, false);
      }
    }
  }
});
