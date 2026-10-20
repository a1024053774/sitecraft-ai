// T-202: the visitor's model interface lives only in this browser's localStorage.
// It is sent as request headers on calls that may reach the model, never in a body.
export type ProviderSettings = { baseURL: string; apiKey: string; model: string };
const storageKey = 'sitecraft.provider.v1';
export const providerSettingsEvent = 'sitecraft-provider-settings';

export function readProviderSettings(): ProviderSettings | null {
  try {
    const value = JSON.parse(window.localStorage.getItem(storageKey) ?? 'null');
    if (value && typeof value.baseURL === 'string' && typeof value.apiKey === 'string' && typeof value.model === 'string'
      && value.baseURL && value.apiKey && value.model) return value;
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
  return settings ? { 'x-sitecraft-provider-base': settings.baseURL, 'x-sitecraft-provider-key': settings.apiKey, 'x-sitecraft-provider-model': settings.model } : {};
}
