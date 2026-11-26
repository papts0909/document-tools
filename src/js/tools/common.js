import { h, escapeHtml } from '../ui.js';

export const SAMPLE_JSON = `{
  "id": 9007199254740993,
  "name": "DevTools PWA",
  "version": "1.0.0",
  "active": true,
  "tags": ["json", "diff", "base64"],
  "owner": { "name": "Nguyễn Văn A", "email": "a@example.com" },
  "price": 12.50,
  "meta": null
}`;

export const SAMPLE_BAD_JSON = `{
  // cấu hình
  name: 'DevTools',
  "tags": ["json", "diff",],
  "active": True,
  "count": 10
  "owner": { "name": "A" },
}`;

/** Hộp hiển thị lỗi JSON có đoạn trích + mũi tên chỉ vị trí. */
export function errorBox(err, text, { onJump, title = 'JSON không hợp lệ' } = {}) {
  const lines = text.split('\n');
  const ln = err.line || 1;
  const from = Math.max(1, ln - 2), to = Math.min(lines.length, ln + 1);
  const snippet = [];
  for (let i = from; i <= to; i++) {
    const t = lines[i - 1] ?? '';
    snippet.push(`<div class="${i === ln ? 'hl' : ''}"><span class="ln">${i}</span>${escapeHtml(t.replace(/\t/g, '  ')) || '&#8203;'}</div>`);
    if (i === ln) {
      const before = t.slice(0, Math.max(0, (err.column || 1) - 1)).replace(/\t/g, '  ');
      snippet.push(`<div class="caret"><span class="ln"></span>${' '.repeat(before.length)}^</div>`);
    }
  }
  return h('div', { class: 'alert error', role: 'alert', 'data-testid': 'json-error' },
    h('div', { class: 'alert-title' }, `✗ ${title}`),
    h('div', { class: 'alert-msg' }, h('strong', {}, `Dòng ${err.line}, cột ${err.column}: `), err.message),
    err.hint ? h('div', { class: 'alert-hint' }, `💡 ${err.hint}`) : null,
    err.line ? h('pre', { class: 'snippet', html: snippet.join('') }) : null,
    onJump && err.pos != null ? h('button', { type: 'button', class: 'link', onClick: () => onJump(err.pos) }, 'Đi tới vị trí lỗi →') : null);
}

export function okBox(title, ...children) {
  return h('div', { class: 'alert ok', role: 'status', 'data-testid': 'json-ok' }, h('div', { class: 'alert-title' }, `✓ ${title}`), ...children);
}

export function warnList(warnings, onJump) {
  if (!warnings.length) return null;
  return h('div', { class: 'alert warn', 'data-testid': 'json-warnings' },
    h('div', { class: 'alert-title' }, `⚠ ${warnings.length} cảnh báo`),
    h('ul', {}, warnings.map((w) => h('li', {}, `Dòng ${w.line}, cột ${w.column}: ${w.message}`))));
}
