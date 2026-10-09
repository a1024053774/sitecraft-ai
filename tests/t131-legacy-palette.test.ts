import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {registerHooks} from 'node:module';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import test from 'node:test';
registerHooks({resolve(specifier,context,next){if(!specifier.startsWith('@/'))return next(specifier,context);const file=path.join(process.cwd(),specifier.slice(2));return next(pathToFileURL(existsSync(file+'.ts')?file+'.ts':file).href,context)}});
const {commitSiteCode}=await import('../lib/code-site-store.ts');
const {GET:list,POST:create}=await import('../app/api/sites/route.ts');
const {GET:open}=await import('../app/api/sites/[siteId]/draft/route.ts');
test('T-131: conversion failures remain visible without breaking a healthy code-site neighbor',async()=>{
  const id=`t131-${crypto.randomUUID()}`;
  await commitSiteCode({siteId:id,legacyImport:{kind:'failed',name:'旧记录原名',source:{revision:3,updatedAt:'2026-09-21T18:34:17.328Z'},reason:'原内容结构无法读取'}});
  const created=await create(new Request('http://localhost',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:'正常邻居'})}));assert.equal(created.status,201);const good=await created.json();
  const response=await list();assert.equal(response.status,200);const rows=(await response.json()).sites;
  const bad=rows.find((r:{siteId:string})=>r.siteId===id);assert.equal(bad.siteName,'旧记录原名');assert.equal(bad.updatedAt,'2026-09-21T18:34:17.328Z');assert.equal(bad.status,'旧站转换失败');assert.equal(bad.readError,'旧站转换失败：原内容结构无法读取');
  const opened=await open(new Request('http://localhost'),{params:Promise.resolve({siteId:id})});assert.equal(opened.status,422);const payload=await opened.json();assert.equal(payload.userMessage,bad.readError);assert.equal('codeSite' in payload,false);assert.equal('draft' in payload,false);
  assert.equal((await open(new Request('http://localhost'),{params:Promise.resolve({siteId:good.id})})).status,200);
});
