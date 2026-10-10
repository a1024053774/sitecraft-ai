'use client';

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, FileText, History, Image as ImageIcon, LoaderCircle, RotateCcw, Send, Trash2 } from 'lucide-react';
import Papa from 'papaparse';
import readXlsxFile from 'read-excel-file';
import type { CodeSiteRecord, CodePreferences } from '@/lib/code-site';
import { codeCheckLabel, codeVersionAuthor, chineseCodeRevision, codeFactMaterials, explicitEnglishCompanyName } from '@/lib/code-site';
import type { AlignmentPublicView } from '@/lib/alignment';
import type { ConversationTurn } from '@/lib/conversation-store';
import { simulatedPackList } from '@/lib/simulated-packs';
import { CodeVersionHistory } from './code-version-history';
import { SiteDeleteDialog } from './site-delete-panel';

export type CodeWorkspacePayload = { codeSite: CodeSiteRecord; alignment: AlignmentPublicView | null; turns: ConversationTurn[]; conversationError?: string };
export function CodeWorkspace({ siteId, initial }: { siteId: string; initial: CodeWorkspacePayload }) {
  const [state, setState] = useState(initial), [input, setInput] = useState(''), [error, setError] = useState('');
  const [sending, setSending] = useState(false), [panel, setPanel] = useState<'materials' | 'images' | null>(null);
  const [preferences, setPreferences] = useState<CodePreferences>(initial.codeSite.preferences);
  const [width, setWidth] = useState(1440), [page, setPage] = useState('home'), [pane, setPane] = useState('chat');
  const [images, setImages] = useState<Array<{ imageId: string; originalName: string }>>([]);
  const [category, setCategory] = useState('product'), [license, setLicense] = useState('user-provided');
  const [sourceUrl, setSourceUrl] = useState(''), [licenseUrl, setLicenseUrl] = useState(''), [author, setAuthor] = useState(''), [attribution, setAttribution] = useState('');
  const [previewReady, setPreviewReady] = useState(false);
  const [language, setLanguage] = useState<'zh' | 'en'>('zh');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const stage = useRef<HTMLDivElement>(null), [availableWidth, setAvailableWidth] = useState(1000);
  useEffect(() => {
    if (!stage.current) return;
    const observer = new ResizeObserver(entries => setAvailableWidth(Math.max(1, entries[0].contentRect.width - 24)));
    observer.observe(stage.current); return () => observer.disconnect();
  }, []);
  const scale = Math.min(1, availableWidth / width);
  const site = state.codeSite, version = site.versions.find(v => v.id === site.currentVersionId);
  const conversationUnavailable = !!state.conversationError;
  const running = site.run?.status === 'running' && !conversationUnavailable, busy = sending || running;
  const progressText = conversationUnavailable && site.run?.status === 'error'
    ? '上次任务未完成，完整检查问题仍保留。' : site.run?.step;
  const english = version?.english;
  const activeLanguage = language === 'en' && english ? 'en' : 'zh';
  const pages = activeLanguage === 'en' ? english!.pages : version?.code.pages ?? site.plan?.pages ?? [];
  const activePage = pages.some(p => p.id === page) ? page : 'home';
  const previewUrl = version ? `/api/sites/${siteId}/code-preview?page=${activePage}&version=${version.id}${activeLanguage === 'en' ? '&language=en' : ''}` : '';
  useEffect(() => { setPreviewReady(false); }, [previewUrl]);
  async function request(body: Record<string, unknown>) {
    const response = await fetch(`/api/sites/${siteId}/chat`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.userMessage || '本次请求失败。');
    setState(payload); return payload as CodeWorkspacePayload;
  }
  useEffect(() => {
    if (!running) return;
    let cancelled = false;
    const timer = setInterval(() => {
      void fetch(`/api/sites/${siteId}/chat`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'state' }) })
        .then(async response => { const payload = await response.json(); if (!response.ok) throw new Error(payload.userMessage || '读取进度失败。'); if (!cancelled) setState(payload); })
        .catch(error => { if (!cancelled) setError(error instanceof Error ? error.message : '读取进度失败。'); });
    }, 2000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [running, siteId]);
  async function perform(body: Record<string, unknown>) {
    setSending(true); setError('');
    try { await request(body); } catch (error) { setError(error instanceof Error ? error.message : '本次请求失败。'); }
    finally { setSending(false); }
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); if (!input.trim() || busy || conversationUnavailable) return;
    const message = input.trim();
    setSending(true); setError('');
    try { await request({ message, baseRevision: version?.revision ?? 0 }); setInput(''); setPanel(null); }
    catch (error) { setError(error instanceof Error ? error.message : '本次请求失败。'); }
    finally { setSending(false); }
  }
  async function undo() {
    setSending(true); setError('');
    try {
      const response = await fetch(`/api/sites/${siteId}/history/undo`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ baseRevision: version?.revision ?? 0 }) }); const payload = await response.json();
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
      setInput(text); setPanel(null); setError('');
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
  return <div className={`builder-shell workspace-theme-light workspace-accent-porcelain code-workspace pane-${pane}`} data-testid="code-workspace">
    <header className="preview-toolbar workspace-topbar">
      <div className="preview-toolbar-left"><Link href="/" className="topbar-back" aria-label="返回站点"><ArrowLeft size={17} /></Link><strong className="project-name">{site.name}</strong><span className="save-status">{running ? <LoaderCircle size={12} className="spin" /> : <Check size={12} />}{version ? `版本 ${version.revision}` : '尚未生成'}</span><button className="icon-button" aria-label="版本历史" title="版本历史" onClick={() => setHistoryOpen(true)} data-testid="open-version-history"><History size={17} /></button></div>
      <div className="builder-mobile-tabs" role="tablist" aria-label="建站工作区视图">{['chat', 'preview'].map(p => <button key={p} role="tab" aria-selected={pane === p} className={pane === p ? 'active' : ''} onClick={() => setPane(p)}>{p === 'chat' ? '对话' : '预览'}</button>)}</div>
      <div className="topbar-tools"><div className="device-toggle" aria-label="预览宽度">{[1440, 768, 375].map(w => <button key={w} aria-pressed={width === w} className={width === w ? 'active' : ''} onClick={() => setWidth(w)}>{w}</button>)}</div><button className="icon-button" aria-label="撤销" disabled={busy || site.versions.length < 2} onClick={() => void undo()}><RotateCcw size={16} /></button><button className="icon-button" aria-label="删除站点" data-testid="toolbar-delete-site" disabled={busy} onClick={() => setDeleteOpen(true)}><Trash2 size={16} /></button></div>
    </header>
    <main className={`preview-shell ${pane !== 'preview' ? 'mobile-hidden' : ''}`}>
      <div className="site-page-chrome">{english && <div className="device-toggle" aria-label="预览语言">{(['zh', 'en'] as const).map(value => <button key={value} className={activeLanguage === value ? 'active' : ''} aria-pressed={activeLanguage === value} data-testid={`preview-${value}`} onClick={() => setLanguage(value)}>{value === 'zh' ? '中文' : 'English'}</button>)}</div>}<nav className="site-page-nav" aria-label="站点页面">{pages.map(p => <button key={p.id} className={`site-page-tab ${activePage === p.id ? 'active' : ''}`} aria-pressed={activePage === p.id} data-page-id={p.id} onClick={() => setPage(p.id)}><strong>{p.title}</strong><small>独立页</small></button>)}</nav></div>
      <div className="preview-stage code-preview-stage" ref={stage}><div className="code-preview-canvas" style={{ width: width * scale, height: 1000 * scale }}>
        {version ? <><iframe key={previewUrl} style={{ width, height: 1000, transform: `scale(${scale})` }} src={previewUrl} title={`${pages.find(p => p.id === activePage)?.title || '首页'}预览`} sandbox="allow-forms" data-testid="code-preview" onLoad={() => setPreviewReady(true)} />{!previewReady && <div className="code-preview-loading" role="status">正在载入版本 {version.revision}…</div>}</> : <div className="code-empty"><strong>先读公司资料，再生成网站</strong><p>发来已有的公司或产品资料。选好风格、确认页面大纲后，预览会出现在这里；资料可以之后继续补充。</p></div>}
      </div></div>
    </main>
    <aside className={`builder-chat ${pane !== 'chat' ? 'mobile-hidden' : ''}`} aria-label="对话">
      <div className="builder-chat-head"><strong data-testid="code-revision">{version ? `当前版本 · v${version.revision}` : '公司资料与需求'}</strong><small>{english ? '中英文网站' : '中文网站'}</small></div>
      <div className="chat-messages">
        {state.conversationError && <p className="code-error" role="alert" data-testid="code-conversation-error">{state.conversationError}</p>}
        {!state.turns.length && !conversationUnavailable && <div className="message assistant"><div className="message-bubble">发来公司资料，或从「资料」选一份模拟公司。已有图片也可以先上传。</div></div>}
        {state.turns.map((turn, index) => <div key={`${turn.createdAt}-${index}`}><div className="message user"><div className="message-label">你</div><div className="message-bubble">{turn.userMessage}</div></div><div className={`message assistant ${turn.outcome}`}><div className="message-label">AI 助手</div><div className="message-bubble">{turn.aiSummary}</div></div></div>)}
        {alignment?.waitingForUser && !alignment.awaitingConfirmation && <section className="alignment-panel" aria-label="需求对齐" data-testid="code-style-question">
          <strong>{alignment.question}</strong><div className="code-style-options">{alignment.options.map(option => <label key={option.id}><input type="radio" name="code-style" value={option.id} checked={preferences.style === option.id} onChange={() => setPreferences(p => ({ ...p, style: option.id as CodePreferences['style'] }))} /><span><strong>{option.label}</strong><small>{option.description}</small></span></label>)}</div>
          <label className="code-slider">版式：规整 ↔ 大胆 <output>{preferences.layout}</output><input aria-label="版式" type="range" min="1" max="10" value={preferences.layout} onChange={e => setPreferences(p => ({ ...p, layout: Number(e.target.value) }))} /></label>
          <label className="code-slider">信息：疏朗 ↔ 紧凑 <output>{preferences.density}</output><input aria-label="信息密度" type="range" min="1" max="10" value={preferences.density} onChange={e => setPreferences(p => ({ ...p, density: Number(e.target.value) }))} /></label>
          <button className="primary-button" disabled={busy} onClick={() => void perform({ action: 'select', questionId: alignment.questionId, questionRevision: alignment.questionRevision, optionId: preferences.style, preferences })}>保存选择，规划页面</button>
        </section>}
        {alignment?.awaitingConfirmation && !busy && site.plan && <section className="alignment-panel" aria-label="确认页面大纲" data-testid="code-plan"><strong>{site.plan.summary}</strong><ol>{site.plan.pages.map(p => <li key={p.id}><strong>{p.title}</strong><p>{p.outline}</p></li>)}</ol><button className="primary-button" onClick={() => void perform({ action: 'confirm', questionId: alignment.questionId, questionRevision: alignment.questionRevision })}>确认并生成</button></section>}
        {site.run && (running || site.run.issues.length > 0 || state.turns.at(-1)?.aiSummary !== progressText) && <div className={`message assistant ${site.run.status}`}><div className="message-bubble" role="status" data-testid="code-progress">{running && <LoaderCircle className="spin" size={14} />} {progressText}{site.run.issues.length > 0 && <details data-testid="code-run-issues"><summary>查看完整检查问题（{site.run.issues.length} 项）</summary><ul>{site.run.issues.map((issue, i) => <li key={i}>{issue}</li>)}</ul></details>}</div></div>}
        {version && <p className="code-check-receipt" data-testid="code-check-receipt">版本 {version.revision} · {codeVersionAuthor(version.author)} · {version.summary} · {codeCheckLabel(version.checks)}</p>}
        {version?.checks.passed && !conversationUnavailable && <section className="alignment-panel code-english-panel" aria-label="英文版">
          <p data-testid="english-status">{english ? `英文版基于中文第 ${english.sourceRevision} 版${english.sourceRevision !== chineseCodeRevision(version) ? '，已落后于当前中文版。' : '。'}` : '中文版满意了吗？可以沿用当前页面生成英文版。'}</p>
          {english && !explicitEnglishCompanyName(codeFactMaterials(site)) && <p data-testid="english-company-name-notice">资料里没有英文公司名，英文版沿用中文名；补充后可重新翻译。</p>}
          <button className="secondary-button" data-testid="generate-english" disabled={busy} onClick={() => void perform({ action: 'translate', baseRevision: version.revision })}>{running && site.run?.kind === 'translate' ? '正在翻译…' : english ? '按当前中文版重新翻译' : '生成英文版'}</button>
        </section>}
        {error && <p className="code-error" role="alert">{error}</p>}
      </div>
      <div className="chat-input-wrap">
        <div className="code-material-tools"><button disabled={busy} onClick={() => setPanel(panel === 'materials' ? null : 'materials')}><FileText size={14} />资料</button><button disabled={busy} onClick={() => { setPanel(panel === 'images' ? null : 'images'); void loadImages().catch(e => setError(e.message)); }}><ImageIcon size={14} />图片</button></div>
        {panel === 'materials' && <section className="code-upload-panel" aria-label="公司资料"><label>上传文本或表格<input type="file" accept=".txt,.md,.csv,.xlsx" onChange={e => void loadMaterial(e)} /></label><div className="code-pack-list">{simulatedPackList.map(pack => <button key={pack.id} data-pack-id={pack.id} onClick={() => { setInput(pack.body); setPanel(null); }}>{pack.label}</button>)}</div><p>资料载入后可先编辑，再发送。</p></section>}
        {panel === 'images' && <section className="code-upload-panel" aria-label="站点图片"><label>用途<select value={category} onChange={e => setCategory(e.target.value)}><option value="product">产品</option><option value="equipment">设备</option><option value="facility">厂房</option><option value="inspection">检测</option></select></label><label>许可<select value={license} onChange={e => setLicense(e.target.value)}>{['user-provided', 'CC0', 'Public Domain', 'CC BY', 'CC BY-SA'].map(l => <option key={l} value={l}>{l === 'user-provided' ? '我有权用于本站' : l}</option>)}</select></label><label>来源地址<input value={sourceUrl} onChange={e => setSourceUrl(e.target.value)} /></label>{license !== 'user-provided' && <label>许可证地址<input value={licenseUrl} onChange={e => setLicenseUrl(e.target.value)} /></label>}<label>作者<input value={author} onChange={e => setAuthor(e.target.value)} /></label><label>署名文字<input value={attribution} onChange={e => setAttribution(e.target.value)} /></label><input aria-label="上传图片" disabled={busy} type="file" accept="image/png,image/jpeg,image/webp" onChange={e => void uploadImage(e)} />{images.map(image => <p key={image.imageId}>{image.originalName} · {image.imageId}</p>)}</section>}
        <form className="code-chat-form" onSubmit={e => void submit(e)}><label className="sr-only" htmlFor="code-message">公司资料或修改要求</label><textarea id="code-message" data-testid="code-message" value={input} maxLength={4000} onChange={e => setInput(e.target.value)} placeholder={version ? '例如：首屏换成深色，保留其他内容' : '粘贴公司资料，说明希望访客做什么'} disabled={busy || conversationUnavailable} rows={4} /><button className="primary-button" type="submit" disabled={busy || conversationUnavailable || !input.trim()}><Send size={14} />{version ? '发送修改' : '发送资料'}</button></form>
      </div>
    </aside>
    {historyOpen && <CodeVersionHistory site={site} busy={!!busy} onUpdate={setState} onClose={() => setHistoryOpen(false)} />}
    <SiteDeleteDialog siteId={siteId} hasVersion={!!version} open={deleteOpen} onClose={() => setDeleteOpen(false)} onDeleted={() => { window.location.href = '/sites'; }} />
  </div>;
}
