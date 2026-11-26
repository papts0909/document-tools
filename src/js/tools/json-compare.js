import { h, Editor, button, checkbox, segmented, debounce, copyText } from '../ui.js';
import { parse, stringify, deepDiff, preview, JsonError } from '../lib/json.js';
import { diffLines, diffStats } from '../lib/diff.js';
import { renderDiff } from './text-compare.js';
import { errorBox } from './common.js';

const SAMPLE_L = `{
  "id": 1,
  "name": "Sản phẩm A",
  "price": 100,
  "tags": ["new", "hot"],
  "stock": { "hn": 10, "hcm": 5 },
  "discontinued": false
}`;
const SAMPLE_R = `{
  "name": "Sản phẩm A",
  "id": 1,
  "price": 120,
  "tags": ["new"],
  "stock": { "hn": 10, "hcm": "5", "dn": 3 },
  "rating": 4.5
}`;

const KIND = {
  added: ['ins', '+ Thêm'],
  removed: ['del', '− Xoá'],
  changed: ['mod', '~ Sửa'],
  type: ['mod', '≠ Kiểu'],
};

export default {
  id: 'json-compare',
  name: 'JSON Compare',
  icon: 'compare',
  desc: 'So sánh cấu trúc hai JSON (bỏ qua thứ tự key), liệt kê khác biệt theo đường dẫn.',
  mount(root, ctx) {
    const opts = { ignoreArrayOrder: false, view: 'list', loose: false };
    const left = new Editor({ label: 'JSON A', testid: 'jcmp-left', placeholder: 'JSON gốc…', filename: 'a.json', onInput: () => { ctx.changed(); live(); } });
    const right = new Editor({ label: 'JSON B', testid: 'jcmp-right', placeholder: 'JSON cần so sánh…', filename: 'b.json', onInput: () => { ctx.changed(); live(); } });
    const result = h('div', { class: 'result', 'data-testid': 'jcmp-result' });

    const parseSide = (ed, label) => {
      try { return parse(ed.value, { loose: opts.loose }).ast; }
      catch (e) {
        if (!(e instanceof JsonError)) throw e;
        ed.setError(e.line);
        result.append(errorBox(e, ed.value, { title: `${label} không hợp lệ`, onJump: (p) => ed.jumpTo(p) }));
        return null;
      }
    };

    const run = (record = false) => {
      result.replaceChildren();
      if (!left.value.trim() || !right.value.trim()) { result.append(h('p', { class: 'muted' }, 'Nhập JSON vào cả hai ô để so sánh.')); return; }
      const a = parseSide(left, 'JSON A'), b = parseSide(right, 'JSON B');
      if (!a || !b) return;
      const diffs = deepDiff(a, b, { ignoreArrayOrder: opts.ignoreArrayOrder });
      const counts = { added: 0, removed: 0, changed: 0, type: 0 };
      diffs.forEach((d) => counts[d.kind]++);
      if (!diffs.length) {
        result.append(h('div', { class: 'alert ok', 'data-testid': 'jcmp-equal' }, h('div', { class: 'alert-title' }, '✓ Hai JSON tương đương về dữ liệu'), h('div', { class: 'muted' }, 'Thứ tự key và khoảng trắng không ảnh hưởng.')));
      } else {
        result.append(h('div', { class: 'badges', 'data-testid': 'jcmp-stats' },
          h('span', { class: 'badge' }, `${diffs.length} khác biệt`),
          h('span', { class: 'badge ins' }, `+${counts.added} thêm`),
          h('span', { class: 'badge del' }, `−${counts.removed} xoá`),
          h('span', { class: 'badge mod' }, `~${counts.changed + counts.type} sửa`)));
      }
      if (opts.view === 'list' && diffs.length) {
        result.append(h('table', { class: 'difflist', 'data-testid': 'jcmp-list' },
          h('thead', {}, h('tr', {}, h('th', {}, 'Loại'), h('th', {}, 'Đường dẫn'), h('th', {}, 'A'), h('th', {}, 'B'))),
          h('tbody', {}, diffs.map((d) => h('tr', { class: KIND[d.kind][0] },
            h('td', {}, h('span', { class: `badge ${KIND[d.kind][0]}` }, KIND[d.kind][1])),
            h('td', { class: 'path' }, h('code', { title: 'Bấm để copy đường dẫn', onClick: () => copyText(d.path) }, d.path)),
            h('td', { class: 'val' }, d.left ? h('code', {}, preview(d.left)) : h('span', { class: 'muted' }, '—')),
            h('td', { class: 'val' }, d.right ? h('code', {}, preview(d.right)) : h('span', { class: 'muted' }, '—')))))));
      } else if (opts.view === 'text') {
        const la = stringify(a, { indent: 2, sortKeys: true }), lb = stringify(b, { indent: 2, sortKeys: true });
        const rows = diffLines(la, lb);
        const wrap = h('div', { class: 'diff-wrap', 'data-testid': 'jcmp-textdiff' });
        renderDiff(wrap, rows, { mode: 'split' });
        result.append(h('p', { class: 'muted small' }, `So sánh văn bản sau khi chuẩn hoá (sắp xếp key, thụt lề 2): ${diffStats(rows).equal} dòng giống.`), wrap);
      }
      if (record) ctx.record(diffs.length ? `${diffs.length} khác biệt` : 'Tương đương');
    };
    const live = debounce(() => run(false), 300);

    const viewSeg = segmented('Hiển thị', [['list', 'Danh sách khác biệt'], ['text', 'Văn bản song song']], opts.view, (v) => { opts.view = v; ctx.changed(); run(); });
    const orderCb = checkbox('Bỏ qua thứ tự phần tử mảng', opts.ignoreArrayOrder, (v) => { opts.ignoreArrayOrder = v; ctx.changed(); run(); }, 'jcmp-ignore-order');
    const looseCb = checkbox('Cho phép JSON lỏng (comment, dấu phẩy thừa…)', opts.loose, (v) => { opts.loose = v; ctx.changed(); run(); });
    root.append(
      h('div', { class: 'toolbar' },
        button('So sánh', { icon: 'compare', variant: 'primary', testid: 'jcmp-run', onClick: () => run(true) }),
        button('Đổi bên', { icon: 'swap', onClick: () => { const t = left.value; left.value = right.value; right.value = t; ctx.changed(); run(); } }),
        button('Mẫu', { icon: 'sample', onClick: () => { left.value = SAMPLE_L; right.value = SAMPLE_R; ctx.changed(); run(true); } }),
        viewSeg, orderCb, looseCb),
      h('div', { class: 'grid-2' }, left.el, right.el),
      result);
    run();

    return {
      run: () => run(true),
      getData: () => ({ left: left.value, right: right.value, opts: { ...opts } }),
      setData: (d) => {
        if (!d) return;
        left.value = d.left || ''; right.value = d.right || '';
        Object.assign(opts, d.opts || {});
        viewSeg.setValue(opts.view); orderCb.input.checked = !!opts.ignoreArrayOrder; looseCb.input.checked = !!opts.loose;
        run();
      },
    };
  },
};
