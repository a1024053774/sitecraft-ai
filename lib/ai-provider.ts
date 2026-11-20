import { providerConfig, providerConfigured } from './provider-context.ts';
import { providerFormatNames } from './provider-format.ts';

export { providerConfig };

export function getAIProviderStatus() {
  const config = providerConfig();
  const configured = providerConfigured(config);
  return {
    configured,
    mode: configured ? config.format : "unconfigured" as const,
    provider: providerFormatNames[config.format],
    model: config.model ?? null,
    baseURL: configured ? config.baseURL : null,
  };
}
