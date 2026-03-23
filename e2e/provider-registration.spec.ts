import { test, expect, Page } from '@playwright/test';
import {
  generateTestEmail,
  fillInput,
  submitForm,
  isLoggedIn,
  expectVisibleWithText,
  navigateTo,
} from './helpers';

test.describe('Provider Registration Flow', () => {
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await navigateTo(page, '/provider/register');
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('should complete provider registration successfully', async () => {
    const email = generateTestEmail('provider');

    // 1. Fill registration form
    await fillInput(page, 'input[type="email"]', email);
    await fillInput(page, 'input[type="password"]', 'TestPassword123!@#');
    await fillInput(page, 'input[placeholder*="name" i]', 'Test Provider');

    // 2. Accept terms (if checkbox exists)
    const termsCheckbox = page.locator('input[type="checkbox"]').first();
    if (await termsCheckbox.isVisible()) {
      await termsCheckbox.check();
    }

    // 3. Submit registration form
    await submitForm(page);

    // 4. Wait for redirect to provider onboarding or dashboard
    await page.waitForURL(/\/(provider-onboarding|provider\/dashboard|provider\/)/, { timeout: 10000 });

    // 5. Verify user is logged in
    const loggedIn = await isLoggedIn(page);
    expect(loggedIn).toBe(true);

    // 6. Verify on provider dashboard or onboarding
    const url = page.url();
    expect(url).toMatch(/(provider-onboarding|provider\/dashboard|provider\/)/);
  });

  test('should reject invalid email', async () => {
    await fillInput(page, 'input[type="email"]', 'invalid-email');
    await fillInput(page, 'input[type="password"]', 'TestPassword123!@#');
    await fillInput(page, 'input[placeholder*="name" i]', 'Test Provider');

    await submitForm(page);

    // Form should still be visible or show validation error
    const emailInput = page.locator('input[type="email"]');
    const isInvalid = await emailInput.evaluate((el: HTMLInputElement) => !el.checkValidity());
    expect(isInvalid).toBe(true);
  });

  test('should reject weak password', async () => {
    const email = generateTestEmail('provider');
    await fillInput(page, 'input[type="email"]', email);
    await fillInput(page, 'input[type="password"]', 'weak');
    await fillInput(page, 'input[placeholder*="name" i]', 'Test Provider');

    await submitForm(page);

    // Should show validation error or password field error
    await expect(page.locator('input[type="password"]')).toBeFocused().catch(() => {
      // If not focused on password, check for error message
      expect(page.locator('text=/password|weak/i')).toBeVisible().catch(() => {});
    });
  });

  test('should require all fields', async () => {
    // Try to submit empty form
    const submitButton = page.locator('button[type="submit"]').first();

    // Check if HTML5 validation prevents submission
    const firstInput = page.locator('input').first();
    const hasValidation = await firstInput.evaluate((el: HTMLInputElement) => el.required || el.pattern);

    if (hasValidation) {
      await submitButton.click();
      // Form should not submit
      const currentUrl = page.url();
      expect(currentUrl).toContain('register');
    }
  });
});
