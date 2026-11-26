const { test, expect } = require('@playwright/test');

const APP_URL = process.env.JUPITERASTRO_URL ||
  'https://www.jupiterastrology108.com/8a9K79m85R0t2B7x6C7p48n8V16d0J85.html';

test('live application loads and exposes Kundali entry form', async ({ page }) => {
  const pageErrors = [];
  const failedRequests = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('requestfailed', request => {
    const url = request.url();
    if (!/fonts.googleapis.com|fonts.gstatic.com|google-analytics|googletagmanager/i.test(url)) {
      failedRequests.push({ url, error: request.failure()?.errorText || 'request failed' });
    }
  });

  const response = await page.goto(APP_URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
  expect(response, 'The application document should return an HTTP response').toBeTruthy();
  expect(response.status(), 'The application document should return HTTP 200').toBe(200);
  await expect(page).toHaveTitle(/JupiterAstro Kundali Research Tool/i);
  await expect(page.locator('#mainForm')).toBeVisible({ timeout: 45000 });
  await expect(page.locator('#dob')).toBeAttached();
  await expect(page.locator('#tob')).toBeAttached();
  await expect(page.locator('#pob')).toBeAttached();

  // The correction reference is a critical dependency of the hybrid longitude engine.
  const referenceUrl = new URL('/data/Planetary%20Transit%20correction%20v4.json', APP_URL).toString();
  const referenceResponse = await page.request.get(referenceUrl, { timeout: 90000 });
  expect(referenceResponse.status(), 'Planetary correction JSON should be reachable').toBe(200);
  const reference = await referenceResponse.json();
  expect(reference).toBeTruthy();
  expect(typeof reference).toBe('object');

  // Wait for deferred application initialization and capture runtime failures.
  await page.waitForTimeout(5000);
  await page.screenshot({ path: 'test-results/live-home.png', fullPage: true });
  expect(pageErrors, 'Uncaught browser JavaScript errors').toEqual([]);
  expect(failedRequests, 'Failed non-analytics network requests').toEqual([]);
});
