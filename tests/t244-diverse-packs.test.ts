import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { siteSubject } from '../lib/code-site-identity.ts';
import { MATERIALS_CHAT_LIMIT, simulatedPackList, wrapCompanyMaterials } from '../lib/simulated-packs.ts';
import { diversePackList, diversePacks, type DiversePackFormat } from '../lib/diverse-packs.ts';

test('T-244 diversePackList provides 4 distinct formats, non-overlapping industries, zero 栏目线索, and valid T-210 subject extraction', () => {
  assert.equal(simulatedPackList.length, 7, 'baseline T-190 simulatedPackList must stay at 7');
  assert.equal(diversePackList.length, 4);

  const baselineIndustries = new Set(simulatedPackList.map(p => p.industry));
  const formats = new Set<DiversePackFormat>();
  const names = new Set<string>();

  for (const pack of diversePackList) {
    assert.equal(diversePacks[pack.id], pack);
    assert.equal(baselineIndustries.has(pack.industry), false, `${pack.id} must not duplicate baseline industry`);
    formats.add(pack.formatKind);
    names.add(pack.companyName);

    assert.match(pack.body.split('\n')[0], /^资料性质：模拟/);
    assert.doesNotMatch(pack.body, /栏目线索/, `${pack.id} must not contain 栏目线索 order hints`);
    assert.doesNotMatch(pack.body, /荣获|领先|第一|500强|五星|好评/, `${pack.id} must not contain unverified superlatives`);
    assert.match(pack.email, /^[a-z0-9.-]+@[a-z0-9.-]+\.luckye\.online$/);
    assert.equal(pack.body.includes(pack.email), true);
    assert.match(pack.body, /待补充/);

    const wrapped = wrapCompanyMaterials(`${pack.body}\n页面要求：${pack.pageRequest}只做中文。`);
    assert.ok(wrapped.length <= MATERIALS_CHAT_LIMIT, `${pack.id} exceeds MATERIALS_CHAT_LIMIT`);
    assert.equal(wrapped.includes('…[truncated]'), false);

    const subjectResult = siteSubject({
      name: '未命名站点',
      materials: pack.body,
      factSources: [{ type: 'materials', messageIndex: 1, text: pack.body }],
    });
    assert.equal(subjectResult.issue, undefined, `${pack.id} subject issue: ${subjectResult.issue}`);
    assert.equal(subjectResult.subject?.name, pack.companyName);
  }

  assert.equal(formats.size, 4, 'must cover all 4 distinct writing formats');
  assert.equal(names.size, 4);

  // Structural format checks verifying the 4 packs genuinely differ in prose structure:
  const luthieryLines = diversePacks.luthiery.body.split('\n').slice(2);
  assert.ok(luthieryLines.some(l => l.length >= 220), 'oral-narrative pack must contain a long spoken paragraph');
  assert.equal(luthieryLines.filter(l => /^[-*•]/.test(l)).length, 0, 'oral-narrative pack must not be bullet notes');

  const vetBullets = diversePacks.vetclinic.body.split('\n').filter(l => /^-\s+\S/.test(l));
  assert.ok(vetBullets.length >= 7, 'scattered-notes pack must consist of scattered bullet notes');

  assert.match(diversePacks.metrology.body, /当前位置[：:]\s*首页\s*>/, 'legacy-web-copy pack must reflect copied legacy website text');
  assert.match(diversePacks.acoustic.body, /【[一二三]面｜/, 'brochure-copy pack must use tri-fold brochure panel copy');
});

test('T-244 eval-new-route --only accepts diverse packs while default --prepare-only keeps exact 14 baseline cases', async () => {
  const root = path.join(process.env.SITECRAFT_DATA_ROOT!, 't244', crypto.randomUUID());
  const before = path.join(root, 'before');
  const defaultOut = path.join(root, 'default-14');
  const onlyOut = path.join(root, 'only-diverse');
  await mkdir(path.join(before, 'private'), { recursive: true });
  await writeFile(
    path.join(before, 'private/round.json'),
    JSON.stringify({
      schemaVersion: 1,
      startedAt: '2026-10-07T00:00:00Z',
      command: 'fixture',
      commit: 'fixture',
      dirty: false,
      base: 'fixture',
      status: 'fixture',
      controls: [],
      errors: [],
      cases: [{ key: 'industrial/precision', pack: 'industrial', style: 'precision', materials: 'x', outcome: 'generated', elapsedMs: 1, attempts: [], modelCalls: [], pages: [] }],
    }),
    'utf8',
  );

  const resDefault = spawnSync(
    process.execPath,
    ['--experimental-strip-types', 'scripts/eval-new-route.ts', '--prepare-only', '--previous', before, '--out', defaultOut],
    { encoding: 'utf8' },
  );
  const roundDefault = JSON.parse(await readFile(path.join(defaultOut, 'private/round.json'), 'utf8'));
  assert.equal(roundDefault.cases.length, 14, `default eval cases must remain 14, got ${roundDefault.cases.length}: ${resDefault.stderr}`);

  const resOnly = spawnSync(
    process.execPath,
    ['--experimental-strip-types', 'scripts/eval-new-route.ts', '--prepare-only', '--previous', before, '--only', 'luthiery/darkroom,vetclinic/neighborly', '--out', onlyOut],
    { encoding: 'utf8' },
  );
  const roundOnly = JSON.parse(await readFile(path.join(onlyOut, 'private/round.json'), 'utf8'));
  assert.equal(roundOnly.cases.length, 2, `expected 2 diverse --only cases, stderr=${resOnly.stderr}`);
  assert.deepEqual(roundOnly.cases.map((c: { key: string }) => c.key), ['luthiery/darkroom', 'vetclinic/neighborly']);
  for (const c of roundOnly.cases) {
    assert.doesNotMatch(c.materials, /栏目线索/);
  }
});
