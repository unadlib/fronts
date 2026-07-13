import { expect, test } from '@playwright/test';

test('runs the full Fronts lifecycle without Module Federation', async ({ page }) => {
  const pageErrors: Error[] = [];
  page.on('pageerror', (error) => pageErrors.push(error));

  await page.goto('http://127.0.0.1:4110');

  await expect(page.getByRole('heading', { name: 'Core-only application runtime' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Notice revision 1' })).toBeVisible();
  await expect(page.locator('#host-audit')).toHaveAttribute('data-state', 'ready');
  await expect(page.locator('#service-event')).toContainText('notice.mounted · revision 1');

  await page.getByRole('button', { name: 'Emit scoped telemetry' }).click();
  await expect(page.locator('#service-event')).toContainText('notice.action · revision 1');

  await page.getByRole('button', { name: 'Update application props' }).click();
  await expect(page.getByRole('heading', { name: 'Notice revision 2' })).toBeVisible();
  await expect(page.locator('#service-event')).toContainText('notice.updated · revision 2');

  await page.getByRole('button', { name: 'Unmount application' }).click();
  await expect(page.getByRole('heading', { name: 'Notice revision 2' })).toHaveCount(0);
  await expect(page.locator('#host-audit')).toHaveAttribute('data-state', 'idle');
  await expect(page.locator('#application-slot')).toBeEmpty();
  expect(pageErrors).toEqual([]);
});
