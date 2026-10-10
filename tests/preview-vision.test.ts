import assert from 'node:assert/strict';
import test from 'node:test';
import { isPng, readPngSize } from '../lib/preview-vision.ts';
// PNG signature and IHDR dimensions are independently encoded in the fixture.
test('PNG reader distinguishes a valid header, a truncated header and non-PNG input', () => {
  const bytes=Buffer.alloc(24);Buffer.from('89504e470d0a1a0a','hex').copy(bytes);bytes.write('IHDR',12);bytes.writeUInt32BE(800,16);bytes.writeUInt32BE(600,20);
  assert.equal(isPng(bytes),true);assert.deepEqual(readPngSize(bytes),{width:800,height:600});
  assert.equal(readPngSize(bytes.subarray(0,20)),null);assert.equal(readPngSize(Buffer.from('<html>')),null);
});
