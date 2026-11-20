// T-202: the visitor's model interface lives only in this browser's localStorage.
// It is sent as request headers on calls that may reach the model, never in a body.
import { providerFormat, type ProviderFormat } from './provider-format.ts';
export type ProviderSettings = { baseURL: string; apiKey: string; model: string; format: ProviderFormat };
const storageKey = 'sitecraft.provider.v1';
export const providerSettingsEvent = 'sitecraft-provider-settings';

export const formatDefaults: Record<ProviderFormat, { baseURL: string; model: string; modelHint: string; keyHint: string }> = {
  deepseek: { baseURL: 'https://api.deepseek.com', model: 'deepseek-flash', modelHint: '', keyHint: 'sk-…' },
  openai: { baseURL: 'https://api.openai.com/v1', model: '', modelHint: '填服务商给的模型名', keyHint: 'sk-…' },
  'openai-responses': { baseURL: 'https://api.openai.com/v1', model: '', modelHint: '填服务商给的模型名', keyHint: 'sk-…' },
  anthropic: { baseURL: 'https://api.anthropic.com', model: '', modelHint: '填服务商给的模型名', keyHint: 'sk-ant-…' },
};

// A saved credential can follow path or protocol-format changes at the same origin.
export function withProviderAddress(current: ProviderSettings, baseURL: string): ProviderSettings {
  let apiKey = '';
  try {
    if (new URL(current.baseURL).origin === new URL(baseURL).origin) apiKey = current.apiKey;
  } catch { /* An incomplete address cannot identify the credential's origin. */ }
  return { ...current, baseURL, apiKey };
}

export function withProviderFormat(current: ProviderSettings, format: ProviderFormat): ProviderSettings {
  const previous = formatDefaults[current.format], next = formatDefaults[format];
  const address = current.baseURL.trim();
  const baseURL = !address || address === previous.baseURL ? next.baseURL : current.baseURL;
  const model = current.model.trim() === previous.model ? next.model : current.model;
  return { ...withProviderAddress(current, baseURL), format, model };
}

export function readProviderSettings(): ProviderSettings | null {
  try {
    const value = JSON.parse(window.localStorage.getItem(storageKey) ?? 'null');
    // Settings saved before T-221 have no format; they were DeepSeek.
    const format = providerFormat(value?.format ?? 'deepseek');
    if (value && typeof value.baseURL === 'string' && typeof value.apiKey === 'string' && typeof value.model === 'string'
      && value.baseURL && value.apiKey && value.model && format) return { baseURL: value.baseURL, apiKey: value.apiKey, model: value.model, format };
  } catch { /* unreadable or blocked storage reads as not configured */ }
  return null;
}
export function saveProviderSettings(settings: ProviderSettings | null) {
  if (settings) window.localStorage.setItem(storageKey, JSON.stringify(settings));
  else window.localStorage.removeItem(storageKey);
  window.dispatchEvent(new Event(providerSettingsEvent));
}
export function providerHeaders(): Record<string, string> {
  const settings = readProviderSettings();
  return settings ? { 'x-sitecraft-provider-base': settings.baseURL, 'x-sitecraft-provider-key': settings.apiKey, 'x-sitecraft-provider-model': settings.model, 'x-sitecraft-provider-format': settings.format } : {};
}
