// Lưu trữ IndexedDB: trạng thái từng tool (auto-save), lịch sử thao tác, cài đặt.
// Tự động fallback sang bộ nhớ RAM nếu IndexedDB không khả dụng (private mode...).

const DB_NAME = 'devtools-pwa';
const DB_VERSION = 1;
export const HISTORY_LIMIT = 50;

let dbPromise = null;
const memory = { state: new Map(), settings: new Map(), history: [] };
let memSeq = 1;
let useMemory = false;

function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') { useMemory = true; resolve(null); return; }
    let req;
    try { req = indexedDB.open(DB_NAME, DB_VERSION); } catch { useMemory = true; resolve(null); return; }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('state')) db.createObjectStore('state');
      if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings');
      if (!db.objectStoreNames.contains('history')) {
        const h = db.createObjectStore('history', { keyPath: 'id', autoIncrement: true });
        h.createIndex('tool', 'tool');
        h.createIndex('time', 'time');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => { useMemory = true; resolve(null); };
    req.onblocked = () => { useMemory = true; resolve(null); };
  });
  return dbPromise;
}

function tx(db, store, mode, fn) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    let result;
    const r = fn(s);
    if (r && 'onsuccess' in r) r.onsuccess = () => { result = r.result; };
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

export function isPersistent() { return !useMemory; }

export async function getState(tool) {
  const db = await open();
  if (!db) return memory.state.get(tool);
  return tx(db, 'state', 'readonly', (s) => s.get(tool));
}

export async function setState(tool, value) {
  const db = await open();
  if (!db) { memory.state.set(tool, value); return; }
  await tx(db, 'state', 'readwrite', (s) => s.put(value, tool));
}

export async function getSetting(key, fallback) {
  const db = await open();
  const v = db ? await tx(db, 'settings', 'readonly', (s) => s.get(key)) : memory.settings.get(key);
  return v === undefined ? fallback : v;
}

export async function setSetting(key, value) {
  const db = await open();
  if (!db) { memory.settings.set(key, value); return; }
  await tx(db, 'settings', 'readwrite', (s) => s.put(value, key));
}

/** Thêm bản ghi lịch sử; bỏ qua nếu trùng với bản ghi gần nhất của tool. */
export async function addHistory(tool, data, title = '') {
  const list = await listHistory(tool);
  const sig = JSON.stringify(data);
  if (list.length && JSON.stringify(list[0].data) === sig) return list[0].id;
  const entry = { tool, data, title, time: Date.now() };
  const db = await open();
  let id;
  if (!db) { id = memSeq++; memory.history.push({ ...entry, id }); }
  else id = await tx(db, 'history', 'readwrite', (s) => s.add(entry));
  // Giới hạn số bản ghi mỗi tool
  const extra = list.slice(HISTORY_LIMIT - 1);
  for (const e of extra) await deleteHistory(e.id);
  return id;
}

/** Danh sách lịch sử (mới nhất trước). */
export async function listHistory(tool) {
  const db = await open();
  let all;
  if (!db) all = memory.history.filter((h) => !tool || h.tool === tool);
  else if (tool) all = await tx(db, 'history', 'readonly', (s) => s.index('tool').getAll(tool));
  else all = await tx(db, 'history', 'readonly', (s) => s.getAll());
  return (all || []).sort((a, b) => b.time - a.time || b.id - a.id);
}

export async function deleteHistory(id) {
  const db = await open();
  if (!db) { memory.history = memory.history.filter((h) => h.id !== id); return; }
  await tx(db, 'history', 'readwrite', (s) => s.delete(id));
}

export async function clearHistory(tool) {
  const list = await listHistory(tool);
  for (const e of list) await deleteHistory(e.id);
}

export async function clearAll() {
  const db = await open();
  if (!db) { memory.state.clear(); memory.settings.clear(); memory.history = []; return; }
  for (const name of ['state', 'settings', 'history']) await tx(db, name, 'readwrite', (s) => s.clear());
}

export async function exportAll() {
  const db = await open();
  const dump = { version: DB_VERSION, exportedAt: new Date().toISOString(), state: {}, settings: {}, history: [] };
  if (!db) {
    memory.state.forEach((v, k) => { dump.state[k] = v; });
    memory.settings.forEach((v, k) => { dump.settings[k] = v; });
    dump.history = [...memory.history];
    return dump;
  }
  for (const name of ['state', 'settings']) {
    const keys = await tx(db, name, 'readonly', (s) => s.getAllKeys());
    const vals = await tx(db, name, 'readonly', (s) => s.getAll());
    keys.forEach((k, i) => { dump[name][k] = vals[i]; });
  }
  dump.history = await listHistory();
  return dump;
}

export async function importAll(dump) {
  if (!dump || typeof dump !== 'object' || !dump.state) throw new Error('File sao lưu không hợp lệ');
  for (const [k, v] of Object.entries(dump.state)) await setState(k, v);
  for (const [k, v] of Object.entries(dump.settings || {})) await setSetting(k, v);
  const db = await open();
  for (const h of dump.history || []) {
    const { id, ...rest } = h;
    if (!db) memory.history.push({ ...rest, id: memSeq++ });
    else await tx(db, 'history', 'readwrite', (s) => s.add(rest));
  }
}

export async function estimate() {
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
    try { return await navigator.storage.estimate(); } catch { /* ignore */ }
  }
  return null;
}
