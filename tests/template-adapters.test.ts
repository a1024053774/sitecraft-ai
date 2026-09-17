import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  adapterCoverage,
  getTemplateAdapter,
  reportDeclaredCoverage,
  templateAdapters,
} from "../lib/template-adapters/index.ts";

test("adapters are JSON data, not per-template JavaScript source", () => {
  for (const adapter of Object.values(templateAdapters)) {
    assert.equal(typeof adapter.templateId, "string");
    assert.ok(Array.isArray(adapter.slots));
    assert.doesNotThrow(() => JSON.stringify(adapter));
    const serialized = JSON.stringify(adapter);
    assert.equal(serialized.includes("function"), false);
    assert.equal(serialized.includes("prepareFn"), false);
    assert.equal(serialized.includes("nativeFillFn"), false);
    assert.equal("heroSelector" in adapter, false);
  }
});

function countExactClassSelector(html: string, selector: string) {
  assert.equal(selector.includes(","), false, "declared selectors must be unique, not fallback lists");
  assert.match(selector, /^[a-z0-9-]+(\.[a-z0-9_-]+)+$/i, `selector ${selector} must be a simple tag.class list for HTML counting`);
  const [tag, ...classes] = selector.split(".");
  const matches = html.matchAll(new RegExp(`<${tag}\\b[^>]*class="([^"]*)"`, "gi"));
  let count = 0;
  for (const match of matches) {
    const present = new Set((match[1] ?? "").split(/\s+/));
    if (classes.every((className) => present.has(className))) count += 1;
  }
  return count;
}

test("required templates declare unique hero slots and only exact collection indexes", () => {
  for (const id of ["forge", "screwfast", "tailwind-landing", "landwind"]) {
    const adapter = getTemplateAdapter(id);
    assert.ok(adapter, `missing adapter ${id}`);
    assert.ok(adapter.slots.some((slot) => slot.target === "hero.title"));
    assert.ok(adapter.slots.every((slot) => !slot.selector.includes(",")), `${id} selector must not be a comma fallback list`);
    assert.ok(
      adapter.slots.every((slot) => !slot.target.includes("items") || /\.items\.\d+\.(title|body)$/.test(slot.target)),
      `${id} collection slots must be exact indexes`,
    );
  }
  assert.equal(getTemplateAdapter("not-a-template"), undefined);
});

test("coverage is locale-exact and does not treat prefix hits as success", () => {
  const exact = reportDeclaredCoverage({
    templateId: "forge",
    expectedTargets: ["hero.title.zh"],
    appliedSlots: ["hero.title.zh"],
  });
  assert.deepEqual(exact.missingSlots, []);
  assert.deepEqual(exact.fallbackMatched, []);

  const localeMismatch = reportDeclaredCoverage({
    templateId: "forge",
    expectedTargets: ["hero.title.en"],
    appliedSlots: ["hero.title.zh"],
  });
  assert.deepEqual(localeMismatch.missingSlots, ["hero.title.en"]);

  const indexPrefix = reportDeclaredCoverage({
    templateId: "forge",
    expectedTargets: ["services.items.10.title.zh"],
    appliedSlots: ["services.items.1.title.zh"],
  });
  assert.deepEqual(indexPrefix.missingSlots, ["services.items.10.title.zh"]);

  const unknown = adapterCoverage("missing", ["hero.title.zh"]);
  assert.deepEqual(unknown.appliedSlots, []);
  assert.deepEqual(unknown.missingSlots, ["hero.title.zh"]);
  assert.deepEqual(unknown.fallbackMatched, []);
});

test("templates without homepage contact fields propose an owned alternative", () => {
  const screwfast = reportDeclaredCoverage({
    templateId: "screwfast",
    expectedTargets: ["contact.email.zh"],
    appliedSlots: ["hero.cta.zh"],
  });
  assert.deepEqual(screwfast.missingSlots, ["contact.email.zh"]);
  assert.deepEqual(screwfast.proposedAlternatives, [{ requested: "contact.email.zh", proposed: "hero.cta" }]);

  const landing = getTemplateAdapter("tailwind-landing");
  assert.equal(landing?.alternatives?.["contact.phone"], "hero.cta");
  assert.equal(landing?.slots.some((slot) => slot.target.startsWith("contact.")), false);

  const landwind = getTemplateAdapter("landwind");
  assert.equal(landwind?.alternatives?.["contact.phone"], "hero.cta");
  assert.equal(landwind?.slots.some((slot) => slot.target.startsWith("contact.")), false);
});

test("forge homepage source has unique declared hero slots and no compare-pack text", () => {
  const html = readFileSync(new URL("../vendor/open-source-templates/small-bis/dist/index.html", import.meta.url), "utf8");
  const adapter = getTemplateAdapter("forge");
  assert.ok(adapter, "forge adapter is required before quality comparison");
  const title = adapter.slots.find((slot) => slot.target === "hero.title");
  const subtitle = adapter.slots.find((slot) => slot.target === "hero.subtitle");
  assert.equal(title?.selector, '[data-testid="hero-text"]');
  assert.equal(subtitle?.selector, '[data-testid="intro-text"]');
  assert.equal((html.match(/data-testid="hero-text"/g) ?? []).length, 1);
  assert.equal((html.match(/data-testid="intro-text"/g) ?? []).length, 1);
  assert.equal(html.includes("汉川精密阀业A17"), false);
  assert.equal(html.includes("北湾流体接头B84"), false);
  assert.match(html, /Main Keywords/);
  assert.match(html, />LOGO</);
});

test("landwind homepage source has exactly one node for each declared first-screen slot", () => {
  const html = readFileSync(new URL("../vendor/open-source-templates/landwind/index.html", import.meta.url), "utf8");
  const adapter = getTemplateAdapter("landwind");
  assert.ok(adapter, "landwind adapter is required before quality comparison");
  assert.equal(adapter.runtime, "static-html");
  const required = ["companyName", "hero.title", "hero.subtitle", "hero.cta"];
  for (const target of required) {
    const slot = adapter.slots.find((item) => item.target === target);
    assert.ok(slot, `missing declared ${target}`);
    assert.equal(countExactClassSelector(html, slot.selector), 1, `${target} selector must be unique in landwind HTML`);
  }
  assert.equal(html.includes("汉川精密阀业A17"), false);
  assert.equal(html.includes("北湾流体接头B84"), false);
  assert.match(html, /Work with tools you already use/);
  assert.match(html, /Building digital/);
});

test("spa-bundle adapters do not claim a local HTML snapshot", () => {
  assert.equal(getTemplateAdapter("shadcn-landing")?.runtime, "spa-bundle");
  assert.notEqual(getTemplateAdapter("tailwind-landing")?.runtime, "spa-bundle");
});

test("catalog includes extra PR4 templates without renaming shadcn-landing2 as Pro", () => {
  const catalog = readFileSync(new URL("../lib/template-catalog.ts", import.meta.url), "utf8");
  for (const id of ["screwfast", "fresh", "tailwind-landing", "nextjs-landing", "shadcn-landing", "shadcn-landing2"]) {
    assert.match(catalog, new RegExp(`id: "${id}"`));
  }
  assert.match(catalog, /id: "shadcn-landing2"[\s\S]*?license: "MIT"/);
  assert.equal(/id: "shadcn-landing2"[\s\S]*?name: ".*Pro/i.test(catalog), false);
});
