import { expect, test } from '@playwright/test';

test('loads an OriginJS production ESM remote with services and shared fallback', async ({
  page,
}) => {
  const pageErrors: Error[] = [];
  const remoteRequests: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error));
  page.on('request', (request) => {
    if (request.url().startsWith('http://127.0.0.1:4203/')) {
      remoteRequests.push(request.url());
    }
  });

  await page.goto('http://127.0.0.1:4200/?producer=originjs');

  await expect(page.getByRole('heading', { name: 'Plain Vite shell' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'OriginJS catalog revision 1' })).toBeVisible();
  await expect(page.locator('#host-audit')).toHaveText(
    'Host audit: @originjs/vite-plugin-federation remote ready',
  );
  await expect(page.locator('#service-event')).toContainText(
    'originjs-catalog.mounted · revision 1',
  );
  await expect(page.locator('[data-shared-dependency="@fronts/core"]')).toHaveText(
    'Shared @fronts/core fallback active',
  );
  expect(remoteRequests).toContain('http://127.0.0.1:4203/assets/remoteEntry.js');
  expect(
    remoteRequests.some((request) => /__federation_shared_.*fronts.*core/i.test(request)),
  ).toBe(true);

  await page.getByRole('button', { name: 'Emit remote telemetry' }).click();
  await expect(page.locator('#service-event')).toContainText(
    'originjs-catalog.action · revision 1',
  );

  await page.getByRole('button', { name: 'Update remote props' }).click();
  await expect(page.getByRole('heading', { name: 'OriginJS catalog revision 2' })).toBeVisible();
  await expect(page.locator('#service-event')).toContainText(
    'originjs-catalog.updated · revision 2',
  );

  await page.getByRole('button', { name: 'Unmount remote' }).click();
  await expect(page.getByRole('heading', { name: 'OriginJS catalog revision 2' })).toHaveCount(0);
  await expect(page.locator('[data-shared-dependency="@fronts/core"]')).toHaveCount(0);
  await expect(page.locator('#host-audit')).toHaveAttribute('data-state', 'idle');
  await expect(page.locator('#application-slot')).toBeEmpty();
  expect(pageErrors).toEqual([]);
});
