import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { packDraft } from "./fixtures/pack-drafts.ts";
import { openBrowser } from "./helpers/workspace-browser.ts";
import { engineeringLook } from "../lib/blocks/looks/engineering.ts";

const fitSource = readFileSync("scripts/visitor-text-fit-scan.js", "utf8");

test("T-063 uses declared character CSS sizing without a look-specific selector", () => {
  assert.equal(engineeringLook.fitText, "container");
  const bridge = readFileSync("lib/template-adapters/preview-bridge.ts", "utf8");
  const hero = readFileSync("lib/blocks/fragments/hero.ts", "utf8");
  const nav = readFileSync("lib/blocks/fragments/nav.ts", "utf8");
  assert.match(bridge, /--sitecraft-title-chars/);
  assert.match(bridge, /--sitecraft-brand-chars/);
  assert.match(hero, /container-type:\s*inline-size/);
  assert.match(hero, /100cqw/);
  assert.match(nav, /100cqw/);
  assert.doesNotMatch(hero, /sitecraft-look-engineering/);
  assert.doesNotMatch(nav, /sitecraft-look-engineering/);
});

test("original engineering titles and company name fit in every published viewport", async () => {
  const browser = await openBrowser();
  const { targetId } = await browser.send("Target.createTarget", { url: `http://127.0.0.1:3034/api/templates/screwfast/preview?t063=${Date.now()}` }) as { targetId: string };
  const { sessionId } = await browser.send("Target.attachToTarget", { targetId, flatten: true }) as { sessionId: string };
  try {
    await browser.send("Runtime.enable", {}, sessionId);
    for (let waited = 0; waited < 15000; waited += 100) {
      if (await browser.eval<boolean>("document.readyState === 'complete' && typeof window.__sitecraftApplyDeclared === 'function'", sessionId).catch(() => false)) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    const draft = packDraft("molding");
    draft.companyName = "宁海精密注塑模具P3T";
    draft.content.hero.title = { zh: "精密注塑模具与注塑件", en: "Precision injection molds and molded parts" };
    for (const width of [375, 768, 1440]) for (const locale of ["zh", "en"]) {
      await browser.send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width === 375 }, sessionId);
      await browser.eval(`window.__sitecraftApplyDeclared(${JSON.stringify(draft)}, ${JSON.stringify(locale)}, [], "published", null, true); document.fonts.ready`, sessionId);
      const failures = await browser.eval(`(${fitSource})(document.body).filter((item) => item.kind === "overflow" || item.kind === "clipped" || item.kind === "viewport")`, sessionId);
      assert.deepEqual(failures, [], `${locale} @${width}: ${JSON.stringify(failures)}`);
    }
  } finally {
    await browser.send("Target.closeTarget", { targetId }).catch(() => {});
    browser.ws.close();
  }
});
