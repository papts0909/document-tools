import { h, Editor, button, checkbox, segmented, debounce, toast, pickFile, download, formatBytes } from '../ui.js';
import { encodeText, decodeToText, bytesToBase64, sniffMime, hexPreview, Base64Error } from '../lib/base64.js';

export default {
  id: 'base64',
  name: 'Base64 Encode / Decode',
  icon: 'base64',
  desc: 'Mã hoá / giải mã Base64 hỗ trợ UTF-8, URL-safe, file & ảnh.',
  mount(root, ctx) {
    const opts = { mode: 'encode', urlSafe: false, wrap: false, noPad: false, dataUri: false };
    const input = new Editor({ label: 'Input', testid: 'b64-input', wrap: true, placeholder: 'Nhập văn bản hoặc chuỗi Base64…', onInput: () => { ctx.changed(); live(); } });
    const output = new Editor({ label: 'Kết quả', testid: 'b64-output', wrap: true, readOnly: true, actions: ['copy', 'download'], filename: 'output.txt' });
    const status = h('div', { class: 'status', 'data-testid': 'b64-status' });
    const preview = h('div', { class: 'preview' });
    let fileBytes = null, fileName = '', lastBytes = null;

    const run = (record = false) => {
      status.replaceChildren(); preview.replaceChildren();
      lastBytes = null;
      const text = input.value;
      if (!text && !fileBytes) { output.value = ''; return; }
      try {
        if (opts.mode === 'encode') {
          const o = { urlSafe: opts.urlSafe, wrap: opts.wrap ? 76 : 0, padding: !opts.noPad };
          let out = fileBytes ? bytesToBase64(fileBytes, o) : encodeText(text, o);
          if (opts.dataUri) {
            const mime = fileBytes ? ((sniffMime(fileBytes) || {}).mime || 'application/octet-stream') : 'text/plain;charset=utf-8';
            out = `data:${mime};base64,${out.replace(/\n/g, '')}`;
          }
          output.value = out;
          output.filename = 'encoded.txt';
          status.append(h('div', { class: 'alert ok' }, `✓ Đã mã hoá ${fileBytes ? `file ${fileName} (${formatBytes(fileBytes.length)})` : formatBytes(new TextEncoder().encode(text).length)} → ${formatBytes(out.length)}`));
        } else {
          const r = decodeToText(text);
          lastBytes = r.bytes;
          const sniff = sniffMime(r.bytes) || (r.mime && r.mime.startsWith('image/') ? { mime: r.mime, ext: r.mime.split('/')[1] } : null);
          if (sniff && sniff.mime.startsWith('image/')) {
            const url = URL.createObjectURL(new Blob([r.bytes], { type: sniff.mime }));
            preview.append(h('p', { class: 'muted' }, `Ảnh ${sniff.mime}`), h('img', { src: url, alt: 'Ảnh giải mã', 'data-testid': 'b64-image' }));
          }
          if (r.valid && !(sniff && sniff.mime !== 'image/svg+xml')) {
            output.value = r.text;
            status.append(h('div', { class: 'alert ok' }, `✓ Đã giải mã ${formatBytes(r.bytes.length)} (UTF-8)`));
          } else {
            output.value = hexPreview(r.bytes, 1024);
            status.append(h('div', { class: 'alert warn' }, `⚠ Dữ liệu nhị phân${sniff ? ` (${sniff.mime})` : ''} — ${formatBytes(r.bytes.length)}. Hiển thị dạng hex.`,
              h('button', { type: 'button', class: 'link', onClick: () => download(new Blob([lastBytes], { type: sniff ? sniff.mime : 'application/octet-stream' }), `decoded.${sniff ? sniff.ext : 'bin'}`) }, ' Tải file đã giải mã')));
          }
          output.filename = 'decoded.txt';
        }
        if (record) ctx.record(opts.mode === 'encode' ? 'Encode' : 'Decode');
      } catch (e) {
        if (!(e instanceof Base64Error)) throw e;
        output.value = '';
        status.append(h('div', { class: 'alert error', 'data-testid': 'b64-error' }, `✗ Base64 không hợp lệ: ${e.message}`));
      }
    };
    const live = debounce(() => run(false), 200);

    const clearFile = () => { fileBytes = null; fileName = ''; fileTag.replaceChildren(); input.ta.disabled = false; };
    const fileTag = h('span', { class: 'file-tag' });
    const modeSeg = segmented('Chế độ', [['encode', 'Encode'], ['decode', 'Decode']], opts.mode, (v) => { opts.mode = v; if (v === 'decode') clearFile(); syncOpts(); ctx.changed(); run(); });
    const urlCb = checkbox('URL-safe (-_)', opts.urlSafe, (v) => { opts.urlSafe = v; ctx.changed(); run(); }, 'b64-urlsafe');
    const wrapCb = checkbox('Xuống dòng mỗi 76 ký tự', opts.wrap, (v) => { opts.wrap = v; ctx.changed(); run(); });
    const padCb = checkbox('Bỏ padding (=)', opts.noPad, (v) => { opts.noPad = v; ctx.changed(); run(); });
    const uriCb = checkbox('Data URI', opts.dataUri, (v) => { opts.dataUri = v; ctx.changed(); run(); });
    const encOnly = h('span', { class: 'group' }, urlCb, wrapCb, padCb, uriCb);
    const syncOpts = () => { encOnly.style.display = opts.mode === 'encode' ? '' : 'none'; fileBtn.style.display = opts.mode === 'encode' ? '' : 'none'; };

    const fileBtn = button('Mã hoá file', { icon: 'upload', onClick: async () => {
      const r = await pickFile({ asText: false });
      if (!r) return;
      if (r.file.size > 20 * 1024 * 1024) { toast('File quá lớn (tối đa 20MB)', 'error'); return; }
      fileBytes = r.content; fileName = r.file.name;
      input.value = ''; input.ta.disabled = true;
      fileTag.replaceChildren(h('span', {}, `📎 ${fileName} (${formatBytes(fileBytes.length)})`), h('button', { type: 'button', class: 'link', onClick: () => { clearFile(); run(); } }, ' ✕ bỏ file'));
      run(true);
    } });

    root.append(
      h('div', { class: 'toolbar' },
        modeSeg,
        button('Chạy', { icon: 'base64', variant: 'primary', testid: 'b64-run', onClick: () => run(true) }),
        button('Đảo chiều', { icon: 'swap', testid: 'b64-swap', onClick: () => {
          if (fileBytes) return toast('Bỏ file trước khi đảo chiều', 'warn');
          if (opts.mode === 'decode' && lastBytes && output.value.startsWith('00000000  ')) return toast('Kết quả là nhị phân, không thể đảo chiều', 'warn');
          const out = output.value; opts.mode = opts.mode === 'encode' ? 'decode' : 'encode'; modeSeg.setValue(opts.mode); syncOpts();
          input.value = out; ctx.changed(); run();
        } }),
        button('Mẫu', { icon: 'sample', onClick: () => { clearFile(); opts.mode = 'encode'; modeSeg.setValue('encode'); syncOpts(); input.value = 'Xin chào DevTools 👋 — Base64 hỗ trợ UTF-8!'; ctx.changed(); run(true); } }),
        fileBtn, fileTag, encOnly),
      h('div', { class: 'grid-2' }, input.el, h('div', {}, output.el, preview)),
      status);
    syncOpts();
    run();

    return {
      run: () => run(true),
      getData: () => ({ input: input.value, opts: { ...opts } }),
      setData: (d) => {
        if (!d) return;
        clearFile();
        input.value = d.input || '';
        Object.assign(opts, d.opts || {});
        modeSeg.setValue(opts.mode);
        urlCb.input.checked = !!opts.urlSafe; wrapCb.input.checked = !!opts.wrap; padCb.input.checked = !!opts.noPad; uriCb.input.checked = !!opts.dataUri;
        syncOpts();
        run();
      },
    };
  },
};
