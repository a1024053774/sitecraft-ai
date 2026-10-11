import assert from 'node:assert/strict';
import { randomInt, randomUUID } from 'node:crypto';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { codeCheckBrowser } from '../lib/code-site-browser.ts';

const base = process.env.SITECRAFT_BASE;
assert.equal(base, 'http://127.0.0.1:3164');
const runDir = process.argv[2], completedOnly = process.argv[3] === '--completed-only';
assert.ok(runDir, 'Pass a real E2E directory');
const report = JSON.parse(await readFile(path.join(runDir, 'report.json'), 'utf8'));
if (!completedOnly) assert.equal(report.status, 'PASS');
assert.ok(Number(report.firstEditTokens) <= 15000);
const jobs = [{ source: report.reviewBefore ?? report.before, result: report.edited }];
if (report.simplified) jobs.push({ source: report.undone, result: report.simplified });
// Failed or fixture candidates cannot become a real-model comparison. A partial
// package contains only completed edits and keeps the unfinished workflow explicit.
for (const job of jobs) {
  assert.ok(job.source && job.result);
  assert.equal(job.result.run.status, 'complete');
  assert.notEqual(job.source.currentVersionId, job.result.currentVersionId);
  assert.equal(job.result.versions.find((version: any) => version.id === job.result.currentVersionId).checks.passed, true);
  assert.ok(job.result.run.modelCalls.every((call: any) => call.model === 'deepseek-flash' && call.httpStatus === 200));
}
if (randomInt(2)) jobs.reverse();
const folder = `artifacts/t152/review-pack-${Date.now()}`;
await mkdir(path.join(folder, 'review'), { recursive: true });
await mkdir(path.join(folder, 'private/source-shots'), { recursive: true });
const mapping = [], sections = [];
const draws: Array<{ pair: string; afterFirst: boolean }> = [];
const browser = await codeCheckBrowser();
try {
  for (const job of jobs) {
    const pair = randomUUID().slice(0, 8);
    const entries = [{ role: 'before', site: job.source }, { role: 'after', site: job.result }];
    const afterFirst = randomInt(2) === 1;
    draws.push({ pair, afterFirst });
    if (afterFirst) entries.reverse();
    const names: string[] = [];
    for (const entry of entries) {
      // A/B identify the randomized display position; filenames and the README
      // agree even when the reviewer sorts filenames rather than opening order.
      const name = `${names.length === 0 ? 'A' : 'B'}-${randomUUID().slice(0, 8)}`; names.push(name);
      for (const width of [1440, 375]) {
        const version = entry.site.currentVersionId;
        await browser.send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
        await browser.send('Page.navigate', { url: `${base}/api/sites/${entry.site.siteId}/code-preview?page=home&version=${version}` });
        let ready = false;
        for (let i = 0; i < 200; i++) {
          ready = await browser.evaluate<boolean>(`location.search.includes(${JSON.stringify(version)}) && document.readyState==='complete' && !!document.querySelector('main h1') && [...document.images].every(img=>img.complete && img.naturalWidth>0)`);
          if (ready) break;
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        assert.ok(ready, 'The exact version must load before capture');
        await browser.evaluate('document.fonts.ready');
        const size = await browser.evaluate<{width:number;height:number}>('({width:innerWidth,height:document.documentElement.scrollHeight})');
        const image = await browser.send<{data:string}>('Page.captureScreenshot', { format:'png',captureBeyondViewport:true,clip:{x:0,y:0,...size,scale:1} });
        const source = path.join(folder, 'private/source-shots', `${version}-${width}.png`);
        await writeFile(source,Buffer.from(image.data,'base64'));
        await copyFile(source,path.join(folder,'review',`${pair}-${name}-${width}.png`));
      }
      mapping.push({ pair, name, role: entry.role, versionId: entry.site.currentVersionId });
    }
    sections.push(`第 ${sections.length + 1} 组（${pair}）：按此顺序查看 ${names.join('、')}。每版都有 1440 与 375 两种宽度。`);
  }
} finally { await browser.close(); }
await writeFile(path.join(folder,'review','README.md'),`请只查看本目录的截图，逐组回答两个问题：\n\n1. 哪版更好？可以回答持平或各有优劣。\n2. 两版差在哪里？请说明具体位置与观察依据。\n\n${sections.join('\n\n')}\n`,'utf8');
await writeFile(path.join(folder,'private','mapping.json'),JSON.stringify({runDir,workflowStatus:report.status,completedOnly,pairCount:jobs.length,actualInputVersion:report.before.currentVersionId,draws,createdAt:new Date().toISOString(),mapping},null,2));
console.log(folder);
