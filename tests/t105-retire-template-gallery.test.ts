import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import test from 'node:test';
import {resolveWorkspaceEntry} from '../lib/workspace-entry.ts';
test('AI 建站 keeps the explicit new-site entry and the gallery engine is removed',()=>{
  assert.deepEqual(resolveWorkspaceEntry('?new=1'),{kind:'create'});
  assert.match(readFileSync('components/app-sidebar.tsx','utf8'),/href: "\/workspace\?new=1"/);
  for(const file of ['app/api/templates','components/open-source-template-frame.tsx','lib/template-adapters'])assert.equal(existsSync(file),false,file);
});
