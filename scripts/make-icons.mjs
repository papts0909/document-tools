// Sinh icon PNG từ SVG bằng Chromium (Playwright).
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';

const svg = await readFile('src/icons/icon.svg', 'utf8');
const browser = await chromium.launch();
const page = await browser.newPage();
const render = async (size, file, maskable = false) => {
  await page.setViewportSize({ width: size, height: size });
  const inner = maskable
    ? `<div style="width:${size}px;height:${size}px;background:#2563eb;display:flex;align-items:center;justify-content:center"><div style="width:${size * 0.8}px;height:${size * 0.8}px">${svg.replace('rx="112"', 'rx="0"')}</div></div>`
    : `<div style="width:${size}px;height:${size}px">${svg}</div>`;
  await page.setContent(`<html><body style="margin:0;background:transparent">${inner}</body></html>`);
  await page.screenshot({ path: file, omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
};
await render(192, 'src/icons/icon-192.png');
await render(512, 'src/icons/icon-512.png');
await render(512, 'src/icons/icon-maskable-512.png', true);
await browser.close();
console.log('icons generated');
