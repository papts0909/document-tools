import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

async function walk(dir, base = dir) {
  const out = [];
  for (const name of await readdir(dir)) {
    const p = join(dir, name);
    if ((await stat(p)).isDirectory()) out.push(...await walk(p, base));
    else out.push('./' + p.slice(base.length + 1).replace(/\\/g, '/'));
  }
  return out;
}

test('service worker precaches every app file', async () => {
  const sw = await readFile('src/sw.js', 'utf8');
  const assets = JSON.parse(sw.match(/const ASSETS = (\[[\s\S]*?\]);/)[1].replace(/'/g, '"').replace(/,\s*\]/, ']'));
  const files = (await walk('src')).filter((f) => f !== './sw.js');
  for (const f of files) assert.ok(assets.includes(f), `${f} missing from ASSETS in sw.js`);
  for (const a of assets) if (a !== './') assert.ok(files.includes(a), `${a} in ASSETS but file does not exist`);
  assert.match(sw, /const VERSION = 'dev';/);
});

test('manifest is valid and icons exist', async () => {
  const m = JSON.parse(await readFile('src/manifest.webmanifest', 'utf8'));
  assert.equal(m.display, 'standalone');
  assert.ok(m.icons.some((i) => i.sizes === '192x192'));
  assert.ok(m.icons.some((i) => i.sizes === '512x512'));
  for (const i of m.icons) await stat(join('src', i.src));
});
