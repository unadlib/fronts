import { expect, test } from '@playwright/test';

test('offers complete English and Chinese entry points', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Fronts 2\.0 Documentation/);
  await expect(page.getByRole('link', { name: /Read in English/ })).toHaveAttribute('href', '/en/');
  await expect(page.getByRole('link', { name: /阅读中文文档/ })).toHaveAttribute('href', '/zh/');

  await page.goto('/en/docs/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Fronts 2.0 Documentation');

  await page.goto('/zh/docs/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Fronts 2.0 文档');
});

test('navigates runtime documentation in both locales', async ({ page }) => {
  await page.goto('/en/docs/runtime/host-runtime-api/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Host Runtime API');
  await expect(
    page.getByRole('heading', { level: 2, name: 'The mount transaction' }),
  ).toBeVisible();

  await page.goto('/zh/docs/runtime/host-runtime-api/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Host 运行时 API');
  await expect(page.getByRole('heading', { level: 2, name: '挂载事务' })).toBeVisible();
});

test('searches English and Chinese static indexes', async ({ page }) => {
  await page.goto('/en/docs/');
  await page.locator('[data-search-full]').click();
  const englishSearch = page.getByRole('dialog');
  await englishSearch.getByRole('textbox').fill('capability');
  await expect(englishSearch).toContainText(/Capability|Application contract/i);

  await page.keyboard.press('Escape');
  await page.goto('/zh/docs/');
  await page.locator('[data-search-full]').click();
  const chineseSearch = page.getByRole('dialog');
  await chineseSearch.getByRole('textbox').fill('能力');
  await expect(chineseSearch).toContainText(/能力|应用契约/);
});
