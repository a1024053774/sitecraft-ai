import assert from "node:assert/strict";
import test from "node:test";
import { engineeringLook } from "../lib/blocks/looks/engineering.ts";

const sharedStyleTokens = {
  "--site-h1-leading": "1.1",
  "--site-h1-tracking": "-0.03em",
  "--site-heading-tracking": "-0.02em",
  "--site-card-radius": "0",
  "--site-media-radius": "0",
  "--site-panel-radius": "0",
  "--site-tile-radius": "0",
  "--site-control-radius": "0",
  "--site-primary-bg": "var(--site-accent-strong)",
  "--site-primary-hover": "var(--site-ink)",
  "--site-plate-bg": "var(--site-ink)",
  "--site-plate-ink": "#fff",
  "--site-plate-muted": "rgba(255, 255, 255, 0.66)",
  "--site-plate-border": "none",
  "--site-specs-top": "3px solid var(--site-accent)",
  "--site-spec-gap": "0",
  "--site-spec-cell-bg": "transparent",
  "--site-key-bg": "transparent",
  "--site-key-gap": "0",
  "--site-key-divider": "var(--site-rule)",
  "--site-footer-bg": "var(--site-ink)",
  "--site-footer-ink": "rgba(255, 255, 255, 0.72)",
  "--site-footer-head": "#fff",
  "--site-footer-top": "none",
  "--site-eyebrow": "var(--site-muted)",
};

test("engineering industrial supplies the shared block-style tokens", () => {
  for (const [name, value] of Object.entries(sharedStyleTokens)) assert.equal(engineeringLook.tokens[name], value, name);
});
