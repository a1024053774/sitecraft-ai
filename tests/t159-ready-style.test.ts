import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import sharp from 'sharp';
import { localEndpoint } from '../scripts/local-endpoint.ts';
import { codeStyles } from '../lib/code-site-styles.ts';

// Approved neighborly must work through ordinary chat, without the eval flag;
// its public image must identify the independently reviewed real version.
test('普通进程的标准 CLI 可选择已盲评通过的邻里日常并进入规划', async () => {
  localEndpoint('SITECRAFT_BASE');
  const folder = path.resolve('artifacts/t159', `ready-entry-${crypto.randomUUID()}`); await mkdir(folder);
  const env: NodeJS.ProcessEnv = { ...process.env, T159_ENTRY_OUT: folder };
  delete env.SITECRAFT_EVAL_STYLES; delete env.T159_PENDING_CATALOG;
  const result = spawnSync(process.execPath, ['--experimental-strip-types', 'tests/fixtures/t159-entry.ts'], { env, encoding: 'utf8', timeout: 30000 });
  await writeFile(path.join(folder, 'process.json'), JSON.stringify({ status: result.status, stdout: result.stdout, stderr: result.stderr }, null, 2), 'utf8');
  assert.equal(result.status, 0, result.stderr);
  const evidence = JSON.parse(await readFile(path.join(folder, 'entry.json'), 'utf8'));
  assert.equal(evidence.routes.find((r: any) => r.body?.action === 'select').status, 202);
  const plans = evidence.modelRequests.filter((b: any) => b.tools);
  assert.equal(plans.length, 1); assert.deepEqual(plans[0].tools[0].function.parameters.properties.style.enum, ['neighborly']);
  assert.match(plans[0].messages[0].content, /name: site-code-neighborly/);
});

test('邻里日常公开缩略图登记实际审核版本、来源与许可并可解码', async () => {
  const preview = codeStyles.neighborly.preview;
  assert.equal(preview.status, 'ready');
  if (preview.status !== 'ready') throw new Error('尚未登记真实缩略图');
  assert.equal(preview.siteId, '20d7d9ae-8272-4880-81cd-eb2aec872557');
  assert.equal(preview.versionId, '7be34b12-ec78-4d75-bcd5-c12a4b7e210d'); assert.equal(preview.revision, 1);
  assert.equal(preview.src, '/style-previews/neighborly.webp');
  assert.equal(preview.source, 't159/authorized-20261014T043816Z/eval/private/case-1/home-fold-1440.png');
  const license = await readFile(`public${preview.license}`, 'utf8');
  assert.match(license, /neighborly\.webp/); assert.match(license, /禾巷小馆/); assert.match(license, /CC BY-SA 4\.0/);
  const image = await sharp(`public${preview.src}`).metadata(); assert.equal(image.format, 'webp'); assert.equal(image.width, 576); assert.equal(image.height, 400);
});
