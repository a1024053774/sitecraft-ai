import assert from 'node:assert/strict';
import { chmod, mkdir, mkdtemp, readdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

// T-204: on Ubuntu 24.04 the checker's Chrome died on start (no usable sandbox) with SIGTRAP.
// A process killed by a signal keeps exitCode null, so the checker kept waiting for it and the
// run hung for good while holding the one work-queue place. A Chrome that dies by a signal
// before it is ready must fail the check quickly with a clear reason.
const { codeCheckBrowser } = await import('../lib/code-site-browser.ts');

test('a Chrome killed by a signal on start fails the check instead of hanging', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'sitecraft-t204-chrome-'));
  const fake = path.join(dir, 'chrome');
  await writeFile(fake, '#!/bin/sh\nkill -TRAP $$\n', 'utf8');
  await chmod(fake, 0o755);
  // A private temp dir, so profiles of checks running in parallel test files do not count.
  const tmp = path.join(dir, 'tmp'); await mkdir(tmp);
  const previous = process.env.CHROME_PATH, previousTmp = process.env.TMPDIR;
  process.env.CHROME_PATH = fake; process.env.TMPDIR = tmp;
  try {
    const started = Date.now();
    const outcome = await Promise.race([
      codeCheckBrowser().then(() => 'opened', (error: Error) => error.message),
      new Promise<string>(resolve => setTimeout(() => resolve('hung'), 20000).unref()),
    ]);
    assert.equal(outcome, 'Chrome 在检查开始前退出');
    assert.ok(Date.now() - started < 5000, `took ${Date.now() - started} ms`);
    // The failed launch cleans up its own profile.
    assert.deepEqual(await readdir(tmp), []);
  } finally {
    if (previous === undefined) delete process.env.CHROME_PATH; else process.env.CHROME_PATH = previous;
    if (previousTmp === undefined) delete process.env.TMPDIR; else process.env.TMPDIR = previousTmp;
  }
});
