'use client';
import { useEffect, useState } from 'react';
import { KeyRound } from 'lucide-react';
import { readProviderSettings, saveProviderSettings, type ProviderSettings } from '@/lib/provider-settings-client';
import { providerFormats, providerFormatNames, type ProviderFormat } from '@/lib/provider-format';

// T-221: each format's usual address. Only DeepSeek has a model name the prompts were tuned on.
const formatDefaults: Record<ProviderFormat, { baseURL: string; model: string; modelHint: string; keyHint: string }> = {
  deepseek: { baseURL: 'https://api.deepseek.com', model: 'deepseek-flash', modelHint: '', keyHint: 'sk-…' },
  openai: { baseURL: 'https://api.openai.com/v1', model: '', modelHint: '填服务商给的模型名', keyHint: 'sk-…' },
  'openai-responses': { baseURL: 'https://api.openai.com/v1', model: '', modelHint: '填服务商给的模型名', keyHint: 'sk-…' },
  anthropic: { baseURL: 'https://api.anthropic.com', model: '', modelHint: '填服务商给的模型名', keyHint: 'sk-ant-…' },
};
const defaults: ProviderSettings = { format: 'deepseek', baseURL: formatDefaults.deepseek.baseURL, apiKey: '', model: formatDefaults.deepseek.model };

export function ProviderSettingsPanel() {
  const [form, setForm] = useState(defaults);
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    const current = readProviderSettings();
    if (current) { setForm(current); setSaved(true); }
  }, []);
  function update(field: 'baseURL' | 'apiKey' | 'model', value: string) { setForm(current => ({ ...current, [field]: value })); setMessage(''); }
  // Switching format swaps an address or model name the form filled in itself; anything the user typed stays.
  function changeFormat(format: ProviderFormat) {
    setForm(current => ({ ...current, format,
      baseURL: current.baseURL.trim() === formatDefaults[current.format].baseURL || !current.baseURL.trim() ? formatDefaults[format].baseURL : current.baseURL,
      model: current.model.trim() === formatDefaults[current.format].model ? formatDefaults[format].model : current.model }));
    setMessage('');
  }
  function save(event: React.FormEvent) {
    event.preventDefault();
    const next = { format: form.format, baseURL: form.baseURL.trim(), apiKey: form.apiKey.trim(), model: form.model.trim() };
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
        <p>生成和修改网站时使用你自己的模型接口。API 地址、key 和模型名只保存在这个浏览器里；服务器只在处理那一次请求时使用 key，不保存。提示词是按 DeepSeek 调的；其他格式的验证情况见项目票 T-221。OpenAI 的模型若提示不能带推理调用函数，选「OpenAI Responses」。</p>
      </div>
      <form className="provider-form" onSubmit={save}>
        <label>接口格式<select name="format" value={form.format} onChange={event => changeFormat(event.target.value as ProviderFormat)} data-testid="provider-format">{providerFormats.map(format => <option key={format} value={format}>{providerFormatNames[format]}</option>)}</select></label>
        <label>API 地址<input name="baseURL" value={form.baseURL} onChange={event => update('baseURL', event.target.value)} autoComplete="off" spellCheck={false} /></label>
        <label>API key<input name="apiKey" type="password" value={form.apiKey} onChange={event => update('apiKey', event.target.value)} autoComplete="off" spellCheck={false} placeholder={saved ? '' : formatDefaults[form.format].keyHint} /></label>
        <label>模型名<input name="model" value={form.model} onChange={event => update('model', event.target.value)} autoComplete="off" spellCheck={false} placeholder={formatDefaults[form.format].modelHint} /></label>
        <div className="provider-actions">
          <button className="primary-button" type="submit">保存模型接口</button>
          {saved && <button className="secondary-button" type="button" onClick={clear}>从浏览器清除</button>}
          <span role="status" className="provider-status">{message || (saved ? '已配置' : '尚未配置，生成和修改前需要先填写。')}</span>
        </div>
      </form>
    </section>
  );
}

// T-220: one line on the home page saying whether this browser has a model interface saved.
export function ProviderStatus() {
  const [model, setModel] = useState<string | null | undefined>(undefined);
  useEffect(() => { setModel(readProviderSettings()?.model ?? null); }, []);
  if (model === undefined) return null;
  return (
    <p className="provider-line" data-testid="provider-status">
      <KeyRound size={14} />
      {model ? `模型接口已保存在这个浏览器里（${model}）。` : "这个浏览器里还没有保存模型接口。"}
      <a href="/settings#provider">{model ? "查看或修改" : "去填写"}</a>
    </p>
  );
}
