import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test.beforeEach(async ({ page }) => {
  // Reproducible offline basemap: HTTP error exercises fallback without external calls.
  await page.route('https://basemaps.cartocdn.com/**', (route) =>
    route.fulfill({ status: 503, body: 'Offline test' }),
  );
});
test('responsive console, offline map, consistent filters and keyboard investigation', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (message) => {
    if (
      message.type() === 'warning' ||
      (message.type() === 'error' && !message.text().includes('Failed to load resource'))
    )
      errors.push(message.text());
  });
  let workerLoaded = false;
  page.on('response', (response) => {
    if (response.url().includes('maplibre-gl-worker') && response.status() === 200)
      workerLoaded = true;
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Response overview' })).toBeVisible();
  await expect(page.getByText('Basemap unavailable — showing incident layer only')).toBeVisible();
  await expect.poll(() => workerLoaded).toBe(true);
  await page.waitForTimeout(1500);
  for (const width of [1920, 1440, 1280, 1024, 768, 390]) {
    await page.setViewportSize({ width, height: 1080 });
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    const clipped = await page
      .locator('.kpi-label, .kpi-trend, .kpi-bottom, .analytics-heading, .feed-footer')
      .evaluateAll((elements) =>
        elements.filter((el) => el.scrollWidth > el.clientWidth + 1).map((el) => el.textContent),
      );
    expect(clipped).toEqual([]);
    await page.screenshot({ path: `test-results/console-${width}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: /Awaiting response/ }).click();
  const table = page.getByRole('table');
  const rowCount = Number(await table.getAttribute('aria-rowcount')) - 1;
  const card = page.getByRole('button', { name: /Total incidents/ });
  await expect(card.locator('.kpi-value')).toHaveText(String(rowCount));
  await page.getByRole('row').nth(1).click();
  await expect(
    page.getByRole('dialog').getByText('Simulated incident · Chennai operations'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Assign demo responder' }).click();
  await expect(page.getByRole('button', { name: 'Mark arrived' })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.keyboard.press('Control+k');
  await expect(page.getByRole('dialog', { name: 'Search SafeMeter' })).toBeVisible();
  await page.keyboard.press('Escape');
  expect(errors).toEqual([]);
});
test('no serious accessibility violations on initial console and drawer', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await expect(page.getByText('Basemap unavailable — showing incident layer only')).toBeVisible();
  await page.waitForTimeout(500);
  let report = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(report.violations).toEqual([]);
  await page.getByRole('row').nth(1).click();
  report = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(report.violations).toEqual([]);
});
