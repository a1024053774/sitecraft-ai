import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { once } from 'node:events';
import { createServer, request as httpRequest } from 'node:http';
import path from 'node:path';
import test from 'node:test';
import { crc32, deflateSync } from 'node:zlib';
import * as evalReport from '../scripts/eval-set-report.ts';
import { reserveRequest } from '../scripts/t153-real-budget.ts';

function pngChunk(type: string, data: Buffer) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, crc]);
}

function makeTestPng(seed: number, extraPixels = 0) {
  const width = 24 + extraPixels, height = 16;
  const rows: Buffer[] = [];
  for (let y = 0; y < height; y++) {
    const row = Buffer.alloc(1 + width * 4);
    row[0] = 0;
    for (let x = 0; x < width; x++) {
      const off = 1 + x * 4;
      row[off] = (seed * 37 + x * 13 + y * 5) & 0xff;
      row[off + 1] = (seed * 73 + x * 7 + y * 11) & 0xff;
      row[off + 2] = (seed * 19 + x * 17 + y * 3) & 0xff;
      row[off + 3] = 255;
    }
    rows.push(row);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(Buffer.concat(rows))),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

async function listTree(root: string): Promise<Array<{ file: string; directory: boolean; birth: number; modified: number; accessed: number; size: number }>> {
  const s = await stat(root);
  const item = { file: root, directory: s.isDirectory(), birth: s.birthtimeMs, modified: s.mtimeMs, accessed: s.atimeMs, size: s.size };
  if (!s.isDirectory()) return [item];
  const children = await Promise.all((await readdir(root)).map(name => listTree(path.join(root, name))));
  return [item, ...children.flat()];
}

function makeRound(specs: Array<{ pack: string; style: string; outcome?: evalReport.EvalCase['outcome'] }>, baseDir: string): evalReport.EvalRound {
  const cases: evalReport.EvalCase[] = specs.map((spec, i) => {
    const outcome = spec.outcome ?? 'generated';
    return {
      key: `${spec.pack}/${spec.style}`,
      pack: spec.pack,
      style: spec.style,
      materials: `资料：${spec.pack}`,
      preferences: { style: spec.style, layout: 5, density: 6 },
      outcome,
      elapsedMs: 100,
      attempts: [],
      modelCalls: [],
      mixedScreenshot: outcome === 'generated' ? `inputs/case-${i}-1440.png` : undefined,
      pages: outcome === 'generated' ? [{ id: 'home', screenshots: { '1440': `inputs/case-${i}-1440.png`, '375': `inputs/case-${i}-375.png` } }] : [],
    };
  });
  const controls = specs.map((spec, i) => ({
    pack: spec.pack,
    url: `https://control-${i}.example`,
    screenshots: { '1440': `inputs/control-${i}.png` },
  }));
  return {
    schemaVersion: 1, startedAt: '2026-11-25T00:00:00Z', command: 'fixture', commit: 'fixture',
    dirty: false, base: 'fixture', status: 'INCOMPLETE', cases, controls, errors: [],
    previousMaterialsChanged: false,
  };
}

async function writeInputPngs(dir: string, count: number) {
  await mkdir(path.join(dir, 'inputs'), { recursive: true });
  await mkdir(path.join(dir, 'private'), { recursive: true });
  for (let i = 0; i < count; i++) {
    await writeFile(path.join(dir, 'inputs', `case-${i}-1440.png`), makeTestPng(i + 1, i));
    await writeFile(path.join(dir, 'inputs', `case-${i}-375.png`), makeTestPng(i + 51, i + 2));
    await writeFile(path.join(dir, 'inputs', `control-${i}.png`), makeTestPng(i + 101, i + 4));
  }
}

test('single-style and empty rounds never fabricate review/diversity or missing cross-style items', async () => {
  const dir = path.resolve('artifacts/t228', `single-${crypto.randomUUID()}`);
  await writeInputPngs(dir, 2);
  const single = makeRound([
    { pack: 'industrial', style: 'precision' },
    { pack: 'export', style: 'precision' },
  ], dir);
  const cov = await evalReport.buildBlindPackage(single, dir) as any;
  assert.ok(cov.diversity, 'buildBlindPackage must report diversity coverage metadata');
  assert.equal(cov.diversity.requested, false);
  assert.equal(cov.diversity.crossStylePairs, 0);
  assert.equal(cov.diversity.clusterSamples, 0);
  assert.equal(cov.complete, true);
  assert.equal(existsSync(path.join(dir, 'review/diversity')), false);

  const emptyDir = path.resolve('artifacts/t228', `empty-${crypto.randomUUID()}`);
  await mkdir(path.join(emptyDir, 'private'), { recursive: true });
  const emptyCov = await evalReport.buildBlindPackage(makeRound([], emptyDir), emptyDir) as any;
  assert.equal(emptyCov.diversity.requested, false);
  assert.equal(existsSync(path.join(emptyDir, 'review/diversity')), false);
});

test('multi-style rounds emit isolated, size-and-time-normalized review/diversity across 6 Phase-2 styles and mixed rounds', async () => {
  const dir = path.resolve('artifacts/t228', `six-style-${crypto.randomUUID()}`);
  const specs = [
    { pack: 'industrial', style: 'precision' },
    { pack: 'export', style: 'documentary' },
    { pack: 'design', style: 'editorial' },
    { pack: 'restaurant', style: 'neighborly' },
    { pack: 'education', style: 'darkroom' },
    { pack: 'packaging', style: 'indexgrid' },
  ];
  await writeInputPngs(dir, specs.length);
  const round = makeRound(specs, dir);
  const cov = await evalReport.buildBlindPackage(round, dir) as any;
  assert.equal(cov.complete, true);
  assert.equal(cov.diversity?.requested, true);
  assert.equal(cov.diversity?.crossStylePairs, 15, 'C(6,2) = 15 different-company cross-style pairs');
  assert.equal(cov.diversity?.clusterSamples, 6, 'all 6 distinct home pages included in clusterSamples');

  const divRoot = path.join(dir, 'review/diversity');
  const allEntries = await listTree(divRoot);
  const pngs = allEntries.filter(e => !e.directory && e.file.endsWith('.png'));
  assert.equal(new Set(pngs.map(p => p.size)).size, 1, 'all review/diversity PNGs must be padded to equal byte length');
  assert.equal(new Set(allEntries.map(e => e.modified)).size, 1, 'uniform mtime under review/diversity');
  assert.equal(new Set(allEntries.map(e => e.accessed)).size, 1, 'uniform atime under review/diversity');

  assert.ok(existsSync(path.join(divRoot, 'index.html')));
  const divHtml = await readFile(path.join(divRoot, 'index.html'), 'utf8');
  assert.ok(divHtml.includes('<div><h2>跨风格成对对比</h2><article>') && divHtml.includes('<div><h2>全池模板归簇</h2><figure>'));
  assert.ok(!divHtml.includes('<section><h2>跨风格成对对比</h2>') && !divHtml.includes('<section><h2>全池模板归簇</h2>'));
  assert.ok(divHtml.includes('article>section{display:flex'));
  const prompt = await readFile(path.join(divRoot, 'prompt.txt'), 'utf8');
  assert.ok(prompt.startsWith('你是独立页面盲评者'));
  for (const required of ['待补充', '页头形式', '首屏构图', '底面明暗', '区块分隔手法', 'crossStylePairs', 'clusters']) {
    assert.ok(prompt.includes(required), `diversity prompt missing ${required}`);
  }
  const tasks = JSON.parse(await readFile(path.join(divRoot, 'tasks.json'), 'utf8'));
  assert.equal(tasks.crossStylePairs.length, 15);
  assert.equal(tasks.clusterSamples.length, 6);

  const mapping = JSON.parse(await readFile(path.join(dir, 'private/mapping.json'), 'utf8'));
  for (const pair of tasks.crossStylePairs) {
    assert.equal(pair.candidates.length, 2);
    assert.ok(mapping[pair.id]);
    assert.notEqual(mapping[pair.id].styles[0], mapping[pair.id].styles[1]);
    for (const c of pair.candidates) assert.equal(c.images.length, 2, 'each cross-style pair candidate includes 1440 & 375');
  }

  for (const e of allEntries) if (!e.directory && !e.file.endsWith('.png')) {
    const content = await readFile(e.file, 'utf8');
    assert.doesNotMatch(content, /precision|documentary|editorial|neighborly|darkroom|indexgrid|craftposter|industrial|export|packaging|restaurant|education|design|\.\.\//);
  }

  // Disjoint IDs across mixed, company, diversity
  const mixedTasks = JSON.parse(await readFile(path.join(dir, 'review/mixed/tasks.json'), 'utf8'));
  const mixedIds = new Set(mixedTasks.samples.map((s: any) => s.id));
  const divIds = new Set([
    ...tasks.clusterSamples.map((s: any) => s.id),
    ...tasks.crossStylePairs.flatMap((p: any) => [p.id, ...p.candidates.map((c: any) => c.id)]),
  ]);
  for (const id of divIds) assert.equal(mixedIds.has(id), false, 'diversity IDs must be disjoint from mixed');
});

test('multi-style rounds preserve same-company cross-style pairs and flag missing cross-style screenshots', async () => {
  const dir = path.resolve('artifacts/t228', `two-style-same-co-${crypto.randomUUID()}`);
  const specs = [
    { pack: 'restaurant', style: 'editorial' },
    { pack: 'restaurant', style: 'neighborly' },
    { pack: 'design', style: 'editorial' },
    { pack: 'design', style: 'neighborly', outcome: 'error' as const },
  ];
  await writeInputPngs(dir, specs.length);
  const cov = await evalReport.buildBlindPackage(makeRound(specs, dir), dir) as any;
  assert.equal(cov.diversity.requested, true);
  assert.equal(cov.complete, false);
  assert.ok(cov.review.missing.some((m: string) => m.includes('跨风格题缺图')));
  assert.ok(cov.review.missing.some((m: string) => m.includes('归簇题缺图')));
  const tasks = JSON.parse(await readFile(path.join(dir, 'review/diversity/tasks.json'), 'utf8'));
  const mapping = JSON.parse(await readFile(path.join(dir, 'private/mapping.json'), 'utf8'));
  assert.ok(tasks.crossStylePairs.some((p: any) => mapping[p.id].sameCompany === true), 'same-company cross-style pair (restaurant/editorial vs restaurant/neighborly) must be emitted');
});

test('summarizeBlindDiversity accurately computes same-style, cross-style, cluster and paired metrics and rejects tampering', async () => {
  const summarizeBlindDiversity = (evalReport as any).summarizeBlindDiversity;
  assert.equal(typeof summarizeBlindDiversity, 'function', 'summarizeBlindDiversity must be exported');

  const dir = path.resolve('artifacts/t228', `unblind-${crypto.randomUUID()}`);
  const prevDir = path.join(dir, 'prev');
  const specs = [
    { pack: 'restaurant', style: 'editorial' },
    { pack: 'restaurant', style: 'neighborly' },
    { pack: 'design', style: 'editorial' },
    { pack: 'design', style: 'neighborly' },
  ];
  await writeInputPngs(dir, specs.length);
  await writeInputPngs(prevDir, specs.length);
  const current = makeRound(specs, dir);
  const prev = makeRound(specs, prevDir);
  await evalReport.buildBlindPackage(current, dir, { round: prev, directory: prevDir });

  const mapping = JSON.parse(await readFile(path.join(dir, 'private/mapping.json'), 'utf8'));
  const companyTasks = JSON.parse(await readFile(path.join(dir, 'review/company/tasks.json'), 'utf8'));
  const divTasks = JSON.parse(await readFile(path.join(dir, 'review/diversity/tasks.json'), 'utf8'));
  const pairedTasks = JSON.parse(await readFile(path.join(dir, 'comparison-review/tasks.json'), 'utf8'));

  // Company: 2 pairs (editorial pair, neighborly pair) -> 1 sameTemplate, 1 different
  const companyReview = {
    pairs: companyTasks.pairs.map((p: any, idx: number) => ({
      id: p.id, sameTemplate: idx === 0, observedFiles: ['samples/...'], reason: 'checked', limitations: '',
    })),
  };
  // Diversity: 4 cross-style pairs (2 sameCompany + 2 diffCompany). Mark only first diffCompany pair sameTemplate=true, second undecided, rest false.
  let markedUndecided = false, markedSame = false;
  const crossStylePairs = divTasks.crossStylePairs.map((p: any) => {
    const isSameCo = mapping[p.id].sameCompany;
    if (!isSameCo && !markedSame) { markedSame = true; return { id: p.id, sameTemplate: true }; }
    if (!isSameCo && !markedUndecided) { markedUndecided = true; return { id: p.id, sameTemplate: null, undecided: true }; }
    return { id: p.id, sameTemplate: false };
  });
  const cIds: string[] = divTasks.clusterSamples.map((s: any) => s.id);
  const clusters = [
    { id: 'c1', members: [cIds[0], cIds[1]] },
    { id: 'c2', members: [cIds[2]] },
    { id: 'c3', members: [cIds[3]] },
  ];
  // Paired: 3 current wins, 1 previous win
  const pairedReview = {
    pairs: pairedTasks.pairs.map((p: any, idx: number) => {
      const winner = p.candidates.find((c: any) => mapping[c.id].round === (idx === 3 ? 'previous' : 'current'))!.id;
      return { id: p.id, picked: winner };
    }),
  };

  const result = summarizeBlindDiversity({ mapping, companyReview, diversityReview: { crossStylePairs, clusters }, pairedReview });
  assert.equal(result.sameStyle.total, 2);
  assert.equal(result.sameStyle.sameTemplate, 1);
  assert.equal(result.sameStyle.rate, 0.5);
  assert.equal(result.crossStyle.total, 4);
  assert.equal(result.crossStyle.sameTemplate, 1);
  assert.equal(result.crossStyle.undecided, 1);
  assert.equal(result.crossStyle.rate, 0.25);
  assert.equal(result.crossStyle.nonPassRate, 0.5);
  assert.equal(result.crossStyle.sameCompany.total, 2);
  assert.equal(result.crossStyle.sameCompany.sameTemplate, 0);
  assert.equal(result.crossStyle.differentCompany.total, 2);
  assert.equal(result.crossStyle.differentCompany.sameTemplate, 1);
  assert.equal(result.clusters.sampleCount, 4);
  assert.equal(result.clusters.clusterCount, 3);
  assert.equal(result.clusters.maxClusterSize, 2);
  assert.deepEqual(result.clusters.missingSamples, []);
  assert.equal(result.paired.total, 4);
  assert.equal(result.paired.currentWins, 3);
  assert.equal(result.paired.previousWins, 1);
  assert.equal(result.paired.winRate, 0.75);
  assert.equal(result.paired.decidedWinRate, 0.75);

  // Reject tampered pair IDs, cross-role/pair cluster members, paired candidate IDs used as pair IDs, and duplicate cluster members
  assert.throws(() => summarizeBlindDiversity({
    mapping,
    diversityReview: { crossStylePairs: [{ id: 'unknown-pair', sameTemplate: false }], clusters },
  }));
  assert.throws(() => summarizeBlindDiversity({
    mapping,
    diversityReview: { crossStylePairs, clusters: [{ id: 'c1', members: [cIds[0], cIds[0]] }] },
  }));
  assert.throws(() => summarizeBlindDiversity({
    mapping,
    diversityReview: { crossStylePairs, clusters: [{ id: 'c1', members: [divTasks.crossStylePairs[0].id] }] },
  }), /归簇题候选/);
  assert.throws(() => summarizeBlindDiversity({
    mapping,
    diversityReview: { crossStylePairs, clusters: [{ id: 'c1', members: [divTasks.crossStylePairs[0].candidates[0].id] }] },
  }), /归簇题候选/);
  assert.throws(() => summarizeBlindDiversity({
    mapping,
    pairedReview: { pairs: [{ id: pairedTasks.pairs[0].candidates[0].id, picked: pairedTasks.pairs[0].candidates[0].id }] },
  }), /映射中不存在跨轮题/);

  // Verify --unblind CLI works with optional default files and fails loudly on missing explicit paths
  const cliDefaults = spawnSync(process.execPath, ['--experimental-strip-types', 'scripts/eval-set-report.ts', '--unblind', dir], { encoding: 'utf8' });
  assert.equal(cliDefaults.status, 0, cliDefaults.stderr);
  assert.equal(JSON.parse(cliDefaults.stdout).crossStyle.total, 0);

  await writeFile(path.join(dir, 'review/company/result.json'), JSON.stringify(companyReview), 'utf8');
  await writeFile(path.join(dir, 'review/diversity/result.json'), JSON.stringify({ crossStylePairs, clusters }), 'utf8');
  await writeFile(path.join(dir, 'comparison-review/result.json'), JSON.stringify(pairedReview), 'utf8');
  const cliPopulated = spawnSync(process.execPath, ['--experimental-strip-types', 'scripts/eval-set-report.ts', '--unblind', dir], { encoding: 'utf8' });
  assert.equal(cliPopulated.status, 0, cliPopulated.stderr);
  assert.deepEqual(JSON.parse(cliPopulated.stdout), result);

  const cliMissingExplicit = spawnSync(process.execPath, ['--experimental-strip-types', 'scripts/eval-set-report.ts', '--unblind', dir, '--diversity', path.join(dir, 'does-not-exist.json')], { encoding: 'utf8' });
  assert.notEqual(cliMissingExplicit.status, 0);
});

async function withResponsesGateway(
  secret: string,
  handler: (reqUrl: string, body: Record<string, any>, callIndex: number) => { status?: number; headers?: Record<string, string>; payload: unknown },
  run: (ctx: { base: string; folder: string; upstreamCalls: Array<{ url: string; body: Record<string, any> }> }) => Promise<void>,
) {
  const upstreamCalls: Array<{ url: string; body: Record<string, any> }> = [];
  const upstream = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    const raw = Buffer.concat(chunks).toString('utf8');
    const body = raw ? JSON.parse(raw) : {};
    upstreamCalls.push({ url: req.url || '', body });
    const reply = handler(req.url || '', body, upstreamCalls.length - 1);
    for (const [k, v] of Object.entries(reply.headers ?? {})) res.setHeader(k, v);
    res.setHeader('content-type', 'application/json');
    res.writeHead(reply.status ?? 200);
    res.end(JSON.stringify(reply.payload));
  });
  await new Promise<void>(resolve => upstream.listen(0, '127.0.0.1', resolve));
  const probe = createServer();
  await new Promise<void>(resolve => probe.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${(probe.address() as { port: number }).port}`;
  await new Promise<void>(resolve => probe.close(() => resolve()));

  const folder = path.resolve('artifacts/t228', `responses-gw-${crypto.randomUUID()}`);
  await mkdir(folder, { recursive: true });
  const child = spawn(process.execPath, ['--experimental-strip-types', 'scripts/t153-real-budget.ts'], {
    env: {
      ...process.env,
      SITECRAFT_BASE: process.env.SITECRAFT_BASE || 'http://127.0.0.1:3000',
      DEEPSEEK_BASE_URL: '', DEEPSEEK_API_KEY: '', DEEPSEEK_MODEL: '',
      AI_PROVIDER_FORMAT: 'openai-responses',
      AI_BASE_URL: `http://127.0.0.1:${(upstream.address() as { port: number }).port}`,
      AI_MODEL: 'gpt-6.2-sol', AI_API_KEY: secret,
      SITECRAFT_ALLOW_LOCAL_PROVIDER: '1', SITECRAFT_BUDGET_BASE: base,
      SITECRAFT_TOKEN_LIMIT: '850000', T153_BUDGET_DIR: folder,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const exited = once(child, 'close');
  let output = '';
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(output || 'timeout')), 10000);
      child.stdout.on('data', d => { output += d; if (output.includes('approved cumulative budget')) { clearTimeout(timer); resolve(); } });
      child.stderr.on('data', d => { output += d; });
      child.once('exit', () => { clearTimeout(timer); reject(new Error(output)); });
    });
    await run({ base, folder, upstreamCalls });
  } finally {
    if (child.exitCode === null) child.kill('SIGTERM');
    await exited;
    await new Promise<void>(resolve => upstream.close(() => resolve()));
  }
}

test('reserveRequest and t153-real-budget.ts support openai-responses budget reservation, accounting, truncation stop and key redaction', async () => {
  const responsesBody = {
    model: 'gpt-6.2-sol',
    instructions: '你是网页设计师。',
    input: [{ role: 'user', content: '公司名：星河精密，工艺稳定。' }],
    max_output_tokens: 32000,
    store: false,
  };
  const r1 = reserveRequest(responsesBody, 800000, 850000);
  assert.ok(r1.inputUpper > 300 && r1.reserved <= 50000);
  assert.ok(r1.outputLimit <= 32000 && r1.outputLimit >= 4096);

  const localResponses = {
    model: 'gpt-6.2-sol',
    instructions: '局部修改',
    input: [{ role: 'user', content: '{"html":"<section><h1>展示</h1></section>"}' }],
    tools: [{ type: 'function', name: 'submit_local_edit', strict: true, parameters: {} }],
    max_output_tokens: 12288,
  };
  assert.equal(reserveRequest(localResponses, 0, 850000).outputLimit, 12288);
  assert.throws(() => reserveRequest(localResponses, 845000, 850000), /submit_local_edit/);

  const secret = 'sk-t228-super-secret-value';

  await withResponsesGateway(secret, () => ({
    payload: {
      id: 'resp_228', status: 'completed',
      output: [{ type: 'message', phase: 'final_answer', content: [{ type: 'output_text', text: '{"ok":true}' }] }],
      usage: { input_tokens: 120, output_tokens: 45, total_tokens: 165, output_tokens_details: { reasoning_tokens: 10 } },
    },
  }), async ({ base, folder, upstreamCalls }) => {
    assert.equal((await fetch(`${base}/round`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ label: 'phase2-6sites', estimate: 600000 }) })).status, 200);
    const res1 = await fetch(`${base}/v1/responses`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(responsesBody) });
    assert.equal(res1.status, 200);
    assert.equal(upstreamCalls[0].url, '/v1/responses');
    assert.equal(upstreamCalls[0].body.model, 'gpt-6.2-sol');
    const ledger1 = JSON.parse(await readFile(path.join(folder, 'usage.json'), 'utf8'));
    assert.equal(ledger1.spent, 165);
    assert.equal(ledger1.stopped, false);
    assert.equal(ledger1.calls[0].usage.total_tokens, 165);

    assert.equal((await fetch(`${base}/round`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ label: 'extra-over', estimate: 850000 }) })).status, 502);
    assert.equal(JSON.parse(await readFile(path.join(folder, 'usage.json'), 'utf8')).stopped, true);
    assert.equal(upstreamCalls.length, 1);
  });

  await withResponsesGateway(secret, () => ({
    status: 401,
    headers: { 'x-request-id': 'req-err-redact' },
    payload: { error: { message: `leaked ${secret}` } },
  }), async ({ base, folder }) => {
    assert.equal((await fetch(`${base}/round`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ label: 'err-check', estimate: 100000 }) })).status, 200);
    const errRes = await fetch(`${base}/responses`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(responsesBody) });
    assert.equal(errRes.status, 401);
    const errBody = await errRes.text();
    assert.equal(errBody.includes(secret), false, 'API key must be redacted from gateway HTTP error response');
    const rawLedger = await readFile(path.join(folder, 'usage.json'), 'utf8');
    assert.equal(rawLedger.includes(secret), false, 'API key must never enter usage.json');
    const ledger2 = JSON.parse(rawLedger);
    assert.equal(ledger2.stopped, true);
    assert.equal(ledger2.calls[0].httpError.bodyRedacted, true);
  });

  await withResponsesGateway(secret, () => ({
    payload: {
      id: 'resp_inc', status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' },
      output: [], usage: { input_tokens: 90, output_tokens: 20, total_tokens: 110 },
    },
  }), async ({ base, folder }) => {
    assert.equal((await fetch(`${base}/round`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ label: 'inc-check', estimate: 100000 }) })).status, 200);
    assert.equal((await fetch(`${base}/v1/responses`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(responsesBody) })).status, 200);
    const ledger3 = JSON.parse(await readFile(path.join(folder, 'usage.json'), 'utf8'));
    assert.equal(ledger3.spent, 110);
    assert.equal(ledger3.calls[0].finishReason, 'incomplete:max_output_tokens');
    assert.equal(ledger3.stopped, true);
    assert.equal((await fetch(`${base}/v1/responses`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(responsesBody) })).status, 409);
  });
});

test('t153-real-budget preserves multi-byte UTF-8 Chinese characters split across TCP chunks', async () => {
  const secret = 'sk-t232-utf8-chunk-secret';
  const targetText = '模具归谁所有？无麸质替换方案待补充';
  const filler = '高精度注塑工艺与餐食现做工艺说明。'.repeat(1800);
  const payload = {
    model: 'gpt-6.2-sol',
    instructions: '局部修改',
    input: [{ role: 'user', content: `${filler}\n${targetText}\n${filler}` }],
    max_output_tokens: 12288,
    store: false,
  };
  const bodyBuf = Buffer.from(JSON.stringify(payload), 'utf8');
  assert.ok(bodyBuf.length > 65536, `expected >64KB payload, got ${bodyBuf.length}`);
  const firstIdx = bodyBuf.indexOf(Buffer.from('模', 'utf8'));
  const secondIdx = bodyBuf.indexOf(Buffer.from('麸', 'utf8'), firstIdx);
  assert.ok(firstIdx > 0 && secondIdx > firstIdx);
  // Split directly inside 3-byte UTF-8 sequences for 模 (firstIdx+1) and 麸 (secondIdx+2).
  const chunks = [
    bodyBuf.subarray(0, firstIdx + 1),
    bodyBuf.subarray(firstIdx + 1, secondIdx + 2),
    bodyBuf.subarray(secondIdx + 2),
  ];

  await withResponsesGateway(secret, () => ({
    payload: {
      id: 'resp_t232', status: 'completed',
      output: [{ type: 'message', phase: 'final_answer', content: [{ type: 'output_text', text: '{"ok":true}' }] }],
      usage: { input_tokens: 200, output_tokens: 20, total_tokens: 220 },
    },
  }), async ({ base, upstreamCalls }) => {
    assert.equal((await fetch(`${base}/round`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ label: 't232-utf8', estimate: 100000 }) })).status, 200);
    const parsedUrl = new URL(`${base}/v1/responses`);
    const status = await new Promise<number>((resolve, reject) => {
      const req = httpRequest({
        hostname: parsedUrl.hostname,
        port: Number(parsedUrl.port),
        path: parsedUrl.pathname,
        method: 'POST',
        headers: { 'content-type': 'application/json', 'content-length': String(bodyBuf.length) },
      }, res => {
        res.resume();
        res.on('end', () => resolve(res.statusCode ?? 0));
      });
      req.on('error', reject);
      void (async () => {
        for (let i = 0; i < chunks.length; i++) {
          req.write(chunks[i]);
          if (i + 1 < chunks.length) await new Promise(r => setTimeout(r, 20));
        }
        req.end();
      })().catch(reject);
    });
    assert.equal(status, 200);
    assert.equal(upstreamCalls.length, 1);
    const forwardedContent = upstreamCalls[0].body.input[0].content as string;
    assert.equal(forwardedContent.includes('\uFFFD'), false, 'upstream content must not contain U+FFFD replacement characters');
    assert.equal(forwardedContent.includes(targetText), true, 'upstream content must preserve exact multi-byte Chinese text');
    assert.deepEqual(upstreamCalls[0].body, payload);
  });
});
