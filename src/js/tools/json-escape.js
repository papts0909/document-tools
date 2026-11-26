import { h, Editor, button, checkbox, segmented, debounce } from '../ui.js';
import { escapeString, unescapeString, parse, stringify, JsonError } from '../lib/json.js';
import { errorBox } from './common.js';

const SAMPLE_ESC = '{\n  "user": "Nguyễn Văn A",\n  "note": "Xin chào \\"bạn\\"",\n  "path": "C:\\\\temp"\n}';

export default {
  id: 'json-escape',
  name: 'JSON Escape & Unescape',
  icon: 'escape',
  desc: 'Escape văn bản thành chuỗi JSON hợp lệ (\\" \\n \\t…) và ngược lại.',
  mount(root, ctx) {
    const opts = { mode: 'escape', quotes: false, unicode: false, prettyJson: true };
    const input = new Editor({ label: 'Input', testid: 'esc-input', placeholder: 'Nhập văn bản…', onInput: () => { ctx.changed(); live(); } });
    const output = new Editor({ label: 'Kết quả', testid: 'esc-output', readOnly: true, actions: ['copy', 'download', 'wrap'], wrap: true });
    const status = h('div', { class: 'status' });

    const run = (record = false) => {
      status.replaceChildren();
      const text = input.value;
      if (!text) { output.value = ''; return; }
      if (opts.mode === 'escape') {
        output.value = escapeString(text, { quotes: opts.quotes, unicode: opts.unicode });
        if (record) ctx.record('Escape');
        return;
      }
      try {
        let out = unescapeString(text);
        let note = null;
        if (opts.prettyJson && /^\s*[[{]/.test(out)) {
          try { out = stringify(parse(out).ast, { indent: 2 }); note = 'Kết quả là JSON — đã format đẹp.'; } catch { /* không phải JSON */ }
        }
        output.value = out;
        if (note) status.append(h('div', { class: 'alert info', 'data-testid': 'esc-json-note' }, note));
        if (record) ctx.record('Unescape');
      } catch (e) {
        if (!(e instanceof JsonError)) throw e;
        output.value = '';
        input.setError(e.line);
        status.append(errorBox(e, text, { title: 'Chuỗi escape không hợp lệ', onJump: (p) => input.jumpTo(p) }));
      }
    };
    const live = debounce(() => run(false), 200);

    const quotesCb = checkbox('Bao trong nháy kép', opts.quotes, (v) => { opts.quotes = v; ctx.changed(); run(); }, 'esc-quotes');
    const uniCb = checkbox('Escape Unicode (\\uXXXX)', opts.unicode, (v) => { opts.unicode = v; ctx.changed(); run(); }, 'esc-unicode');
    const prettyCb = checkbox('Format nếu kết quả là JSON', opts.prettyJson, (v) => { opts.prettyJson = v; ctx.changed(); run(); });
    const escOpts = h('span', { class: 'group' }, quotesCb, uniCb);
    const unOpts = h('span', { class: 'group' }, prettyCb);
    const sync = () => { escOpts.style.display = opts.mode === 'escape' ? '' : 'none'; unOpts.style.display = opts.mode === 'unescape' ? '' : 'none'; };
    const modeSeg = segmented('Chế độ', [['escape', 'Escape'], ['unescape', 'Unescape']], opts.mode, (v) => { opts.mode = v; sync(); ctx.changed(); run(); });

    root.append(
      h('div', { class: 'toolbar' },
        modeSeg,
        button('Chạy', { icon: 'escape', variant: 'primary', testid: 'esc-run', onClick: () => run(true) }),
        button('Đảo chiều', { icon: 'swap', testid: 'esc-swap', onClick: () => { const out = output.value; opts.mode = opts.mode === 'escape' ? 'unescape' : 'escape'; modeSeg.setValue(opts.mode); sync(); input.value = out; ctx.changed(); run(); } }),
        button('Mẫu', { icon: 'sample', onClick: () => { opts.mode = 'escape'; modeSeg.setValue('escape'); sync(); input.value = SAMPLE_ESC; ctx.changed(); run(true); } }),
        escOpts, unOpts),
      h('div', { class: 'grid-2' }, input.el, output.el),
      status);
    sync();
    run();

    return {
      run: () => run(true),
      getData: () => ({ input: input.value, opts: { ...opts } }),
      setData: (d) => {
        if (!d) return;
        input.value = d.input || '';
        Object.assign(opts, d.opts || {});
        modeSeg.setValue(opts.mode); quotesCb.input.checked = !!opts.quotes; uniCb.input.checked = !!opts.unicode; prettyCb.input.checked = !!opts.prettyJson;
        sync(); run();
      },
    };
  },
};
