import { expect, test } from '@playwright/test';

test('orchestrates every execution model and updates it in place', async ({ page }) => {
  const pageErrors: Error[] = [];
  page.on('pageerror', (error) => pageErrors.push(error));

  await page.goto('/');

  await expect(
    page.getByRole('heading', { name: 'One application runtime, three execution models' }),
  ).toBeVisible();
  await expect(page.locator('[data-fronts-react-status="ready"]')).toHaveCount(3);
  await expect(page.getByRole('heading', { name: 'Cart cart-1' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Account account-1' })).toBeVisible();

  const isolated = page.frameLocator('iframe[title="Isolated checkout application"]');
  await expect(isolated.getByRole('heading', { name: 'Cart isolated-1' })).toBeVisible();

  await page.getByRole('button', { name: 'Update all props · revision 1' }).click();

  await expect(page.getByRole('heading', { name: 'Cart cart-2' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Account account-2' })).toBeVisible();
  await expect(isolated.getByRole('heading', { name: 'Cart isolated-2' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Update all props · revision 2' })).toBeVisible();

  await page.getByRole('button', { name: 'Open checkout' }).click();
  await expect(page).toHaveURL(/\/checkout\/cart-2$/);

  await isolated.getByRole('button', { name: 'Open checkout' }).click();
  await expect(page).toHaveURL(/\/checkout\/isolated-2$/);

  await expect(page.locator('.status.error')).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});
