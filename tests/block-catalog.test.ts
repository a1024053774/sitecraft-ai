import assert from "node:assert/strict";
import test from "node:test";
import { blockCatalog, blockIds, layoutBlocks } from "../lib/blocks/catalog.ts";
import { baseFragment, blockFragments } from "../lib/blocks/fragments/index.ts";
import { blockLooks } from "../lib/blocks/looks/index.ts";
import { parseHtmlFragment } from "./fixtures/html-dom.ts";

// T-053: the block library is reviewable data plus markup. These checks read the catalog and the
// fragments directly, without a page or the bridge.

function variantMarkup(block: (typeof blockIds)[number], variant: string) {
  const markup = blockFragments[block].variants[variant];
  assert.ok(markup, `${block}:${variant} has no markup`);
  const fragment = parseHtmlFragment(markup);
  assert.equal(fragment.children.length, 1, `${block}:${variant} must have exactly one root element`);
  return { markup, fragment, root: fragment.children[0] };
}

function eachVariant(run: (block: (typeof blockIds)[number], variant: string) => void) {
  for (const block of blockIds) for (const variant of Object.keys(blockCatalog[block].variants)) run(block, variant);
}

// Content hooks in the markup; the hero band's own benchmark marker is structural, not a slot.
const CONTENT_ATTR = /data-sitecraft-(?:benchmark|optional|contact|brand(?:-name)?|nav)="([^"]+)"/g;
const STRUCTURAL = new Set(['[data-sitecraft-benchmark="hero"]']);

test("the catalog and the fragments list the same blocks and variants, and each root names its block", () => {
  assert.deepEqual(Object.keys(blockCatalog).sort(), [...blockIds].sort());
  assert.deepEqual(Object.keys(blockFragments).sort(), [...blockIds].sort());
  eachVariant((block, variant) => {
    const { root, fragment } = variantMarkup(block, variant);
    assert.equal(root.getAttribute("data-sc-block"), block);
    assert.equal(root.getAttribute("data-sc-variant"), variant);
    assert.equal(fragment.querySelectorAll("[data-sc-block]").length, 1, `${block}:${variant} nests another block`);
  });
  for (const block of blockIds) {
    assert.deepEqual(Object.keys(blockFragments[block].variants).sort(), Object.keys(blockCatalog[block].variants).sort(), `${block} markup and catalog disagree`);
  }
});

test("every declared slot, marker and part hits exactly one node in its variant", () => {
  eachVariant((block, variant) => {
    const spec = blockCatalog[block].variants[variant];
    const { fragment, markup } = variantMarkup(block, variant);
    for (const slot of spec.slots) {
      assert.match(slot.selector, /^\[[\w-]+="[^"]+"\]$/, `${block}:${variant} ${slot.target} selector must be one attribute`);
      assert.equal(fragment.querySelectorAll(slot.selector).length, 1, `${block}:${variant} ${slot.target} ${slot.selector}`);
    }
    for (const marker of spec.markers) {
      assert.equal(fragment.querySelectorAll(marker).length, 1, `${block}:${variant} marker ${marker}`);
    }
    const parts = fragment.querySelectorAll("[data-sc-part]").map((node) => node.getAttribute("data-sc-part") ?? "");
    assert.deepEqual([...parts].sort(), [...spec.parts].sort(), `${block}:${variant} parts in markup and catalog`);
    assert.equal(new Set(parts).size, parts.length, `${block}:${variant} repeats a part`);
    const declared = new Set(spec.slots.map((slot) => slot.selector));
    for (const match of markup.matchAll(CONTENT_ATTR)) {
      const selector = `[${match[0]}]`;
      if (STRUCTURAL.has(selector)) continue;
      assert.ok(declared.has(selector), `${block}:${variant} carries ${selector} without declaring a slot`);
    }
  });
});

test("a block's anchor and visibility node are on every variant", () => {
  eachVariant((block, variant) => {
    const spec = blockCatalog[block];
    const { fragment } = variantMarkup(block, variant);
    if (spec.anchor) assert.equal(fragment.querySelectorAll(`#${spec.anchor}`).length, 1, `${block}:${variant} anchor #${spec.anchor}`);
    if (spec.section) assert.equal(fragment.querySelectorAll(spec.section.selector).length, 1, `${block}:${variant} visibility node`);
  });
});

test("slots stay inside the fields their block reads and no two blocks share a selector", () => {
  const owner = new Map<string, string>();
  const covered = (reads: string[], target: string) => reads.some((field) => {
    const path = [target, `content.${target}`];
    return path.some((candidate) => candidate === field || candidate.startsWith(`${field}.`));
  });
  eachVariant((block, variant) => {
    for (const slot of blockCatalog[block].variants[variant].slots) {
      assert.ok(covered(blockCatalog[block].reads, slot.target), `${block} writes ${slot.target} but does not list it in reads`);
      const previous = owner.get(slot.selector);
      assert.ok(!previous || previous === block, `${slot.selector} is declared by ${previous} and ${block}`);
      owner.set(slot.selector, block);
    }
  });
});

test("fragments carry no scripts, outside resources or demo leftovers", () => {
  const sources = [
    baseFragment.css, baseFragment.narrow ?? "", baseFragment.phone ?? "",
    ...blockIds.flatMap((block) => {
      const fragment = blockFragments[block];
      return [fragment.css, fragment.narrow ?? "", fragment.phone ?? "", ...Object.values(fragment.variants)];
    }),
  ];
  for (const source of sources) {
    assert.doesNotMatch(source, /<script|https?:|\burl\(|@import|\bsrc=/i);
    for (const leftover of ["ScrewFast", "Pricing", "Reviews", "$29", "GitHub", "Crafted by", "data-sitecraft-demo", "unsplash", "Lorem"]) {
      assert.equal(source.includes(leftover), false, `fragment contains ${leftover}`);
    }
  }
});

test("each look shows every block once and has an existing default variant for it", () => {
  assert.ok(blockLooks.length > 0);
  for (const look of blockLooks) {
    const order = layoutBlocks(look);
    assert.equal(new Set(order).size, order.length, `${look.id} repeats a block`);
    assert.deepEqual(Object.keys(look.defaults).sort(), [...order].sort(), `${look.id} defaults must cover exactly its blocks`);
    for (const block of order) {
      assert.ok(blockCatalog[block].variants[look.defaults[block]], `${look.id} default ${block}:${look.defaults[block]} does not exist`);
    }
    for (const [name, value] of Object.entries(look.tokens)) {
      assert.match(name, /^--site-[a-z0-9-]+$/, `${look.id} token ${name}`);
      assert.doesNotMatch(value, /url\(|["'\\]/, `${look.id} token ${name} value`);
    }
  }
});

test("the catalog is plain data", () => {
  const serialized = JSON.stringify(blockCatalog);
  assert.deepEqual(JSON.parse(serialized), blockCatalog);
  assert.equal(serialized.includes("function"), false);
  assert.equal(serialized.includes("<"), false, "markup belongs in fragments, not the catalog");
});
