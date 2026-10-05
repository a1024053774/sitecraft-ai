import assert from "node:assert/strict";
import test from "node:test";
import { composeLookDocument } from "../lib/blocks/compose.ts";
import { baseFragment, blockFragments } from "../lib/blocks/fragments/index.ts";
import { blockLooks } from "../lib/blocks/looks/index.ts";
import { getTemplateAdapter } from "../lib/template-adapters/registry.ts";
import { resolveVars, rootTokens } from "./fixtures/look-tokens.ts";

// T-074: a fragment's CSS must not read a look token that some block look does not define. A
// var(--x) with no value and no fallback makes the whole declaration invalid (the border, colour
// or size silently disappears on that look). Every var() in every fragment is resolved against the
// :root of every block look. Declarations that read the bridge's run-time --sitecraft-* variables
// (set on elements, not on :root) are skipped.
//
// KNOWN_GAPS is a ratchet, not a licence. All current fragment tokens resolve on all four looks;
// a new gap fails, and a listed gap that now resolves fails too (delete it). New layouts must
// resolve their tokens on all four looks (give a fallback or a token on each look, as 型号索引表
// does with --site-index-top / --site-index-row).

const KNOWN_GAPS: string[] = [];

function declarations(css: string) {
  const found: Array<{ property: string; value: string }> = [];
  for (const match of css.matchAll(/([\w-]+):\s*([^;{}]*var\([^;{}]*)(?=;|})/g)) found.push({ property: match[1], value: match[2].trim() });
  return found;
}

test("every var() in every block fragment resolves on every block look", () => {
  const sources = [
    ["base", baseFragment],
    ...Object.entries(blockFragments),
  ] as const;
  assert.ok(blockLooks.length >= 4);
  const problems: string[] = [];
  for (const look of blockLooks) {
    const palette = getTemplateAdapter(look.templateId)?.kit?.tokens;
    assert.ok(palette, `${look.id} has a palette`);
    const tokens = rootTokens(composeLookDocument(look, palette));
    for (const [name, fragment] of sources) {
      for (const css of [fragment.css, fragment.narrow ?? "", fragment.phone ?? ""]) {
        for (const { property, value } of declarations(css)) {
          if (value.includes("--sitecraft-")) continue;
          if (resolveVars(value, tokens) === null) problems.push(`${look.id} / ${name}: ${property}: ${value}`);
        }
      }
    }
  }
  const found = [...new Set(problems)].sort();
  assert.deepEqual(found.filter((line) => !KNOWN_GAPS.includes(line)), [], "new declarations that have no value on some look");
  assert.deepEqual(KNOWN_GAPS.filter((line) => !found.includes(line)), [], "listed gaps that now resolve (remove them from KNOWN_GAPS)");
});
