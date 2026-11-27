// Kịch bản UAT: luồng người dùng thật trên desktop & mobile.
import { test, expect } from '@playwright/test';
import { open, fill } from './helpers.js';

const TOOLS = ['text-compare', 'json-checker', 'json-compare', 'json-formatter', 'json-minify', 'base64', 'json-escape'];

test('UAT-01: Trang chủ có đủ 7 công cụ, chọn từ menu mở đúng công cụ', async ({ page, isMobile }) => {
  const errors = await open(page);
  for (const id of TOOLS) await expect(page.getByTestId(`card-${id}`)).toBeVisible();
  for (const id of TOOLS) {
    if (isMobile) {
      await page.getByTestId('menu-toggle').click();
      await expect(page.locator('#sidebar')).toBeInViewport();
    }
    await page.getByTestId(`nav-${id}`).click();
    await expect(page).toHaveURL(new RegExp(`#/${id}$`));
    await expect(page.getByTestId(`nav-${id}`)).toHaveAttribute('aria-current', 'page');
    if (isMobile) await expect(page.locator('#sidebar')).not.toBeInViewport();
  }
  expect(errors).toEqual([]);
});

test('UAT-02: Dữ liệu nhập tự lưu vào IndexedDB và còn sau khi tải lại', async ({ page }) => {
  await open(page, 'json-formatter');
  await fill(page, 'json-formatter-input', '{"keep":"me"}');
  await page.getByTestId('json-formatter-indent').selectOption('4');
  await page.waitForTimeout(700);
  await page.reload();
  await expect(page.getByTestId('json-formatter-input')).toHaveValue('{"keep":"me"}');
  await expect(page.getByTestId('json-formatter-indent')).toHaveValue('4');
  await expect(page.getByTestId('json-formatter-output')).toHaveValue('{\n    "keep": "me"\n}');
  // Kiểm tra trực tiếp trong IndexedDB
  const stored = await page.evaluate(() => new Promise((res) => {
    const r = indexedDB.open('devtools-pwa');
    r.onsuccess = () => { const g = r.result.transaction('state').objectStore('state').get('json-formatter'); g.onsuccess = () => res(g.result); };
  }));
  expect(stored.input).toBe('{"keep":"me"}');
  // Mở lại app không có hash → quay lại công cụ cuối cùng
  await page.goto('./');
  await expect(page).toHaveURL(/#\/json-formatter$/);
});

test('UAT-03: Lịch sử ghi lại lần chạy và khôi phục được', async ({ page }) => {
  await open(page, 'json-minify');
  await fill(page, 'json-minify-input', '{ "first": 1 }');
  await page.getByTestId('json-minify-run').click();
  await fill(page, 'json-minify-input', '{ "second": 2 }');
  await page.getByTestId('json-minify-run').click();
  await page.getByTestId('history-btn').click();
  const items = page.getByTestId('history-item');
  await expect(items).toHaveCount(2);
  await items.nth(1).locator('.hist-main').click();
  await expect(page.getByTestId('json-minify-input')).toHaveValue('{ "first": 1 }');
  await expect(page.getByTestId('json-minify-output')).toHaveValue('{"first":1}');
});

test('UAT-04: Ứng dụng chạy offline sau lần truy cập đầu (Service Worker)', async ({ page, context }) => {
  await open(page, 'base64');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('body.ready')).toBeAttached();
  await fill(page, 'b64-input', 'offline');
  await expect(page.getByTestId('b64-output')).toHaveValue('b2ZmbGluZQ==');
  await page.goto('./#/text-compare');
  await expect(page.getByTestId('tc-left')).toBeVisible();
  await context.setOffline(false);
});

test('UAT-05: Đổi giao diện sáng/tối và nhớ lựa chọn', async ({ page }) => {
  await open(page);
  const before = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  await page.getByTestId('theme-toggle').click();
  const after = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  expect(after).not.toBe(before);
  await page.waitForTimeout(200);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', after);
});

test('UAT-06: Ctrl+Enter chạy công cụ, copy kết quả', async ({ page, isMobile, browserName }) => {
  test.skip(isMobile, 'Phím tắt chỉ cho desktop');
  await open(page, 'json-formatter');
  await fill(page, 'json-formatter-input', '[1]');
  await page.getByTestId('json-formatter-input').press('Control+Enter');
  await page.getByTestId('history-btn').click();
  await expect(page.getByTestId('history-item')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('history-drawer')).toBeHidden();
  await page.getByTestId('json-formatter-output-copy').click();
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  expect(clip).toBe('[\n  1\n]');
});

test('UAT-07: Cài đặt — xoá toàn bộ dữ liệu', async ({ page }) => {
  await open(page, 'json-checker');
  await fill(page, 'jc-input', '{"x":1}');
  await page.waitForTimeout(600);
  await page.goto('./#/settings');
  await expect(page.getByTestId('storage-mode')).toContainText('IndexedDB');
  page.once('dialog', (d) => d.accept());
  await page.getByTestId('clear-all').click();
  await page.goto('./#/json-checker');
  await expect(page.getByTestId('jc-input')).toHaveValue('');
});

test('UAT-08: Không có tràn ngang trên màn hình nhỏ', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Chỉ cho mobile');
  for (const id of ['', ...TOOLS, 'settings']) {
    await open(page, id);
    const sample = page.getByRole('button', { name: /^Mẫu$/ });
    if (await sample.count()) await sample.click();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `overflow on ${id || 'home'}`).toBeLessThanOrEqual(0);
  }
});

test('UAT-09: Manifest, SW scope và tài nguyên đúng với đường dẫn triển khai', async ({ page, request, baseURL }) => {
  const base = new URL(baseURL).pathname;
  await open(page);
  expect(new URL(page.url()).pathname).toBe(base);
  const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
  expect(new URL(scope).pathname).toBe(base);
  const manifest = await (await request.get('manifest.webmanifest')).json();
  expect(manifest.start_url).toBe('./');
  for (const icon of manifest.icons) expect((await request.get(icon.src)).ok()).toBe(true);
});
