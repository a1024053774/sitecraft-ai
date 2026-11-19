import { providerConfig } from './provider-context.ts';
import { providerFormatNames } from './provider-format.ts';

export { providerConfig };

export function getAIProviderStatus() {
  const config = providerConfig();
  const configured = Boolean(config.apiKey && config.model);
  return {
    configured,
    mode: configured ? config.format : "unconfigured" as const,
    provider: providerFormatNames[config.format],
    model: config.model ?? null,
    baseURL: configured ? config.baseURL : null,
  };
}
