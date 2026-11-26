// Helper dựng DOM + các component dùng chung (Editor có số dòng, toast, copy, download).

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v == null) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') el.innerHTML = v;
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export const ICONS = {
  home: '<path d="M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  diff: '<path d="M8 3v12M4 7h8M14 17h8M16 3l-2 2 2 2M8 21l2-2-2-2"/><rect x="3" y="3" width="18" height="18" rx="2" fill="none"/>',
  check: '<path d="M4 12l5 5L20 6"/>',
  compare: '<path d="M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h5M14 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5M12 2v20"/>',
  format: '<path d="M4 6h16M8 12h12M8 18h12M4 12h0M4 18h0"/>',
  minify: '<path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7"/>',
  base64: '<path d="M7 8l-4 4 4 4M17 8l4 4-4 4M14 4l-4 16"/>',
  escape: '<path d="M7 4c-2 0-3 1-3 3v3l-2 2 2 2v3c0 2 1 3 3 3M17 4c2 0 3 1 3 3v3l2 2-2 2v3c0 2-1 3-3 3"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>',
  paste: '<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>',
  download: '<path d="M12 4v12M7 11l5 5 5-5M4 20h16"/>',
  swap: '<path d="M7 4L3 8l4 4M3 8h18M17 20l4-4-4-4M21 16H3"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 3"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  sample: '<path d="M9 3h6M10 3v6L4 19a1 1 0 0 0 1 2h14a1 1 0 0 0 1-2l-6-10V3"/>',
  wrap: '<path d="M3 6h18M3 12h15a3 3 0 0 1 0 6h-4M16 16l-2 2 2 2M3 18h7"/>',
};

export function icon(name, cls = 'icon') {
  const span = document.createElement('span');
  span.className = cls;
  span.setAttribute('aria-hidden', 'true');
  span.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ''}</svg>`;
  return span;
}

export function button(label, { icon: ic, onClick, variant = '', title, testid, iconOnly = false } = {}) {
  return h('button', {
    type: 'button',
    class: `btn ${variant} ${iconOnly ? 'icon-only' : ''}`.trim(),
    title: title || (iconOnly ? label : null),
    'aria-label': iconOnly ? label : null,
    'data-testid': testid,
    onClick,
  }, ic && icon(ic), !iconOnly && h('span', {}, label));
}

let toastTimer;
export function toast(message, type = 'info') {
  let el = document.getElementById('toast');
  if (!el) { el = h('div', { id: 'toast', role: 'status', 'aria-live': 'polite' }); document.body.append(el); }
  el.textContent = message;
  el.className = `show ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = ''; }, 2400);
}

export async function copyText(text) {
  if (!text) { toast('Không có gì để copy', 'warn'); return false; }
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = h('textarea', { style: { position: 'fixed', opacity: '0' } });
    ta.value = text;
    document.body.append(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  toast('Đã copy vào clipboard', 'ok');
  return true;
}

export async function readClipboard() {
  try { return await navigator.clipboard.readText(); } catch { toast('Trình duyệt không cho phép đọc clipboard — hãy dùng Ctrl+V', 'warn'); return null; }
}

export function download(content, filename, mime = 'text/plain;charset=utf-8') {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function pickFile({ accept = '', asText = true } = {}) {
  return new Promise((resolve) => {
    const input = h('input', { type: 'file', accept, style: { display: 'none' } });
    input.addEventListener('change', async () => {
      const f = input.files[0];
      input.remove();
      if (!f) return resolve(null);
      resolve({ file: f, content: asText ? await f.text() : new Uint8Array(await f.arrayBuffer()) });
    });
    document.body.append(input);
    input.click();
  });
}

export function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

export function debounce(fn, ms) {
  let t;
  const d = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  d.flush = (...a) => { clearTimeout(t); fn(...a); };
  return d;
}

/**
 * Editor: textarea + gutter số dòng, kéo thả file, đánh dấu dòng lỗi.
 */
export class Editor {
  constructor({ label, placeholder = '', readOnly = false, testid, onInput, actions = ['paste', 'upload', 'copy', 'clear'], filename = 'data.txt', wrap = false, extraActions = [] } = {}) {
    this.onInput = onInput;
    this.filename = filename;
    this.gutter = h('div', { class: 'gutter', 'aria-hidden': 'true' });
    this.ta = h('textarea', {
      class: 'code', spellcheck: 'false', autocomplete: 'off', autocapitalize: 'off',
      placeholder, 'data-testid': testid, 'aria-label': label, readonly: readOnly || null,
      wrap: wrap ? 'soft' : 'off',
    });
    this.info = h('span', { class: 'editor-info' });
    const acts = [];
    if (actions.includes('paste') && !readOnly) acts.push(button('Dán', { icon: 'paste', iconOnly: true, onClick: async () => { const t = await readClipboard(); if (t != null) { this.value = t; this.emit(); } } }));
    if (actions.includes('upload') && !readOnly) acts.push(button('Mở file', { icon: 'upload', iconOnly: true, onClick: async () => { const r = await pickFile(); if (r) { this.value = r.content; this.emit(); toast(`Đã mở ${r.file.name}`); } } }));
    if (actions.includes('wrap')) acts.push(button('Ngắt dòng', { icon: 'wrap', iconOnly: true, onClick: () => this.toggleWrap() }));
    acts.push(...extraActions);
    if (actions.includes('copy')) acts.push(button('Copy', { icon: 'copy', iconOnly: true, testid: testid && `${testid}-copy`, onClick: () => copyText(this.value) }));
    if (actions.includes('download')) acts.push(button('Tải xuống', { icon: 'download', iconOnly: true, onClick: () => download(this.value, this.filename) }));
    if (actions.includes('clear') && !readOnly) acts.push(button('Xoá', { icon: 'trash', iconOnly: true, onClick: () => { this.value = ''; this.emit(); this.ta.focus(); } }));

    this.wrapEl = h('div', { class: 'editor-body' }, this.gutter, this.ta);
    this.el = h('div', { class: `editor ${readOnly ? 'readonly' : ''}` },
      h('div', { class: 'editor-head' }, h('span', { class: 'editor-label' }, label), this.info, h('span', { class: 'editor-actions' }, acts)),
      this.wrapEl);
    this.errorLine = 0;
    this.ta.addEventListener('input', () => this.emit());
    this.ta.addEventListener('scroll', () => { this.gutter.scrollTop = this.ta.scrollTop; });
    this.ta.addEventListener('keydown', (e) => {
      if (e.key === 'Tab' && !e.ctrlKey && !e.metaKey && !readOnly) {
        e.preventDefault();
        const { selectionStart: s, selectionEnd: en } = this.ta;
        this.ta.setRangeText('  ', s, en, 'end');
        this.emit();
      }
    });
    this.el.addEventListener('dragover', (e) => { e.preventDefault(); this.el.classList.add('drag'); });
    this.el.addEventListener('dragleave', () => this.el.classList.remove('drag'));
    this.el.addEventListener('drop', async (e) => {
      e.preventDefault();
      this.el.classList.remove('drag');
      if (readOnly) return;
      const f = e.dataTransfer.files[0];
      if (f) { this.value = await f.text(); this.emit(); toast(`Đã mở ${f.name}`); }
      else { const t = e.dataTransfer.getData('text'); if (t) { this.value = t; this.emit(); } }
    });
    if (wrap) this.el.classList.add('wrap');
    this.renderGutter();
  }

  toggleWrap() {
    const on = !this.el.classList.contains('wrap');
    this.el.classList.toggle('wrap', on);
    this.ta.setAttribute('wrap', on ? 'soft' : 'off');
    this.renderGutter();
  }

  get value() { return this.ta.value; }
  set value(v) { this.ta.value = v ?? ''; this.setError(0); this.renderGutter(); }

  emit() { this.setError(0); this.renderGutter(); this.onInput && this.onInput(this.value); }

  renderGutter() {
    const text = this.ta.value;
    let lines = 1;
    for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) lines++;
    const wrapped = this.el && this.el.classList.contains('wrap');
    this.gutter.style.display = wrapped ? 'none' : '';
    if (!wrapped) {
      const max = Math.min(lines, 100000);
      if (this._lines !== max || this._err !== this.errorLine) {
        const parts = [];
        for (let i = 1; i <= max; i++) parts.push(i === this.errorLine ? `<div class="err">${i}</div>` : `<div>${i}</div>`);
        this.gutter.innerHTML = parts.join('');
        this._lines = max; this._err = this.errorLine;
      }
      this.gutter.scrollTop = this.ta.scrollTop;
    }
    const chars = text.length;
    this.info.textContent = chars ? `${lines.toLocaleString()} dòng · ${formatBytes(new TextEncoder().encode(text).length)}` : '';
  }

  setError(line) { this.errorLine = line || 0; this.el.classList.toggle('has-error', !!line); this.renderGutter(); }

  /** Đưa con trỏ tới vị trí (offset) và cuộn tới. */
  jumpTo(pos) {
    const ta = this.ta;
    ta.focus();
    ta.setSelectionRange(pos, Math.min(pos + 1, ta.value.length));
    const before = ta.value.slice(0, pos);
    const line = before.split('\n').length;
    const lh = parseFloat(getComputedStyle(ta).lineHeight) || 20;
    ta.scrollTop = Math.max(0, (line - 5) * lh);
  }
}

export function segmented(name, options, value, onChange) {
  const wrap = h('div', { class: 'segmented', role: 'radiogroup', 'aria-label': name });
  const set = (v) => { wrap.querySelectorAll('button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.value === String(v)))); };
  for (const [v, label] of options) {
    wrap.append(h('button', { type: 'button', role: 'radio', 'data-value': String(v), onClick: () => { set(v); onChange(v); } }, label));
  }
  set(value);
  wrap.setValue = set;
  return wrap;
}

export function checkbox(label, checked, onChange, testid) {
  const input = h('input', { type: 'checkbox', 'data-testid': testid });
  input.checked = !!checked;
  input.addEventListener('change', () => onChange(input.checked));
  const el = h('label', { class: 'check' }, input, h('span', {}, label));
  el.input = input;
  return el;
}

export function select(label, options, value, onChange, testid) {
  const s = h('select', { 'data-testid': testid, 'aria-label': label });
  for (const [v, t] of options) s.append(h('option', { value: String(v) }, t));
  s.value = String(value);
  s.addEventListener('change', () => onChange(s.value));
  const el = h('label', { class: 'select' }, h('span', {}, label), s);
  el.input = s;
  return el;
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
