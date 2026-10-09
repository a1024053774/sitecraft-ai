import assert from 'node:assert/strict';
import test from 'node:test';
import {resolveWorkspaceEntry,workspaceUrlForSite} from '../lib/workspace-entry.ts';

test('only the explicit new entry creates a site; absent or unsafe site IDs require a choice',()=>{
  assert.deepEqual(resolveWorkspaceEntry('?new=1'),{kind:'create'});
  assert.deepEqual(resolveWorkspaceEntry(''),{kind:'choose'});
  assert.deepEqual(resolveWorkspaceEntry('?site=../etc/passwd'),{kind:'choose'});
  assert.deepEqual(resolveWorkspaceEntry('?template=screwfast'),{kind:'choose'});
  assert.deepEqual(resolveWorkspaceEntry('?site=abc-123&new=1'),{kind:'open',siteId:'abc-123'});
});
test('refresh reopens the just-created site without keeping a create action in the URL',()=>{
  const url=workspaceUrlForSite('?new=1&page=home','new-site-1'),params=new URL(url,'http://localhost').searchParams;
  assert.equal(params.get('new'),null);assert.equal(params.get('page'),'home');assert.deepEqual(resolveWorkspaceEntry(params),{kind:'open',siteId:'new-site-1'});
});

// grok-b's T-036 review: the in-flight creation was kept for the whole page session, so a second
// 新建站点 with the same template (client-side navigation, no reload) reopened the first site.
test("two effect runs of one entry share a single creation", async () => {
  const { createSiteOnce } = await import("../lib/workspace-entry.ts");
  let calls = 0;
  let release: (id: string) => void = () => {};
  const create = () => { calls += 1; return new Promise<string>((resolve) => { release = resolve; }); };
  const first = createSiteOnce("?new=1", create);
  const second = createSiteOnce("?new=1", create);
  release("site-a");
  assert.deepEqual(await Promise.all([first, second]), ["site-a", "site-a"]);
  assert.equal(calls, 1);
});

test("a later 新建站点 with the same template creates another site", async () => {
  const { createSiteOnce } = await import("../lib/workspace-entry.ts");
  let n = 0;
  const create = async () => `site-${++n}`;
  assert.equal(await createSiteOnce("?new=1", create), "site-1");
  assert.equal(await createSiteOnce("?new=1", create), "site-2");
});

test("a failed creation can be retried", async () => {
  const { createSiteOnce } = await import("../lib/workspace-entry.ts");
  await assert.rejects(createSiteOnce("?new=1", async () => { throw new Error("down"); }));
  assert.equal(await createSiteOnce("?new=1", async () => "site-ok"), "site-ok");
});
