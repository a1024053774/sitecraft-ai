// T-207: one demo site per workspace stage, all cut from the real 禾巷小馆 record (3e52f683, v3).
// Later stages keep the record as it is; earlier ones drop what had not happened yet.
// Only the site's display name changes (its test label is removed). Nothing is invented.
// Usage: node scripts/t207-build-demo-stages.mjs <source data root> <stage data root>
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
const [from, to] = process.argv.slice(2);
const sourceId = '3e52f683-e543-4561-999a-45097c55b174', conversationId = 'b7731875-8700-47e2-8dff-96463f26b818';
const read = file => JSON.parse(readFileSync(path.join(from, file), 'utf8'));
const site = { ...read(`code-sites/${sourceId}.json`), name: '禾巷小馆' };
const conversation = read(`conversations/${sourceId}/${conversationId}.json`);
const materials = conversation.turns[0].userMessage;
const generate = site.runs.find(run => run.kind === 'generate');
const disabled = { enabled: false, state: 'disabled', pendingRequest: null, currentQuestion: null, submittedCard: null, answers: [], proposedChange: null,
  lastResult: null, confirmClaimed: false, roundCount: 0, epoch: 0, inflightRunId: null, styleOptionId: null, styleLabel: null, history: [] };
const real = conversation.alignment, change = real.proposedChange;
const stages = {
  materials: { site: { materials: '', plan: null, versions: [], currentVersionId: null, run: null, runs: [], factSources: undefined }, turns: [], alignment: disabled },
  style: { site: { materials, plan: null, versions: [], currentVersionId: null, run: null, runs: [], factSources: undefined }, turns: [],
    alignment: { ...disabled, enabled: true, state: 'awaiting_style', epoch: 1, currentQuestion: real.submittedCard,
      pendingRequest: { message: materials, baseRevision: 0, selectedTarget: null }, history: real.history.slice(0, 1) } },
  outline: { site: { materials, versions: [], currentVersionId: null, run: null, runs: site.runs.filter(run => run.kind === 'plan'), factSources: undefined }, turns: [],
    alignment: { ...disabled, enabled: true, state: 'awaiting_confirmation', epoch: change.questionRevision, answers: real.answers, styleOptionId: real.styleOptionId, styleLabel: real.styleLabel,
      submittedCard: real.submittedCard, proposedChange: change, history: real.history.slice(0, 2),
      currentQuestion: { questionId: change.questionId, questionRevision: change.questionRevision, kind: 'confirm_ops', prompt: change.summary,
        options: [{ id: 'approve', label: '确认并生成', description: '按下面的大纲写网站' }], allowOther: false } } },
  progress: { site: { materials, versions: [], currentVersionId: null, factSources: undefined,
      run: { ...generate, status: 'running', step: '清理资源，检查事实与三档页面布局', repairRound: 0, issues: [] },
      runs: [...site.runs.filter(run => run.kind === 'plan'), { ...generate, status: 'running', step: '清理资源，检查事实与三档页面布局', repairRound: 0, issues: [] }] }, turns: [],
    alignment: { ...real, state: 'idle', currentQuestion: null, lastResult: null, history: real.history.slice(0, 3) } },
  // The state right before the second batch of annotations: v2 is current, its two drafts are written.
  v2: { site: { versions: site.versions.slice(0, 2), currentVersionId: site.versions[1].id, run: site.runs[2], runs: site.runs.slice(0, 3) },
    turns: conversation.turns.slice(0, 2), annotations: 2,
    alignment: { ...real, lastResult: { status: 'applied', summary: site.runs[2].step, revision: 2 }, history: real.history.slice(0, 4) } },
  site: { site: {}, turns: conversation.turns, alignment: real },
};
rmSync(to, { recursive: true, force: true });
const ids = {};
for (const [index, [name, stage]] of Object.entries(stages).entries()) {
  const siteId = `d7207000-0000-4000-8000-00000000000${index + 1}`; ids[name] = siteId;
  const record = { ...site, ...stage.site, siteId };
  for (const key of Object.keys(record)) if (record[key] === undefined) delete record[key];
  mkdirSync(path.join(to, 'code-sites'), { recursive: true });
  writeFileSync(path.join(to, 'code-sites', `${siteId}.json`), JSON.stringify(record, null, 2));
  mkdirSync(path.join(to, 'conversations', siteId), { recursive: true });
  writeFileSync(path.join(to, 'conversations', siteId, `${conversationId}.json`),
    JSON.stringify({ ...conversation, siteId, turns: stage.turns, alignment: stage.alignment }, null, 2));
  if (name === 'site' || name === 'v2') { mkdirSync(path.join(to, 'annotations'), { recursive: true });
    const annotations = JSON.parse(readFileSync(path.join(from, 'annotations', `${sourceId}.json`), 'utf8').replaceAll(sourceId, siteId));
    if (stage.annotations) annotations.annotations = annotations.annotations.slice(0, stage.annotations);
    writeFileSync(path.join(to, 'annotations', `${siteId}.json`), JSON.stringify(annotations, null, 2)); }
}
// The v2 stage's browser drafts are the real second batch, exactly as it was sent.
const drafts = site.runs[5].annotationBatch.map(({ draftId, target, revision, body }) => ({ id: draftId, target, revision, body, status: 'draft' }));
writeFileSync(path.join(to, 'stages.json'), JSON.stringify({ ids, v2Drafts: drafts }, null, 2));
console.log(ids);
