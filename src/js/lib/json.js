// Trình phân tích JSON tự viết: báo lỗi chính xác dòng/cột, phát hiện key trùng,
// giữ nguyên chữ số gốc (không mất độ chính xác số lớn), hỗ trợ chế độ "loose"
// để tự sửa lỗi phổ biến (comment, dấu phẩy cuối, nháy đơn, key không nháy...).

export class JsonError extends Error {
  constructor(message, pos, text, hint) {
    super(message);
    this.name = 'JsonError';
    this.pos = pos;
    const { line, column } = lineCol(text, pos);
    this.line = line;
    this.column = column;
    this.hint = hint || '';
  }
}

export function lineCol(text, pos) {
  let line = 1, last = -1;
  for (let i = 0; i < pos && i < text.length; i++) if (text.charCodeAt(i) === 10) { line++; last = i; }
  return { line, column: pos - last };
}

const ESC = { '"': '"', '\\': '\\', '/': '/', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t' };

function describe(ch) {
  if (ch === undefined) return 'cuối dữ liệu';
  if (ch === '\n') return 'xuống dòng';
  return `ký tự '${ch}'`;
}

/**
 * Parse JSON thành AST.
 * Node: {t:'object', entries:[{key, keyPos, value}]} | {t:'array', items:[]} |
 *       {t:'string', v} | {t:'number', raw} | {t:'boolean', v} | {t:'null'}
 * @returns {{ast, warnings:Array<{message,line,column}>, fixes:string[]}}
 */
export function parse(text, { loose = false } = {}) {
  let i = 0;
  const warnings = [];
  const fixes = new Set();
  const fail = (msg, pos = i, hint) => { throw new JsonError(msg, pos, text, hint); };

  if (text.charCodeAt(0) === 0xfeff) { i = 1; if (!loose) warnings.push(warn('Có ký tự BOM ở đầu dữ liệu', 0)); }

  function warn(message, pos) { const lc = lineCol(text, pos); return { message, line: lc.line, column: lc.column }; }

  function ws() {
    for (;;) {
      const c = text[i];
      if (c === ' ' || c === '\t' || c === '\n' || c === '\r') { i++; continue; }
      if (c === '/' && (text[i + 1] === '/' || text[i + 1] === '*')) {
        if (!loose) fail('JSON không cho phép comment', i, 'Xoá comment hoặc dùng nút "Tự sửa lỗi"');
        fixes.add('Xoá comment');
        if (text[i + 1] === '/') { while (i < text.length && text[i] !== '\n') i++; }
        else {
          const end = text.indexOf('*/', i + 2);
          if (end < 0) fail('Comment /* chưa được đóng', i);
          i = end + 2;
        }
        continue;
      }
      if (loose && (c === ' ' || c === '﻿')) { i++; continue; }
      break;
    }
  }

  function value(depth) {
    if (depth > 5000) fail('Dữ liệu lồng nhau quá sâu');
    ws();
    const c = text[i];
    if (c === '{') return object(depth);
    if (c === '[') return array(depth);
    if (c === '"') return { t: 'string', v: string('"') };
    if (c === "'") {
      if (!loose) fail('JSON yêu cầu chuỗi dùng nháy kép (")', i, 'Đổi \' thành " hoặc dùng "Tự sửa lỗi"');
      fixes.add('Đổi nháy đơn thành nháy kép');
      return { t: 'string', v: string("'") };
    }
    if (c === '-' || (c >= '0' && c <= '9') || (loose && (c === '+' || c === '.'))) return number();
    if (text.startsWith('true', i)) { i += 4; return { t: 'boolean', v: true }; }
    if (text.startsWith('false', i)) { i += 5; return { t: 'boolean', v: false }; }
    if (text.startsWith('null', i)) { i += 4; return { t: 'null' }; }
    if (loose) {
      for (const [w, node] of [['undefined', { t: 'null' }], ['None', { t: 'null' }], ['True', { t: 'boolean', v: true }], ['False', { t: 'boolean', v: false }], ['NaN', { t: 'null' }]]) {
        if (text.startsWith(w, i)) { i += w.length; fixes.add(`Đổi ${w} thành giá trị JSON hợp lệ`); return node; }
      }
    }
    if (c === undefined) fail('Thiếu giá trị (dữ liệu kết thúc đột ngột)');
    if (c === '}' || c === ']') fail(`Gặp ${describe(c)} nhưng đang chờ một giá trị`, i, 'Có thể có dấu phẩy thừa ở trước');
    fail(`${describe(c)} không hợp lệ — đang chờ một giá trị`, i, /[A-Za-z_]/.test(c) ? 'Chuỗi phải nằm trong nháy kép "..."' : '');
  }

  function object(depth) {
    const start = i;
    i++;
    const entries = [];
    const seen = new Map();
    let lastComma = -1;
    ws();
    if (text[i] === '}') { i++; return { t: 'object', entries }; }
    for (;;) {
      ws();
      const keyPos = i;
      let key;
      if (text[i] === '"') key = string('"');
      else if (loose && text[i] === "'") { fixes.add('Đổi nháy đơn thành nháy kép'); key = string("'"); }
      else if (loose && /[A-Za-z_$\p{L}0-9]/u.test(text[i] || '')) {
        const m = /^[\p{L}\p{N}_$-]+/u.exec(text.slice(i));
        key = m[0]; i += key.length; fixes.add('Thêm nháy kép cho key');
      } else if (text[i] === '}') {
        if (!loose) fail('Dấu phẩy thừa trước }', lastComma, 'JSON không cho phép trailing comma');
        fixes.add('Xoá dấu phẩy thừa'); i++; return { t: 'object', entries };
      } else if (text[i] === undefined) {
        fail(`Object mở tại dòng ${lineCol(text, start).line} chưa được đóng (thiếu })`);
      } else {
        fail(`Key phải là chuỗi trong nháy kép, gặp ${describe(text[i])}`, i, /[A-Za-z_]/.test(text[i]) ? 'Bọc key trong nháy kép, ví dụ "key"' : '');
      }
      if (seen.has(key)) warnings.push(warn(`Key trùng lặp "${key}" (lần đầu ở dòng ${lineCol(text, seen.get(key)).line})`, keyPos));
      else seen.set(key, keyPos);
      ws();
      if (text[i] !== ':') {
        if (loose && text[i] === '=') { fixes.add("Đổi '=' thành ':'"); }
        else fail(`Thiếu dấu ':' sau key "${key}"`, i);
      }
      i++;
      const v = value(depth + 1);
      entries.push({ key, keyPos, value: v });
      ws();
      const c = text[i];
      if (c === ',') { lastComma = i; i++; continue; }
      if (c === '}') { i++; return { t: 'object', entries }; }
      if (c === undefined) fail(`Object mở tại dòng ${lineCol(text, start).line} chưa được đóng (thiếu })`);
      if (loose && (c === '"' || c === "'" || /[A-Za-z_$]/.test(c))) { fixes.add('Thêm dấu phẩy bị thiếu'); continue; }
      fail(`Thiếu dấu ',' hoặc '}' sau giá trị của "${key}", gặp ${describe(c)}`, i, c === '"' ? 'Có thể bạn quên dấu phẩy giữa hai thuộc tính' : '');
    }
  }

  function array(depth) {
    const start = i;
    i++;
    const items = [];
    ws();
    if (text[i] === ']') { i++; return { t: 'array', items }; }
    let lastComma = -1;
    for (;;) {
      ws();
      if (text[i] === ']' && lastComma >= 0) {
        if (!loose) fail('Dấu phẩy thừa trước ]', lastComma, 'JSON không cho phép trailing comma');
        fixes.add('Xoá dấu phẩy thừa'); i++; return { t: 'array', items };
      }
      items.push(value(depth + 1));
      ws();
      const c = text[i];
      if (c === ',') { lastComma = i; i++; continue; }
      if (c === ']') { i++; return { t: 'array', items }; }
      if (c === undefined) fail(`Mảng mở tại dòng ${lineCol(text, start).line} chưa được đóng (thiếu ])`);
      if (loose && c !== '}' ) { fixes.add('Thêm dấu phẩy bị thiếu'); continue; }
      fail(`Thiếu dấu ',' hoặc ']' trong mảng, gặp ${describe(c)}`, i);
    }
  }

  function string(q) {
    const start = i;
    i++;
    let out = '';
    let chunk = i;
    for (;;) {
      const c = text[i];
      if (c === undefined) fail('Chuỗi chưa được đóng (thiếu nháy kép)', start);
      if (c === q) { out += text.slice(chunk, i); i++; return out; }
      if (c === '\\') {
        out += text.slice(chunk, i);
        const e = text[i + 1];
        if (e in ESC) { out += ESC[e]; i += 2; }
        else if (e === 'u') {
          const hex = text.slice(i + 2, i + 6);
          if (!/^[0-9a-fA-F]{4}$/.test(hex)) fail('Escape \\u phải có đúng 4 chữ số hex', i);
          out += String.fromCharCode(parseInt(hex, 16));
          i += 6;
        } else if (loose && e === "'") { out += "'"; i += 2; }
        else fail(`Escape không hợp lệ: \\${e ?? ''}`, i, 'Các escape hợp lệ: \\" \\\\ \\/ \\b \\f \\n \\r \\t \\uXXXX');
        chunk = i;
        continue;
      }
      const code = text.charCodeAt(i);
      if (code < 0x20) {
        if (!loose) fail(code === 10 ? 'Chuỗi không được chứa xuống dòng trực tiếp (dùng \\n)' : `Ký tự điều khiển U+${code.toString(16).padStart(4, '0')} phải được escape`, i);
        fixes.add('Escape ký tự điều khiển trong chuỗi');
      }
      i++;
    }
  }

  function number() {
    const start = i;
    if (loose && text[i] === '+') { i++; fixes.add('Bỏ dấu + trước số'); }
    if (text[i] === '-') i++;
    if (loose && text[i] === '.') { /* .5 */ }
    else if (text[i] === '0') {
      i++;
      if (/[0-9]/.test(text[i] || '')) { if (!loose) fail('Số không được bắt đầu bằng 0', start); fixes.add('Bỏ số 0 ở đầu'); while (/[0-9]/.test(text[i] || '')) i++; }
    } else if (/[1-9]/.test(text[i] || '')) { while (/[0-9]/.test(text[i] || '')) i++; }
    else fail('Số không hợp lệ', start);
    if (text[i] === '.') {
      i++;
      if (!/[0-9]/.test(text[i] || '')) { if (!loose) fail('Phải có chữ số sau dấu chấm thập phân', i); fixes.add('Sửa số thập phân'); }
      while (/[0-9]/.test(text[i] || '')) i++;
    }
    if (text[i] === 'e' || text[i] === 'E') {
      i++;
      if (text[i] === '+' || text[i] === '-') i++;
      if (!/[0-9]/.test(text[i] || '')) fail('Số mũ không hợp lệ', i);
      while (/[0-9]/.test(text[i] || '')) i++;
    }
    let raw = text.slice(start, i);
    if (loose) {
      const n = Number(raw.replace(/^\+/, ''));
      const canon = raw.replace(/^\+/, '').replace(/^(-?)0+(\d)/, '$1$2').replace(/^(-?)\./, '$10.').replace(/\.(?=$|[eE])/, '');
      raw = isValidNumber(canon) ? canon : String(n);
    }
    return { t: 'number', raw };
  }

  ws();
  if (i >= text.length) fail('Dữ liệu rỗng', i);
  const ast = value(0);
  ws();
  if (i < text.length) {
    fail(`Dữ liệu thừa sau giá trị JSON: ${describe(text[i])}`, i, text[i] === ',' || text[i] === '{' ? 'JSON chỉ được có một giá trị gốc. Bọc trong [ ] nếu là danh sách' : '');
  }
  return { ast, warnings, fixes: [...fixes] };
}

function isValidNumber(s) { return /^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?$/.test(s); }

/** Chuyển AST thành chuỗi JSON. indent: số space, '\t', hoặc 0 để minify. */
export function stringify(ast, { indent = 2, sortKeys = false } = {}) {
  const unit = indent === '\t' ? '\t' : ' '.repeat(Number(indent) || 0);
  const pretty = unit.length > 0;
  const parts = [];
  const write = (node, level) => {
    switch (node.t) {
      case 'object': {
        if (node.entries.length === 0) { parts.push('{}'); return; }
        const entries = sortKeys ? [...node.entries].sort((x, y) => (x.key < y.key ? -1 : x.key > y.key ? 1 : 0)) : node.entries;
        parts.push('{');
        entries.forEach((e, idx) => {
          if (idx) parts.push(',');
          if (pretty) parts.push('\n', unit.repeat(level + 1));
          parts.push(JSON.stringify(e.key), pretty ? ': ' : ':');
          write(e.value, level + 1);
        });
        if (pretty) parts.push('\n', unit.repeat(level));
        parts.push('}');
        return;
      }
      case 'array': {
        if (node.items.length === 0) { parts.push('[]'); return; }
        parts.push('[');
        node.items.forEach((it, idx) => {
          if (idx) parts.push(',');
          if (pretty) parts.push('\n', unit.repeat(level + 1));
          write(it, level + 1);
        });
        if (pretty) parts.push('\n', unit.repeat(level));
        parts.push(']');
        return;
      }
      case 'string': parts.push(JSON.stringify(node.v)); return;
      case 'number': parts.push(node.raw); return;
      case 'boolean': parts.push(node.v ? 'true' : 'false'); return;
      default: parts.push('null');
    }
  };
  write(ast, 0);
  return parts.join('');
}

export function format(text, opts = {}) {
  const { ast } = parse(text, { loose: !!opts.loose });
  return stringify(ast, opts);
}

export function minify(text, opts = {}) {
  const { ast } = parse(text, { loose: !!opts.loose });
  return stringify(ast, { indent: 0, sortKeys: !!opts.sortKeys });
}

/** Thống kê cấu trúc của AST. */
export function stats(ast) {
  const s = { objects: 0, arrays: 0, keys: 0, strings: 0, numbers: 0, booleans: 0, nulls: 0, maxDepth: 0 };
  const walk = (n, d) => {
    s.maxDepth = Math.max(s.maxDepth, d);
    if (n.t === 'object') { s.objects++; s.keys += n.entries.length; n.entries.forEach((e) => walk(e.value, d + 1)); }
    else if (n.t === 'array') { s.arrays++; n.items.forEach((x) => walk(x, d + 1)); }
    else if (n.t === 'string') s.strings++;
    else if (n.t === 'number') s.numbers++;
    else if (n.t === 'boolean') s.booleans++;
    else s.nulls++;
  };
  walk(ast, 0);
  return s;
}

/** Nhận diện kiểu định dạng hiện tại của văn bản JSON hợp lệ. */
export function detectFormat(text, ast) {
  const t = text.replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\n$/, '');
  if (t === stringify(ast, { indent: 0 })) return { kind: 'minified', label: 'Minified (1 dòng)' };
  for (const [ind, label] of [[2, '2 spaces'], [4, '4 spaces'], ['\t', 'Tab'], [3, '3 spaces']]) {
    if (t === stringify(ast, { indent: ind })) return { kind: 'pretty', indent: ind, label: `Pretty — thụt lề ${label}` };
  }
  if (t === stringify(ast, { indent: 2, sortKeys: true })) return { kind: 'pretty', indent: 2, label: 'Pretty — 2 spaces (key đã sắp xếp)' };
  return { kind: 'inconsistent', label: 'Chưa chuẩn (thụt lề / khoảng trắng không đồng nhất)' };
}

/** Chuyển AST -> giá trị JS (số dùng Number). */
export function toValue(node) {
  switch (node.t) {
    case 'object': { const o = {}; for (const e of node.entries) o[e.key] = toValue(e.value); return o; }
    case 'array': return node.items.map(toValue);
    case 'string': return node.v;
    case 'number': return Number(node.raw);
    case 'boolean': return node.v;
    default: return null;
  }
}

/** Đường dẫn kiểu JS: $.a.b[0]["key có dấu cách"] */
export function pathJoin(base, key) {
  if (typeof key === 'number') return `${base}[${key}]`;
  return /^[A-Za-z_$][\w$]*$/.test(key) ? `${base}.${key}` : `${base}[${JSON.stringify(key)}]`;
}

const typeName = (n) => n.t;

function canonical(n) { return stringify(n, { indent: 0, sortKeys: true }); }

function nodeEqual(a, b) {
  if (a.t !== b.t) return false;
  if (a.t === 'number') return a.raw === b.raw || Number(a.raw) === Number(b.raw);
  if (a.t === 'string' || a.t === 'boolean') return a.v === b.v;
  if (a.t === 'null') return true;
  return canonical(a) === canonical(b) || deepDiff(a, b).length === 0;
}

/**
 * So sánh cấu trúc hai AST.
 * @returns Array<{kind:'added'|'removed'|'changed'|'type', path, left?, right?}>
 */
export function deepDiff(left, right, { ignoreArrayOrder = false } = {}, path = '$', out = []) {
  if (left.t !== right.t) { out.push({ kind: 'type', path, left, right }); return out; }
  if (left.t === 'object') {
    const rmap = new Map(right.entries.map((e) => [e.key, e.value]));
    const lkeys = new Set();
    for (const e of left.entries) {
      lkeys.add(e.key);
      const p = pathJoin(path, e.key);
      if (!rmap.has(e.key)) out.push({ kind: 'removed', path: p, left: e.value });
      else deepDiff(e.value, rmap.get(e.key), { ignoreArrayOrder }, p, out);
    }
    for (const e of right.entries) if (!lkeys.has(e.key)) out.push({ kind: 'added', path: pathJoin(path, e.key), right: e.value });
    return out;
  }
  if (left.t === 'array') {
    if (ignoreArrayOrder) {
      const rest = right.items.map((n, idx) => ({ n, idx, c: canonical(n), used: false }));
      const unmatched = [];
      left.items.forEach((n, idx) => {
        const c = canonical(n);
        const hit = rest.find((r) => !r.used && r.c === c);
        if (hit) hit.used = true; else unmatched.push({ n, idx });
      });
      const remaining = rest.filter((r) => !r.used);
      const pairs = Math.min(unmatched.length, remaining.length);
      for (let k = 0; k < pairs; k++) deepDiff(unmatched[k].n, remaining[k].n, { ignoreArrayOrder }, pathJoin(path, unmatched[k].idx), out);
      for (let k = pairs; k < unmatched.length; k++) out.push({ kind: 'removed', path: pathJoin(path, unmatched[k].idx), left: unmatched[k].n });
      for (let k = pairs; k < remaining.length; k++) out.push({ kind: 'added', path: pathJoin(path, remaining[k].idx), right: remaining[k].n });
      return out;
    }
    const n = Math.max(left.items.length, right.items.length);
    for (let k = 0; k < n; k++) {
      const p = pathJoin(path, k);
      if (k >= right.items.length) out.push({ kind: 'removed', path: p, left: left.items[k] });
      else if (k >= left.items.length) out.push({ kind: 'added', path: p, right: right.items[k] });
      else deepDiff(left.items[k], right.items[k], { ignoreArrayOrder }, p, out);
    }
    return out;
  }
  if (!nodeEqual(left, right)) out.push({ kind: 'changed', path, left, right });
  return out;
}

export { typeName };

export function preview(node, max = 80) {
  const s = stringify(node, { indent: 0 });
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

// ---------- Escape / Unescape ----------

/** Escape văn bản thành nội dung chuỗi JSON. */
export function escapeString(text, { quotes = false, unicode = false } = {}) {
  let s = JSON.stringify(text);
  if (unicode) s = s.replace(/[\u007f-￿]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
  return quotes ? s : s.slice(1, -1);
}

/** Unescape một chuỗi JSON (có hoặc không có nháy kép bao ngoài). */
export function unescapeString(text) {
  const t = text.trim();
  const quoted = t.length >= 2 && t[0] === '"' && t[t.length - 1] === '"';
  const lead = quoted ? text.indexOf('"') + 1 : 0;
  const inner = quoted ? text.slice(lead, text.lastIndexOf('"')) : text;
  // Dựng literal hợp lệ: escape nháy kép trần và ký tự điều khiển; ghi lại map vị trí.
  let src = '"';
  const map = [lead];
  for (let k = 0; k < inner.length; k++) {
    const c = inner[k];
    let add;
    if (c === '\\') { add = c + (inner[k + 1] ?? ''); k++; }
    else if (c === '"') add = '\\"';
    else if (c === '\n') add = '\\n';
    else if (c === '\r') add = '\\r';
    else if (c === '\t') add = '\\t';
    else if (c.charCodeAt(0) < 0x20) add = '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0');
    else add = c;
    const origin = lead + (c === '\\' ? k - 1 : k);
    for (let z = 0; z < add.length; z++) map.push(origin);
    src += add;
  }
  src += '"';
  map.push(lead + inner.length);
  try {
    return parse(src).ast.v;
  } catch (e) {
    if (e instanceof JsonError) throw new JsonError(e.message, map[Math.min(e.pos, map.length - 1)] ?? 0, text, e.hint);
    throw e;
  }
}
