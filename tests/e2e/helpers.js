import { expect } from '@playwright/test';

export async function open(page, id = '') {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`./#/${id}`);
  await expect(page.locator('body.ready')).toBeAttached();
  return errors;
}

export async function fill(page, testid, text) {
  await page.getByTestId(testid).fill(text);
}

export const out = (page, testid) => page.getByTestId(testid);
