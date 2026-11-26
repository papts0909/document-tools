import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeText, decodeToText, bytesToBase64, base64ToBytes, Base64Error, sniffMime, hexPreview } from '../../src/js/lib/base64.js';

test('encode matches Buffer for random bytes', () => {
  for (let n = 0; n < 200; n++) {
    const bytes = new Uint8Array(n).map(() => Math.floor(Math.random() * 256));
    const ref = Buffer.from(bytes).toString('base64');
    assert.equal(bytesToBase64(bytes), ref);
    assert.deepEqual(Buffer.from(base64ToBytes(ref).bytes), Buffer.from(bytes));
  }
});

test('UTF-8 text roundtrip', () => {
  const s = 'Tiếng Việt có dấu 😀 — ok';
  const b = encodeText(s);
  assert.equal(b, Buffer.from(s).toString('base64'));
  assert.equal(decodeToText(b).text, s);
  assert.equal(decodeToText(b).valid, true);
});

test('url-safe, no padding, wrapping, whitespace & data URI', () => {
  const bytes = new Uint8Array([251, 255, 191]);
  assert.equal(bytesToBase64(bytes, { urlSafe: true }), '-_-_');
  assert.equal(bytesToBase64(new Uint8Array([1]), { padding: false }), 'AQ');
  assert.deepEqual([...base64ToBytes('AQ').bytes], [1]);
  assert.deepEqual([...base64ToBytes('-_-_').bytes], [251, 255, 191]);
  const long = encodeText('x'.repeat(100), { wrap: 76 });
  assert.equal(long.split('\n')[0].length, 76);
  assert.equal(decodeToText(long).text, 'x'.repeat(100));
  const d = base64ToBytes('data:image/png;base64,iVBORw0KGgo=');
  assert.equal(d.mime, 'image/png');
  assert.deepEqual(sniffMime(d.bytes), { mime: 'image/png', ext: 'png' });
});

test('invalid input errors', () => {
  assert.throws(() => base64ToBytes('ab$c'), Base64Error);
  assert.throws(() => base64ToBytes('a'), Base64Error);
  assert.throws(() => base64ToBytes('ab=c'), Base64Error);
  assert.throws(() => base64ToBytes('ab==='), Base64Error);
});

test('binary detection & hex preview', () => {
  const r = decodeToText(Buffer.from([0xff, 0xfe, 0x00]).toString('base64'));
  assert.equal(r.valid, false);
  assert.match(hexPreview(r.bytes), /^00000000  ff fe 00/);
});
