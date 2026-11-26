// Myers O(ND) diff + helpers cho so sánh text theo dòng / theo từ.

/**
 * Diff hai mảng token. Trả về danh sách op: {op:'equal'|'delete'|'insert', a?, b?}
 * với a = index bên trái, b = index bên phải.
 */
export function diffSequences(a, b, eq = (x, y) => x === y) {
  const ops = [];
  // Cắt phần đầu / cuối giống nhau để giảm độ phức tạp.
  let start = 0;
  while (start < a.length && start < b.length && eq(a[start], b[start])) start++;
  let endA = a.length, endB = b.length;
  while (endA > start && endB > start && eq(a[endA - 1], b[endB - 1])) { endA--; endB--; }

  for (let i = 0; i < start; i++) ops.push({ op: 'equal', a: i, b: i });
  const mid = myers(a, b, start, endA, start, endB, eq);
  for (const o of mid) ops.push(o);
  for (let i = 0; i < a.length - endA; i++) ops.push({ op: 'equal', a: endA + i, b: endB + i });
  return ops;
}

function myers(a, b, a0, a1, b0, b1, eq) {
  const n = a1 - a0, m = b1 - b0;
  if (n === 0 && m === 0) return [];
  if (n === 0) return range(m).map((j) => ({ op: 'insert', b: b0 + j }));
  if (m === 0) return range(n).map((i) => ({ op: 'delete', a: a0 + i }));

  const max = n + m;
  const off = max + 1;
  const v = new Int32Array(2 * max + 3);
  const trace = [];
  let found = -1;
  outer: for (let d = 0; d <= max; d++) {
    trace.push(v.slice(off - d, off + d + 1));
    for (let k = -d; k <= d; k += 2) {
      let x = (k === -d || (k !== d && v[off + k - 1] < v[off + k + 1])) ? v[off + k + 1] : v[off + k - 1] + 1;
      let y = x - k;
      while (x < n && y < m && eq(a[a0 + x], b[b0 + y])) { x++; y++; }
      v[off + k] = x;
      if (x >= n && y >= m) { found = d; break outer; }
    }
  }

  const rev = [];
  let x = n, y = m;
  for (let d = found; d > 0; d--) {
    const snap = trace[d];
    const get = (k) => snap[k + d];
    const k = x - y;
    const prevK = (k === -d || (k !== d && get(k - 1) < get(k + 1))) ? k + 1 : k - 1;
    const prevX = get(prevK);
    const prevY = prevX - prevK;
    while (x > prevX && y > prevY) { x--; y--; rev.push({ op: 'equal', a: a0 + x, b: b0 + y }); }
    if (x === prevX) { y--; rev.push({ op: 'insert', b: b0 + y }); } else { x--; rev.push({ op: 'delete', a: a0 + x }); }
  }
  while (x > 0 && y > 0) { x--; y--; rev.push({ op: 'equal', a: a0 + x, b: b0 + y }); }
  return rev.reverse();
}

function range(n) { return Array.from({ length: n }, (_, i) => i); }

export function splitLines(text) {
  if (text === '') return [];
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
  return lines;
}

export function normalizeLine(line, { ignoreCase = false, ignoreWhitespace = false, trim = false } = {}) {
  let s = line;
  if (ignoreWhitespace) s = s.replace(/\s+/g, '');
  else if (trim) s = s.trim();
  if (ignoreCase) s = s.toLowerCase();
  return s;
}

/**
 * Diff theo dòng. Trả về các "row" để render side-by-side:
 * {type:'equal'|'delete'|'insert'|'modify', left?:{n,text}, right?:{n,text}}
 */
export function diffLines(leftText, rightText, opts = {}) {
  const L = splitLines(leftText), R = splitLines(rightText);
  const kl = L.map((l) => normalizeLine(l, opts));
  const kr = R.map((l) => normalizeLine(l, opts));
  const ops = diffSequences(kl, kr);
  const rows = [];
  let dels = [], ins = [];
  const flush = () => {
    const pairs = Math.min(dels.length, ins.length);
    for (let i = 0; i < pairs; i++) {
      rows.push({ type: 'modify', left: { n: dels[i] + 1, text: L[dels[i]] }, right: { n: ins[i] + 1, text: R[ins[i]] } });
    }
    for (let i = pairs; i < dels.length; i++) rows.push({ type: 'delete', left: { n: dels[i] + 1, text: L[dels[i]] } });
    for (let i = pairs; i < ins.length; i++) rows.push({ type: 'insert', right: { n: ins[i] + 1, text: R[ins[i]] } });
    dels = []; ins = [];
  };
  for (const o of ops) {
    if (o.op === 'delete') dels.push(o.a);
    else if (o.op === 'insert') ins.push(o.b);
    else {
      flush();
      const lt = L[o.a], rt = R[o.b];
      rows.push({ type: lt === rt ? 'equal' : 'equal-normalized', left: { n: o.a + 1, text: lt }, right: { n: o.b + 1, text: rt } });
    }
  }
  flush();
  return rows;
}

export function diffStats(rows) {
  const s = { equal: 0, insert: 0, delete: 0, modify: 0 };
  for (const r of rows) {
    if (r.type === 'equal' || r.type === 'equal-normalized') s.equal++;
    else s[r.type]++;
  }
  s.identical = s.insert === 0 && s.delete === 0 && s.modify === 0;
  return s;
}

/** Tách token theo từ (giữ khoảng trắng và dấu câu thành token riêng). */
export function tokenizeWords(s) {
  return s.match(/\s+|[\p{L}\p{N}_]+|[^\s\p{L}\p{N}_]/gu) || [];
}

/**
 * Diff trong một dòng (theo từ). Trả về {left:[{text,changed}], right:[{text,changed}]}
 */
export function diffInline(a, b, { ignoreCase = false } = {}) {
  const ta = tokenizeWords(a), tb = tokenizeWords(b);
  const ka = ignoreCase ? ta.map((t) => t.toLowerCase()) : ta;
  const kb = ignoreCase ? tb.map((t) => t.toLowerCase()) : tb;
  const ops = diffSequences(ka, kb);
  const left = [], right = [];
  const push = (arr, text, changed) => {
    const last = arr[arr.length - 1];
    if (last && last.changed === changed) last.text += text; else arr.push({ text, changed });
  };
  for (const o of ops) {
    if (o.op === 'equal') { push(left, ta[o.a], false); push(right, tb[o.b], false); }
    else if (o.op === 'delete') push(left, ta[o.a], true);
    else push(right, tb[o.b], true);
  }
  return { left, right };
}

/** Gộp các dòng giống nhau dài thành "fold" chỉ giữ `context` dòng xung quanh thay đổi. */
export function foldRows(rows, context = 3) {
  const isChange = (r) => r.type === 'insert' || r.type === 'delete' || r.type === 'modify';
  const keep = new Array(rows.length).fill(false);
  rows.forEach((r, i) => {
    if (isChange(r)) for (let j = Math.max(0, i - context); j <= Math.min(rows.length - 1, i + context); j++) keep[j] = true;
  });
  const out = [];
  let skipped = [];
  const flush = () => { if (skipped.length) { out.push({ type: 'fold', rows: skipped }); skipped = []; } };
  rows.forEach((r, i) => { if (keep[i]) { flush(); out.push(r); } else skipped.push(r); });
  flush();
  return out;
}
