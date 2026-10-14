import { readFile } from 'node:fs/promises';

// Origin fixtures serve the real static input; rejection expectations live in T-166's tests.
export const codeCheckDocument = await readFile(new URL('../../public/code-check.html', import.meta.url), 'utf8');
