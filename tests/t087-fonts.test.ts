import assert from "node:assert/strict";
import test from "node:test";
import { getTemplateAdapter } from "../lib/template-adapters/index.ts";

const LOOK_TEMPLATES = ["screwfast", "landwind", "forge", "tailwind-landing"] as const;
const CJK_FALLBACKS = ["PingFang SC", "Noto Sans SC", "Microsoft YaHei"] as const;

test("all production look kits declare the shared Chinese fallback stack", () => {
  for (const templateId of LOOK_TEMPLATES) {
    const font = getTemplateAdapter(templateId)?.kit?.tokens.font ?? "";
    for (const fallback of CJK_FALLBACKS) {
      assert.ok(font.includes(`"${fallback}"`), `${templateId} should include ${fallback} in its font token`);
    }
  }
});
