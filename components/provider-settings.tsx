'use client';
import { useEffect, useState } from 'react';
import { KeyRound } from 'lucide-react';
import { readProviderSettings, saveProviderSettings } from '@/lib/provider-settings-client';

const defaults = { baseURL: 'https://api.deepseek.com', apiKey: '', model: 'deepseek-flash' };

export function ProviderSettingsPanel() {
  const [form, setForm] = useState(defaults);
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    const current = readProviderSettings();
    if (current) { setForm(current); setSaved(true); }
  }, []);
  function update(field: keyof typeof defaults, value: string) { setForm(current => ({ ...current, [field]: value })); setMessage(''); }
  function save(event: React.FormEvent) {
    event.preventDefault();
    const next = { baseURL: form.baseURL.trim(), apiKey: form.apiKey.trim(), model: form.model.trim() };
    if (!next.baseURL || !next.apiKey || !next.model) { setMessage('API 地址、key 和模型名都要填写。'); return; }
    if (!/^https:\/\//i.test(next.baseURL) && !/^http:\/\/(127\.0\.0\.1|localhost)[:/]/i.test(next.baseURL)) { setMessage('API 地址必须以 https:// 开头。'); return; }
    try { saveProviderSettings(next); setSaved(true); setMessage('已保存在这个浏览器里。'); }
    catch { setMessage('浏览器拒绝保存（可能是隐私模式或存储被禁用），设置没有保存。'); }
  }
  function clear() {
    try { saveProviderSettings(null); } catch { /* nothing stored */ }
    setForm(defaults); setSaved(false); setMessage('已从这个浏览器清除。');
  }
  return (
    <section className="settings-section settings-section-stack" id="provider" data-testid="provider-settings">
      <div className="settings-icon"><KeyRound size={17} /></div>
      <div>
        <h2>模型接口</h2>
        <p>生成和修改网站时使用你自己的模型接口。API 地址、key 和模型名只保存在这个浏览器里；服务器只在处理那一次请求时使用 key，不保存。目前只保证 DeepSeek 兼容接口可用。</p>
      </div>
      <form className="provider-form" onSubmit={save}>
        <label>API 地址<input name="baseURL" value={form.baseURL} onChange={event => update('baseURL', event.target.value)} autoComplete="off" spellCheck={false} /></label>
        <label>API key<input name="apiKey" type="password" value={form.apiKey} onChange={event => update('apiKey', event.target.value)} autoComplete="off" spellCheck={false} placeholder={saved ? '' : 'sk-…'} /></label>
        <label>模型名<input name="model" value={form.model} onChange={event => update('model', event.target.value)} autoComplete="off" spellCheck={false} /></label>
        <div className="provider-actions">
          <button className="primary-button" type="submit">保存模型接口</button>
          {saved && <button className="secondary-button" type="button" onClick={clear}>从浏览器清除</button>}
          <span role="status" className="provider-status">{message || (saved ? '已配置' : '尚未配置，生成和修改前需要先填写。')}</span>
        </div>
      </form>
    </section>
  );
}
