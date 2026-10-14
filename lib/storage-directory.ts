import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

function within(parent: string, child: string) {
  const relative = path.relative(parent, child);
  return !path.isAbsolute(relative) && relative.split(path.sep)[0] !== '..';
}

// T-167: Next 16.3.1 cannot trace paths returned by a shared closure safely.
// Keep store paths statically scoped and use this closure only for validation.
// Runtime test paths are not deployment inputs; opt them out of NFT below.
// Remove the annotations only after the main artifact-tree regression passes
// without them. Delay validation so health can run before registration.
export function storageGuard() {
  const cwd = process.cwd(), configured = process.env.SITECRAFT_DATA_ROOT;
  const root = path.resolve(/* turbopackIgnore: true */ configured || path.join(cwd, '.sitecraft-data'));
  const testing = process.env.NODE_ENV === 'test' || !!process.env.NODE_TEST_CONTEXT;
  const identityFile = process.env.SITECRAFT_TEST_IDENTITY_FILE;
  return () => {
    if (testing) {
      const message = '测试存储必须使用显式且经身份核对的数据根，拒绝默认或未核对目录';
      if (!configured || root === path.join(cwd, '.sitecraft-data') || !identityFile || !existsSync(/* turbopackIgnore: true */ identityFile)) throw new Error(message);
      const identity = JSON.parse(readFileSync(/* turbopackIgnore: true */ identityFile, 'utf8'));
      if (typeof identity.cwd !== 'string' || typeof identity.dataRoot !== 'string'
        || !path.isAbsolute(identity.cwd) || !path.isAbsolute(identity.dataRoot)
        || !within(identity.cwd, cwd) || !within(identity.dataRoot, root)) throw new Error(message);
    }
  };
}
