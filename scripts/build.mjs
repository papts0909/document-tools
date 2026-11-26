// Build: copy src -> dist, gắn version (git sha) vào service worker & index.html.
import { cp, readFile, writeFile, rm } from 'node:fs/promises';
import { execSync } from 'node:child_process';

let sha = process.env.GITHUB_SHA || '';
if (!sha) { try { sha = execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { sha = 'local'; } }
const build = `${sha.slice(0, 7)}-${Date.now().toString(36)}`;

await rm('dist', { recursive: true, force: true });
await cp('src', 'dist', { recursive: true });
const sw = await readFile('dist/sw.js', 'utf8');
if (!sw.includes("const VERSION = 'dev';")) throw new Error('VERSION placeholder not found in sw.js');
await writeFile('dist/sw.js', sw.replace("const VERSION = 'dev';", `const VERSION = '${build}';`));
const html = await readFile('dist/index.html', 'utf8');
await writeFile('dist/index.html', html.replace("window.__BUILD__ = 'dev';", `window.__BUILD__ = '${build}';`));
await writeFile('dist/.nojekyll', '');
await writeFile('dist/404.html', html.replace("window.__BUILD__ = 'dev';", `window.__BUILD__ = '${build}';`));
console.log(`Built dist/ version ${build}`);
