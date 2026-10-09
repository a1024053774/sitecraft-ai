import assert from 'node:assert/strict';
import test from 'node:test';
import {applyAlignmentAction,applyCommittedResult,disabledAlignment,normalizeAlignmentSnapshot,AlignmentTextTooLongError,type CurrentQuestion} from '../lib/alignment.ts';
const question:CurrentQuestion={questionId:'style-1',questionRevision:1,kind:'style',prompt:'选择风格',options:[{id:'precision',label:'精密工程',description:'参数与细线'},{id:'documentary',label:'现场实拍',description:'照片与大字'}],allowOther:false};
// Failure modes: stale answers commit; replay starts a second job; double confirm
// claims twice; cancellation discards prior answers; long snapshots are rewritten.
test('saved question/answer state survives reread and rejects a stale selection',()=>{
  const started=applyAlignmentAction(disabledAlignment(),{action:'start',startQuestion:question,pendingRequest:{message:'精密加工资料',baseRevision:0,selectedTarget:null}});assert.equal(started.ok,true);if(!started.ok)return;
  const stale=applyAlignmentAction(started.snapshot,{action:'select',questionId:'style-1',questionRevision:0,optionId:'precision'});assert.equal(stale.ok,false);if(stale.ok)return;assert.equal(stale.status,409);
  const selected=applyAlignmentAction(started.snapshot,{action:'select',questionId:'style-1',questionRevision:1,optionId:'precision'});assert.equal(selected.ok,true);if(!selected.ok)return;assert.equal(selected.shouldContinue,true);
  const reread=normalizeAlignmentSnapshot(JSON.parse(JSON.stringify(selected.snapshot)));assert.equal(reread.styleOptionId,'precision');assert.equal(reread.answers[0].label,'精密工程');
  const replay=applyAlignmentAction(reread,{action:'select',questionId:'style-1',questionRevision:1,optionId:'precision'});assert.equal(replay.ok,true);if(replay.ok)assert.equal(replay.shouldContinue,false);
});
test('confirmation validates question identity and claims exactly once, then completion replays without a job',()=>{
  const snapshot={...disabledAlignment(),enabled:true,state:'awaiting_confirmation' as const,currentQuestion:{...question,questionId:'plan-2',questionRevision:2,kind:'confirm_ops' as const},proposedChange:{questionId:'plan-2',questionRevision:2,summary:'首页与产品内容',rejected:[],baseRevision:0,model:'local-test-only',latencyMs:0}};
  const wrong=applyAlignmentAction(snapshot,{action:'confirm',questionId:'plan-1',questionRevision:2});assert.equal(wrong.ok,false);
  const first=applyAlignmentAction(snapshot,{action:'confirm',questionId:'plan-2',questionRevision:2});assert.equal(first.ok,true);if(!first.ok)return;assert.equal(first.shouldCommit,true);
  assert.equal(applyAlignmentAction(first.snapshot,{action:'confirm',questionId:'plan-2',questionRevision:2}).ok,false);
  const complete=applyCommittedResult(first.snapshot,{status:'applied',revision:1,summary:'版本已保存'});
  const replay=applyAlignmentAction(complete,{action:'confirm',questionId:'plan-2',questionRevision:2});assert.equal(replay.ok,true);if(replay.ok)assert.equal(replay.shouldCommit,false);
});
test('long persisted explanations fail visibly without silently truncating them',()=>{
  const snapshot={...disabledAlignment(),lastResult:{status:'error',summary:'拒收原因'.repeat(150)}};
  assert.throws(()=>normalizeAlignmentSnapshot(snapshot),AlignmentTextTooLongError);assert.equal(snapshot.lastResult.summary.length,600);
});
