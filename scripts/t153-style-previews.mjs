import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import sharp from 'sharp';

assert.equal(process.env.SITECRAFT_BASE, 'http://127.0.0.1:3170');
const source = process.argv[2];
assert.ok(source, 'Pass the existing t130 evaluation round directory (artifacts only).');
await mkdir('public/style-previews', { recursive: true });
for (const [style, number] of [['precision', 1], ['documentary', 2]]) {
  await sharp(path.join(source, `private/case-${number}/home-fold-1440.png`))
    .resize(576, 400).webp({ quality: 88 }).toFile(`public/style-previews/${style}.webp`);
}
