import { localEndpoint } from '../../scripts/local-endpoint.ts';

// Keep the production origin checks. Only this child process redirects the
// provider transport to the test's local HTTP server; it cannot reach DeepSeek.
const fixture = localEndpoint('SITECRAFT_FIXTURE_BASE').origin;
const originalFetch = globalThis.fetch;
globalThis.fetch = (input, options) => {
  const url = new URL(input);
  if (url.origin === 'https://api.deepseek.com') return originalFetch(`${fixture}${url.pathname}`, options);
  throw new Error('T-165 gateway child may only call the intercepted provider');
};
