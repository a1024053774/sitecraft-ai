import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const hostCss = readFileSync(new URL("../public/visitor-host.css", import.meta.url), "utf8");
const previewPage = readFileSync(new URL("../app/templates/[templateId]/preview/page.tsx", import.meta.url), "utf8");

test("template preview controls have static visitor-host definitions", () => {
  for (const className of ["icon-button", "primary-button", "secondary-button", "template-tag"]) {
    assert.match(previewPage, new RegExp(`className=\\"[^\\"]*${className}`), `${className} is used by the preview toolbar`);
    assert.match(hostCss, new RegExp(`\\.${className}\\b`), `${className} must be styled without workspace CSS`);
  }
  assert.match(previewPage, /visitor-host\.css/);
  assert.doesNotMatch(previewPage, /globals\.css/);
});
