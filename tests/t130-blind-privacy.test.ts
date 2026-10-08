import assert from 'node:assert/strict';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { codeCheckBrowser } from '../lib/code-site-browser.ts';
import { buildBlindPackage, type EvalCase, type EvalRound } from '../scripts/eval-set-report.ts';

// Failure modes: source-first writes reveal identity in birthtime; preserved times
// or variable PNG lengths reveal origin; repeated controls and cross-protocol
// identities solve mixed without visual judgment. Real photos and the real
// filesystem are exercised. These are privacy fixtures, not generated-site evidence.
const root = path.resolve('artifacts/t130', `privacy-${crypto.randomUUID()}`);
const photos = [
  'industrial/equipment-gear-shaping-machine.jpg', 'industrial/product-gearbox-reducer.jpg',
  'industrial/equipment-gearbox-housing-machining.jpg', 'industrial/equipment-multitasking-cnc.jpg',
  'industrial/inspection-gear-testing.jpg', 'industrial/equipment-heat-treatment.jpg',
  'industrial/inspection-coordinate-measuring-t112.jpg', 'industrial/facility-gear-shaper-plant.jpg',
  'industrial/facility-cnc-production-workshop.jpg', 'industrial/product-gearbox-reducer-2.jpg',
  'export/product-compression-union.jpg', 'export/product-compression-tee.jpg',
  'export/product-gas-fittings.jpg', 'export/product-plumbing-fittings.jpg',
  'export/equipment-pipe-threading-lathe.jpg', 'export/equipment-cnc-lathe.jpg',
  'export/equipment-ultrasonic-cleaner.jpg', 'export/inspection-helium-leak-machine.jpg',
  'molding/product-injection-mold.jpg', 'molding/product-injection-molded-parts.jpg',
  'molding/equipment-bi-material-machine.jpg', 'molding/equipment-1300-ton-machine.jpg',
  'molding/facility-injection-molding.jpg', 'molding/inspection-microscope-defect.jpg',
];
let current: EvalRound, previous: EvalRound;
const round = (cases: EvalCase[]): EvalRound => ({ schemaVersion: 1, startedAt: '2026-10-08T00:00:00Z', command: 'privacy-fixture', commit: 'fixture', dirty: false, base: 'fixture', status: 'fixture', cases, controls: [], errors: [] });
test.before(async () => {
  await mkdir(path.join(root, 'inputs'), { recursive: true });
  const browser = await codeCheckBrowser();
  try {
    await browser.send('Emulation.setDeviceMetricsOverride', { width: 400, height: 280, deviceScaleFactor: 1, mobile: false });
    for (let i = 0; i < photos.length; i++) {
      const jpeg = await readFile(path.join('tests/fixtures/company-images', photos[i]));
      await browser.evaluate(`(async()=>{document.body.innerHTML='<img>';document.body.style.margin='0';const img=document.querySelector('img');img.style='width:400px;height:280px;object-fit:cover';img.src=${JSON.stringify('data:image/jpeg;base64,' + jpeg.toString('base64'))};await img.decode()})()`);
      const png = await browser.send<{ data: string }>('Page.captureScreenshot', { format: 'png' });
      await writeFile(path.join(root, 'inputs', `photo-${i}.png`), Buffer.from(png.data, 'base64'));
    }
  } finally { await browser.close(); }
  const cases = ['industrial', 'export', 'molding', 'packaging'].flatMap((pack, p) => ['precision', 'documentary'].map((style, s) => {
    const image = `../inputs/photo-${p * 2 + s}.png`;
    return { key: `${pack}/${style}`, pack, style, materials: `模拟公司 ${pack}`, outcome: 'generated' as const,
      elapsedMs: 100, attempts: [], modelCalls: [], mixedScreenshot: image,
      pages: [{ id: 'home', screenshots: { '1440': image, '375': image } }] };
  }));
  current = round(cases);
  current.controls = ['industrial', 'export', 'molding', 'packaging'].flatMap((pack, p) => [0, 1].map(i => ({ pack,
    url: `https://website.example/${pack}/${i}`, screenshots: { '1440': `../inputs/photo-${8 + p * 2 + i}.png` } })));
  previous = round(cases.map((c, i) => ({ ...c, pages: [{ id: 'home', screenshots: { '1440': `inputs/photo-${16 + i}.png`, '375': `inputs/photo-${16 + i}.png` } }] })).reverse());
  await writeFile(path.join(root, 'fixture-inputs.json'), JSON.stringify({ kind: 'real-photo-privacy-fixture-only', photos, current, previous }, null, 2));
});
async function packet(name: string) {
  const out = path.join(root, name); await mkdir(path.join(out, 'private'), { recursive: true });
  await buildBlindPackage(current, out, { directory: root, round: previous });
  return out;
}
async function inventory(root: string): Promise<Array<{ file: string; birth: number; modified: number; accessed: number; size: number; directory: boolean }>> {
  const s = await stat(root); const entry = { file: root, birth: s.birthtimeMs, modified: s.mtimeMs, accessed: s.atimeMs, size: s.size, directory: s.isDirectory() };
  const children = s.isDirectory() ? (await Promise.all((await readdir(root)).map(name => inventory(path.join(root, name))))).flat() : [];
  return [entry, ...children];
}
test('privacy: birthtime, mtime, atime and size do not identify source or round', async () => {
  const out = await packet('metadata');
  const mapping = JSON.parse(await readFile(path.join(out, 'private/mapping.json'), 'utf8'));
  const review = path.join(out, 'review');
  const entries = await inventory(review);
  // Observe the exact prior defect before the package layout changes.
  if (entries.some(e => e.file === path.join(review, 'tasks.json'))) {
    const legacy = JSON.parse(await readFile(path.join(review, 'tasks.json'), 'utf8'));
    const guesses = await Promise.all(legacy.mixed.map(async (t: { candidates: Array<{ id: string }> }) => {
      const candidates = await Promise.all(t.candidates.map(async c => ({ ...c, time: (await stat(path.join(review, 'samples', c.id))).birthtimeMs })));
      return mapping[candidates.sort((a, b) => a.time - b.time)[0].id].kind === 'generated';
    }));
    await writeFile(path.join(out, 'birthtime-attack.json'), JSON.stringify({ correct: guesses.filter(Boolean).length, total: guesses.length }));
    assert.notEqual(guesses.filter(Boolean).length, guesses.length, 'birthtime reveals every generated candidate');
  }
  const compareRoot = path.join(out, 'comparison-review');
  const all = [...entries, ...await inventory(compareRoot)];
  assert.equal(new Set(all.map(e => e.modified)).size, 1, 'all file and directory mtime values must be equal');
  assert.equal(new Set(all.map(e => e.accessed)).size, 1, 'all file and directory atime values must be equal');
  for (const [folder, field, positive] of [['mixed', 'kind', 'generated'], ['company', 'style', 'precision']] as const) {
    const samplesRoot = path.join(review, folder, 'samples');
    const dirs = entries.filter(e => e.directory && path.dirname(e.file) === samplesRoot);
    const ordered = [...dirs].sort((a, b) => a.birth - b.birth);
    const matches = ordered.slice(0, ordered.length / 2).filter(e => mapping[path.basename(e.file)][field] === positive).length;
    assert.equal(matches, ordered.length / 4, `${folder}: timestamp rank must not recover the source partition`);
    const images = entries.filter(e => !e.directory && e.file.startsWith(samplesRoot) && e.file.endsWith('.png'));
    assert.equal(new Set(images.map(e => e.size)).size, 1, `${folder}: image size must carry no identity rank`);
  }
  const paired = JSON.parse(await readFile(path.join(compareRoot, 'tasks.json'), 'utf8'));
  let earlierCurrent = 0;
  for (const pair of paired.pairs) {
    const candidates = pair.candidates.map((c: { id: string }) => ({ ...c, time: all.find(e => e.file === path.join(compareRoot, 'samples', c.id))!.birth }));
    if (mapping[candidates.sort((a: { time: number }, b: { time: number }) => a.time - b.time)[0].id].round === 'current') earlierCurrent++;
  }
  assert.equal(earlierCurrent, 4, 'earliest-in-pair must not recover all eight round identities');
  const pairedImages = all.filter(e => !e.directory && e.file.startsWith(compareRoot) && e.file.endsWith('.png'));
  assert.equal(new Set(pairedImages.map(e => e.size)).size, 1, 'paired PNG sizes must not identify rounds');
  assert.ok(new Set(await Promise.all(photos.map((_, i) => stat(path.join(root, 'inputs', `photo-${i}.png`)).then(s => s.size)))).size > 1,
    'the inputs must be different photographic PNGs with different original lengths');
  const browser = await codeCheckBrowser();
  try {
    for (const e of all.filter(e => !e.directory && e.file.endsWith('.png'))) {
      const encoded = (await readFile(e.file)).toString('base64');
      const dimensions = await browser.evaluate<number[]>(`(async()=>{const img=new Image();img.src=${JSON.stringify('data:image/png;base64,') }+${JSON.stringify(encoded)};await img.decode();return [img.naturalWidth,img.naturalHeight]})()`);
      assert.deepEqual(dimensions, [400, 280], 'padding must leave a decodable real image');
    }
  } finally { await browser.close(); }
  await writeFile(path.join(out, 'metadata-observations.json'), JSON.stringify(all, null, 2));
});
test('privacy: separate protocols and one use per real website prevent identity elimination', async () => {
  const out = await packet('protocols'), review = path.join(out, 'review');
  assert.deepEqual((await readdir(review)).sort(), ['company', 'mixed'], 'each rubric requires its own reviewer directory');
  const mixed = JSON.parse(await readFile(path.join(review, 'mixed/tasks.json'), 'utf8'));
  const company = JSON.parse(await readFile(path.join(review, 'company/tasks.json'), 'utf8'));
  const mapping = JSON.parse(await readFile(path.join(out, 'private/mapping.json'), 'utf8'));
  assert.equal(mixed.samples.length, 16); assert.equal(company.pairs.length, 12);
  const real = mixed.samples.filter((c: { id: string }) => mapping[c.id].kind === 'control');
  assert.equal(real.length, 8); assert.equal(new Set(real.map((c: { id: string }) => mapping[c.id].url)).size, 8);
  assert.equal(mixed.samples.filter((c: { id: string }) => mapping[c.id].kind === 'generated').length, 8);
  const mixedIds = new Set(mixed.samples.map((c: { id: string }) => c.id));
  for (const pair of company.pairs) {
    assert.equal(pair.candidates.length, 2);
    const identities = pair.candidates.map((c: { id: string }) => mapping[c.id]);
    assert.notEqual(identities[0].key.split('/')[0], identities[1].key.split('/')[0]);
    assert.equal(identities[0].style, identities[1].style);
    for (const c of pair.candidates) assert.equal(mixedIds.has(c.id), false);
  }
  const paired = JSON.parse(await readFile(path.join(out, 'comparison-review/tasks.json'), 'utf8'));
  assert.equal(paired.pairs.length, 8);
  for (const pair of paired.pairs) {
    const identities = pair.candidates.map((c: { id: string }) => mapping[c.id]);
    assert.equal(identities[0].key, identities[1].key); assert.notEqual(identities[0].round, identities[1].round);
  }
  for (const folder of ['mixed', 'company']) {
    const prompt = await readFile(path.join(review, folder, 'prompt.txt'), 'utf8');
    assert.match(prompt, /独立|不同|单独/);
    for (const e of await inventory(path.join(review, folder))) if (!e.directory && !e.file.endsWith('.png')) {
      const text = await readFile(e.file, 'utf8');
      assert.doesNotMatch(text, /\.\.\//, 'no link can expose another reviewer package');
      assert.doesNotMatch(text, /precision|documentary|website\.example|current|previous/);
    }
  }
});
test('privacy: repeated real URLs, repeated real input images and missing screenshots are refused', async () => {
  for (const kind of ['url', 'image', 'missing']) {
    const out = path.join(root, `invalid-${kind}`); await mkdir(path.join(out, 'private'), { recursive: true });
    const invalid = structuredClone(current);
    if (kind === 'url') invalid.controls[1].url = invalid.controls[0].url;
    if (kind === 'image') invalid.controls[1].screenshots['1440'] = invalid.controls[0].screenshots['1440'];
    if (kind === 'missing') invalid.controls[0].screenshots['1440'] = 'nonexistent.png';
    await assert.rejects(buildBlindPackage(invalid, out), kind === 'missing' ? /ENOENT/ : /重复使用/);
  }
});
