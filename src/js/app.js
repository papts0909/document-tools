import { h, icon, button, toast, debounce, download, pickFile, formatBytes } from './ui.js';
import * as store from './lib/store.js';
import textCompare from './tools/text-compare.js';
import jsonChecker from './tools/json-checker.js';
import jsonCompare from './tools/json-compare.js';
import { jsonFormatter, jsonMinify } from './tools/json-format.js';
import base64 from './tools/base64.js';
import jsonEscape from './tools/json-escape.js';

export const APP_VERSION = '1.0.0';
export const TOOLS = [textCompare, jsonChecker, jsonCompare, jsonFormatter, jsonMinify, base64, jsonEscape];

const $ = (sel) => document.querySelector(sel);
let current = null; // { id, api, tool }
let mountSeq = 0;

// ---------- Theme ----------
async function initTheme() {
  const saved = await store.getSetting('theme', 'auto');
  applyTheme(saved);
}
function applyTheme(t) {
  const root = document.documentElement;
  if (t === 'auto') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', t);
  const dark = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  const btn = $('#theme-toggle');
  if (btn) { btn.replaceChildren(icon(dark ? 'sun' : 'moon')); btn.title = dark ? 'Chế độ sáng' : 'Chế độ tối'; }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = dark ? '#0f1419' : '#2563eb';
}
async function toggleTheme() {
  const dark = document.documentElement.getAttribute('data-theme') === 'dark' ||
    (!document.documentElement.getAttribute('data-theme') && matchMedia('(prefers-color-scheme: dark)').matches);
  const next = dark ? 'light' : 'dark';
  applyTheme(next);
  await store.setSetting('theme', next);
}

// ---------- Navigation ----------
function buildNav() {
  const nav = $('#nav');
  const item = (id, name, ic) => h('a', { href: `#/${id}`, class: 'nav-item', 'data-id': id, 'data-testid': `nav-${id}` }, icon(ic), h('span', {}, name));
  nav.replaceChildren(
    item('', 'Trang chủ', 'home'),
    h('div', { class: 'nav-sep' }, 'Công cụ'),
    ...TOOLS.map((t) => item(t.id, t.name, t.icon)),
    h('div', { class: 'nav-sep' }),
    item('settings', 'Cài đặt & dữ liệu', 'settings'));
}

function setActiveNav(id) {
  document.querySelectorAll('.nav-item').forEach((a) => {
    const on = a.dataset.id === id;
    a.classList.toggle('active', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
}

function closeMenu() { document.body.classList.remove('menu-open'); $('#menu-toggle').setAttribute('aria-expanded', 'false'); }

async function saveCurrent() {
  if (current && current.api && current.api.getData) {
    try { await store.setState(current.id, current.api.getData()); } catch (e) { console.warn('save failed', e); }
  }
}
const saveDebounced = debounce(saveCurrent, 400);

async function route() {
  const id = (location.hash.replace(/^#\/?/, '') || '').split('?')[0];
  const seq = ++mountSeq;
  if (current) { saveDebounced.flush(); }
  current = null;
  closeMenu();
  closeHistory();
  const main = $('#main');
  main.replaceChildren();
  setActiveNav(id);
  const tool = TOOLS.find((t) => t.id === id);

  if (!tool) {
    if (id === 'settings') renderSettings(main);
    else renderHome(main);
    document.title = id === 'settings' ? 'Cài đặt · DevTools' : 'DevTools — Bộ công cụ cho lập trình viên';
    $('#history-btn').hidden = true;
    $('#page-title').textContent = id === 'settings' ? 'Cài đặt & dữ liệu' : 'DevTools';
    store.setSetting('lastRoute', id === 'settings' ? 'settings' : '');
    return;
  }

  document.title = `${tool.name} · DevTools`;
  $('#page-title').textContent = tool.name;
  $('#history-btn').hidden = false;
  const body = h('div', { class: 'tool-body' });
  main.append(h('header', { class: 'tool-head' }, h('h1', {}, icon(tool.icon), tool.name), h('p', { class: 'muted' }, tool.desc)), body);
  const ctx = {
    changed: () => saveDebounced(),
    record: async (title) => {
      if (!current || current.id !== tool.id) return;
      await store.addHistory(tool.id, current.api.getData(), title);
      if (!$('#history').hidden) renderHistory();
    },
  };
  const api = tool.mount(body, ctx);
  current = { id: tool.id, api, tool };
  const saved = await store.getState(tool.id);
  if (seq !== mountSeq) return;
  if (saved) api.setData(saved);
  store.setSetting('lastRoute', tool.id);
  const first = body.querySelector('textarea:not([readonly])');
  if (first && matchMedia('(min-width: 900px)').matches) first.focus({ preventScroll: true });
}

function renderHome(main) {
  main.append(
    h('section', { class: 'hero' },
      h('h1', {}, 'DevTools'),
      h('p', { class: 'muted' }, 'Bộ công cụ xử lý văn bản & JSON chạy hoàn toàn trên trình duyệt — dữ liệu không rời khỏi máy bạn, hoạt động cả khi offline.')),
    h('div', { class: 'cards' }, TOOLS.map((t) =>
      h('a', { class: 'card', href: `#/${t.id}`, 'data-testid': `card-${t.id}` }, h('div', { class: 'card-icon' }, icon(t.icon)), h('h2', {}, t.name), h('p', {}, t.desc)))),
    h('section', { class: 'tips' },
      h('h2', {}, 'Mẹo'),
      h('ul', {},
        h('li', {}, h('kbd', {}, 'Ctrl'), ' + ', h('kbd', {}, 'Enter'), ' để chạy công cụ hiện tại.'),
        h('li', {}, h('kbd', {}, 'Ctrl'), ' + ', h('kbd', {}, 'K'), ' để mở nhanh menu công cụ.'),
        h('li', {}, 'Dữ liệu nhập được tự động lưu vào IndexedDB; xem lại các lần chạy trong ', h('strong', {}, 'Lịch sử'), '.'),
        h('li', {}, 'Kéo thả file vào ô nhập để mở nội dung file.'))));
}

async function renderSettings(main) {
  const usage = h('span', { 'data-testid': 'storage-usage' }, '…');
  const persistent = store.isPersistent();
  const counts = h('ul', { class: 'plain' });
  const theme = h('select', { 'data-testid': 'theme-select', 'aria-label': 'Giao diện' },
    h('option', { value: 'auto' }, 'Theo hệ thống'), h('option', { value: 'light' }, 'Sáng'), h('option', { value: 'dark' }, 'Tối'));
  theme.value = await store.getSetting('theme', 'auto');
  theme.addEventListener('change', async () => { applyTheme(theme.value); await store.setSetting('theme', theme.value); });

  const refresh = async () => {
    const est = await store.estimate();
    usage.textContent = est ? `${formatBytes(est.usage || 0)} / ${formatBytes(est.quota || 0)}` : 'không xác định';
    const all = await store.listHistory();
    counts.replaceChildren(...TOOLS.map((t) => h('li', {}, `${t.name}: ${all.filter((x) => x.tool === t.id).length} bản ghi lịch sử`)));
  };

  main.append(
    h('header', { class: 'tool-head' }, h('h1', {}, icon('settings'), 'Cài đặt & dữ liệu')),
    h('section', { class: 'panel' },
      h('h2', {}, 'Giao diện'),
      h('label', { class: 'select' }, h('span', {}, 'Chủ đề'), theme)),
    h('section', { class: 'panel' },
      h('h2', {}, 'Dữ liệu lưu trên máy (IndexedDB)'),
      h('p', {}, 'Trạng thái: ', h('strong', { 'data-testid': 'storage-mode' }, persistent ? 'IndexedDB (lưu bền vững)' : 'Bộ nhớ tạm (IndexedDB không khả dụng)')),
      h('p', {}, 'Dung lượng đã dùng: ', usage),
      counts,
      h('div', { class: 'toolbar' },
        button('Sao lưu (.json)', { icon: 'download', onClick: async () => { download(JSON.stringify(await store.exportAll(), null, 2), `devtools-backup-${new Date().toISOString().slice(0, 10)}.json`, 'application/json'); } }),
        button('Khôi phục', { icon: 'upload', onClick: async () => {
          const r = await pickFile({ accept: '.json,application/json' });
          if (!r) return;
          try { await store.importAll(JSON.parse(r.content)); toast('Đã khôi phục dữ liệu', 'ok'); refresh(); } catch (e) { toast(e.message, 'error'); }
        } }),
        button('Xoá toàn bộ dữ liệu', { icon: 'trash', variant: 'danger', testid: 'clear-all', onClick: async () => {
          if (!confirm('Xoá toàn bộ dữ liệu đã lưu và lịch sử?')) return;
          await store.clearAll(); applyTheme('auto'); toast('Đã xoá dữ liệu', 'ok'); refresh();
        } }))),
    h('section', { class: 'panel' },
      h('h2', {}, 'Ứng dụng'),
      h('p', {}, 'Phiên bản: ', h('code', { 'data-testid': 'app-version' }, `${APP_VERSION} (${window.__BUILD__ || 'dev'})`)),
      h('p', {}, 'Offline: ', h('strong', { id: 'sw-state' }, 'serviceWorker' in navigator ? (navigator.serviceWorker.controller ? 'Sẵn sàng' : 'Đang chuẩn bị…') : 'Không hỗ trợ')),
      h('div', { class: 'toolbar' },
        button('Kiểm tra cập nhật', { icon: 'download', onClick: async () => {
          const reg = await navigator.serviceWorker?.getRegistration();
          if (!reg) return toast('Service worker chưa đăng ký', 'warn');
          await reg.update();
          toast(reg.waiting || reg.installing ? 'Đang tải bản mới…' : 'Bạn đang dùng bản mới nhất', 'ok');
        } }),
        installBtn())));
  refresh();
}

// ---------- History drawer ----------
function closeHistory() { const d = $('#history'); if (d) d.hidden = true; }

async function renderHistory() {
  const list = $('#history-list');
  if (!current) return;
  const items = await store.listHistory(current.id);
  list.replaceChildren();
  if (!items.length) { list.append(h('p', { class: 'muted' }, 'Chưa có lịch sử. Lịch sử được ghi mỗi khi bạn bấm nút chạy chính (hoặc Ctrl+Enter).')); return; }
  for (const it of items) {
    const first = Object.values(it.data).find((v) => typeof v === 'string' && v) || '';
    list.append(h('div', { class: 'hist-item', 'data-testid': 'history-item' },
      h('button', { type: 'button', class: 'hist-main', onClick: () => { current.api.setData(it.data); saveCurrent(); closeHistory(); toast('Đã khôi phục từ lịch sử', 'ok'); } },
        h('div', { class: 'hist-title' }, it.title || 'Bản ghi'),
        h('div', { class: 'hist-time' }, new Date(it.time).toLocaleString('vi-VN')),
        h('div', { class: 'hist-preview' }, first.slice(0, 120))),
      button('Xoá', { icon: 'trash', iconOnly: true, onClick: async () => { await store.deleteHistory(it.id); renderHistory(); } })));
  }
}

// ---------- PWA ----------
let deferredInstall = null;
let userRequestedUpdate = false;
function installBtn() {
  const b = button('Cài đặt ứng dụng', { icon: 'download', variant: 'primary', onClick: async () => {
    if (!deferredInstall) return toast('Dùng menu trình duyệt → "Cài đặt ứng dụng" / "Thêm vào màn hình chính"', 'info');
    deferredInstall.prompt();
    await deferredInstall.userChoice;
    deferredInstall = null;
  } });
  b.classList.add('install-btn');
  return b;
}

function registerSW() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  navigator.serviceWorker.register('./sw.js').then((reg) => {
    const showUpdate = (worker) => {
      const bar = $('#update-bar');
      bar.hidden = false;
      $('#update-reload').onclick = () => { userRequestedUpdate = true; worker.postMessage({ type: 'SKIP_WAITING' }); };
    };
    if (reg.waiting && navigator.serviceWorker.controller) showUpdate(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w && w.addEventListener('statechange', () => {
        if (w.state === 'installed' && navigator.serviceWorker.controller) showUpdate(w);
      });
    });
  }).catch((e) => console.warn('SW register failed', e));
  // Chỉ reload khi người dùng chủ động cập nhật (lần cài đầu tiên clients.claim() cũng phát controllerchange).
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!userRequestedUpdate || reloading) return;
    reloading = true;
    saveDebounced.flush();
    location.reload();
  });
}

// ---------- Boot ----------
async function boot() {
  buildNav();
  await initTheme();
  $('#theme-toggle').addEventListener('click', toggleTheme);
  $('#menu-toggle').addEventListener('click', () => {
    const open = !document.body.classList.contains('menu-open');
    document.body.classList.toggle('menu-open', open);
    $('#menu-toggle').setAttribute('aria-expanded', String(open));
  });
  $('#backdrop').addEventListener('click', closeMenu);
  $('#history-btn').addEventListener('click', () => { const d = $('#history'); d.hidden = !d.hidden; if (!d.hidden) renderHistory(); });
  $('#history-close').addEventListener('click', closeHistory);
  $('#history-clear').addEventListener('click', async () => { if (current && confirm('Xoá toàn bộ lịch sử của công cụ này?')) { await store.clearHistory(current.id); renderHistory(); } });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', async () => applyTheme(await store.getSetting('theme', 'auto')));

  document.addEventListener('keydown', (e) => {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key === 'Enter' && current && current.api.run) { e.preventDefault(); current.api.run(); }
    else if (mod && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault();
      document.body.classList.add('menu-open');
      const first = document.querySelector('.nav-item.active') || document.querySelector('.nav-item');
      first && first.focus();
    } else if (e.key === 'Escape') { closeMenu(); closeHistory(); }
  });
  window.addEventListener('beforeunload', () => saveDebounced.flush());
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') saveDebounced.flush(); });
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredInstall = e; });
  window.addEventListener('online', () => document.body.classList.remove('offline'));
  window.addEventListener('offline', () => { document.body.classList.add('offline'); toast('Bạn đang offline — ứng dụng vẫn hoạt động bình thường', 'info'); });
  if (!navigator.onLine) document.body.classList.add('offline');

  window.addEventListener('hashchange', route);
  if (!location.hash) {
    const last = await store.getSetting('lastRoute', '');
    if (last) history.replaceState(null, '', `#/${last}`);
  }
  await route();
  registerSW();
  document.body.classList.add('ready');
}

boot();
