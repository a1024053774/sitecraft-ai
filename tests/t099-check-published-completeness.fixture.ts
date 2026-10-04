import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

function extractJudge(source: string) {
  const start = source.indexOf("function judge(");
  const end = source.indexOf("\n  return failures;\n}", start) + "\n  return failures;\n}".length;
  if (start < 0 || end < 0) throw new Error("could not extract check-published judge");
  return source.slice(start, end);
}

test("a report with no measurement metadata is rejected instead of silently passing", async () => {
  const source = await readFile(process.env.T099_CHECK_PUBLISHED_SOURCE || "scripts/check-published.mjs", "utf8");
  const judge = new Function("missingFacts", "TEXT_FIT_FAILURES", "FORBIDDEN_TEXT", `${extractJudge(source)}; return judge;`)(() => [], [], []) as (report: Record<string, unknown>, facts: unknown[]) => string[];
  const failures = judge({ editorCursor: "", editorHoverOutline: false, horizontalScroll: false, pageSectionOrder: [], cardOverflow: 0, textFit: [], textContrast: [], bodyLineLength: [], heroOrphan: false, heroTitleWordBreak: false, englishSpecValueHan: [], brandClipped: false, headerOverflow: false, headerControlStacked: false, heroPhotoCovered: false, numbering: 0, phoneNav: true, contactVisible: true, formVisible: true, ctaTargetVisible: true, ctaLandsOnForm: true, broken: [], photoCount: 0, saysSchematicOnly: false, text: "", readable: "" }, []);
  assert.ok(failures.some((failure) => failure.includes("measurement incomplete")), failures.join("；"));
});
