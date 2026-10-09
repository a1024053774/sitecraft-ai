import { z } from 'zod';

export const OTHER_OPTION_ID = 'other';
export const MAX_ALIGNMENT_NOTE_CHARS = 500;
export const MAX_ALIGNMENT_SUMMARY_CHARS = 400;
export const MAX_ALIGNMENT_HISTORY = 20;
export const MAX_ALIGNMENT_ROUNDS = 3;

export type AlignmentModeState =
  | "disabled"
  | "awaiting_style"
  | "awaiting_user"
  | "awaiting_confirmation"
  | "idle"
  | "cancelled";
export type AlignmentQuestionKind = "style" | "clarify" | "confirm_ops";
export type AlignmentOption = { id: string; label: string; description: string; recommended?: boolean };
export type AlignmentHistoryEntry = {
  at: string;
  action: string;
  optionId?: string;
  summary?: string;
};
export type PendingRequest = {
  message: string;
  baseRevision: number;
  selectedTarget: string | null;
};
export type CurrentQuestion = {
  questionId: string;
  questionRevision: number;
  kind: AlignmentQuestionKind;
  prompt: string;
  options: AlignmentOption[];
  allowOther: boolean;
  /** A card may contain 1–4 independent questions submitted together. */
  questions?: AlignmentCardQuestion[];
};
export type AlignmentCardQuestion = {
  field?: "goal" | "pages" | "style" | "other";
  questionId: string;
  prompt: string;
  options: AlignmentOption[];
  allowOther: boolean;
};
export type AlignmentAnswer = {
  questionId: string;
  questionRevision: number;
  question: string;
  optionId: string;
  label: string;
  note: string | null;
};
export type ProposedChange = {
  summary: string;
  rejected: string[];
  baseRevision: number;
  questionId: string;
  questionRevision: number;
  model: string | null;
  latencyMs: number;
};
export type RecordedResult = {
  status: "applied" | "answer" | "no_change" | "conflict" | "error";
  summary?: string;
  text?: string;
  revision?: number;
};
export type AlignmentSnapshot = {
  enabled: boolean;
  state: AlignmentModeState;
  pendingRequest: PendingRequest | null;
  currentQuestion: CurrentQuestion | null;
  submittedCard?: CurrentQuestion | null;
  answers: AlignmentAnswer[];
  proposedChange: ProposedChange | null;
  lastResult: RecordedResult | null;
  confirmClaimed: boolean;
  roundCount: number;
  epoch: number;
  inflightRunId: string | null;
  styleOptionId: string | null;
  styleLabel: string | null;
  history: AlignmentHistoryEntry[];
};
export type AlignmentActionName = "start" | "select" | "confirm" | "cancel" | "state";
export type AlignmentActionInput = {
  action: AlignmentActionName;
  questionId?: string;
  questionRevision?: number;
  optionId?: string;
  note?: string;
  selections?: Array<{ questionId: string; optionId: string; note?: string }>;
  pendingRequest?: PendingRequest | null;
  /** The workflow supplies the question to persist. */
  startQuestion?: CurrentQuestion | null;
};
export type AlignmentPublicView = {
  enabled: boolean;
  state: AlignmentModeState;
  questionId: string | null;
  questionRevision: number;
  questionKind: AlignmentQuestionKind | null;
  question: string;
  options: AlignmentOption[];
  utilities: AlignmentOption[];
  selectedOptionId: string | null;
  selectedLabel: string | null;
  summary: string | null;
  saved: boolean;
  waitingForUser: boolean;
  awaitingConfirmation: boolean;
  prefsOnly: boolean;
  cannotProceed: boolean;
  pendingMessage: string | null;
  lastResult: RecordedResult | null;
  styleLabel: string | null;
  answers: AlignmentAnswer[];
  questions: AlignmentCardQuestion[];
  processing: boolean;
};
export type AlignmentActionSuccess = {
  ok: true;
  snapshot: AlignmentSnapshot;
  view: AlignmentPublicView;
  shouldContinue: boolean;
  shouldCommit: boolean;
  runId: string | null;
};
export type AlignmentActionFailure = {
  ok: false;
  status: 400 | 409;
  code: "invalid_option" | "stale_question" | "invalid_state" | "invalid_payload";
  error: string;
  snapshot: AlignmentSnapshot;
};
export type AlignmentActionResult = AlignmentActionSuccess | AlignmentActionFailure;

const optionSchema = z.object({ id:z.string().min(1).max(80), label:z.string().min(1).max(80), description:z.string().max(200), recommended:z.boolean().optional() });
const cardQuestionSchema = z.object({ field:z.enum(['goal','pages','style','other']).optional(), questionId:z.string().min(1).max(80), prompt:z.string().min(1).max(800), options:z.array(optionSchema).min(2).max(4), allowOther:z.boolean() });
// confirm_ops is the persisted confirmation-card discriminator used by existing
// code-site conversations. No operation schema, planner or executor remains.
const questionSchema = z.object({ questionId:z.string().min(1).max(80), questionRevision:z.number().int().nonnegative(), kind:z.enum(['style','clarify','confirm_ops']), prompt:z.string().min(1).max(800), options:z.array(optionSchema).max(12), allowOther:z.boolean(), questions:z.array(cardQuestionSchema).min(1).max(4).optional() });
const answerSchema = z.object({ questionId:z.string(), questionRevision:z.number().int().nonnegative(), question:z.string().max(800).default(''), optionId:z.string(), label:z.string().max(80), note:z.string().max(500).nullable() });
const resultSchema = z.object({ status:z.enum(['applied','answer','no_change','conflict','error']), summary:z.string().max(400).optional(), text:z.string().max(4000).optional(), revision:z.number().int().nonnegative().optional() });
export const alignmentSnapshotSchema = z.object({
  enabled:z.boolean(), state:z.enum(['disabled','awaiting_style','awaiting_user','awaiting_confirmation','idle','cancelled']),
  pendingRequest:z.object({message:z.string().min(1).max(4000),baseRevision:z.number().int().nonnegative(),selectedTarget:z.string().max(200).nullable()}).nullable().default(null),
  currentQuestion:questionSchema.nullable().default(null), submittedCard:questionSchema.nullable().optional(), answers:z.array(answerSchema).max(20).default([]),
  proposedChange:z.object({summary:z.string().min(1).max(400),rejected:z.array(z.string().max(200)).max(20),baseRevision:z.number().int().nonnegative(),questionId:z.string(),questionRevision:z.number().int().nonnegative(),model:z.string().max(120).nullable(),latencyMs:z.number()}).nullable().default(null),
  lastResult:resultSchema.nullable().default(null),confirmClaimed:z.boolean().default(false),roundCount:z.number().int().nonnegative().default(0),epoch:z.number().int().nonnegative().default(0),inflightRunId:z.string().max(80).nullable().default(null),
  styleOptionId:z.string().max(80).nullable().default(null),styleLabel:z.string().max(80).nullable().default(null),history:z.array(z.object({at:z.string(),action:z.string().max(40),optionId:z.string().max(80).optional(),summary:z.string().max(400).optional()})).max(20).default([]),
});
export class AlignmentTextTooLongError extends Error {
  constructor(){super('会话说明过长，此会话暂时不可用。已保存的网站和版本仍可查看，完整检查问题仍保留；请联系维护者处理会话记录。');this.name='AlignmentTextTooLongError'}
}
export class AlignmentActionError extends Error {
  readonly status:400|409;readonly code:AlignmentActionFailure['code'];
  constructor(result:AlignmentActionFailure){super(result.error);this.name='AlignmentActionError';this.status=result.status;this.code=result.code}
}
export function disabledAlignment():AlignmentSnapshot {
  return {enabled:false,state:'disabled',pendingRequest:null,currentQuestion:null,submittedCard:null,answers:[],proposedChange:null,lastResult:null,confirmClaimed:false,roundCount:0,epoch:0,inflightRunId:null,styleOptionId:null,styleLabel:null,history:[]};
}
export function normalizeAlignmentSnapshot(raw:unknown):AlignmentSnapshot {
  if(raw==null || (typeof raw==='object' && !Array.isArray(raw) && !Object.keys(raw).length))return disabledAlignment();
  const result=alignmentSnapshotSchema.safeParse(raw);
  if(!result.success){if(result.error.issues.every(issue=>issue.code==='too_big' && issue.origin==='string'))throw new AlignmentTextTooLongError();throw new Error('Invalid alignment snapshot')}
  return result.data;
}
export function otherOption():AlignmentOption {return {id:'other',label:'其他',description:'补充你的要求'}}
export function publicAlignmentView(snapshot:AlignmentSnapshot,extras:{saved?:boolean;prefsOnly?:boolean;cannotProceed?:boolean}={}):AlignmentPublicView {
  const q=snapshot.currentQuestion,last=snapshot.answers.at(-1),processing=!!snapshot.inflightRunId || (snapshot.confirmClaimed && !snapshot.lastResult);
  return {enabled:snapshot.enabled,state:snapshot.state,questionId:q?.questionId??null,questionRevision:q?.questionRevision??0,questionKind:q?.kind??null,question:q?.prompt??'',options:q?.options??[],utilities:q?.allowOther?[otherOption()]:[],
    selectedOptionId:last && q && last.questionId===q.questionId?last.optionId:q?null:snapshot.styleOptionId,selectedLabel:last && q && last.questionId===q.questionId?last.label:q?null:snapshot.styleLabel,
    summary:snapshot.proposedChange?.summary??snapshot.lastResult?.summary??null,saved:!!extras.saved,waitingForUser:!!q && !processing && !extras.cannotProceed,awaitingConfirmation:snapshot.state==='awaiting_confirmation',prefsOnly:!!extras.prefsOnly,cannotProceed:!!extras.cannotProceed,
    pendingMessage:snapshot.pendingRequest?.message??null,lastResult:snapshot.lastResult,styleLabel:snapshot.styleLabel,answers:snapshot.answers,questions:(q?.kind==='confirm_ops'?snapshot.submittedCard:q)?.questions??[],processing};
}
function success(snapshot:AlignmentSnapshot,flags:{saved?:boolean;shouldContinue?:boolean;shouldCommit?:boolean}={}):AlignmentActionSuccess {
  return {ok:true,snapshot,view:publicAlignmentView(snapshot,{saved:flags.saved}),shouldContinue:!!flags.shouldContinue,shouldCommit:!!flags.shouldCommit,runId:snapshot.inflightRunId};
}
function failure(snapshot:AlignmentSnapshot,status:400|409,code:AlignmentActionFailure['code'],error:string):AlignmentActionFailure{return {ok:false,snapshot,status,code,error}}
function history(snapshot:AlignmentSnapshot,action:string):AlignmentHistoryEntry[]{return [...snapshot.history,{at:new Date().toISOString(),action}].slice(-MAX_ALIGNMENT_HISTORY)}
export function applyAlignmentAction(current:AlignmentSnapshot,input:AlignmentActionInput):AlignmentActionResult {
  if(input.action==='state')return success(current);
  if(input.action==='start'){
    if(current.inflightRunId || current.confirmClaimed && !current.lastResult)return failure(current,409,'invalid_state','当前任务还在进行。');
    if(current.currentQuestion)return success(current);
    if(!input.startQuestion)return failure(current,400,'invalid_payload','缺少要保存的需求问题。');
    const next={...current,enabled:true,state:'awaiting_style' as const,pendingRequest:input.pendingRequest??null,currentQuestion:input.startQuestion,submittedCard:null,proposedChange:null,lastResult:null,confirmClaimed:false,epoch:current.epoch+1,history:history(current,'start')};
    return success(next);
  }
  if(input.action==='cancel'){
    if(current.confirmClaimed && !current.lastResult)return failure(current,409,'invalid_state','正在提交已确认的方案。');
    return success({...current,enabled:false,state:'cancelled',currentQuestion:null,submittedCard:null,proposedChange:null,confirmClaimed:false,inflightRunId:null,pendingRequest:null,lastResult:null,roundCount:0,history:history(current,'cancel')});
  }
  if(input.action==='confirm'){
    const p=current.proposedChange,q=current.currentQuestion;
    if(!input.questionId || input.questionRevision===undefined)return failure(current,400,'invalid_payload','确认请求缺少问题 ID 或版本。');
    if(!p || input.questionId!==p.questionId || input.questionRevision!==p.questionRevision)return failure(current,409,'stale_question','问题版本已更新，请使用最新确认。');
    if(current.lastResult && ['applied','no_change','conflict'].includes(current.lastResult.status))return success(current);
    if(current.confirmClaimed)return failure(current,409,'invalid_state','正在提交已确认的方案。');
    if(!q || q.kind!=='confirm_ops')return failure(current,400,'invalid_state','当前没有待确认的页面大纲。');
    if(input.questionId!==q.questionId || input.questionRevision!==q.questionRevision)return failure(current,409,'stale_question','问题版本已更新，请使用最新确认。');
    return success({...current,confirmClaimed:true,inflightRunId:null,history:history(current,'confirm')},{shouldCommit:true});
  }
  if(input.action==='select'){
    const q=current.currentQuestion;
    if(!q || q.kind==='confirm_ops')return failure(current,400,'invalid_state','当前没有可回答的问题。');
    if(input.questionId!==q.questionId || input.questionRevision!==q.questionRevision)return failure(current,409,'stale_question','问题版本已更新，请使用最新选项。');
    const questions=q.questions??[{questionId:q.questionId,prompt:q.prompt,options:q.options,allowOther:q.allowOther}];
    const selections=input.selections??(input.optionId?[{questionId:q.questionId,optionId:input.optionId,note:input.note}]:[]);
    if(selections.length!==questions.length || new Set(selections.map(s=>s.questionId)).size!==questions.length)return failure(current,400,'invalid_payload','请完成这张卡上的所有问题后一次提交。');
    const answers:AlignmentAnswer[]=[];let style=current.styleOptionId,label=current.styleLabel;
    for(const question of questions){
      const selection=selections.find(s=>s.questionId===question.questionId);
      if(!selection)return failure(current,400,'invalid_payload','缺少当前问题的答案。');
      const option=selection.optionId==='other' && question.allowOther?otherOption():question.options.find(o=>o.id===selection.optionId);
      if(!option)return failure(current,400,'invalid_option','未知的选项。');
      const note=selection.note?.trim()||null;
      if(note && note.length>MAX_ALIGNMENT_NOTE_CHARS)return failure(current,400,'invalid_payload','补充说明超过 500 字。');
      if(option.id==='other' && !note)return failure(current,400,'invalid_payload','选择其他时请填写补充说明。');
      answers.push({questionId:question.questionId,questionRevision:q.questionRevision,question:question.prompt,optionId:option.id,label:option.label,note});
      if(q.kind==='style' && (!('field' in question) || question.field==='style')){style=option.id;label=option.label}
    }
    if(answers.every(a=>current.answers.some(old=>old.questionId===a.questionId && old.questionRevision===a.questionRevision && old.optionId===a.optionId && old.note===a.note)))return success(current,{saved:true});
    if(current.inflightRunId || current.confirmClaimed && !current.lastResult)return failure(current,409,'invalid_state','当前任务还在进行。');
    const next:AlignmentSnapshot={...current,submittedCard:q,styleOptionId:style,styleLabel:label,answers:[...current.answers.filter(a=>!answers.some(n=>n.questionId===a.questionId)),...answers].slice(-20),inflightRunId:current.pendingRequest?crypto.randomUUID():null,state:current.pendingRequest?'awaiting_user':'idle',currentQuestion:current.pendingRequest?q:null,epoch:current.epoch+1,lastResult:null,history:history(current,'select')};
    return success(next,{saved:true,shouldContinue:!!next.inflightRunId});
  }
  return failure(current,400,'invalid_payload','未知的需求对齐操作。');
}
export function applyCommittedResult(snapshot:AlignmentSnapshot,result:RecordedResult):AlignmentSnapshot {
  const lastResult = {...result,
    ...(result.summary === undefined ? {} : {summary:result.summary.length>400?result.summary.slice(0,399)+'…':result.summary}),
    ...(result.text === undefined ? {} : {text:result.text.length>4000?result.text.slice(0,3999)+'…':result.text})};
  return {...snapshot,state:'idle',currentQuestion:null,pendingRequest:null,inflightRunId:null,confirmClaimed:false,lastResult,history:[...snapshot.history,{at:new Date().toISOString(),action:result.status,...(lastResult.summary===undefined?{}:{summary:lastResult.summary})}].slice(-20)};
}
