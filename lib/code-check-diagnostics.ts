import { writeFileSync } from 'node:fs';
import path from 'node:path';

// The standard test runner owns this directory. Never record document content,
// model inputs, CDP parameters, environment variables, or credentials.
export function recordCheckDiagnostic(record: Record<string, unknown>) {
  const directory = process.env.SITECRAFT_CHECK_DIAGNOSTICS_DIR;
  if (directory) writeFileSync(path.join(directory, `${process.pid}-${crypto.randomUUID()}.json`),
    JSON.stringify({ pid: process.pid, ...record }) + '\n', 'utf8');
}
