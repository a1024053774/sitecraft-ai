import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync("scripts/check-published.mjs", "utf8");
const start = source.indexOf("function judge(");
const end = source.indexOf("\n  return failures;\n}", start) + "\n  return failures;\n}".length;
assert.ok(start >= 0 && end > start);
const judge = new Function("missingFacts", "TEXT_FIT_FAILURES", "FORBIDDEN_TEXT", `${source.slice(start, end)}; return judge;`)(() => [], [], []);
const report = () => ({
  measurement: { visibleBlocks: ["hero"], measuredBlocks: ["hero"], textContrastEntries: 2, bodyParagraphs: 1 },
  editorCursor: "", editorHoverOutline: false, horizontalScroll: false, cardOverflow: 0,
  heroOrphan: false, heroTitleWordBreak: false, englishSpecValueHan: [], numbering: 0, phoneNav: true,
  contactVisible: true, formVisible: true, ctaTargetVisible: true, ctaLandsOnForm: true,
  broken: [], photoCount: 5, saysSchematicOnly: false, text: "", readable: "",
});
const image = (extra = {}) => ({ imageId: "img_inspection", originalName: "inspection.jpg", category: "inspection", expectedSections: ["capabilities"], exempt: false, matches: [], ...extra });
const coverage = (images: unknown[]) => ({ expectedCount: images.length, inspectedCount: images.length, images });

test("T-109 published check fails without a verifiable uploaded-image coverage report", () => {
  assert.ok(judge(report(), []).some((x: string) => x.includes("image coverage incomplete")));
});

test("T-109 published check rejects an invisible uploaded photo even when photoCount is positive", () => {
  const failures = judge({ ...report(), imageCoverage: coverage([image({ matches: [{visible:false,decoded:true,section:"capabilities",category:"inspection"}] })]) }, []);
  assert.ok(failures.some((x: string) => x.includes("img_inspection") && x.includes("visible")), failures.join("; "));
});

test("T-109 published check requires decode and the declared category destination", () => {
  for (const match of [
    {visible:true,decoded:false,section:"capabilities",category:"inspection"},
    {visible:true,decoded:true,section:"products",category:"product"},
  ]) {
    const failures = judge({ ...report(), imageCoverage: coverage([image({matches:[match]})]) }, []);
    assert.ok(failures.some((x: string) => x.includes("img_inspection")), failures.join("; "));
  }
});

test("T-109 published check exempts user-hidden images but rejects visible photos in that exemption", () => {
  const hidden = image({exempt:true,exemptionReason:"hiddenSections:capabilities",matches:[]});
  assert.deepEqual(judge({ ...report(), imageCoverage: coverage([hidden]) }, []), []);
  const leaked = {...hidden,matches:[{visible:true,decoded:true,section:"capabilities",category:"inspection"}]};
  assert.ok(judge({ ...report(), imageCoverage: coverage([leaked]) }, []).some((x: string) => x.includes("explicitly hidden")));
});
