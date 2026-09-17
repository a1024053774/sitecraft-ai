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
  for (const id of ["forge", "screwfast", "tailwind-landing", "fresh", "landwind"]) {
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

  const fresh = reportDeclaredCoverage({
    templateId: "fresh",
    expectedTargets: ["contact.email.zh"],
    appliedSlots: ["hero.cta.zh"],
  });
  assert.deepEqual(fresh.missingSlots, ["contact.email.zh"]);
  assert.deepEqual(fresh.proposedAlternatives, [{ requested: "contact.email.zh", proposed: "hero.cta" }]);
  assert.equal(getTemplateAdapter("fresh")?.slots.some((slot) => slot.target.startsWith("contact.")), false);
  assert.equal(getTemplateAdapter("fresh")?.slots.some((slot) => slot.target === "companyName"), false);
  assert.equal(landing?.slots.some((slot) => slot.target === "companyName"), false);
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

const FIRST_SCREEN_PACK_TOKENS = ["澄海传动件K07", "甬江密封件M52"] as const;

const SIMPLE_TAG_CLASS = /^[a-z0-9-]+(\.[a-z0-9_-]+)+$/i;
const SIMPLE_TAG_OPTIONAL_CLASS = /^[a-z0-9-]+(\.[a-z0-9_-]+)*$/i;

function countTagClasses(html: string, tag: string, classes: readonly string[]) {
  const matches = html.matchAll(new RegExp(`<${tag}\\b([^>]*)>`, "gi"));
  let count = 0;
  for (const match of matches) {
    const classMatch = match[1]?.match(/\bclass="([^"]*)"/);
    const present = new Set((classMatch?.[1] ?? "").split(/\s+/).filter(Boolean));
    if (classes.every((className) => present.has(className))) count += 1;
  }
  return count;
}

function innerOfUniqueTagClass(html: string, tag: string, classes: readonly string[]) {
  const opener = new RegExp(`<${tag}\\b([^>]*)>`, "gi");
  const hits: Array<{ match: RegExpExecArray; classes: string }> = [];
  let found: RegExpExecArray | null;
  while ((found = opener.exec(html))) {
    const classMatch = found[1]?.match(/\bclass="([^"]*)"/);
    const present = new Set((classMatch?.[1] ?? "").split(/\s+/).filter(Boolean));
    if (classes.every((className) => present.has(className))) hits.push({ match: found, classes: classMatch?.[1] ?? "" });
  }
  assert.equal(hits.length, 1, `${tag}.${classes.join(".")} must be unique before reading descendants`);
  const open = hits[0].match;
  const start = open.index + open[0].length;
  const walker = new RegExp(`<${tag}\\b[^>]*>|</${tag}>`, "gi");
  walker.lastIndex = start;
  let depth = 1;
  let next: RegExpExecArray | null;
  while ((next = walker.exec(html))) {
    if (next[0].startsWith("</")) depth -= 1;
    else depth += 1;
    if (depth === 0) return html.slice(start, next.index);
  }
  throw new Error(`unclosed <${tag}> for ${classes.join(".")}`);
}

function parseSimpleSelector(selector: string) {
  assert.match(selector, SIMPLE_TAG_OPTIONAL_CLASS, `selector ${selector} must stay a simple tag.class list`);
  const [tag, ...classes] = selector.split(".");
  return { tag, classes };
}

function countDeclaredSelector(html: string, selector: string) {
  assert.equal(selector.includes(","), false, "declared selectors must be unique, not fallback lists");
  if (SIMPLE_TAG_CLASS.test(selector)) return countExactClassSelector(html, selector);
  const parts = selector.trim().split(/\s+/).filter(Boolean);
  assert.equal(parts.length, 2, `selector ${selector} must be a unique tag.class list or one unique ancestor plus one leaf`);
  const ancestor = parseSimpleSelector(parts[0]);
  const leaf = parseSimpleSelector(parts[1]);
  const inner = innerOfUniqueTagClass(html, ancestor.tag, ancestor.classes);
  return countTagClasses(inner, leaf.tag, leaf.classes);
}

/** Independent HTML probes. Not copied from adapter selector strings. */
const LOOK_FIRST_SCREEN_PROBES = {
  "tailwind-landing": {
    html: new URL("../vendor/open-source-templates/tailwind-landing/index.html", import.meta.url),
    runtime: "static-html",
    title: { tag: "h1", classes: ["my-4", "text-5xl"] },
    subtitle: { tag: "p", classes: ["leading-normal", "text-2xl"] },
    ctaAncestor: { tag: "div", classes: ["pt-24"] },
    undeclared: ["What business are you?", "Call to Action", "Action!"],
  },
  fresh: {
    html: new URL("../vendor/open-source-templates/fresh/dist/index.html", import.meta.url),
    runtime: "astro-static",
    title: { tag: "h1", classes: ["title", "is-1"] },
    subtitle: { tag: "h2", classes: ["subtitle", "is-5", "is-muted"] },
    cta: { tag: "a", classes: ["button", "cta", "primary-btn"] },
    undeclared: ["Great Power Comes", "Discover", "Sign up"],
  },
} as const;

test("tailwind-landing and fresh snapshots have unique first-screen nodes and leave chrome undeclared", () => {
  for (const [templateId, probe] of Object.entries(LOOK_FIRST_SCREEN_PROBES)) {
    const html = readFileSync(probe.html, "utf8");
    const adapter = getTemplateAdapter(templateId);
    assert.ok(adapter, `${templateId} adapter is required before quality comparison`);
    assert.equal(adapter.runtime, probe.runtime);
    assert.equal(countTagClasses(html, probe.title.tag, probe.title.classes), 1, `${templateId} hero.title probe must be unique`);
    assert.equal(countTagClasses(html, probe.subtitle.tag, probe.subtitle.classes), 1, `${templateId} hero.subtitle probe must be unique`);
    if ("ctaAncestor" in probe) {
      assert.equal(countTagClasses(html, probe.ctaAncestor.tag, probe.ctaAncestor.classes), 1, `${templateId} hero wrapper must be unique`);
      assert.equal(countTagClasses(html, "button", ["shadow-lg"]), 8, `${templateId} must not treat duplicated CTA classes as unique`);
    } else {
      assert.equal(countTagClasses(html, probe.cta.tag, probe.cta.classes), 1, `${templateId} hero.cta probe must be unique`);
    }

    const required = ["hero.title", "hero.subtitle", "hero.cta"] as const;
    for (const target of required) {
      const slot = adapter.slots.find((item) => item.target === target);
      assert.ok(slot, `${templateId} missing declared ${target}`);
      if (target === "hero.cta" && "ctaAncestor" in probe) {
        assert.equal(SIMPLE_TAG_CLASS.test(slot.selector), false, `${templateId} CTA cannot fake uniqueness with duplicated button classes`);
        assert.equal(countDeclaredSelector(html, slot.selector), 1, `${templateId} ${target} descendant selector must hit one node`);
      } else {
        assert.match(slot.selector, SIMPLE_TAG_CLASS, `${templateId} ${target} must be a unique tag.class list`);
        assert.equal(countExactClassSelector(html, slot.selector), 1, `${templateId} ${target} selector must be unique`);
      }
    }
    assert.equal(adapter.slots.some((slot) => slot.target === "companyName"), false, `${templateId} has no unique companyName text node`);
    assert.equal(adapter.slots.some((slot) => slot.target.startsWith("contact.")), false);
    assert.equal(adapter.alternatives?.["contact.email"], "hero.cta");
    for (const token of FIRST_SCREEN_PACK_TOKENS) {
      assert.equal(html.includes(token), false, `${templateId} snapshot must not contain pack token ${token}`);
    }
    for (const chrome of probe.undeclared) {
      assert.equal(html.includes(chrome), true, `${templateId} undeclared chrome ${chrome} must remain in the snapshot`);
    }
  }
  const promptSource = readFileSync(new URL("../lib/ai-provider.ts", import.meta.url), "utf8");
  for (const token of FIRST_SCREEN_PACK_TOKENS) {
    assert.equal(promptSource.includes(token), false, "simulated packs must not be copied into production prompts");
  }
});

test("spa-bundle adapters do not claim a local HTML snapshot", () => {
  assert.equal(getTemplateAdapter("shadcn-landing")?.runtime, "spa-bundle");
  assert.notEqual(getTemplateAdapter("tailwind-landing")?.runtime, "spa-bundle");
});

test("declared hero images are unique src slots and leave logos and avatars undeclared", () => {
  const cases = [
    {
      id: "forge",
      html: new URL("../vendor/open-source-templates/small-bis/dist/index.html", import.meta.url),
      declared: 'alt="hero"',
      undeclared: ['alt="completed work"', 'alt="example service"'],
    },
    {
      id: "landwind",
      html: new URL("../vendor/open-source-templates/landwind/index.html", import.meta.url),
      declared: 'alt="hero image"',
      undeclared: ['alt="Landwind Logo"', 'alt="profile picture"', 'alt="dashboard feature image"'],
    },
    {
      id: "screwfast",
      html: new URL("../vendor/open-source-templates/screwfast/dist/index.html", import.meta.url),
      declared: "Stack of ScrewFast product boxes containing assorted hardware tools",
      undeclared: ["Customer review avatar 1", "Samantha Ruiz photo", "ScrewFast products in floating boxes"],
    },
    {
      id: "fresh",
      html: new URL("../vendor/open-source-templates/fresh/dist/index.html", import.meta.url),
      declared: 'class="hero-image"',
      undeclared: ["partner-logo", "Made with Bulma"],
    },
    {
      id: "tailwind-landing",
      html: new URL("../vendor/open-source-templates/tailwind-landing/index.html", import.meta.url),
      declared: "hero.png",
      undeclared: [],
    },
  ] as const;
  for (const item of cases) {
    const html = readFileSync(item.html, "utf8");
    const adapter = getTemplateAdapter(item.id);
    const slot = adapter?.slots.find((entry) => entry.target === "hero.image");
    assert.ok(slot, `${item.id} must declare a unique hero.image src slot`);
    assert.equal(slot?.attr, "src");
    assert.equal(slot?.selector.includes(","), false);
    const declaredHits = html.split(item.declared).length - 1;
    assert.equal(declaredHits, 1, `${item.id} declared image token must be unique`);
    for (const chrome of item.undeclared) {
      assert.equal(html.includes(chrome), true, `${item.id} still contains undeclared ${chrome}`);
      assert.equal(adapter?.slots.some((entry) => entry.selector.includes(chrome)), false, `${item.id} must not declare ${chrome}`);
    }
    assert.equal(adapter?.slots.some((entry) => entry.attr === "src" && entry.target !== "hero.image"), false);
  }
});

test("catalog includes extra PR4 templates without renaming shadcn-landing2 as Pro", () => {
  const catalog = readFileSync(new URL("../lib/template-catalog.ts", import.meta.url), "utf8");
  for (const id of ["screwfast", "fresh", "tailwind-landing", "nextjs-landing", "shadcn-landing", "shadcn-landing2"]) {
    assert.match(catalog, new RegExp(`id: "${id}"`));
  }
  assert.match(catalog, /id: "shadcn-landing2"[\s\S]*?license: "MIT"/);
  assert.equal(/id: "shadcn-landing2"[\s\S]*?name: ".*Pro/i.test(catalog), false);
});
