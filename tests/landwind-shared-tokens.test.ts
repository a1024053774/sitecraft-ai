import assert from "node:assert/strict";
import test from "node:test";
import { engineeringLook } from "../lib/blocks/looks/engineering.ts";

// T-056 step 1: the common fragments need named seams for the catalog look while engineering
// receives the exact current values so its existing rendered pages stay unchanged.
test("engineering fills the catalog migration token seams with current values", () => {
  const expected = {
    "--site-hero-bg": "var(--site-surface)",
    "--site-frame-pad": "0",
    "--site-frame-bg": "transparent",
    "--site-frame-border": "none",
    "--site-eyebrow-bg": "transparent",
    "--site-eyebrow-pad": "0",
    "--site-head-rule": "none",
    "--site-head-pad": "0",
    "--site-value-ink": "var(--site-ink)",
    "--site-keys-border": "var(--site-rule)",
    "--site-card-edge": "none",
    "--site-badge-edge": "none",
    "--site-panel-edge": "none",
    "--site-step-top": "none",
    "--site-list-marker": "0",
    "--site-catalog-row": "minmax(0, 11em) minmax(0, 1fr)",
    "--site-spec-table-border": "var(--site-rule)",
    "--site-spec-table-head": "transparent",
    "--site-panel-bg": "var(--site-tint)",
    "--site-panel-copy-bg": "transparent",
    "--site-form-card": "var(--site-surface)",
  };
  for (const [name, value] of Object.entries(expected)) assert.equal(engineeringLook.tokens[name], value, name);
});
