import assert from "node:assert/strict";

/** The custom properties a composed look page declares on :root (palette plus the look's tokens). */
export function rootTokens(html: string) {
  const root = /:root \{([^}]*)\}/.exec(html);
  assert.ok(root, "composed page has a :root block");
  return new Map([...root[1].matchAll(/^\s*(--[\w-]+):\s*(.+);$/gm)].map((match) => [match[1], match[2].trim()] as const));
}

/** Resolves var(--a, fallback) the way CSS does; null when a reference has no value and no fallback. */
export function resolveVars(value: string, tokens: Map<string, string>, depth = 0): string | null {
  if (depth > 8) return null;
  let failed = false;
  const out = value.replace(/var\((--[\w-]+)(?:,\s*((?:[^()]|\([^()]*\))*))?\)/g, (_all, name: string, fallback?: string) => {
    const own = tokens.get(name);
    const next = own ?? fallback;
    const resolved = next === undefined ? null : resolveVars(next, tokens, depth + 1);
    if (resolved === null) failed = true;
    return resolved ?? "";
  });
  return failed ? null : out;
}
