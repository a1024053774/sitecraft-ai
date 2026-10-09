'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { codeCheckLabel, codeVersionAuthor, type CodeSiteRecord } from '@/lib/code-site';
import { groupCodeVersions, type VersionGrouping } from '@/lib/code-site-history';
import type { CodeWorkspacePayload } from './code-workspace';
import styles from './code-version-history.module.css';

const time = (date: Date, grouping?: VersionGrouping) => new Intl.DateTimeFormat('zh-CN', {
  month: 'short', day: 'numeric', ...(grouping === 'day' ? {} : { hour: '2-digit', minute: '2-digit' }),
  ...(grouping && grouping !== 'day' ? { timeZoneName: 'shortOffset' } : {}),
}).format(date);

export function CodeVersionHistory({ site, busy, onUpdate, onClose }: {
  site: CodeSiteRecord; busy: boolean; onUpdate: (payload: CodeWorkspacePayload) => void; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null), stage = useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = useState(site.currentVersionId);
  const [grouping, setGrouping] = useState<VersionGrouping>('ten-minutes');
  const [width, setWidth] = useState(1440), [available, setAvailable] = useState(800), [page, setPage] = useState('home');
  const [name, setName] = useState(''), [saving, setSaving] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [readyUrl, setReadyUrl] = useState('');
  const selected = site.versions.find(version => version.id === selectedId);
  const activePage = selected?.code.pages.some(item => item.id === page) ? page : 'home';
  const previewUrl = selected ? `/api/sites/${site.siteId}/code-preview?version=${selected.id}&page=${activePage}` : '';
  const scale = Math.min(1, available / width), disabled = busy || saving;
  useEffect(() => { setReadyUrl(''); }, [previewUrl]);
  useEffect(() => { const node = dialog.current!; node.showModal(); return () => node.close(); }, []);
  useEffect(() => {
    const node = stage.current; if (!node) return;
    const observer = new ResizeObserver(entries => setAvailable(Math.max(1, entries[0].contentRect.width - 24)));
    observer.observe(node); return () => observer.disconnect();
  }, [selected?.id]);
  useEffect(() => { setName(selected?.name ?? ''); }, [selected?.id, selected?.name]);
  useEffect(() => { dialog.current?.querySelector(`[data-version-id="${selectedId}"]`)?.scrollIntoView({ block: 'nearest' }); }, [selectedId, selected?.name]);

  async function mutate(kind: 'name' | 'restore', event?: FormEvent) {
    event?.preventDefault(); if (!selected || disabled) return;
    setSaving(true); setError(''); setNotice('');
    try {
      const response = await fetch(kind === 'name' ? `/api/sites/${site.siteId}/versions/${selected.id}` : `/api/sites/${site.siteId}/history/restore`, {
        method: kind === 'name' ? 'PATCH' : 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(kind === 'name' ? { name } : { versionId: selected.id, baseRevision: site.versions.find(version => version.id === site.currentVersionId)?.revision ?? 0 }),
      });
      const payload = await response.json();
      if (payload.codeSite) onUpdate(payload);
      if (!response.ok) throw new Error(payload.userMessage || '本次操作未完成。');
      if (kind === 'restore') {
        setSelectedId(payload.codeSite.currentVersionId);
        setNotice(`已恢复第 ${selected.revision} 版，保存为第 ${payload.codeSite.versions.at(-1).revision} 版。`);
      } else setNotice(name.trim() ? '版本名称已保存。' : '版本名称已清除。');
    } catch (error) { setError(error instanceof Error ? error.message : '本次操作未完成。'); }
    finally { setSaving(false); }
  }
  return <dialog ref={dialog} className={styles.dialog} aria-labelledby="version-history-title" onCancel={onClose} data-testid="version-history">
    <header className={styles.header}><div><h2 id="version-history-title">版本历史</h2><span>{site.name} · {site.versions.length} 个版本</span></div><button className="icon-button" aria-label="关闭版本历史" onClick={onClose}><X size={18} /></button></header>
    <div className={styles.body}>
      <aside className={styles.sidebar} aria-label="站点版本">
        <label className={styles.grouping}>按时间分组<select aria-label="版本分组" value={grouping} onChange={event => setGrouping(event.target.value as VersionGrouping)}>{[['minute', '1 分钟'], ['ten-minutes', '10 分钟'], ['hour', '1 小时'], ['day', '天']].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <div className={styles.list}>
          {!site.versions.length && <p className={styles.empty}>还没有版本。生成或保存一次修改后，版本会出现在这里。</p>}
          {groupCodeVersions(site.versions, grouping).map(group => <section key={group.key} className={styles.group} data-version-group={group.key}><h3>{time(group.date, grouping)}</h3>{group.versions.map(version => <button key={version.id} className={`${styles.version} ${version.id === selectedId ? styles.selected : ''}`} aria-pressed={version.id === selectedId} onClick={() => { setSelectedId(version.id); setError(''); setNotice(''); }} data-version-id={version.id} data-revision={version.revision}>
            <span className={styles.versionTop}><strong>第 {version.revision} 版</strong>{version.id === site.currentVersionId && <em>当前版本</em>}</span>
            {version.name && <strong className={styles.versionName}>{version.name}</strong>}
            <span className={styles.summary}>{version.summary}</span>
            <span className={styles.meta}><time dateTime={version.createdAt}>{new Date(version.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</time> · {codeVersionAuthor(version.author)} · {codeCheckLabel(version.checks)}</span>
          </button>)}</section>)}
        </div>
      </aside>
      <section className={styles.detail} aria-label="版本预览">
        {selected ? <>
          <div className={styles.detailHead}><div><h3>{selected.name || `第 ${selected.revision} 版`}{selected.id === site.currentVersionId && <small>当前版本</small>}</h3><p>{time(new Date(selected.createdAt))} · {codeVersionAuthor(selected.author)} · {selected.summary}</p></div><button className="primary-button" disabled={disabled || selected.id === site.currentVersionId} onClick={() => void mutate('restore')} data-testid="restore-version">{saving ? '正在保存…' : '恢复到这个版本'}</button></div>
          <form className={styles.naming} onSubmit={event => void mutate('name', event)}><label htmlFor="version-name">版本名称</label><input id="version-name" aria-label="版本名称" placeholder="例如：产品目录确认版" value={name} maxLength={80} onChange={event => setName(event.target.value)} disabled={disabled} /><button className="secondary-button" disabled={disabled || name.trim() === (selected.name ?? '')} type="submit">保存名称</button></form>
          {error && <p className={styles.error} role="alert">{error}</p>}{notice && <p className={styles.notice} role="status">{notice}</p>}
          <div className={styles.previewTools}><select aria-label="版本页面" value={activePage} onChange={event => setPage(event.target.value)}>{selected.code.pages.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select><div className="device-toggle" aria-label="版本预览宽度">{[1440, 768, 375].map(value => <button key={value} className={width === value ? 'active' : ''} aria-pressed={width === value} onClick={() => setWidth(value)}>{value}</button>)}</div><span>{codeCheckLabel(selected.checks)}</span></div>
          <div ref={stage} className={styles.stage}><div className={styles.canvas} style={{ width: width * scale, height: 900 * scale }}>
            <iframe key={previewUrl} src={previewUrl} title={`第 ${selected.revision} 版 · ${selected.code.pages.find(item => item.id === activePage)?.title}预览`} sandbox="allow-forms" style={{ width, height: 900, transform: `scale(${scale})` }} onLoad={() => setReadyUrl(previewUrl)} data-testid="version-preview" />
            {readyUrl !== previewUrl && <div className={styles.loading} role="status" data-testid="version-preview-loading">正在载入第 {selected.revision} 版…</div>}
          </div></div>
        </> : <div ref={stage} className={styles.empty}>选择一个版本查看页面。</div>}
      </section>
    </div>
  </dialog>;
}
