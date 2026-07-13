import { expect, test } from '@playwright/test';

test('loads a Vite federation remote from a plugin-free Vite host', async ({ page }) => {
  const pageErrors: Error[] = [];
  const remoteRequests: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error));
  page.on('request', (request) => {
    if (request.url().startsWith('http://127.0.0.1:4201/')) {
      remoteRequests.push(request.url());
    }
  });

  await page.goto('http://127.0.0.1:4200');

  await expect(page.getByRole('heading', { name: 'Plain Vite shell' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Vite catalog revision 1' })).toBeVisible();
  await expect(page.locator('#host-audit')).toHaveAttribute('data-state', 'ready');
  await expect(page.locator('#service-event')).toContainText('vite-catalog.mounted · revision 1');
  expect(remoteRequests).toContain('http://127.0.0.1:4201/mf-manifest.json');

  await page.getByRole('button', { name: 'Emit remote telemetry' }).click();
  await expect(page.locator('#service-event')).toContainText('vite-catalog.action · revision 1');

  await page.getByRole('button', { name: 'Update remote props' }).click();
  await expect(page.getByRole('heading', { name: 'Vite catalog revision 2' })).toBeVisible();
  await expect(page.locator('#service-event')).toContainText('vite-catalog.updated · revision 2');

  await page.getByRole('button', { name: 'Unmount remote' }).click();
  await expect(page.getByRole('heading', { name: 'Vite catalog revision 2' })).toHaveCount(0);
  await expect(page.locator('#host-audit')).toHaveAttribute('data-state', 'idle');
  await expect(page.locator('#application-slot')).toBeEmpty();
  expect(pageErrors).toEqual([]);
});

test('loads a vite-plugin-federation manifest in development and production', async ({ page }) => {
  const pageErrors: Error[] = [];
  const remoteRequests: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error));
  page.on('request', (request) => {
    if (request.url().startsWith('http://127.0.0.1:4202/')) {
      remoteRequests.push(request.url());
    }
  });

  await page.goto('http://127.0.0.1:4200/?producer=vite-plugin-federation');

  await expect(page.getByRole('heading', { name: 'Plain Vite shell' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Vite plugin catalog revision 1' })).toBeVisible();
  await expect(page.locator('#host-audit')).toHaveText(
    'Host audit: vite-plugin-federation remote ready',
  );
  await expect(page.locator('#service-event')).toContainText(
    'vite-plugin-catalog.mounted · revision 1',
  );
  expect(remoteRequests).toContain('http://127.0.0.1:4202/mf-manifest.json');

  await page.getByRole('button', { name: 'Emit remote telemetry' }).click();
  await expect(page.locator('#service-event')).toContainText(
    'vite-plugin-catalog.action · revision 1',
  );

  await page.getByRole('button', { name: 'Update remote props' }).click();
  await expect(page.getByRole('heading', { name: 'Vite plugin catalog revision 2' })).toBeVisible();
  await expect(page.locator('#service-event')).toContainText(
    'vite-plugin-catalog.updated · revision 2',
  );

  await page.getByRole('button', { name: 'Unmount remote' }).click();
  await expect(page.getByRole('heading', { name: 'Vite plugin catalog revision 2' })).toHaveCount(
    0,
  );
  await expect(page.locator('#host-audit')).toHaveAttribute('data-state', 'idle');
  await expect(page.locator('#application-slot')).toBeEmpty();
  expect(pageErrors).toEqual([]);
});
