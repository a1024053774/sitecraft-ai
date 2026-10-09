import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { registerHooks } from 'node:module';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { simulatedPackList } from '../lib/simulated-packs.ts';
import { buildBlindPackage, type EvalRound } from '../scripts/eval-set-report.ts';

const root = path.resolve('artifacts/t140', `materials-${crypto.randomUUID()}`);
const empty: EvalRound = { schemaVersion: 1, startedAt: '2026-10-09T00:00:00Z', command: 'local-fixture', commit: 'fixture', dirty: false,
  base: 'fixture', status: 'INCOMPLETE', cases: [], controls: [], errors: [] };

test('all three emitted blind-review instructions exclude intentional placeholders as evidence', async () => {
  const directory = path.join(root, 'prompts'); await mkdir(path.join(directory, 'private'), { recursive: true });
  await buildBlindPackage(empty, directory, { round: empty, directory });
  for (const file of ['review/mixed/prompt.txt', 'review/company/prompt.txt', 'comparison-review/prompt.txt']) {
    const prompt = await readFile(path.join(directory, file), 'utf8');
    assert.match(prompt, /待补充[\s\S]{0,100}有意[\s\S]{0,100}资料缺口/, file);
    assert.match(prompt, /不作为判断[\s\S]{0,100}依据/, file);
  }
});

test('workspace packs use the owner domain and retain their simulation and factual gaps', () => {
  for (const pack of simulatedPackList) {
    assert.match(pack.email, /@(?:[a-z0-9-]+\.)?luckye\.online$/);
    assert.ok(pack.body.includes(pack.email));
    assert.match(pack.body, /^资料性质：模拟/);
    assert.match(pack.body, /电话、地址：待补充/);
    assert.doesNotMatch(pack.body, /@[\w.-]+\.(?:test|example)\b/);
  }
});

test('the real evaluation CLI preserves owner-domain addresses in every case', async () => {
  const before = path.join(root, 'previous'), after = path.join(root, 'evaluation');
  await mkdir(path.join(before, 'private'), { recursive: true });
  await writeFile(path.join(before, 'private/round.json'), JSON.stringify(empty), 'utf8');
  // An incompatible prior corpus stops before either models or external controls.
  const command = ['--experimental-strip-types', 'scripts/eval-new-route.ts', '--prepare-only', '--previous', before, '--out', after];
  const result = spawnSync(process.execPath, command, { encoding: 'utf8', env: { ...process.env, CHROME_PATH: '' } });
  await writeFile(path.join(root, 'evaluation-command.json'), JSON.stringify({ command, status: result.status, stdout: result.stdout, stderr: result.stderr }, null, 2));
  assert.equal(result.status, 1);
  const report = JSON.parse(await readFile(path.join(after, 'private/round.json'), 'utf8'));
  assert.equal(report.cases.length, 8);
  assert.ok(report.errors.some((error: string) => error.includes('资料或组合已变化')));
  for (const item of report.cases) {
    const emails = item.materials.match(/[\w.+-]+@[\w.-]+/g) || [];
    assert.ok(emails.length > 0);
    for (const email of emails) assert.match(email, /@(?:[a-z0-9-]+\.)?luckye\.online$/);
    assert.equal(item.outcome, 'not-run'); assert.deepEqual(item.modelCalls, []);
  }
});

test('core guidance supplies semantic icons and different header/hero tasks without inventing downloads', async () => {
  const rules = await readFile('skills/site-code-core/SKILL.md', 'utf8');
  assert.match(rules, /页头[\s\S]{0,80}询盘[\s\S]{0,100}首屏[\s\S]{0,150}不同任务/);
  assert.match(rules, /图标.{0,80}含义/);
  assert.match(rules, /不要每个链接都加图标/);
  for (const id of ['phone', 'map-pin', 'download', 'file-text', 'certificate', 'factory', 'cog', 'inspection', 'package', 'truck', 'clock', 'wrench']) {
    assert.ok(rules.includes(`\"${id}\"`), `core instructions lack ${id}`);
  }
  assert.match(rules, /下载[\s\S]{0,100}资料[\s\S]{0,100}(?:已提供|实际|存在)/);
});

test('the actual writer request loads semantic icon and CTA guidance and preserves declared gaps', async () => {
  registerHooks({ resolve(specifier, context, next) {
    if (!specifier.startsWith('@/')) return next(specifier, context);
    const file = path.join(process.cwd(), specifier.slice(2));
    return next(pathToFileURL(existsSync(`${file}.ts`) ? `${file}.ts` : file).href, context);
  } });
  const requests: Array<{ messages: Array<{ content: string }> }> = [];
  const server = createServer(async (request, response) => {
    let raw = ''; for await (const chunk of request) raw += chunk;
    requests.push(JSON.parse(raw));
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ header: '', footer: '', css: '', pages: [{ id: 'home', title: '本地夹具', html: '<main><h1>本地夹具</h1></main>' }] }) } }] }));
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  process.env.DEEPSEEK_BASE_URL = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  process.env.DEEPSEEK_API_KEY = 'local-fixture-only'; process.env.DEEPSEEK_MODEL = 'local-fixture-only';
  try {
    const { writeSiteCode } = await import('../lib/code-site-model.ts');
    await writeSiteCode({ materials: '公司名：本地夹具。电话：待补充。', preferences: { style: 'precision', layout: 5, density: 6 },
      plan: { summary: '公司与产品', style: 'precision', styleReason: '本地夹具', pages: [{ id: 'home', title: '首页', outline: '公司与产品' }] }, images: [], request: '页头已提供询盘入口。' });
    await mkdir(root, { recursive: true });
    await writeFile(path.join(root, 'writer-requests.json'), JSON.stringify(requests, null, 2));
    assert.equal(requests.length, 1);
    const [system, user] = requests[0].messages.map(message => message.content);
    assert.match(system, /页头[\s\S]{0,80}询盘[\s\S]{0,100}首屏[\s\S]{0,150}不同任务/);
    assert.ok(system.includes('"inspection"') && system.includes('不要每个链接都加图标'));
    assert.match(user, /资料标明的缺口保留待补充，不自动隐藏/);
    assert.doesNotMatch(user, /缺口可省略/);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});
