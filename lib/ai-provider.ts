import { providerConfig } from './provider-context.ts';

export { providerConfig };

export function getAIProviderStatus() {
  const config = providerConfig();
  const configured = Boolean(config.apiKey && config.model);
  return {
    configured,
    mode: configured ? "deepseek" as const : "unconfigured" as const,
    provider: "DeepSeek" as const,
    model: config.model ?? null,
    baseURL: configured ? config.baseURL : null,
  };
}
