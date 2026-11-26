import { h, Editor, button, checkbox, debounce, toast, formatBytes } from '../ui.js';
import { parse, stringify, stats, detectFormat, JsonError } from '../lib/json.js';
import { errorBox, okBox, warnList, SAMPLE_JSON, SAMPLE_BAD_JSON } from './common.js';

export default {
  id: 'json-checker',
  name: 'JSON Checker',
  icon: 'check',
  desc: 'Kiểm tra cú pháp (syntax) và định dạng (format) JSON, chỉ đúng dòng/cột lỗi, tự sửa lỗi phổ biến.',
  mount(root, ctx) {
    const opts = { live: true };
    const editor = new Editor({ label: 'JSON', testid: 'jc-input', placeholder: 'Dán JSON cần kiểm tra…', filename: 'data.json', onInput: () => { ctx.changed(); if (opts.live) liveCheck(); } });
    const result = h('div', { class: 'result', 'data-testid': 'jc-result' });

    const check = (record = false) => {
      const text = editor.value;
      result.replaceChildren();
      if (!text.trim()) { result.append(h('p', { class: 'muted' }, 'Nhập JSON để kiểm tra.')); return null; }
      try {
        const { ast, warnings } = parse(text);
        const s = stats(ast);
        const f = detectFormat(text, ast);
        result.append(
          okBox('JSON hợp lệ',
            h('dl', { class: 'kv' },
              h('dt', {}, 'Kiểu gốc'), h('dd', {}, ast.t),
              h('dt', {}, 'Định dạng'), h('dd', { 'data-testid': 'jc-format' }, f.label),
              h('dt', {}, 'Kích thước'), h('dd', {}, formatBytes(new TextEncoder().encode(text).length)),
              h('dt', {}, 'Object / Array'), h('dd', {}, `${s.objects} / ${s.arrays}`),
              h('dt', {}, 'Số key'), h('dd', {}, String(s.keys)),
              h('dt', {}, 'Giá trị'), h('dd', {}, `${s.strings} chuỗi · ${s.numbers} số · ${s.booleans} boolean · ${s.nulls} null`),
              h('dt', {}, 'Độ sâu tối đa'), h('dd', {}, String(s.maxDepth)))),
          warnList(warnings));
        if (record) ctx.record(`Hợp lệ · ${f.label}`);
        return ast;
      } catch (e) {
        if (!(e instanceof JsonError)) throw e;
        editor.setError(e.line);
        result.append(errorBox(e, text, { onJump: (p) => editor.jumpTo(p) }));
        let fixable = false;
        try { parse(text, { loose: true }); fixable = true; } catch { /* không sửa được */ }
        if (fixable) result.append(h('div', { class: 'alert info' }, 'Có thể tự sửa lỗi này — bấm ', h('strong', {}, 'Tự sửa lỗi'), '.'));
        if (record) ctx.record(`Lỗi dòng ${e.line}: ${e.message}`);
        return null;
      }
    };
    const liveCheck = debounce(() => check(false), 250);

    const fix = () => {
      try {
        const { ast, fixes } = parse(editor.value, { loose: true });
        editor.value = stringify(ast, { indent: 2 });
        ctx.changed();
        check(true);
        toast(fixes.length ? `Đã sửa: ${fixes.join(', ')}` : 'Không có lỗi cần sửa', 'ok');
      } catch (e) {
        if (e instanceof JsonError) { toast(`Không tự sửa được: ${e.message}`, 'error'); editor.setError(e.line); }
        else throw e;
      }
    };

    root.append(
      h('div', { class: 'toolbar' },
        button('Kiểm tra', { icon: 'check', variant: 'primary', testid: 'jc-check', onClick: () => check(true) }),
        button('Tự sửa lỗi', { icon: 'sample', testid: 'jc-fix', onClick: fix }),
        button('Format đẹp', { icon: 'format', onClick: () => { const ast = check(); if (ast) { editor.value = stringify(ast, { indent: 2 }); ctx.changed(); check(); } } }),
        button('Mẫu hợp lệ', { onClick: () => { editor.value = SAMPLE_JSON; ctx.changed(); check(true); } }),
        button('Mẫu lỗi', { testid: 'jc-sample-bad', onClick: () => { editor.value = SAMPLE_BAD_JSON; ctx.changed(); check(true); } }),
        checkbox('Kiểm tra khi gõ', opts.live, (v) => { opts.live = v; })),
      h('div', { class: 'grid-2 wide-left' }, editor.el, result));
    check();

    return {
      run: () => check(true),
      getData: () => ({ input: editor.value }),
      setData: (d) => { if (d) { editor.value = d.input || ''; check(); } },
    };
  },
};
