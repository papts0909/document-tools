import { h, Editor, button, checkbox, segmented, escapeHtml, toast, download } from '../ui.js';
import { diffLines, diffStats, diffInline, foldRows } from '../lib/diff.js';

const SAMPLE_L = `Chào mừng bạn đến với DevTools.
Công cụ này giúp so sánh hai đoạn văn bản.
Dòng này giống nhau.
Phiên bản: 1.0.0
Tác giả: Nhóm A
Dòng cuối.`;
const SAMPLE_R = `Chào mừng bạn đến với DevTools PWA.
Công cụ này giúp so sánh hai đoạn văn bản.
Dòng này giống nhau.
Phiên bản: 1.2.0
Dòng mới được thêm vào.
Dòng cuối.`;

/** Nếu gần như toàn bộ dòng thay đổi thì không đánh dấu từng từ (đỡ rối mắt). */
export function renderInline(parts) {
  const total = parts.reduce((n, p) => n + p.text.length, 0);
  const changed = parts.reduce((n, p) => n + (p.changed ? p.text.length : 0), 0);
  if (total && changed / total > 0.7) return escapeHtml(parts.map((p) => p.text).join(''));
  return parts.map((p) => (p.changed ? `<mark>${escapeHtml(p.text)}</mark>` : escapeHtml(p.text))).join('');
}

/** Render kết quả diff (dùng lại cho JSON Compare). */
export function renderDiff(container, rows, { mode = 'split', onlyChanges = false, ignoreCase = false } = {}) {
  const view = onlyChanges ? foldRows(rows, 3) : rows;
  const out = [];
  const cell = (side, cls, html) => `<td class="ln">${side ? side.n : ''}</td><td class="tx ${cls}">${html}</td>`;
  const lineHtml = (s) => (s === '' ? '&#8203;' : escapeHtml(s));
  for (const r of view) {
    if (r.type === 'fold') {
      out.push(`<tr class="fold"><td colspan="${mode === 'split' ? 4 : 3}">⋯ ${r.rows.length} dòng giống nhau được ẩn</td></tr>`);
      continue;
    }
    if (mode === 'split') {
      if (r.type === 'equal' || r.type === 'equal-normalized') out.push(`<tr>${cell(r.left, '', lineHtml(r.left.text))}${cell(r.right, '', lineHtml(r.right.text))}</tr>`);
      else if (r.type === 'delete') out.push(`<tr>${cell(r.left, 'del', lineHtml(r.left.text))}${cell(null, 'empty', '')}</tr>`);
      else if (r.type === 'insert') out.push(`<tr>${cell(null, 'empty', '')}${cell(r.right, 'ins', lineHtml(r.right.text))}</tr>`);
      else {
        const d = diffInline(r.left.text, r.right.text, { ignoreCase });
        out.push(`<tr>${cell(r.left, 'del', renderInline(d.left) || '&#8203;')}${cell(r.right, 'ins', renderInline(d.right) || '&#8203;')}</tr>`);
      }
    } else {
      const uni = (sign, l, rr, cls, html) => `<tr><td class="ln">${l ? l.n : ''}</td><td class="ln">${rr ? rr.n : ''}</td><td class="tx ${cls}"><span class="sign">${sign}</span>${html}</td></tr>`;
      if (r.type === 'equal' || r.type === 'equal-normalized') out.push(uni(' ', r.left, r.right, '', lineHtml(r.left.text)));
      else if (r.type === 'delete') out.push(uni('-', r.left, null, 'del', lineHtml(r.left.text)));
      else if (r.type === 'insert') out.push(uni('+', null, r.right, 'ins', lineHtml(r.right.text)));
      else {
        const d = diffInline(r.left.text, r.right.text, { ignoreCase });
        out.push(uni('-', r.left, null, 'del', renderInline(d.left) || '&#8203;'));
        out.push(uni('+', null, r.right, 'ins', renderInline(d.right) || '&#8203;'));
      }
    }
  }
  container.innerHTML = `<table class="diff ${mode}">${mode === 'split' ? '<colgroup><col class="c-ln"><col><col class="c-ln"><col></colgroup>' : '<colgroup><col class="c-ln"><col class="c-ln"><col></colgroup>'}<tbody>${out.join('')}</tbody></table>`;
}

export function statsBadges(s) {
  if (s.identical) return h('div', { class: 'badges' }, h('span', { class: 'badge ok', 'data-testid': 'diff-identical' }, '✓ Hai bên giống nhau'));
  return h('div', { class: 'badges', 'data-testid': 'diff-stats' },
    h('span', { class: 'badge ins' }, `+${s.insert} thêm`),
    h('span', { class: 'badge del' }, `−${s.delete} xoá`),
    h('span', { class: 'badge mod' }, `~${s.modify} sửa`),
    h('span', { class: 'badge' }, `${s.equal} giống`));
}

/** Tạo unified diff dạng patch để tải xuống. */
export function toPatch(rows) {
  const lines = ['--- left', '+++ right'];
  for (const r of rows) {
    if (r.type === 'equal' || r.type === 'equal-normalized') lines.push(' ' + r.left.text);
    else if (r.type === 'delete') lines.push('-' + r.left.text);
    else if (r.type === 'insert') lines.push('+' + r.right.text);
    else { lines.push('-' + r.left.text); lines.push('+' + r.right.text); }
  }
  return lines.join('\n') + '\n';
}

export default {
  id: 'text-compare',
  name: 'Text Compare',
  icon: 'diff',
  desc: 'So sánh hai đoạn văn bản theo dòng, highlight từng từ thay đổi.',
  mount(root, ctx) {
    const opts = { mode: 'split', ignoreCase: false, ignoreWhitespace: false, trim: false, onlyChanges: false, live: true };
    const left = new Editor({ label: 'Văn bản gốc (A)', testid: 'tc-left', placeholder: 'Dán văn bản gốc…', onInput: () => changed() });
    const right = new Editor({ label: 'Văn bản mới (B)', testid: 'tc-right', placeholder: 'Dán văn bản cần so sánh…', onInput: () => changed() });
    const result = h('div', { class: 'diff-wrap', 'data-testid': 'tc-result' });
    const summary = h('div', { class: 'summary' });
    let lastRows = [];

    const compare = (record = false) => {
      if (!left.value && !right.value) { result.innerHTML = '<p class="muted center">Nhập văn bản vào hai ô để so sánh.</p>'; summary.replaceChildren(); return; }
      lastRows = diffLines(left.value, right.value, opts);
      const s = diffStats(lastRows);
      summary.replaceChildren(statsBadges(s));
      renderDiff(result, lastRows, opts);
      if (record) ctx.record(`${s.identical ? 'Giống nhau' : `+${s.insert} −${s.delete} ~${s.modify}`}`);
    };
    const changed = () => { ctx.changed(); if (opts.live) compare(); };

    const toolbar = h('div', { class: 'toolbar' },
      button('So sánh', { icon: 'diff', variant: 'primary', testid: 'tc-compare', onClick: () => compare(true) }),
      button('Đổi bên', { icon: 'swap', onClick: () => { const t = left.value; left.value = right.value; right.value = t; changed(); } }),
      button('Mẫu', { icon: 'sample', onClick: () => { left.value = SAMPLE_L; right.value = SAMPLE_R; changed(); compare(true); } }),
      segmented('Chế độ xem', [['split', 'Song song'], ['unified', 'Gộp']], opts.mode, (v) => { opts.mode = v; ctx.changed(); compare(); }),
      checkbox('Bỏ qua hoa/thường', opts.ignoreCase, (v) => { opts.ignoreCase = v; changed(); }, 'tc-ignore-case'),
      checkbox('Bỏ qua khoảng trắng', opts.ignoreWhitespace, (v) => { opts.ignoreWhitespace = v; changed(); }, 'tc-ignore-ws'),
      checkbox('Trim đầu/cuối dòng', opts.trim, (v) => { opts.trim = v; changed(); }),
      checkbox('Chỉ hiện thay đổi', opts.onlyChanges, (v) => { opts.onlyChanges = v; ctx.changed(); compare(); }, 'tc-only-changes'),
      button('Tải .patch', { icon: 'download', onClick: () => { if (!lastRows.length) return toast('Chưa có kết quả', 'warn'); download(toPatch(lastRows), 'diff.patch'); } }));
    const modeSeg = toolbar.querySelector('.segmented');
    const checks = [...toolbar.querySelectorAll('label.check input')];

    root.append(toolbar, h('div', { class: 'grid-2' }, left.el, right.el), summary, result);
    compare();

    return {
      run: () => compare(true),
      getData: () => ({ left: left.value, right: right.value, opts: { ...opts } }),
      setData: (d) => {
        if (!d) return;
        left.value = d.left || ''; right.value = d.right || '';
        Object.assign(opts, d.opts || {});
        modeSeg.setValue(opts.mode);
        [opts.ignoreCase, opts.ignoreWhitespace, opts.trim, opts.onlyChanges].forEach((v, i) => { checks[i].checked = !!v; });
        compare();
      },
    };
  },
};
