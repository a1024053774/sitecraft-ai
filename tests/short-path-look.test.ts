import assert from "node:assert/strict";
import test from "node:test";
import { shortPathLook } from "../lib/blocks/looks/short-path.ts";

test("灰底短路径 look declares its tokenized layout seams", () => {
  const look = shortPathLook;
  assert.equal(look.id, "technical-product");
  assert.equal(look.templateId, "tailwind-landing");
  assert.equal(look.layout.main.join(","), "hero,products,commercialTerms,equipment,qualityProcess,history,industries,capabilities,services,contact,certifications,faq");
  for (const token of [
    "--site-head-dash",
    "--site-h1-leading",
    "--site-h1-tracking",
    "--site-h1-narrow",
    "--site-hero-columns",
    "--site-product-columns",
    "--site-keys-columns",
    "--site-key-display",
    "--site-catalog-columns",
    "--site-step-gap",
    "--site-steps-bg",
    "--site-step-min",
    "--site-inquiry-bg",
    "--site-contact-line-size",
    "--site-submit-width",
  ]) assert.equal(typeof look.tokens[token], "string", `${token} token`);
});
