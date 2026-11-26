// Base64 encode/decode an toàn UTF-8, hỗ trợ URL-safe, xuống dòng MIME, file nhị phân.

const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const LOOKUP = new Int16Array(256).fill(-1);
for (let i = 0; i < 64; i++) LOOKUP[ALPHA.charCodeAt(i)] = i;
LOOKUP['-'.charCodeAt(0)] = 62;
LOOKUP['_'.charCodeAt(0)] = 63;

export class Base64Error extends Error {
  constructor(message, pos) { super(message); this.name = 'Base64Error'; this.pos = pos; }
}

export function bytesToBase64(bytes, { urlSafe = false, wrap = 0, padding = true } = {}) {
  let out = '';
  const n = bytes.length;
  let i = 0;
  for (; i + 2 < n; i += 3) {
    const v = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    out += ALPHA[v >> 18] + ALPHA[(v >> 12) & 63] + ALPHA[(v >> 6) & 63] + ALPHA[v & 63];
  }
  if (n - i === 1) {
    const v = bytes[i] << 16;
    out += ALPHA[v >> 18] + ALPHA[(v >> 12) & 63] + (padding ? '==' : '');
  } else if (n - i === 2) {
    const v = (bytes[i] << 16) | (bytes[i + 1] << 8);
    out += ALPHA[v >> 18] + ALPHA[(v >> 12) & 63] + ALPHA[(v >> 6) & 63] + (padding ? '=' : '');
  }
  if (urlSafe) out = out.replace(/\+/g, '-').replace(/\//g, '_');
  if (wrap > 0) out = out.replace(new RegExp(`(.{${wrap}})(?=.)`, 'g'), '$1\n');
  return out;
}

export function base64ToBytes(input) {
  let s = String(input).trim();
  const m = /^data:([^;,]*)(;[^,]*)?,/i.exec(s);
  if (m) s = s.slice(m[0].length);
  s = s.replace(/[\s]/g, '');
  // Bỏ padding cuối để xử lý thống nhất
  let end = s.length;
  while (end > 0 && s[end - 1] === '=') end--;
  if (s.length - end > 2) throw new Base64Error('Quá nhiều ký tự "=" ở cuối', end);
  if (s.indexOf('=') !== -1 && s.indexOf('=') < end) throw new Base64Error('Ký tự "=" chỉ được nằm ở cuối', s.indexOf('='));
  const body = s.slice(0, end);
  if (body.length % 4 === 1) throw new Base64Error('Độ dài dữ liệu Base64 không hợp lệ', body.length);
  const out = new Uint8Array(Math.floor((body.length * 3) / 4));
  let buf = 0, bits = 0, o = 0;
  for (let i = 0; i < body.length; i++) {
    const c = body.charCodeAt(i);
    const v = c < 256 ? LOOKUP[c] : -1;
    if (v < 0) throw new Base64Error(`Ký tự không hợp lệ '${body[i]}' tại vị trí ${i + 1}`, i);
    buf = ((buf << 6) | v) & 0xffffff;
    bits += 6;
    if (bits >= 8) { bits -= 8; out[o++] = (buf >> bits) & 0xff; }
  }
  return { bytes: out.subarray(0, o), mime: m ? (m[1] || 'text/plain') : null };
}

export function encodeText(text, opts) {
  return bytesToBase64(new TextEncoder().encode(text), opts);
}

/** Giải mã sang text. Trả về {text, valid} — valid=false nếu không phải UTF-8 hợp lệ. */
export function decodeToText(b64) {
  const { bytes, mime } = base64ToBytes(b64);
  try {
    return { text: new TextDecoder('utf-8', { fatal: true }).decode(bytes), valid: true, bytes, mime };
  } catch {
    return { text: new TextDecoder('utf-8').decode(bytes), valid: false, bytes, mime };
  }
}

const SIGNATURES = [
  [[0x89, 0x50, 0x4e, 0x47], 'image/png', 'png'],
  [[0xff, 0xd8, 0xff], 'image/jpeg', 'jpg'],
  [[0x47, 0x49, 0x46, 0x38], 'image/gif', 'gif'],
  [[0x25, 0x50, 0x44, 0x46], 'application/pdf', 'pdf'],
  [[0x50, 0x4b, 0x03, 0x04], 'application/zip', 'zip'],
  [[0x1f, 0x8b], 'application/gzip', 'gz'],
  [[0x42, 0x4d], 'image/bmp', 'bmp'],
];

export function sniffMime(bytes) {
  for (const [sig, mime, ext] of SIGNATURES) {
    if (sig.every((b, i) => bytes[i] === b)) return { mime, ext };
  }
  if (bytes.length >= 12 && String.fromCharCode(...bytes.subarray(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.subarray(8, 12)) === 'WEBP') return { mime: 'image/webp', ext: 'webp' };
  const head = new TextDecoder().decode(bytes.subarray(0, 200)).trimStart();
  if (head.startsWith('<svg') || (head.startsWith('<?xml') && head.includes('<svg'))) return { mime: 'image/svg+xml', ext: 'svg' };
  return null;
}

export function hexPreview(bytes, max = 256) {
  const rows = [];
  const n = Math.min(bytes.length, max);
  for (let i = 0; i < n; i += 16) {
    const chunk = bytes.subarray(i, Math.min(i + 16, n));
    const hex = Array.from(chunk, (b) => b.toString(16).padStart(2, '0')).join(' ');
    const asc = Array.from(chunk, (b) => (b >= 32 && b < 127 ? String.fromCharCode(b) : '.')).join('');
    rows.push(`${i.toString(16).padStart(8, '0')}  ${hex.padEnd(47)}  ${asc}`);
  }
  if (bytes.length > max) rows.push(`… (${bytes.length - max} byte nữa)`);
  return rows.join('\n');
}
