import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

// Exercise the real CLI, including multipart upload, before generation starts.
// The HTTP fixture refuses chat and supplies no Chrome, so neither DeepSeek nor
// external control sites are called. This proves upload selection, not generation.
test('evaluation uploads every admitted image for both styles of all four companies', async () => {
  const packs = ['industrial', 'export', 'molding', 'packaging'];
  const manifests = await Promise.all(packs.map(async pack => JSON.parse(await readFile(`tests/fixtures/company-images/${pack}/manifest.json`, 'utf8'))));
  const out = path.resolve('artifacts/t137', `eval-images-${Date.now()}-${process.pid}`);
  await mkdir(out, { recursive: true });
  const uploaded: Array<Array<{ file: string; category: string; sourceUrl: string; licenseUrl: string; author: string; attribution: string }>> = [];
  const materials: string[] = [];
  const server = createServer(async (request, response) => {
    const json = (status: number, body: unknown) => { response.writeHead(status, { 'content-type': 'application/json' }); response.end(JSON.stringify(body)); };
    if (request.url === '/api/health') return json(200, { testIdentity: { cwd: process.cwd() }, persistence: { driver: 'development-file' }, deepseek: { configured: true } });
    const chunks = []; for await (const chunk of request) chunks.push(chunk);
    const body = Buffer.concat(chunks);
    if (request.url === '/api/sites') { uploaded.push([]); return json(201, { id: `fixture-${uploaded.length}` }); }
    const index = Number(request.url?.match(/fixture-(\d+)/)?.[1]) - 1;
    if (request.url?.endsWith('/images')) {
      const form = await new Request('http://fixture/upload', { method: 'POST', headers: { 'content-type': request.headers['content-type']! }, body }).formData();
      const file = form.get('file') as File;
      uploaded[index].push({ file: file.name, category: String(form.get('usageCategory')), sourceUrl: String(form.get('sourceUrl')),
        licenseUrl: String(form.get('licenseUrl')), author: String(form.get('author')), attribution: String(form.get('attribution')) });
      return json(201, { image: { imageId: `img-${index}-${uploaded[index].length}` } });
    }
    if (request.url?.endsWith('/chat')) { materials[index] = JSON.parse(body.toString()).message; return json(503, { userMessage: '本地夹具停止在生成前；没有模型调用。' }); }
    if (request.url?.endsWith('/draft')) return json(200, { codeSite: { runs: [], versions: [] } });
    return json(404, { userMessage: 'unexpected fixture endpoint' });
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const command = [process.execPath, '--experimental-strip-types', 'scripts/eval-new-route.ts', '--base', base, '--out', path.join(out, 'round')];
  const child = spawn(command[0], command.slice(1), { env: { ...process.env, CHROME_PATH: '', SITE_STORE: 'fs' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = ''; child.stdout.on('data', data => { output += data; }); child.stderr.on('data', data => { output += data; });
  try {
    const code = await new Promise<number | null>((resolve, reject) => { child.on('error', reject); child.on('close', resolve); });
    await writeFile(path.join(out, 'observations.json'), JSON.stringify({ at: new Date().toISOString(), command, code, uploaded, materials, output }, null, 2) + '\n');
    assert.equal(code, 1, 'an intentionally ungenerated evaluation stays INCOMPLETE');
    assert.equal(uploaded.length, 8, 'four companies × two styles');
    for (let i = 0; i < 8; i++) {
      const manifest = manifests[Math.floor(i / 2)];
      assert.deepEqual(uploaded[i].map(photo => photo.file).sort(), manifest.images.map((photo: { file: string }) => photo.file).sort(), `${packs[Math.floor(i / 2)]} must use the whole admitted manifest`);
      for (const photo of manifest.images) {
        const receipt = uploaded[i].find(item => item.file === photo.file)!;
        assert.deepEqual(receipt, { file: photo.file, category: photo.category, sourceUrl: photo.sourceUrl, licenseUrl: photo.licenseUrl, author: photo.author, attribution: photo.attribution });
        assert.ok(materials[i].includes(photo.file), 'the model receives the uploaded image caption and usage limits');
        if (photo.limitations) assert.ok(materials[i].includes(photo.limitations));
      }
    }
    const round = JSON.parse(await readFile(path.join(out, 'round/private/round.json'), 'utf8'));
    assert.ok(round.cases.every((item: { modelCalls: unknown[] }) => item.modelCalls.length === 0));
  } finally { if (child.exitCode === null) child.kill('SIGTERM'); await new Promise<void>(resolve => server.close(() => resolve())); }
});
