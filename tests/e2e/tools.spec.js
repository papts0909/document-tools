import { test, expect } from '@playwright/test';
import { open, fill } from './helpers.js';

test.describe('Text Compare', () => {
  test('hiển thị thêm / xoá / sửa và highlight từ', async ({ page }) => {
    const errors = await open(page, 'text-compare');
    await fill(page, 'tc-left', 'alpha\nthe quick fox\ngamma\ndelta');
    await fill(page, 'tc-right', 'alpha\nthe slow fox\ngamma\nepsilon\nzeta');
    await page.getByTestId('tc-compare').click();
    const stats = page.getByTestId('diff-stats');
    await expect(stats).toContainText('+1 thêm');
    await expect(stats).toContainText('~2 sửa');
    await expect(page.locator('[data-testid=tc-result] td.ins')).toHaveCount(3);
    await expect(page.locator('[data-testid=tc-result] mark').first()).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('bỏ qua hoa/thường & khoảng trắng → giống nhau', async ({ page }) => {
    await open(page, 'text-compare');
    await fill(page, 'tc-left', 'Hello   World');
    await fill(page, 'tc-right', 'hello world');
    await expect(page.getByTestId('diff-stats')).toBeVisible();
    await page.getByTestId('tc-ignore-case').check();
    await page.getByTestId('tc-ignore-ws').check();
    await expect(page.getByTestId('diff-identical')).toBeVisible();
  });

  test('chế độ gộp & chỉ hiện thay đổi', async ({ page }) => {
    await open(page, 'text-compare');
    const lines = Array.from({ length: 30 }, (_, i) => `line ${i}`);
    await fill(page, 'tc-left', lines.join('\n'));
    lines[15] = 'changed';
    await fill(page, 'tc-right', lines.join('\n'));
    await page.getByRole('radio', { name: 'Gộp' }).click();
    await expect(page.locator('table.diff.unified')).toBeVisible();
    await page.getByTestId('tc-only-changes').check();
    await expect(page.locator('tr.fold')).toHaveCount(2);
  });
});

test.describe('JSON Checker', () => {
  test('JSON hợp lệ: hiện định dạng & thống kê', async ({ page }) => {
    await open(page, 'json-checker');
    await fill(page, 'jc-input', '{"a":[1,2],"b":{"c":null}}');
    await page.getByTestId('jc-check').click();
    await expect(page.getByTestId('json-ok')).toContainText('JSON hợp lệ');
    await expect(page.getByTestId('jc-format')).toHaveText(/Minified/);
  });

  test('JSON lỗi: báo đúng dòng/cột, tự sửa được', async ({ page }) => {
    await open(page, 'json-checker');
    await fill(page, 'jc-input', '{\n  "a": 1\n  "b": 2\n}');
    await page.getByTestId('jc-check').click();
    await expect(page.getByTestId('json-error')).toContainText('Dòng 3, cột 3');
    await expect(page.locator('.gutter .err')).toHaveText('3');
    await page.getByTestId('jc-fix').click();
    await expect(page.getByTestId('json-ok')).toBeVisible();
    await expect(page.getByTestId('jc-input')).toHaveValue('{\n  "a": 1,\n  "b": 2\n}');
  });

  test('cảnh báo key trùng', async ({ page }) => {
    await open(page, 'json-checker');
    await fill(page, 'jc-input', '{"a":1,"a":2}');
    await expect(page.getByTestId('json-warnings')).toContainText('Key trùng lặp "a"');
  });

  test('mẫu lỗi có nút tự sửa', async ({ page }) => {
    await open(page, 'json-checker');
    await page.getByTestId('jc-sample-bad').click();
    await expect(page.getByTestId('json-error')).toBeVisible();
    await page.getByTestId('jc-fix').click();
    await expect(page.getByTestId('json-ok')).toBeVisible();
  });
});

test.describe('JSON Formatter & Minify', () => {
  test('format với 4 spaces + sort keys, giữ số lớn', async ({ page }) => {
    await open(page, 'json-formatter');
    await fill(page, 'json-formatter-input', '{"b":12345678901234567890,"a":[1]}');
    await page.getByTestId('json-formatter-indent').selectOption('4');
    await page.getByTestId('json-formatter-sort').check();
    await expect(page.getByTestId('json-formatter-output')).toHaveValue('{\n    "a": [\n        1\n    ],\n    "b": 12345678901234567890\n}');
  });

  test('xem dạng cây', async ({ page }) => {
    await open(page, 'json-formatter');
    await fill(page, 'json-formatter-input', '{"user":{"name":"An","tags":["x"]}}');
    await page.getByRole('radio', { name: 'Dạng cây' }).click();
    const tree = page.getByTestId('json-formatter-tree');
    await expect(tree).toBeVisible();
    await expect(tree).toContainText('"name": "An"');
  });

  test('lỗi cú pháp hiện ra ở formatter', async ({ page }) => {
    await open(page, 'json-formatter');
    await fill(page, 'json-formatter-input', '[1,2,]');
    await expect(page.getByTestId('json-error')).toContainText('phẩy thừa');
    await page.getByTestId('json-formatter-loose').check();
    await expect(page.getByTestId('json-formatter-output')).toHaveValue('[\n  1,\n  2\n]');
  });

  test('minify', async ({ page }) => {
    await open(page, 'json-minify');
    await fill(page, 'json-minify-input', '{\n  "a" : [ 1 , 2 ],\n  "s": "x y"\n}');
    await expect(page.getByTestId('json-minify-output')).toHaveValue('{"a":[1,2],"s":"x y"}');
    await expect(page.getByTestId('json-ok')).toContainText('giảm');
  });
});

test.describe('JSON Compare', () => {
  test('liệt kê khác biệt theo path, bỏ qua thứ tự key', async ({ page }) => {
    await open(page, 'json-compare');
    await fill(page, 'jcmp-left', '{"a":1,"b":[1,2],"c":{"d":"x"}}');
    await fill(page, 'jcmp-right', '{"c":{"d":"y"},"b":[1,2,3],"a":1,"e":true}');
    await page.getByTestId('jcmp-run').click();
    const list = page.getByTestId('jcmp-list');
    await expect(list).toContainText('$.c.d');
    await expect(list).toContainText('$.b[2]');
    await expect(list).toContainText('$.e');
    await expect(page.getByTestId('jcmp-stats')).toContainText('3 khác biệt');
  });

  test('tương đương khi chỉ khác thứ tự', async ({ page }) => {
    await open(page, 'json-compare');
    await fill(page, 'jcmp-left', '{"a":1,"b":[1,2]}');
    await fill(page, 'jcmp-right', '{"b":[2,1],"a":1}');
    await expect(page.getByTestId('jcmp-stats')).toBeVisible();
    await page.getByTestId('jcmp-ignore-order').check();
    await expect(page.getByTestId('jcmp-equal')).toBeVisible();
  });

  test('chế độ văn bản song song & báo lỗi bên B', async ({ page }) => {
    await open(page, 'json-compare');
    await fill(page, 'jcmp-left', '{"a":1}');
    await fill(page, 'jcmp-right', '{"a":2}');
    await page.getByRole('radio', { name: 'Văn bản song song' }).click();
    await expect(page.getByTestId('jcmp-textdiff')).toBeVisible();
    await fill(page, 'jcmp-right', '{"a":');
    await expect(page.getByTestId('json-error')).toContainText('JSON B không hợp lệ');
  });
});

test.describe('Base64', () => {
  test('encode / decode UTF-8 và đảo chiều', async ({ page }) => {
    await open(page, 'base64');
    await fill(page, 'b64-input', 'Xin chào 😀');
    await expect(page.getByTestId('b64-output')).toHaveValue('WGluIGNow6BvIPCfmIA=');
    await page.getByTestId('b64-swap').click();
    await expect(page.getByTestId('b64-input')).toHaveValue('WGluIGNow6BvIPCfmIA=');
    await expect(page.getByTestId('b64-output')).toHaveValue('Xin chào 😀');
  });

  test('url-safe và lỗi decode', async ({ page }) => {
    await open(page, 'base64');
    await fill(page, 'b64-input', 'ûÿ');
    await page.getByTestId('b64-urlsafe').check();
    await expect(page.getByTestId('b64-output')).not.toHaveValue(/[+/]/);
    await page.getByRole('radio', { name: 'Decode' }).click();
    await fill(page, 'b64-input', 'abc$');
    await expect(page.getByTestId('b64-error')).toContainText('Ký tự không hợp lệ');
  });

  test('decode ảnh PNG hiển thị preview', async ({ page }) => {
    await open(page, 'base64');
    await page.getByRole('radio', { name: 'Decode' }).click();
    const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    await fill(page, 'b64-input', png);
    await expect(page.getByTestId('b64-image')).toBeVisible();
  });
});

test.describe('JSON Escape', () => {
  test('escape và unescape (format lại JSON)', async ({ page }) => {
    await open(page, 'json-escape');
    await fill(page, 'esc-input', '{"a":"x\ty"}\nnext');
    await expect(page.getByTestId('esc-output')).toHaveValue('{\\"a\\":\\"x\\ty\\"}\\nnext');
    await page.getByRole('radio', { name: 'Unescape' }).click();
    await fill(page, 'esc-input', '"{\\"a\\":1,\\"b\\":[true]}"');
    await expect(page.getByTestId('esc-output')).toHaveValue('{\n  "a": 1,\n  "b": [\n    true\n  ]\n}');
    await expect(page.getByTestId('esc-json-note')).toBeVisible();
  });

  test('unicode escape & lỗi escape', async ({ page }) => {
    await open(page, 'json-escape');
    await page.getByTestId('esc-unicode').check();
    await fill(page, 'esc-input', 'é');
    await expect(page.getByTestId('esc-output')).toHaveValue('\\u00e9');
    await page.getByRole('radio', { name: 'Unescape' }).click();
    await fill(page, 'esc-input', 'bad \\q');
    await expect(page.getByTestId('json-error')).toContainText('Escape không hợp lệ');
  });
});
