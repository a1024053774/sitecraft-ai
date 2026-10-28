'use client';

// 草稿集合与编号列表改编自 BaoCut（JimLiu/baocut@7aa049e8），BaoCut Community License。
// 仅画板批注；本地持久化与单区块发送使用 SiteCraft 合同，来源见 resources/baocut-annotation/SOURCE.md。

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { providerHeaders } from '@/lib/provider-settings-client';
import { browserStorageMode, pullSite } from '@/lib/browser-sites-client';
import Link from 'next/link';
import { ArrowLeft, Check, Download, FileText, History, Image as ImageIcon, LoaderCircle, RotateCcw, Send, Trash2 } from 'lucide-react';
import Papa from 'papaparse';
import readXlsxFile from 'read-excel-file';
import type { CodeSiteRecord, CodePreferences } from '@/lib/code-site';
import { codeCheckLabel, codeVersionAuthor, chineseCodeRevision, codeFactMaterials, explicitEnglishCompanyName } from '@/lib/code-site';
import type { AlignmentPublicView } from '@/lib/alignment';
import type { ConversationTurn } from '@/lib/conversation-store';
import { simulatedPackList } from '@/lib/simulated-packs';
import { CodeVersionHistory } from './code-version-history';
import { annotationTargetSchema, annotationCaptureSchema, annotationDraftSchema, type AnnotationDraft, type AnnotationTarget, type AnnotationThread } from '@/lib/annotations';
import { CodePreviewSelection } from './code-preview-selection';
import { CodePreviewCitations } from './code-preview-citations';
import { SiteDeleteDialog } from './site-delete-panel';
import { codeStyles, codeStyleSchema, codePreferencesSchema, codeSliderBand } from '@/lib/code-site-styles';

function CodeStyleChoice({ siteId, alignment, initial, busy, onSelect, onCancel }: { siteId: string; alignment: AlignmentPublicView;
  initial: CodePreferences; busy: boolean; onSelect: (preferences: CodePreferences) => void; onCancel: () => void }) {
  const [preferences, setPreferences] = useState(initial), [draftError, setDraftError] = useState('');
  const validPreference = codePreferencesSchema.safeParse(preferences).success;
  const draftKey = `sitecraft-style:${siteId}:${alignment.questionId}`;
  useEffect(() => {
    const saved = localStorage.getItem(draftKey);
    if (!saved) return;
    try { setPreferences(codePreferencesSchema.parse(JSON.parse(saved))); }
    catch { setDraftError('上次未提交的风格选择无法读取，请重新选择。'); }
  }, [draftKey]);
  function change(patch: Partial<CodePreferences>) {
    const next = { ...preferences, ...patch };
    setPreferences(next); localStorage.setItem(draftKey, JSON.stringify(next)); setDraftError('');
  }
  return <section className="alignment-panel" aria-label="需求对齐" data-testid="code-style-question">
    <strong>{alignment.question}</strong>
    <fieldset className="code-style-options" disabled={busy}><legend className="sr-only">网站风格</legend>{alignment.options.filter(option => option.id === 'auto' || codeStyleSchema.safeParse(option.id).success).map(option => {
      const id = codeStyleSchema.safeParse(option.id);
      const preview = id.success ? codeStyles[id.data].preview : null;
      return <label key={option.id} className={`code-style-card${option.id === 'auto' ? ' code-style-auto' : ''}`}>
        <input type="radio" name="code-style" value={option.id} checked={preferences.style === option.id} onChange={() => change({ style: option.id as CodePreferences['style'] })} />
        {preview && (preview.status === 'ready' ? <img className="code-style-preview" src={preview.src} alt={`${option.label}：真实生成站点首屏示例`} width="576" height="400" />
          : <span className="code-style-pending">待生成<small>新风格，示例待补</small></span>)}
        <span className="code-style-copy"><strong>{option.label}</strong><small>{option.description}</small></span>
      </label>;
    })}</fieldset>
    <p className="code-style-caption">缩略图来自已生成站点，具体排法随资料变化。<a href="/style-previews/SOURCE.md" target="_blank" rel="noreferrer">示例来源</a></p>
    {(['layout', 'density'] as const).map(kind => {
      const band = codeSliderBand(kind, preferences[kind]);
      return <label className="code-slider" key={kind}>{kind === 'layout' ? '版式：规整 ↔ 大胆' : '信息：疏朗 ↔ 紧凑'} <output>{band.label} · {preferences[kind]}</output>
        <input aria-label={kind === 'layout' ? '版式' : '信息密度'} aria-valuetext={`${band.label}，${preferences[kind]}/10`} type="range" min="1" max="10" disabled={busy} value={preferences[kind]} onChange={e => change({ [kind]: Number(e.target.value) })} />
        <small>{band.hint}</small>
      </label>;
    })}
    {draftError && <p role="alert">{draftError}</p>}
    {!validPreference && <p role="alert">上次选择的风格已下线，请重新选择。</p>}
    <button className="primary-button" disabled={busy || !validPreference} onClick={() => onSelect(preferences)}>保存选择，规划页面</button>
    <button className="code-alignment-cancel" disabled={busy} onClick={onCancel}>返回对话</button>
  </section>;
}

export type CodeWorkspacePayload = { codeSite: CodeSiteRecord; continuation?: { runId: string } | null; alignment: AlignmentPublicView | null; turns: ConversationTurn[]; conversationError?: string };
function CodeSubjectChoice({ question, busy, onSubmit }: { question: string; busy: boolean; onSubmit: (name: string) => void }) {
  const [name, setName] = useState('');
  return <section className="alignment-panel" aria-label="确认主体名称" data-testid="code-subject-question">
    <strong>{question}</strong>
    <label>完整主体名称<input value={name} maxLength={100} disabled={busy} onChange={event => setName(event.target.value)} /></label>
    <button className="primary-button" disabled={busy || !name.trim()} onClick={() => onSubmit(name.trim())}>保存名称，继续</button>
  </section>;
}
export function CodeWorkspace({ siteId, initial }: { siteId: string; initial: CodeWorkspacePayload }) {
  const [state, setState] = useState(initial), [input, setInput] = useState(''), [error, setError] = useState('');
  const [sending, setSending] = useState(false), [panel, setPanel] = useState<'materials' | 'images' | null>(null);
  const [materialSource, setMaterialSource] = useState<{ type: 'upload'; sourceId: string; name: string; text: string } | undefined>();
  const [width, setWidth] = useState(1440), [page, setPage] = useState('home'), [pane, setPane] = useState('chat');
  const [images, setImages] = useState<Array<{ imageId: string; originalName: string }>>([]);
  const [category, setCategory] = useState('product'), [license, setLicense] = useState('user-provided');
  const [sourceUrl, setSourceUrl] = useState(''), [licenseUrl, setLicenseUrl] = useState(''), [author, setAuthor] = useState(''), [attribution, setAttribution] = useState('');
  const [previewReady, setPreviewReady] = useState(false);
  const [language, setLanguage] = useState<'zh' | 'en'>('zh');
  const [previewHash, setPreviewHash] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null), sendLock = useRef(false);
  const [picking, setPicking] = useState(false), [selectedTarget, setSelectedTarget] = useState<AnnotationTarget | null>(null);
  const [saveAnnotation, setSaveAnnotation] = useState(false), [threads, setThreads] = useState<AnnotationThread[]>([]);
  const [threadsOpen, setThreadsOpen] = useState(false), [selectionLoaded, setSelectionLoaded] = useState(false);
  const [drafts, setDrafts] = useState<AnnotationDraft[]>([]), [draftsLoaded, setDraftsLoaded] = useState(false);
  const draftsRef = useRef<AnnotationDraft[]>([]);
  const [draftStorageError, setDraftStorageError] = useState(false);
  const [overlapConfirmation, setOverlapConfirmation] = useState(false);
  const [composer, setComposer] = useState<{ target: AnnotationTarget; draftId?: string; thread?: AnnotationThread } | null>(null);
  const [composerCollapsed, setComposerCollapsed] = useState(false), [annotationBottomSpace, setAnnotationBottomSpace] = useState(0);
  const annotationInput = useRef<HTMLTextAreaElement>(null);
  const [opinion, setOpinion] = useState(''), [reveal, setReveal] = useState(0), [previewVersionId, setPreviewVersionId] = useState<string | null>(null);
  const draftKey = `sitecraft-annotation-drafts:${siteId}`;
  const pendingDrafts = useMemo(() => drafts.filter(d => d.status !== 'archived'), [drafts]);
  const numberedDrafts = useMemo(() => pendingDrafts.map((draft, index) => ({ id: draft.id, target: draft.target, number: index + 1 })), [pendingDrafts]);
  const sendingDraft = pendingDrafts.find(d => d.status === 'sending');
  const [areaCandidates, setAreaCandidates] = useState<AnnotationTarget[]>([]);
  const stage = useRef<HTMLDivElement>(null), [availableWidth, setAvailableWidth] = useState(1000);
  useEffect(() => {
    if (!stage.current) return;
    const observer = new ResizeObserver(entries => setAvailableWidth(Math.max(1, entries[0].contentRect.width - 24)));
    observer.observe(stage.current); return () => observer.disconnect();
  }, []);
  const scale = Math.min(1, availableWidth / width);
  const site = state.codeSite, version = site.versions.find(v => v.id === site.currentVersionId);
  const previewVersion = site.versions.find(v => v.id === previewVersionId) ?? version;
  const conversationUnavailable = !!state.conversationError;
  const running = site.run?.status === 'running' && !conversationUnavailable, busy = sending || running || !!sendingDraft;
  const progressText = conversationUnavailable && site.run?.status === 'error'
    ? '上次任务未完成，完整检查问题仍保留。' : site.run?.step;
  const english = version?.english;
  const activeLanguage = language === 'en' && english ? 'en' : 'zh';
  const pages = activeLanguage === 'en' ? english!.pages : previewVersion?.code.pages ?? site.plan?.pages ?? [];
  const activePage = pages.some(p => p.id === page) ? page : 'home';
  const previewUrl = previewVersion ? `/api/sites/${siteId}/code-preview?page=${activePage}&version=${previewVersion.id}${activeLanguage === 'en' ? '&language=en' : ''}${previewHash}` : '';
  useEffect(() => { setPreviewReady(false); }, [previewUrl]);
  const selected = activeLanguage === 'zh' && selectedTarget?.versionId === version?.id && selectedTarget?.pageId === activePage ? selectedTarget : null;
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`sitecraft-selection:${siteId}`);
      if (saved) { const parsed = annotationTargetSchema.safeParse(JSON.parse(saved));
        if (parsed.success && parsed.data.versionId === initial.codeSite.currentVersionId) { setSelectedTarget(parsed.data); setPage(parsed.data.pageId); }
      }
    } catch { setError('浏览器无法读取点选记录，请重新点选；当前操作仍可继续。'); }
    setSelectionLoaded(true);
  }, [siteId, initial.codeSite.currentVersionId]);
  useEffect(() => {
    if (!selectionLoaded) return;
    const valid = selectedTarget?.versionId === version?.id;
    try {
      if (valid && selectedTarget) localStorage.setItem(`sitecraft-selection:${siteId}`, JSON.stringify(selectedTarget));
      else localStorage.removeItem(`sitecraft-selection:${siteId}`);
    } catch { setError('浏览器无法保存点选记录，当前点选仍可使用；刷新后请重新点选。'); }
    if (!valid && selectedTarget) setSelectedTarget(null);
  }, [selectedTarget, version?.id, selectionLoaded, siteId]);
  const canAnnotate = !!version && activeLanguage === 'zh' && !conversationUnavailable && !previewVersionId;
  useEffect(() => { if (!canAnnotate) setPicking(false); }, [canAnnotate]);
  const saveDrafts = useCallback((update: (current: AnnotationDraft[]) => AnnotationDraft[]) => {
    const next = update(draftsRef.current);
    try {
      if (next.length) localStorage.setItem(draftKey, JSON.stringify(next));
      else localStorage.removeItem(draftKey);
      draftsRef.current = next; setDrafts(next); return true;
    }
    catch { setError('批注草稿未能保存到浏览器，请检查存储空间后再添加或发送。'); return false; }
  }, [draftKey]);
  useEffect(() => {
    try { const saved = localStorage.getItem(draftKey); if (saved) { const parsed = annotationDraftSchema.array().parse(JSON.parse(saved)); draftsRef.current = parsed; setDrafts(parsed); } }
    catch { setDraftStorageError(true); setError('批注草稿无法读取，原记录已保留。请先处理浏览器中的草稿记录。'); }
    setDraftsLoaded(true);
  }, [draftKey]);
  useEffect(() => {
    if (!draftsLoaded) return;
    if (!drafts.some(draft => draft.status === 'sending' && site.runs.some(run => run.annotationSubmissionId === draft.submissionId && run.status !== 'running'))) return;
    saveDrafts(current => current.map(draft => {
      if (draft.status !== 'sending' || !draft.submissionId) return draft;
      const run = site.runs.find(run => run.annotationSubmissionId === draft.submissionId);
      if (!run || run.status === 'running') return draft;
      const result = run.annotationResults?.find(item => item.draftIds.includes(draft.id));
      return { ...draft, status: run.status === 'complete' ? 'archived' as const : 'draft' as const,
        error: result?.status === 'rejected' ? result.message : run.status === 'error' ? run.step : undefined };
    }));
  }, [draftsLoaded, drafts, site.runs, saveDrafts]);
  const cancelComposer = useCallback(() => { if (composer?.thread) setComposerCollapsed(true); else setComposer(null); frame.current?.focus(); }, [composer]);
  useEffect(() => { setComposerCollapsed(false); }, [composer]);
  useEffect(() => {
    if (composer && !composer.thread) annotationInput.current?.focus();
  }, [composer]);
  const annotationKey = useCallback((event: KeyboardEvent) => {
    if (event.isComposing || event.keyCode === 229) return;
    if (event.key === 'Escape') {
      if (areaCandidates.length) { event.preventDefault(); setAreaCandidates([]); }
      else if (composer) { event.preventDefault(); cancelComposer(); }
      else if (picking) { event.preventDefault(); setPicking(false); setSelectedTarget(null); frame.current?.focus(); }
      return;
    }
    const input = event.target as HTMLElement | null;
    if (input?.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"])') || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key.toLowerCase() === 'c' && canAnnotate) {
      event.preventDefault(); setPane('preview'); setPicking(value => !value); setSelectedTarget(null);
    }
  }, [composer, cancelComposer, picking, canAnnotate, areaCandidates.length]);
  useEffect(() => { document.addEventListener('keydown', annotationKey); return () => document.removeEventListener('keydown', annotationKey); }, [annotationKey]);
  const selectBlock = useCallback((target: AnnotationTarget) => {
    setAreaCandidates([]);
    setSelectedTarget(target); setComposer({ target, ...(composer?.draftId ? { draftId: composer.draftId } : {}) });
    if (!composer?.draftId) setOpinion('');
  }, [composer?.draftId]);
  const selectArea = useCallback((targets: AnnotationTarget[]) => {
    if (targets.length === 1) { selectBlock(targets[0]); return; }
    setAreaCandidates(targets); setSelectedTarget(null);
    if (!composer?.draftId) { setComposer(null); setOpinion(''); }
  }, [selectBlock, composer?.draftId]);
  const changePage = useCallback((id: string) => { setPage(id); setPreviewHash(''); setSelectedTarget(null); setComposer(null); setPicking(false); setAreaCandidates([]); }, []);
  function revealAnnotation(target: AnnotationTarget, detail: { draftId?: string; thread?: AnnotationThread }, body: string) {
    setAreaCandidates([]);
    setPreviewVersionId(target.versionId === version?.id ? null : target.versionId);
    setPage(target.pageId); setPreviewHash(''); setLanguage('zh'); setPane('preview'); setPicking(false);
    setSelectedTarget(target); setComposer({ target, ...detail }); setOpinion(body); setReveal(value => value + 1);
  }
  function addAnnotation() {
    if (!composer || composer.thread || !opinion.trim() || composer.target.versionId !== version?.id || draftStorageError || areaCandidates.length
      || draftsRef.current.find(d => d.id === composer.draftId)?.status === 'sending') return;
    const draft: AnnotationDraft = { id: composer.draftId ?? crypto.randomUUID(), target: composer.target,
      revision: version.revision, body: opinion.trim(), status: 'draft' };
    if (!saveDrafts(current => current.some(d => d.id === draft.id) ? current.map(d => d.id === draft.id ? draft : d) : [...current, draft])) return;
    setComposer(null); if (!composer.draftId) setSelectedTarget(null); frame.current?.focus();
  }
  const placeholderCandidates = version?.stalePlaceholders?.map((prompt, index) => annotationDraftSchema.safeParse({
    id: `${version.id}-placeholder-${index}`, target: prompt.target, revision: version.revision, status: 'draft',
    body: `请更新「${prompt.snippet}」，采用你补充的原句：「${prompt.quote}」。保留本区块其他内容。`,
  })) ?? [];
  const placeholderDrafts = placeholderCandidates.flatMap(candidate => candidate.success ? [candidate.data] : []);
  const placeholdersAdded = placeholderDrafts.length > 0 && placeholderDrafts.every(draft => drafts.some(existing => existing.id === draft.id));
  function addPlaceholderDrafts() {
    if (!draftsLoaded || draftStorageError || conversationUnavailable || previewVersionId) return;
    saveDrafts(current => [...current, ...placeholderDrafts.filter(draft => !current.some(existing => existing.id === draft.id))]);
  }
  function previewLoaded() {
    const location = frame.current?.contentWindow?.location;
    if (location) {
      const url = new URL(location.href), loadedPage = url.searchParams.get('page');
      if (loadedPage && pages.some(page => page.id === loadedPage)) {
        if (loadedPage !== activePage) { setSelectedTarget(null); setComposer(null); }
        setPage(loadedPage); setLanguage(url.searchParams.get('language') === 'en' ? 'en' : 'zh'); setPreviewHash(url.hash);
      }
    }
    setPreviewReady(true);
  }
  useEffect(() => {
    if (!threadsOpen) return;
    void fetch(`/api/sites/${siteId}/annotations`, { cache: 'no-store' }).then(async response => {
      const data = await response.json(); if (!response.ok) throw new Error(data.userMessage || '批注读取失败。'); setThreads(data.annotations);
    }).catch(error => setError(error.message));
  }, [threadsOpen, siteId, site.run?.status]);
  // T-202 browser storage: keep this browser's copy in step with the server's working copy.
  useEffect(() => {
    if (!browserStorageMode()) return;
    let stopped = false;
    const sync = () => { void pullSite(siteId).catch(error => { if (!stopped) setError(error instanceof Error ? error.message : '站点没有同步回这个浏览器。'); }); };
    const timer = window.setInterval(sync, 5000);
    return () => { stopped = true; window.clearInterval(timer); sync(); };
  }, [siteId]);
  async function request(body: Record<string, unknown>) {
    // State polling never reaches the model, so it does not carry the key (T-202).
    const response = await fetch(`/api/sites/${siteId}/chat`, { method: 'POST', headers: { 'content-type': 'application/json', ...(body.action === 'state' ? {} : providerHeaders()) }, body: JSON.stringify(body) });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.userMessage || '本次请求失败。');
    setState(payload); return payload as CodeWorkspacePayload;
  }
  // On refresh, reconcile an in-flight draft with the persistent task. Never resend it.
  useEffect(() => {
    const saved = drafts.find(d => d.status === 'sending');
    if (!draftsLoaded || !saved || site.runs.some(run => run.annotationSubmissionId === saved.submissionId)) return;
    let cancelled = false;
    void request({ action: 'state' }).then(payload => {
      if (!cancelled && !payload.codeSite.runs.some(run => run.annotationSubmissionId === saved.submissionId))
        setError('正在确认批注发送状态，意见与范围已保留。');
    }).catch(error => { if (!cancelled) setError(error.message); });
    return () => { cancelled = true; };
  }, [draftsLoaded]);
  async function sendAnnotation(id: string) {
    const draft = draftsRef.current.find(d => d.id === id);
    if (!draft || draft.status === 'sending' || draft.target.versionId !== version?.id || busy || sendLock.current || conversationUnavailable) return;
    sendLock.current = true; setSending(true); setError('');
    const frozen = { ...draft, status: 'sending' as const,
      submissionId: draft.submissionId && !site.runs.some(run => run.annotationSubmissionId === draft.submissionId) ? draft.submissionId : crypto.randomUUID(), error: undefined };
    if (!saveDrafts(current => current.map(d => d.id === draft.id ? frozen : d))) { sendLock.current = false; setSending(false); return; }
    setComposer(null); setPicking(false);
    try { await request({ message: frozen.body, baseRevision: frozen.revision, selectedTarget: frozen.target,
      saveAnnotation: true, annotationSubmissionId: frozen.submissionId }); }
    catch (error) {
      const message = error instanceof Error ? error.message : '批注发送失败。';
      // A lost HTTP reply may already own a task. Read its state once before releasing the draft.
      try { const payload = await request({ action: 'state' });
        if (!payload.codeSite.runs.some(run => run.annotationSubmissionId === frozen.submissionId))
          saveDrafts(current => current.map(d => d.id === draft.id ? { ...frozen, status: 'draft', error: message } : d));
      } catch { setError(`${message} 无法确认任务状态，意见已保留；刷新后查看。`); }
    } finally { sendLock.current = false; setSending(false); }
  }
  async function sendAnnotationBatch(confirmOverlap = false) {
    const selected = draftsRef.current.filter(draft => draft.status === 'draft' && draft.target.versionId === version?.id);
    if (!selected.length || !version || busy || sendLock.current || conversationUnavailable) return;
    sendLock.current = true; setSending(true); setError(''); setOverlapConfirmation(false);
    const submissionId = crypto.randomUUID();
    const frozen = selected.map(draft => ({ ...draft, status: 'sending' as const, submissionId, error: undefined }));
    if (!saveDrafts(current => current.map(draft => frozen.some(item => item.id === draft.id) ? frozen.find(item => item.id === draft.id)! : draft))) { sendLock.current = false; setSending(false); return; }
    setComposer(null); setPicking(false);
    try {
      await request({ message: '批量局部修改', baseRevision: version.revision,
        annotationBatch: frozen.map(({ id, target, revision, body }) => ({ draftId: id, target, revision, body })),
        annotationOverlapConfirmed: confirmOverlap, saveAnnotation: true, annotationSubmissionId: submissionId });
    } catch (error) {
      const message = error instanceof Error ? error.message : '批注发送失败。';
      if (/同一个范围|重叠/.test(message)) setOverlapConfirmation(true);
      try {
        const payload = await request({ action: 'state' });
        if (!payload.codeSite.runs.some(run => run.annotationSubmissionId === submissionId))
          saveDrafts(current => current.map(draft => frozen.some(item => item.id === draft.id) ? { ...draft, status: 'draft' as const, error: message } : draft));
      } catch { setError(`${message} 无法确认任务状态，意见已保留；刷新后查看。`); }
    } finally { sendLock.current = false; setSending(false); }
  }
  async function checkAnnotationSubmission(id: string) {
    const draft = draftsRef.current.find(d => d.id === id);
    if (!draft || draft.status !== 'sending') return;
    try { const payload = await request({ action: 'state' });
      if (!payload.codeSite.runs.some(run => run.annotationSubmissionId === draft.submissionId))
        saveDrafts(current => current.map(d => d.id === draft.id ? { ...d, status: 'draft', error: '未找到发送任务，意见已保留。可以重新发送。' } : d));
    } catch (error) { setError(error instanceof Error ? error.message : '无法读取发送状态，意见已保留。'); }
  }
  useEffect(() => {
    if (!running && !sendingDraft) return;
    let cancelled = false;
    const timer = setInterval(() => {
      void fetch(`/api/sites/${siteId}/chat`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'state' }) })
        .then(async response => { const payload = await response.json(); if (!response.ok) throw new Error(payload.userMessage || '读取进度失败。'); if (!cancelled) setState(payload); })
        .catch(error => { if (!cancelled) setError(error instanceof Error ? error.message : '读取进度失败。'); });
    }, 2000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [running, sendingDraft?.id, siteId]);
  async function perform(body: Record<string, unknown>) {
    setSending(true); setError('');
    try { await request(body); } catch (error) { setError(error instanceof Error ? error.message : '本次请求失败。'); }
    finally { setSending(false); }
  }
  async function sendEdit(message: string, quick = false) {
    if (previewVersionId) { setError('正在回看历史版本，请回到当前版本并重新点选后再修改。'); return; }
    if (!message.trim() || busy || conversationUnavailable || sendLock.current) return;
    sendLock.current = true; setSending(true); setError('');
    try { await request({ message, baseRevision: version?.revision ?? 0,
      ...(materialSource?.text === message ? { source: materialSource } : {}),
      ...(selected ? { selectedTarget: selected, saveAnnotation } : {}),
      ...(version && quick && !selected ? { pageId: activePage } : {}) }); setInput(''); setMaterialSource(undefined); setPanel(null); }

    catch (error) { setError(error instanceof Error ? error.message : '本次请求失败。'); }
    finally { sendLock.current = false; setSending(false); }
  }
  async function submit(event: FormEvent) { event.preventDefault(); await sendEdit(input); }
  async function undo() {
    setSending(true); setError('');
    try {
      const response = await fetch(`/api/sites/${siteId}/history/undo`, { method: 'POST', headers: { 'content-type': 'application/json', ...providerHeaders() }, body: JSON.stringify({ baseRevision: version?.revision ?? 0 }) }); const payload = await response.json();
      if (!response.ok) throw new Error(payload.userMessage || '撤销失败。'); setState(payload);
    } catch (error) { setError(error instanceof Error ? error.message : '撤销失败。'); }
    finally { setSending(false); }
  }
  async function loadMaterial(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file) return;
    try {
      const text = /\.xlsx$/i.test(file.name) ? (await readXlsxFile(file)).map(row => row.join('\t')).join('\n')
        : /\.csv$/i.test(file.name) ? Papa.parse<string[]>(await file.text()).data.map(row => row.join('\t')).join('\n') : await file.text();
      if (text.length > 4000) throw new Error('这份资料超过 4000 字，请先保留公司业务、产品参数和已有资料。');
      setInput(text); setMaterialSource({ type: 'upload', sourceId: crypto.randomUUID(), name: file.name || 'upload', text }); setPanel(null); setError('');
    } catch (error) { setError(error instanceof Error ? error.message : '资料读取失败。'); }
    event.target.value = '';
  }
  async function loadImages() {
    const response = await fetch(`/api/sites/${siteId}/images`, { cache: 'no-store' }); const payload = await response.json();
    if (!response.ok) throw new Error(payload.userMessage || '图片读取失败。'); setImages(payload.images);
  }
  async function uploadImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file) return;
    setSending(true); setError('');
    try {
      const form = new FormData(); form.set('file', file); form.set('license', license); form.set('usageScope', 'current-site-only'); form.set('usageCategory', category);
      form.set('sourceUrl', sourceUrl); form.set('licenseUrl', licenseUrl); form.set('author', author); form.set('attribution', attribution);
      const response = await fetch(`/api/sites/${siteId}/images`, { method: 'POST', body: form }); const payload = await response.json();
      if (!response.ok) throw new Error(payload.userMessage || '图片上传失败。'); await loadImages();
    } catch (error) { setError(error instanceof Error ? error.message : '图片上传失败。'); }
    finally { setSending(false); event.target.value = ''; }
  }
  const alignment = state.alignment;
  return <div className={`builder-shell workspace-theme-light workspace-accent-porcelain code-workspace pane-${pane}${alignment?.waitingForUser || alignment?.awaitingConfirmation ? ' code-aligning' : ''}`} data-testid="code-workspace">
    <header className="preview-toolbar workspace-topbar">
      <div className="preview-toolbar-left"><Link href="/" className="topbar-back" aria-label="返回站点"><ArrowLeft size={17} /></Link><strong className="project-name">{site.name}</strong><span className="save-status">{running ? <LoaderCircle size={12} className="spin" /> : <Check size={12} />}{version ? `版本 ${version.revision}` : '尚未生成'}</span><button className="icon-button" aria-label="版本历史" title="版本历史" onClick={() => setHistoryOpen(true)} data-testid="open-version-history"><History size={17} /></button></div>
      <div className="builder-mobile-tabs" role="tablist" aria-label="建站工作区视图">{['chat', 'preview'].map(p => <button key={p} role="tab" aria-selected={pane === p} className={pane === p ? 'active' : ''} onClick={() => setPane(p)}>{p === 'chat' ? '对话' : '预览'}</button>)}</div>
      <div className="topbar-tools"><div className="device-toggle" aria-label="预览宽度">{[1440, 768, 375].map(w => <button key={w} aria-pressed={width === w} className={width === w ? 'active' : ''} onClick={() => setWidth(w)}>{w}</button>)}</div>{version && <a className="icon-button" aria-label="下载网站" title="下载网站" data-testid="download-site" href={`/api/sites/${encodeURIComponent(siteId)}/export`} download><Download size={16} /></a>}<button className="icon-button" aria-label="撤销" disabled={busy || site.versions.length < 2} onClick={() => void undo()}><RotateCcw size={16} /></button><button className="icon-button" aria-label="删除站点" data-testid="toolbar-delete-site" disabled={busy} onClick={() => setDeleteOpen(true)}><Trash2 size={16} /></button></div>
    </header>
    <main className={`preview-shell ${pane !== 'preview' ? 'mobile-hidden' : ''}`} style={{ paddingBottom: annotationBottomSpace }}>
      <div className="site-page-chrome"><div className="code-pick-toolbar">{version && activeLanguage === 'zh' && <><button type="button" className="secondary-button" aria-pressed={picking} disabled={!canAnnotate} data-testid="pick-block" onClick={() => { setPicking(!picking); setSelectedTarget(null); setComposer(null); setAreaCandidates([]); }}>{picking ? '退出批注' : '批注'}</button><small>{picking ? '点击或拖框写批注 · Esc 取消' : selected ? `已选：${selected.label}` : 'C 进入批注 · 只修改选中区块'}</small></>}</div>{english && <div className="device-toggle" aria-label="预览语言">{(['zh', 'en'] as const).map(value => <button key={value} className={activeLanguage === value ? 'active' : ''} aria-pressed={activeLanguage === value} data-testid={`preview-${value}`} onClick={() => setLanguage(value)}>{value === 'zh' ? '中文' : 'English'}</button>)}</div>}<nav className="site-page-nav" aria-label="站点页面">{pages.map(p => <button key={p.id} className={`site-page-tab ${activePage === p.id ? 'active' : ''}`} aria-pressed={activePage === p.id} data-page-id={p.id} onClick={() => changePage(p.id)}><strong>{p.title}</strong><small>独立页</small></button>)}</nav></div>
      {previewVersionId && <p className="code-preview-version">正在回看 v{previewVersion?.revision} 的批注 <button onClick={() => { setPreviewVersionId(null); setComposer(null); setSelectedTarget(null); }}>回到当前版本</button></p>}
      {activeLanguage === 'zh' && previewVersion && <p className="code-fact-status" data-testid="fact-citation-status">{!previewVersion.checks.factCitations ? '未提供可引用的原句' : `${previewVersion.checks.factCitations.entries.length} 条资料出处${previewVersion.checks.factCitations.complete ? '' : ' · 部分内容未记录出处'}`}<small>悬停或点选预览中的编号，查看资料原句。</small></p>}
      <div className="preview-stage code-preview-stage" ref={stage}><div className="code-preview-canvas" style={{ width: width * scale, height: 1000 * scale }}>
        {version ? <><iframe ref={frame} key={previewUrl} style={{ width, height: 1000, transform: `scale(${scale})` }} src={previewUrl} title={`${pages.find(p => p.id === activePage)?.title || '首页'}预览`} sandbox="allow-same-origin" data-testid="code-preview" onLoad={previewLoaded} />{activeLanguage === 'zh' && previewVersion && <CodePreviewSelection frame={frame} ready={previewReady} picking={picking && canAnnotate}
          selected={areaCandidates.length ? null : composer?.target ?? selected} areaChoosing={!!areaCandidates.length} pageId={activePage} versionId={previewVersion.id} html={previewVersion.code.pages.find(p => p.id === activePage)!.html}
          scale={scale} onSelect={selectBlock} onArea={selectArea} onKey={annotationKey} reveal={reveal} bottomSpace={annotationBottomSpace} onBottomSpace={setAnnotationBottomSpace} collapsed={composerCollapsed}
          numbered={numberedDrafts}
          onReveal={id => { const draft = draftsRef.current.find(d => d.id === id); if (draft && draft.status !== 'sending') revealAnnotation(draft.target, { draftId: draft.id }, draft.body); }}>
          {!!areaCandidates.length && <section className="code-annotation-composer" data-testid="annotation-area-candidates" role="dialog" aria-label="收窄圈选范围">
            <strong>圈中了 {areaCandidates.length} 个区块</strong><p>一次只修改一个区块，请选择这一条意见的范围。</p>
            {areaCandidates.map(target => <button type="button" className="secondary-button" key={target.path.join('-')} onClick={() => selectBlock(target)}>{target.label}</button>)}
            <button type="button" onClick={() => setAreaCandidates([])}>取消圈选</button>
          </section>}
          {composer && !areaCandidates.length && <section className="code-annotation-composer" data-testid="annotation-composer" role="dialog" aria-label="批注意见">
            {composerCollapsed ? <div className="code-annotation-summary"><span aria-hidden="true">1</span><p title={composer.thread?.comments[0].body ?? opinion}>{composer.thread?.comments[0].body ?? opinion}</p><button type="button" data-testid="annotation-expand" onClick={() => setComposerCollapsed(false)}>展开意见</button></div> : <>
            <strong>{composer.thread ? '批注线程' : `批注 · ${composer.draftId ? pendingDrafts.findIndex(d => d.id === composer.draftId) + 1 : pendingDrafts.length + 1}`}</strong>
            <p data-testid="annotation-scope">修改范围：{pages.find(p => p.id === composer.target.pageId)?.title} · {composer.target.label}</p>
            {composer.target.elements && <small data-testid="annotation-elements">圈选内容：{composer.target.elements.map(hint => hint.text || hint.tag).join()} · 只修改上面的区块</small>}
            {composer.target.element && <small>指向：{composer.target.element.tag === 'img' ? '图片' : /^h[1-6]$/.test(composer.target.element.tag) ? '标题' : '内容'} · {composer.target.element.text || '无文字'}</small>}
            {composer.thread ? <div className="code-thread-comments">{composer.thread.comments.map(comment => <p key={comment.id}>{comment.author.name}：{comment.body}</p>)}</div>
              : <><label htmlFor="annotation-message">修改意见</label><textarea ref={annotationInput} autoFocus id="annotation-message" value={opinion} maxLength={4000} rows={4}
                onChange={event => setOpinion(event.target.value)} onKeyDown={event => { if (!event.nativeEvent.isComposing && event.key === 'Enter' && (event.metaKey || event.ctrlKey)) { event.preventDefault(); addAnnotation(); } }} />
                <small>Enter 换行 · ⌘/Ctrl+Enter 添加</small></>}
            <div className="code-annotation-actions"><button type="button" autoFocus={!!composer.thread} onClick={cancelComposer}>{composer.thread ? '收起' : '取消'}</button>
              {!composer.thread && <button type="button" className="primary-button" data-testid="annotation-add" disabled={!opinion.trim() || draftStorageError || composer.target.versionId !== version?.id || drafts.find(d => d.id === composer.draftId)?.status === 'sending'} onClick={addAnnotation}>{composer.draftId ? '保存批注' : '添加批注'}</button>}</div>
            </>}
          </section>}
        </CodePreviewSelection>}{activeLanguage === 'zh' && previewVersion && !picking && !composer && <CodePreviewCitations key={`${previewVersion.id}:${activePage}`} frame={frame} stage={stage} ready={previewReady} record={previewVersion.checks.factCitations} versionId={previewVersion.id} pageId={activePage} scale={scale} header={previewVersion.code.header} languageLinks={!!previewVersion.english} />}{!previewReady && <div className="code-preview-loading" role="status">正在载入版本 {version.revision}…</div>}</> : <div className="code-empty"><strong>先读公司资料，再生成网站</strong><p>发来已有的公司或产品资料。选好风格、确认页面大纲后，预览会出现在这里；资料可以之后继续补充。</p></div>}
      </div></div>
    </main>
    <aside className={`builder-chat ${pane !== 'chat' ? 'mobile-hidden' : ''}`} aria-label="对话">
      <div className="builder-chat-head"><strong data-testid="code-revision">{version ? `当前版本 · v${version.revision}` : '公司资料与需求'}</strong><small>{english ? '中英文网站' : '中文网站'}</small></div>
      <div className="chat-messages">
        {state.conversationError && <p className="code-error" role="alert" data-testid="code-conversation-error">{state.conversationError}</p>}
        {!state.turns.length && !conversationUnavailable && <div className="message assistant"><div className="message-bubble">发来公司资料，或从「资料」选一份模拟公司。已有图片也可以先上传。</div></div>}
        {state.turns.map((turn, index) => <div key={`${turn.createdAt}-${index}`}><div className="message user"><div className="message-label">你</div><div className="message-bubble">{turn.userMessage}</div></div><div className={`message assistant ${turn.outcome}`}><div className="message-label">AI 助手</div><div className="message-bubble">{turn.aiSummary}</div></div></div>)}
        {alignment?.waitingForUser && alignment.questionKind === 'clarify' && <CodeSubjectChoice key={alignment.questionId} question={alignment.question} busy={busy} onSubmit={name => void perform({ message: `主体名称：${name}` })} />}
        {alignment?.waitingForUser && alignment.questionKind === 'style' && <CodeStyleChoice key={alignment.questionId} siteId={siteId} alignment={alignment} initial={site.preferences} busy={busy}
          onSelect={preferences => void perform({ action: 'select', questionId: alignment.questionId, questionRevision: alignment.questionRevision, optionId: preferences.style, preferences })} onCancel={() => void perform({ action: 'cancel' })} />}
        {version && !conversationUnavailable && !alignment?.waitingForUser && !alignment?.awaitingConfirmation && <button className="code-restyle" disabled={busy} onClick={() => void perform({ action: 'start', baseRevision: version.revision })}>调整风格与疏密</button>}
        {alignment?.awaitingConfirmation && !busy && site.plan && <section className="alignment-panel" aria-label="确认页面大纲" data-testid="code-plan"><strong>{site.plan.summary}</strong><ol>{site.plan.pages.map(p => <li key={p.id}><strong>{p.title}</strong><p>{p.outline}</p></li>)}</ol><button className="primary-button" onClick={() => void perform({ action: 'confirm', questionId: alignment.questionId, questionRevision: alignment.questionRevision })}>{!version && site.run?.kind === 'generate' && site.run.status === 'error' ? '按已保存的大纲重新生成' : '确认并生成'}</button><button className="code-alignment-cancel" onClick={() => void perform({ action: 'cancel' })}>返回对话</button></section>}
        {site.run && (running || site.run.issues.length > 0 || state.turns.at(-1)?.aiSummary !== progressText) && <div className={`message assistant ${site.run.status}`}><div className="message-bubble" role="status" data-testid="code-progress">{running && <LoaderCircle className="spin" size={14} />} {progressText}{site.run.issues.length > 0 && <details data-testid="code-run-issues"><summary>查看完整检查问题（{site.run.issues.length} 项）</summary><ul>{site.run.issues.map((issue, i) => <li key={i}>{issue}</li>)}</ul></details>}</div></div>}
        {state.continuation && !previewVersionId && !busy && !conversationUnavailable && !alignment?.waitingForUser && !alignment?.awaitingConfirmation && <section className="alignment-panel" aria-label="继续检查">
          <p>已生成的页面已保留。继续检查会调用模型核对，沿用剩余的内容修正次数；全部通过后保存版本。</p>
          <button className="primary-button" data-testid="code-resume-check" onClick={() => void perform({ action: 'resume', resumeRunId: state.continuation!.runId, baseRevision: version?.revision ?? 0 })}>继续检查已生成的页面</button>
        </section>}
        {activeLanguage === 'zh' && !previewVersionId && !!version?.stalePlaceholders?.length && <div className="message assistant" data-testid="stale-placeholder-prompt"><div className="message-bubble">
          <p>这些地方还写着「待补充」：</p>
          {version.stalePlaceholders.map((prompt, index) => <p key={index}>{prompt.pageTitle}：{prompt.snippet}{!placeholderCandidates[index].success && <small>此处无法加入批注草稿，请在预览中重新点选并填写意见。</small>}</p>)}
          <button type="button" className="secondary-button" data-testid="stale-placeholder-add" disabled={conversationUnavailable || !draftsLoaded || draftStorageError || !!previewVersionId || !placeholderDrafts.length || placeholdersAdded} onClick={addPlaceholderDrafts}>{placeholdersAdded ? '已加入批注草稿' : '一起更新'}</button>
          <small>加入草稿后，可查看意见再发送。</small>
        </div></div>}
        {version && <p className="code-check-receipt" data-testid="code-check-receipt">版本 {version.revision} · {codeVersionAuthor(version.author)} · {version.summary} · {codeCheckLabel(version.checks)}</p>}
        {version?.checks.passed && !conversationUnavailable && <section className="alignment-panel code-english-panel" aria-label="英文版">
          <p data-testid="english-status">{english ? `英文版基于中文第 ${english.sourceRevision} 版${english.sourceRevision !== chineseCodeRevision(version) ? '，已落后于当前中文版。' : '。'}` : '中文版满意了吗？可以沿用当前页面生成英文版。'}</p>
          {english && !explicitEnglishCompanyName(codeFactMaterials(site)) && <p data-testid="english-company-name-notice">资料里没有英文公司名，英文版沿用中文名；补充后可重新翻译。</p>}
          <button className="secondary-button" data-testid="generate-english" disabled={busy} onClick={() => void perform({ action: 'translate', baseRevision: version.revision })}>{running && site.run?.kind === 'translate' ? '正在翻译…' : english ? '按当前中文版重新翻译' : '生成英文版'}</button>
        </section>}
        {error && <p className="code-error" role="alert">{error}</p>}
      </div>
      <div className="chat-input-wrap">
        {!!pendingDrafts.length && <section aria-label="待发送批注列表">
          <strong>待发送批注 · {pendingDrafts.length} 条</strong>
          {site.run?.overallIssue && <p className="code-error" role="alert" data-testid="annotation-overall-error">{site.run.overallIssue}</p>}
          {pendingDrafts.filter(draft => draft.status === 'draft' && draft.target.versionId === version?.id).length > 1 && <button type="button" data-testid="annotation-send-batch" disabled={busy || conversationUnavailable || !!previewVersionId} onClick={() => void sendAnnotationBatch(false)}>发送这些批注为一个版本</button>}
          {overlapConfirmation && <button type="button" data-testid="annotation-confirm-overlap" disabled={busy || conversationUnavailable || !!previewVersionId} onClick={() => void sendAnnotationBatch(true)}>确认按较大区块合并后发送</button>}
          <div className="code-annotation-list">{pendingDrafts.map((draft, index) => <section key={draft.id} className="code-annotation-draft" data-testid="annotation-draft" data-draft-id={draft.id} aria-label={`批注 ${index + 1}`}>
            <small>{index + 1} · {site.versions.find(v => v.id === draft.target.versionId)?.code.pages.find(p => p.id === draft.target.pageId)?.title} · {draft.target.label}</small>
            <p>{draft.body}</p>
            {draft.target.versionId !== version?.id && <p role="status">来自 v{draft.revision}，请重新点选</p>}
            {draft.status === 'sending' && <p role="status">正在修改，意见与范围已冻结。</p>}
            {draft.status === 'sending' && !site.runs.some(run => run.annotationSubmissionId === draft.submissionId) && <button type="button" data-testid="annotation-check" onClick={() => void checkAnnotationSubmission(draft.id)}>核对发送状态</button>}
            {draft.error && <p className="code-error" role="alert">{draft.error}</p>}
            <div className="code-annotation-actions"><button type="button" data-testid="annotation-reveal" disabled={draft.status === 'sending'} onClick={() => revealAnnotation(draft.target, { draftId: draft.id }, draft.body)}>回看 / 编辑</button>
              {draft.target.versionId !== version?.id && <button type="button" data-testid="annotation-reselect" disabled={draft.status === 'sending'} onClick={() => { setPreviewVersionId(null); setLanguage('zh'); setPane('preview'); setComposer({ target: draft.target, draftId: draft.id }); setOpinion(draft.body); setSelectedTarget(null); setAreaCandidates([]); setPicking(true); }}>重新点选</button>}
              <button type="button" data-testid="annotation-remove" disabled={draft.status === 'sending'} onClick={() => { if (saveDrafts(current => current.filter(d => d.id !== draft.id)) && composer?.draftId === draft.id) { setComposer(null); setSelectedTarget(null); } }}>移除</button>
              <button type="button" className="primary-button" data-testid="annotation-send" disabled={busy || conversationUnavailable || draft.status === 'sending' || draft.target.versionId !== version?.id || !!previewVersionId} onClick={() => void sendAnnotation(draft.id)}>发送这条批注</button></div>
          </section>)}</div>
        </section>}
        {version && activeLanguage === 'zh' && <>
          {selected && <div className="code-selected-target" data-testid="selected-target"><strong>已选：{selected.label}</strong><button type="button" onClick={() => setSelectedTarget(null)} disabled={busy}>取消</button><small>{pages.find(p => p.id === activePage)?.title} · 只改这一块</small><label><input type="checkbox" checked={saveAnnotation} onChange={e => setSaveAnnotation(e.target.checked)} disabled={busy} />保存为批注线程</label></div>}
          <div className="code-quick-edits" aria-label={selected ? '选中区块快捷修改' : '当前页快捷修改'}>{[
            ['更大胆', '更大胆：保留全部事实、文案含义、操作顺序和已有功能入口；加强标题层级、字号对比和留白节奏，让重点更突出，保持正文易读。'],
            ['更克制', '更克制：保留全部事实、文案含义、操作顺序和已有功能入口；减少装饰与过强的色彩和字号对比，收拢视觉层级，仍让重点清楚、正文易读。'],
            ['精简文字', '精简文字：删掉重复和空话，保留事实与操作顺序，包括“先…再…”等衔接；句子保持自然、口语化的商务中文，不压成电报体。保留必要的解释、限制条件和已有功能入口。'],
            ['换个版式', '换个版式：保留全部事实、文案含义、操作顺序、已有功能入口和当前风格；调整图文位置、列数与留白组织，让阅读顺序更清楚，兼顾窄屏。'],
          ].map(([text, prompt]) => <button key={text} type="button" disabled={busy || conversationUnavailable || !!previewVersionId} onClick={() => { if (selected) { setComposer({ target: selected, ...(composer?.draftId ? { draftId: composer.draftId } : {}) }); setOpinion(prompt); setPane('preview'); } else void sendEdit(prompt, true); }}>{text}</button>)}</div>
          {previewVersionId ? <small className="code-quick-scope" role="status">正在回看历史版本，请回到当前版本并重新点选后再修改。</small>
            : !selected && <small className="code-quick-scope">快捷按钮作用于「{pages.find(p => p.id === activePage)?.title}」</small>}
          {selected && site.run?.status === 'error' && site.run.selectedTarget && <button className="secondary-button" disabled={busy} onClick={() => { setSelectedTarget(null); setInput(site.run!.request); }}>改整页</button>}
        </>}
        <details open={threadsOpen} onToggle={event => setThreadsOpen(event.currentTarget.open)} className="code-annotation-threads"><summary>批注线程</summary>{threads.length ? threads.map(thread => {
          const capture = annotationCaptureSchema.safeParse(thread.anchor);
          return <article key={thread.id}><strong>{capture.success ? capture.data.target.label : '旧批注，无法定位'}</strong><small>{thread.status === 'resolved' ? '已处理' : thread.comments.some(comment => comment.author.id === 'assistant' && comment.body.startsWith('已修改')) ? '已修改，待确认' : '待处理'}{capture.success && capture.data.target.versionId !== version?.id ? ' · 来自旧版本，请重新点选' : ''}</small>{thread.comments.map(comment => <p key={comment.id}>{comment.author.name}：{comment.body}</p>)}{capture.success && site.versions.some(v => v.id === capture.data.target.versionId) && <button type="button" data-testid="thread-reveal" disabled={busy} onClick={() => revealAnnotation(capture.data.target, { thread }, thread.comments[0].body)}>定位区块</button>}<button type="button" disabled={busy} onClick={async () => {
            try { const response = await fetch(`/api/sites/${siteId}/annotations/${thread.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: thread.status === 'open' ? 'resolved' : 'open' }) });
              const payload = await response.json(); if (!response.ok) throw new Error(payload.error || '批注状态保存失败。'); setThreads(items => items.map(item => item.id === thread.id ? payload.annotation : item)); }
            catch (error) { setError(error instanceof Error ? error.message : '批注状态保存失败。'); }
          }}>{thread.status === 'open' ? '标为已处理' : '重新打开'}</button></article>;
        }) : <p>还没有保存的批注。</p>}</details>
        <div className="code-material-tools"><button disabled={busy} onClick={() => setPanel(panel === 'materials' ? null : 'materials')}><FileText size={14} />资料</button><button disabled={busy} onClick={() => { setPanel(panel === 'images' ? null : 'images'); void loadImages().catch(e => setError(e.message)); }}><ImageIcon size={14} />图片</button></div>
        {panel === 'materials' && <section className="code-upload-panel" aria-label="公司资料"><label>上传文本或表格<input type="file" accept=".txt,.md,.csv,.xlsx" onChange={e => void loadMaterial(e)} /></label><div className="code-pack-list">{simulatedPackList.map(pack => <button key={pack.id} data-pack-id={pack.id} onClick={() => { setInput(pack.body); setMaterialSource(undefined); setPanel(null); }}>{pack.label}</button>)}</div><p>资料载入后可先编辑，再发送。</p></section>}
        {panel === 'images' && <section className="code-upload-panel" aria-label="站点图片"><label>用途<select value={category} onChange={e => setCategory(e.target.value)}><option value="product">产品</option><option value="equipment">设备</option><option value="facility">厂房</option><option value="inspection">检测</option></select></label><label>许可<select value={license} onChange={e => setLicense(e.target.value)}>{['user-provided', 'CC0', 'Public Domain', 'CC BY', 'CC BY-SA'].map(l => <option key={l} value={l}>{l === 'user-provided' ? '我有权用于本站' : l}</option>)}</select></label><label>来源地址<input value={sourceUrl} onChange={e => setSourceUrl(e.target.value)} /></label>{license !== 'user-provided' && <label>许可证地址<input value={licenseUrl} onChange={e => setLicenseUrl(e.target.value)} /></label>}<label>作者<input value={author} onChange={e => setAuthor(e.target.value)} /></label><label>署名文字<input value={attribution} onChange={e => setAttribution(e.target.value)} /></label><input aria-label="上传图片" disabled={busy} type="file" accept="image/png,image/jpeg,image/webp" onChange={e => void uploadImage(e)} />{images.map(image => <p key={image.imageId}>{image.originalName} · {image.imageId}</p>)}</section>}
        <form className="code-chat-form" onSubmit={e => void submit(e)}><label className="sr-only" htmlFor="code-message">公司资料或修改要求</label><textarea id="code-message" data-testid="code-message" value={input} maxLength={4000} onChange={e => { const value = e.target.value; setInput(value); if (materialSource && materialSource.text !== value) setMaterialSource(undefined); }} placeholder={selected ? `想怎样修改「${selected.label}」？` : version ? '例如：首屏换成深色，保留其他内容' : '粘贴公司资料，说明希望访客做什么'} disabled={busy || conversationUnavailable} rows={4} /><button className="primary-button" type="submit" disabled={busy || conversationUnavailable || !input.trim()}><Send size={14} />{version ? '发送修改' : '发送资料'}</button></form>
      </div>
    </aside>
    {historyOpen && <CodeVersionHistory site={site} busy={!!busy} onUpdate={setState} onClose={() => setHistoryOpen(false)} />}
    <SiteDeleteDialog siteId={siteId} hasVersion={!!version} open={deleteOpen} onClose={() => setDeleteOpen(false)} onDeleted={() => { window.location.href = '/sites'; }} />
  </div>;
}
