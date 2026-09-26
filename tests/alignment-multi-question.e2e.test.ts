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

test("submitted single-question card retains recommendation, other note and palette choice in confirmation", async () => {
  const { normalizeAlignmentSnapshot, applyEditProposal, publicAlignmentView } = await import('../lib/alignment.ts');
  const question = { questionId:'palette-card', questionRevision:1, kind:'clarify' as const, prompt:'选择配色',options:[],allowOther:false, questions:[{questionId:'palette', field:'colorSet' as const,prompt:'色彩集',allowOther:true,options:[{id:'graphite',label:'石墨工坊',description:'适合工业',recommended:true},{id:'orange',label:'工程暖橙',description:'醒目'}]}] };
  const start = applyAlignmentAction(disabledAlignment(),{action:'start',pendingRequest:{message:'临港接头',baseRevision:1,selectedTarget:null},startQuestion:question});
  assert.ok(start.ok); if(!start.ok) return;
  const restored = normalizeAlignmentSnapshot(start.snapshot);
  assert.equal(restored.currentQuestion?.questions?.[0].options[0].recommended,true);
  const submitted = applyAlignmentAction(restored,{action:'select',questionId:'palette-card',questionRevision:1,selections:[{questionId:'palette',optionId:'other',note:'松石'}]});
  assert.ok(submitted.ok); if(!submitted.ok) return;
  const proposal=applyEditProposal(submitted.snapshot,{runId:submitted.runId!,summary:'生成临港接头',operations:[],rejected:[],baseRevision:1,model:null,latencyMs:0});
  assert.ok(!('stale' in proposal)); if('stale' in proposal) return;
  const view=publicAlignmentView(normalizeAlignmentSnapshot(proposal.snapshot));
  assert.match(view.question,/色彩集：松石/);
  assert.equal(view.questions[0].questionId,'palette');
  assert.equal(view.answers[0].note,'松石');
});
