import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diffSequences, diffLines, diffStats, diffInline, foldRows, splitLines } from '../../src/js/lib/diff.js';

function apply(a, b, ops) {
  // Từ ops dựng lại được cả a và b
  const ra = [], rb = [];
  for (const o of ops) {
    if (o.op === 'equal') { ra.push(a[o.a]); rb.push(b[o.b]); assert.equal(a[o.a], b[o.b]); }
    else if (o.op === 'delete') ra.push(a[o.a]);
    else rb.push(b[o.b]);
  }
  assert.deepEqual(ra, a); assert.deepEqual(rb, b);
  return ops.filter((o) => o.op !== 'equal').length;
}

test('diffSequences: classic ABCABBA vs CBABAC has edit distance 5', () => {
  const a = [...'ABCABBA'], b = [...'CBABAC'];
  assert.equal(apply(a, b, diffSequences(a, b)), 5);
});

test('diffSequences: empty and identical inputs', () => {
  assert.deepEqual(diffSequences([], []), []);
  assert.equal(apply([], ['x'], diffSequences([], ['x'])), 1);
  assert.equal(apply(['x'], [], diffSequences(['x'], [])), 1);
  const s = [...'hello'];
  assert.equal(apply(s, s, diffSequences(s, s)), 0);
});

test('diffSequences: random fuzz reconstructs both sides and is minimal-ish', () => {
  let seed = 42;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (let t = 0; t < 300; t++) {
    const a = Array.from({ length: Math.floor(rnd() * 30) }, () => 'abcd'[Math.floor(rnd() * 4)]);
    const b = Array.from({ length: Math.floor(rnd() * 30) }, () => 'abcd'[Math.floor(rnd() * 4)]);
    const edits = apply(a, b, diffSequences(a, b));
    // So với LCS DP để kiểm tra tối ưu
    const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    assert.equal(edits, a.length + b.length - 2 * dp[a.length][b.length]);
  }
});

test('diffLines: modify / insert / delete rows', () => {
  const rows = diffLines('a\nb\nc\n', 'a\nB\nc\nd\n');
  assert.deepEqual(rows.map((r) => r.type), ['equal', 'modify', 'equal', 'insert']);
  const s = diffStats(rows);
  assert.equal(s.modify, 1); assert.equal(s.insert, 1); assert.equal(s.identical, false);
});

test('diffLines: ignore case & whitespace options', () => {
  assert.ok(diffStats(diffLines('Hello  World', 'hello world', { ignoreCase: true, ignoreWhitespace: true })).identical);
  assert.ok(!diffStats(diffLines('Hello', 'hello')).identical);
  assert.ok(diffStats(diffLines('  x  ', 'x', { trim: true })).identical);
});

test('splitLines handles CRLF and trailing newline', () => {
  assert.deepEqual(splitLines('a\r\nb\r\n'), ['a', 'b']);
  assert.deepEqual(splitLines(''), []);
  assert.deepEqual(splitLines('\n'), ['']);
});

test('diffInline marks changed words', () => {
  const { left, right } = diffInline('the quick fox', 'the slow fox');
  assert.deepEqual(left.filter((p) => p.changed).map((p) => p.text), ['quick']);
  assert.deepEqual(right.filter((p) => p.changed).map((p) => p.text), ['slow']);
  assert.equal(left.map((p) => p.text).join(''), 'the quick fox');
});

test('foldRows keeps context around changes', () => {
  const a = Array.from({ length: 20 }, (_, i) => `l${i}`);
  const b = [...a]; b[10] = 'X';
  const folded = foldRows(diffLines(a.join('\n'), b.join('\n')), 2);
  assert.deepEqual(folded.map((r) => r.type), ['fold', 'equal', 'equal', 'modify', 'equal', 'equal', 'fold']);
  assert.equal(folded[0].rows.length, 8);
});

test('diffLines handles large input quickly', () => {
  const a = Array.from({ length: 20000 }, (_, i) => `line ${i}`).join('\n');
  const b = a.replace('line 5000', 'changed').replace('line 15000\n', '');
  const t = Date.now();
  const s = diffStats(diffLines(a, b));
  assert.ok(Date.now() - t < 2000);
  assert.equal(s.modify + s.delete, 2);
});
