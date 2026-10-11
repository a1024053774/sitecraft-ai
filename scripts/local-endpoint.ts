import assert from 'node:assert/strict';

// Standalone acceptance scripts require explicit origins. Never fall back to a
// different worktree, or bind a development provider to a public interface.
export function localEndpoint(name: 'SITECRAFT_BASE' | 'SITECRAFT_FIXTURE_BASE' | 'SITECRAFT_BUDGET_BASE') {
  const value = process.env[name]?.trim();
  const message = `${name} must be an explicit local HTTP origin (127.0.0.1, localhost or [::1]), without credentials, path, query or fragment`;
  assert.ok(value && URL.canParse(value), message);
  const url = new URL(value);
  assert.ok(url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
    && !url.username && !url.password && url.pathname === '/' && !url.search && !url.hash, message);
  const port = Number(url.port || 80);
  assert.ok(port > 0, message);
  return { origin: url.origin, hostname: url.hostname === '[::1]' ? '::1' : url.hostname, port };
}
