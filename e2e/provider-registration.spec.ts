import { test, expect, Page } from '@playwright/test';
import { generateTestEmail, fillInput, submitForm, navigateTo } from './helpers';

test.describe('Provider Registration Flow', () => {
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await navigateTo(page, '/provider/register');
  });

  test.afterEach(async () => {
    if (page && !page.isClosed()) {
      await page.close();
    }
  });

  test('should complete provider registration successfully', async () => {
    const email = generateTestEmail('provider');

    await fillInput(page, '#fullName', 'Test Provider');
    await fillInput(page, '#email', email);
    await page.selectOption('#gpuModel', 'RTX 4090');
    await page.selectOption('#locationCountry', 'US');
    await page.selectOption('#operatingSystem', 'Ubuntu 22.04');
    await page.locator('input[name="pdplConsent"]').check();

    await submitForm(page);

    await expect(page.locator('text=Registration successful')).toBeVisible();
    await expect(page.locator('text=Your API Key')).toBeVisible();
  });

  test('should reject invalid email', async () => {
    await fillInput(page, '#fullName', 'Test Provider');
    await fillInput(page, '#email', 'invalid-email');
    await page.selectOption('#gpuModel', 'RTX 4090');
    await page.selectOption('#locationCountry', 'US');
    await page.selectOption('#operatingSystem', 'Ubuntu 22.04');
    await page.locator('input[name="pdplConsent"]').check();

    const submitButton = page.locator('button[type="submit"]').first();
    await expect(submitButton).toBeDisabled();
    await expect(page.locator('text=Valid email address is required')).toBeVisible();
  });

  test('should require consent before submission', async () => {
    const email = generateTestEmail('provider');

    await fillInput(page, '#fullName', 'Test Provider');
    await fillInput(page, '#email', email);
    await page.selectOption('#gpuModel', 'RTX 4090');
    await page.selectOption('#locationCountry', 'US');
    await page.selectOption('#operatingSystem', 'Ubuntu 22.04');

    const submitButton = page.locator('button[type="submit"]').first();
    await expect(submitButton).toBeDisabled();
    await expect(page.locator('text=Complete the readiness checklist above to enable registration.')).toBeVisible();
  });

  test('should require all fields', async () => {
    const submitButton = page.locator('button[type="submit"]').first();
    await expect(submitButton).toBeDisabled();
    await expect(page.locator('text=Complete the readiness checklist above to enable registration.')).toBeVisible();
  });

  test('should unlock submit once required provider fields are complete', async () => {
    const email = generateTestEmail('provider');

    await fillInput(page, '#fullName', 'Test Provider');
    await fillInput(page, '#email', email);
    await page.selectOption('#gpuModel', 'RTX 4090');
    await page.selectOption('#locationCountry', 'US');
    await page.selectOption('#operatingSystem', 'Ubuntu 22.04');
    await page.locator('input[name="pdplConsent"]').check();

    await expect(page.locator('button[type="submit"]').first()).toBeEnabled();
  });

  test('should show inline error when custom GPU has no VRAM value', async () => {
    const email = generateTestEmail('provider');

    await fillInput(page, '#fullName', 'Custom GPU Provider');
    await fillInput(page, '#email', email);
    await page.selectOption('#gpuModel', 'Other');
    await page.selectOption('#locationCountry', 'US');
    await page.selectOption('#operatingSystem', 'Ubuntu 22.04');
    await page.locator('input[name="pdplConsent"]').check();

    const submitButton = page.locator('button[type="submit"]').first();
    await expect(submitButton).toBeDisabled();
    await expect(page.locator('text=VRAM is required when you choose Other.')).toBeVisible();
  });

  test('should keep submit disabled when custom GPU VRAM is zero', async () => {
    const email = generateTestEmail('provider');

    await fillInput(page, '#fullName', 'Custom GPU Provider');
    await fillInput(page, '#email', email);
    await page.selectOption('#gpuModel', 'Other');
    await fillInput(page, '#vram', '0');
    await page.selectOption('#locationCountry', 'US');
    await page.selectOption('#operatingSystem', 'Ubuntu 22.04');
    await page.locator('input[name="pdplConsent"]').check();

    const submitButton = page.locator('button[type="submit"]').first();
    await expect(submitButton).toBeDisabled();
    await expect(page.locator('text=VRAM must be greater than 0.')).toBeVisible();
  });
});
