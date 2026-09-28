import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { applyAlignmentAction, disabledAlignment, normalizeAlignmentSnapshot, styleQuestion, type CurrentQuestion } from "../lib/alignment.ts";
import { colorSetCatalog, defaultPaletteIdForVisualBrief, paletteIds } from "../lib/site-document.ts";

test("the look card recommends the given look and its default color set, with catalog ids only", () => {
  const card = styleQuestion(1, { briefId: "export-catalog", reason: "外贸目录按系列筛选。" });
  const [style, color] = card.questions ?? [];
  assert.equal(style.field, "style");
  assert.equal(color.field, "colorSet");
  const recommendedStyle = style.options.filter((option) => option.recommended);
  assert.deepEqual(recommendedStyle.map((option) => option.id), ["export-catalog"]);
  assert.equal(recommendedStyle[0].description, "外贸目录按系列筛选。");
  const setIds = new Set(colorSetCatalog.map((set) => `colorSet:${set.id}`));
  assert.ok(color.options.length >= 2 && color.options.length <= 4);
  for (const option of color.options) assert.ok(setIds.has(option.id), option.id);
  const recommendedColor = color.options.filter((option) => option.recommended);
  assert.equal(recommendedColor.length, 1);
  assert.equal(recommendedColor[0].paletteId, defaultPaletteIdForVisualBrief("export-catalog"));
});

test("an unknown color option never writes a palette outside the catalog", () => {
  const card: CurrentQuestion = {
    questionId: "card", questionRevision: 1, kind: "clarify", prompt: "开始前确认", options: [], allowOther: false,
    questions: [
      { questionId: "look", field: "style", prompt: "样子", allowOther: false, options: [{ id: "export-catalog", label: "蓝白目录", description: "" }, { id: "engineering-industrial", label: "工程工业", description: "" }] },
      { questionId: "color", field: "colorSet", prompt: "配色", allowOther: false, options: [{ id: "colorSet:hydraulic-blue", label: "液压蓝白", description: "", paletteId: "hydraulic-blue" }, { id: "colorSet:porcelain", label: "青花瓷", description: "", paletteId: "export-porcelain" }] },
    ],
  };
  const started = applyAlignmentAction(disabledAlignment(), { action: "start", pendingRequest: { message: "资料", baseRevision: 1, selectedTarget: null }, startQuestion: card });
  assert.ok(started.ok); if (!started.ok) return;
  const submitted = applyAlignmentAction(started.snapshot, {
    action: "select", questionId: "card", questionRevision: 1,
    selections: [{ questionId: "look", optionId: "export-catalog" }, { questionId: "color", optionId: "colorSet:hydraulic-blue" }],
  });
  assert.ok(submitted.ok); if (!submitted.ok) return;
  const paletteId = submitted.snapshot.paletteId;
  assert.ok(paletteId === null || paletteId === undefined || (paletteIds as readonly string[]).includes(paletteId), `wrote ${paletteId}`);
  assert.doesNotThrow(() => normalizeAlignmentSnapshot(JSON.parse(JSON.stringify(submitted.snapshot))));
});

test("the workspace turns 需求对齐 on by default for a site that was never generated", async () => {
  const source = await readFile(new URL("../app/workspace/page.tsx", import.meta.url), "utf8");
  assert.match(source, /hasGeneratedContent/);
  assert.match(source, /if \(!snapshot\.hasGeneratedContent\) setAlignmentEnabled\(true\)/);
  // Card color chips need the sized class; a bare <i> renders at 0×0 and the colors never show.
  assert.match(source, /cardColorSwatches\(option\.id, option\.swatches\)[\s\S]{0,400}className="palette-swatch-role"/);
});
