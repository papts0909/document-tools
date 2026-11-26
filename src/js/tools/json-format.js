import { h, Editor, button, checkbox, select, segmented, debounce, formatBytes, escapeHtml } from '../ui.js';
import { parse, stringify, JsonError } from '../lib/json.js';
import { errorBox, okBox, SAMPLE_JSON } from './common.js';

function treeNode(node, key, depth = 0) {
  const k = key != null ? h('span', { class: 'tk' }, typeof key === 'number' ? `${key}` : JSON.stringify(key), ': ') : null;
  if (node.t === 'object' || node.t === 'array') {
    const kids = node.t === 'object' ? node.entries.map((e) => treeNode(e.value, e.key, depth + 1)) : node.items.map((it, i) => treeNode(it, i, depth + 1));
    const n = node.t === 'object' ? node.entries.length : node.items.length;
    const brace = node.t === 'object' ? ['{', '}'] : ['[', ']'];
    const d = h('details', { open: depth < 2 || null },
      h('summary', {}, k, h('span', { class: 'tb' }, brace[0]), h('span', { class: 'tc' }, ` ${n} ${node.t === 'object' ? 'key' : 'phần tử'} `), h('span', { class: 'tb' }, brace[1])),
      h('div', { class: 'tchildren' }, kids));
    return d;
  }
  const cls = { string: 'ts', number: 'tn', boolean: 'tbool', null: 'tnull' }[node.t];
  return h('div', { class: 'tleaf' }, k, h('span', { class: cls, html: escapeHtml(stringify(node, { indent: 0 })) }));
}

function makeTool({ id, name, icon, desc, minify }) {
  return {
    id, name, icon, desc,
    mount(root, ctx) {
      const opts = { indent: '2', sortKeys: false, loose: false, view: 'text' };
      const input = new Editor({ label: 'Input JSON', testid: `${id}-input`, placeholder: 'Dán JSON…', filename: 'input.json', onInput: () => { ctx.changed(); live(); } });
      const output = new Editor({ label: minify ? 'Kết quả (minified)' : 'Kết quả', testid: `${id}-output`, readOnly: true, filename: minify ? 'data.min.json' : 'data.json', actions: ['copy', 'download', 'wrap'], wrap: minify });
      const tree = h('div', { class: 'tree', 'data-testid': `${id}-tree` });
      const status = h('div', { class: 'status' });
      const outWrap = h('div', { class: 'out-wrap' }, output.el, tree);

      const run = (record = false) => {
        status.replaceChildren();
        const text = input.value;
        if (!text.trim()) { output.value = ''; tree.replaceChildren(); return; }
        try {
          const { ast, fixes } = parse(text, { loose: opts.loose });
          const indent = minify ? 0 : opts.indent === 'tab' ? '\t' : Number(opts.indent);
          const out = stringify(ast, { indent, sortKeys: opts.sortKeys });
          output.value = out;
          const inB = new TextEncoder().encode(text).length, outB = new TextEncoder().encode(out).length;
          const pct = inB ? Math.round((1 - outB / inB) * 100) : 0;
          status.append(okBox(minify ? `Đã minify: ${formatBytes(inB)} → ${formatBytes(outB)} (giảm ${pct}%)` : `Đã format: ${formatBytes(inB)} → ${formatBytes(outB)}`,
            fixes.length ? h('div', { class: 'alert-hint' }, `Đã tự sửa: ${fixes.join(', ')}`) : null));
          if (!minify && opts.view === 'tree') tree.replaceChildren(treeNode(ast));
          if (record) ctx.record(minify ? `Minify ${formatBytes(inB)} → ${formatBytes(outB)}` : `Format indent ${opts.indent}${opts.sortKeys ? ', sort keys' : ''}`);
        } catch (e) {
          if (!(e instanceof JsonError)) throw e;
          input.setError(e.line);
          output.value = '';
          tree.replaceChildren();
          status.append(errorBox(e, text, { onJump: (p) => input.jumpTo(p) }));
        }
      };
      const live = debounce(() => run(false), 250);
      const applyView = () => { outWrap.dataset.view = opts.view; if (opts.view === 'tree') run(); };

      const controls = [
        button(minify ? 'Minify' : 'Format', { icon: minify ? 'minify' : 'format', variant: 'primary', testid: `${id}-run`, onClick: () => run(true) }),
        button('Mẫu', { icon: 'sample', onClick: () => { input.value = SAMPLE_JSON; ctx.changed(); run(true); } }),
      ];
      let indentSel, viewSeg;
      if (!minify) {
        indentSel = select('Thụt lề', [['2', '2 spaces'], ['4', '4 spaces'], ['tab', 'Tab'], ['1', '1 space']], opts.indent, (v) => { opts.indent = v; ctx.changed(); run(); }, `${id}-indent`);
        controls.push(indentSel);
        viewSeg = segmented('Hiển thị', [['text', 'Văn bản'], ['tree', 'Dạng cây']], opts.view, (v) => { opts.view = v; ctx.changed(); applyView(); });
        controls.push(viewSeg);
      }
      const sortCb = checkbox('Sắp xếp key A→Z', opts.sortKeys, (v) => { opts.sortKeys = v; ctx.changed(); run(); }, `${id}-sort`);
      const looseCb = checkbox('Tự sửa lỗi (comment, dấu phẩy thừa, nháy đơn…)', opts.loose, (v) => { opts.loose = v; ctx.changed(); run(); }, `${id}-loose`);
      controls.push(sortCb, looseCb);
      if (!minify) controls.push(button('Dùng kết quả làm input', { icon: 'swap', onClick: () => { if (output.value) { input.value = output.value; ctx.changed(); run(); } } }));

      root.append(h('div', { class: 'toolbar' }, controls), h('div', { class: 'grid-2' }, input.el, outWrap), status);
      applyView();
      run();

      return {
        run: () => run(true),
        getData: () => ({ input: input.value, opts: { ...opts } }),
        setData: (d) => {
          if (!d) return;
          input.value = d.input || '';
          Object.assign(opts, d.opts || {});
          if (indentSel) indentSel.input.value = opts.indent;
          if (viewSeg) viewSeg.setValue(opts.view);
          sortCb.input.checked = !!opts.sortKeys;
          looseCb.input.checked = !!opts.loose;
          applyView();
          run();
        },
      };
    },
  };
}

export const jsonFormatter = makeTool({ id: 'json-formatter', name: 'JSON Formatter', icon: 'format', desc: 'Làm đẹp JSON: chọn thụt lề, sắp xếp key, xem dạng cây, giữ nguyên số lớn.', minify: false });
export const jsonMinify = makeTool({ id: 'json-minify', name: 'JSON Minify', icon: 'minify', desc: 'Nén JSON về một dòng, loại bỏ mọi khoảng trắng thừa.', minify: true });
