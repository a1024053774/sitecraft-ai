import assert from "node:assert/strict";
import test from "node:test";
import { engineeringLook } from "../lib/blocks/looks/engineering.ts";
import { navFragment } from "../lib/blocks/fragments/nav.ts";

test("engineering hero titles opt into declared word spans and its mobile brand can wrap", () => {
  assert.equal(engineeringLook.heroTitle, "words");
  const css = `${navFragment.css}\n${navFragment.narrow ?? ""}`;
  assert.match(css, /sitecraft-look-engineering-industrial[\s\S]*sitecraft-brand-name/);
  assert.match(css, /overflow-wrap:\s*anywhere/);
});
