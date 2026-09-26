import assert from "node:assert/strict";
import test from "node:test";
import { applyAlignmentAction, disabledAlignment, type CurrentQuestion } from "../lib/alignment.ts";

test("alignment card exposes 1-4 questions and commits all selections once", () => {
  const card: CurrentQuestion = {
    questionId: "card-1",
    questionRevision: 1,
    kind: "clarify",
    prompt: "选择建站方向",
    questions: [
      { questionId: "goal", prompt: "主要行动", options: [{ id: "rfq", label: "询价", description: "" }], allowOther: false },
      { questionId: "palette", prompt: "配色", options: [{ id: "orange", label: "工程暖橙", description: "推荐" }], allowOther: false },
    ],
    options: [],
    allowOther: false,
  };
  const started = applyAlignmentAction(disabledAlignment(), { action: "start", pendingRequest: { message: "资料", baseRevision: 0, selectedTarget: null }, startQuestion: card });
  assert.equal(started.ok, true);
  if (!started.ok) return;
  assert.equal(started.snapshot.currentQuestion?.questions?.length, 2);
  const submitted = applyAlignmentAction(started.snapshot, {
    action: "select",
    questionId: "card-1",
    questionRevision: 1,
    selections: [
      { questionId: "goal", optionId: "rfq" },
      { questionId: "palette", optionId: "orange" },
    ],
  });
  assert.equal(submitted.ok, true);
  if (!submitted.ok) return;
  assert.equal(submitted.snapshot.answers.length, 2);
});
