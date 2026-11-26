import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse, stringify, format, minify, JsonError, detectFormat, stats, deepDiff, escapeString, unescapeString, toValue } from '../../src/js/lib/json.js';

const err = (fn) => { try { fn(); } catch (e) { assert.ok(e instanceof JsonError, String(e)); return e; } assert.fail('expected error'); };

test('parse matches JSON.parse for valid documents', () => {
  const samples = ['{}', '[]', '0', '-1.5e+10', '"a\\u00e9\\n"', 'true', 'null', '{"a":[1,2,{"b":null}],"c":"x"}', ' \n [ 1 , 2 ] \n'];
  for (const s of samples) assert.deepEqual(toValue(parse(s).ast), JSON.parse(s), s);
});

test('formatter preserves big numbers and unicode', () => {
  const out = format('{"id":12345678901234567890123,"v":1.10,"s":"Tiếng Việt"}', { indent: 2 });
  assert.equal(out, '{\n  "id": 12345678901234567890123,\n  "v": 1.10,\n  "s": "Tiếng Việt"\n}');
});

test('formatter indent options & sort keys', () => {
  assert.equal(format('{"b":1,"a":[1]}', { indent: 4, sortKeys: true }), '{\n    "a": [\n        1\n    ],\n    "b": 1\n}');
  assert.equal(format('{"a":{}}', { indent: '\t' }), '{\n\t"a": {}\n}');
});

test('minify removes whitespace', () => {
  assert.equal(minify('{\n  "a" : [ 1, 2 ],\n  "b": "x y"\n}'), '{"a":[1,2],"b":"x y"}');
});

test('errors report line and column', () => {
  const e = err(() => parse('{\n  "a": 1\n  "b": 2\n}'));
  assert.equal(e.line, 3); assert.equal(e.column, 3);
  assert.match(e.message, /Thiếu dấu ','/);
  const t = err(() => parse('[1,2,]'));
  assert.match(t.message, /phẩy thừa/); assert.equal(t.column, 5);
  assert.match(err(() => parse("{'a':1}")).message, /Key phải là chuỗi/);
  assert.match(err(() => parse('{"a":01}')).message, /bắt đầu bằng 0/);
  assert.match(err(() => parse('{"a":1} x')).message, /Dữ liệu thừa/);
  assert.match(err(() => parse('')).message, /rỗng/);
  assert.match(err(() => parse('{"a":"x')).message, /chưa được đóng/);
  assert.match(err(() => parse('{"a":1 // c\n}')).message, /comment/);
  assert.match(err(() => parse('"\\x"')).message, /Escape không hợp lệ/);
  assert.match(err(() => parse('[1')).message, /chưa được đóng/);
});

test('duplicate keys produce warnings', () => {
  const { warnings } = parse('{"a":1,\n"a":2}');
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].line, 2);
});

test('loose mode fixes common mistakes', () => {
  const src = `{
    // comment
    name: 'An', /* block */
    "list": [1, 2, 3,],
    ok: True,
    n: +.5,
  }`;
  const { ast, fixes } = parse(src, { loose: true });
  assert.deepEqual(toValue(ast), { name: 'An', list: [1, 2, 3], ok: true, n: 0.5 });
  assert.ok(fixes.length >= 4);
  assert.equal(stringify(ast, { indent: 0 }), '{"name":"An","list":[1,2,3],"ok":true,"n":0.5}');
});

test('detectFormat', () => {
  const t = '{"a":[1]}';
  assert.equal(detectFormat(t, parse(t).ast).kind, 'minified');
  const p = format(t, { indent: 4 });
  assert.equal(detectFormat(p, parse(p).ast).indent, 4);
  const bad = '{ "a":[1]}';
  assert.equal(detectFormat(bad, parse(bad).ast).kind, 'inconsistent');
});

test('stats counts nodes', () => {
  const s = stats(parse('{"a":[1,"x",null,true],"b":{"c":2}}').ast);
  assert.deepEqual(s, { objects: 2, arrays: 1, keys: 3, strings: 1, numbers: 2, booleans: 1, nulls: 1, maxDepth: 2 });
});

test('deepDiff finds added, removed, changed and type changes', () => {
  const a = parse('{"a":1,"b":{"c":[1,2]},"d":"x","e":1.0,"sp ace":1}').ast;
  const b = parse('{"a":2,"b":{"c":[1]},"f":true,"e":1,"sp ace":"1"}').ast;
  const d = deepDiff(a, b).map((x) => `${x.kind} ${x.path}`);
  assert.deepEqual(d.sort(), ['added $.f', 'changed $.a', 'removed $.b.c[1]', 'removed $.d', 'type $["sp ace"]'].sort());
});

test('deepDiff ignore array order', () => {
  const a = parse('[1,2,{"x":1}]').ast, b = parse('[{"x":1},2,1]').ast;
  assert.equal(deepDiff(a, b).length > 0, true);
  assert.equal(deepDiff(a, b, { ignoreArrayOrder: true }).length, 0);
  const c = parse('[1,2,3]').ast, e = parse('[3,1,4]').ast;
  assert.deepEqual(deepDiff(c, e, { ignoreArrayOrder: true }).map((x) => x.kind), ['changed']);
});

test('deepDiff key order does not matter', () => {
  assert.equal(deepDiff(parse('{"a":1,"b":2}').ast, parse('{"b":2,"a":1}').ast).length, 0);
});

test('escape / unescape roundtrip', () => {
  const s = 'Xin chào "bạn"\n\tC:\\path\\file\u0001 😀';
  const esc = escapeString(s);
  assert.equal(esc, 'Xin chào \\"bạn\\"\\n\\tC:\\\\path\\\\file\\u0001 😀');
  assert.equal(unescapeString(esc), s);
  assert.equal(unescapeString(escapeString(s, { quotes: true })), s);
  assert.equal(escapeString('é', { unicode: true }), '\\u00e9');
  assert.equal(unescapeString('{\\"a\\":1}'), '{"a":1}');
  assert.equal(unescapeString('say "hi"'), 'say "hi"');
  assert.equal(unescapeString('line1\nline2'), 'line1\nline2');
});

test('unescape reports invalid escape position', () => {
  const e = err(() => unescapeString('abc\\qdef'));
  assert.match(e.message, /Escape không hợp lệ/);
  assert.equal(e.column, 4);
});
