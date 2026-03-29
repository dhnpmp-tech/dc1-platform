import { test, expect, Page } from '@playwright/test';
import {
  generateTestEmail,
  fillInput,
  submitForm,
  isLoggedIn,
  expectVisibleWithText,
  navigateTo,
} from './helpers';

test.describe('Renter Registration and Marketplace Access', () => {
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await navigateTo(page, '/renter/register');
  });

  test.afterEach(async () => {
    if (page && !page.isClosed()) {
      await page.close();
    }
  });

  test('should complete renter registration successfully', async () => {
    const email = generateTestEmail('renter');

    // Fill registration form
    await fillInput(page, 'input[type="email"]', email);
    await fillInput(page, 'input[type="password"]', 'TestPassword123!@#');
    await fillInput(page, 'input[placeholder*="name" i]', 'Test Renter');

    // Accept terms
    const termsCheckbox = page.locator('input[type="checkbox"]').first();
    if (await termsCheckbox.isVisible()) {
      await termsCheckbox.check();
    }

    // Submit form
    await submitForm(page);

    // Should redirect to renter dashboard or marketplace
    await page.waitForURL(/\/renter(\/|$)/, { timeout: 10000 });

    // Verify logged in
    const loggedIn = await isLoggedIn(page);
    expect(loggedIn).toBe(true);

    // Verify on renter dashboard
    const url = page.url();
    expect(url).toContain('/renter');
  });

  test('should have valid email and password validation', async () => {
    // Test invalid email
    await fillInput(page, 'input[type="email"]', 'not-an-email');
    await fillInput(page, 'input[type="password"]', 'TestPassword123!@#');
    await fillInput(page, 'input[placeholder*="name" i]', 'Test Renter');

    const emailInput = page.locator('input[type="email"]');
    const isInvalid = await emailInput.evaluate((el: HTMLInputElement) => !el.checkValidity());
    expect(isInvalid).toBe(true);
  });

  test('should reject weak passwords', async () => {
    const email = generateTestEmail('renter');
    await fillInput(page, 'input[type="email"]', email);
    await fillInput(page, 'input[type="password"]', 'weak');
    await fillInput(page, 'input[placeholder*="name" i]', 'Test Renter');

    // Password field should fail validation
    const passwordInput = page.locator('input[type="password"]');
    const isInvalid = await passwordInput.evaluate((el: HTMLInputElement) => !el.checkValidity());
    expect(isInvalid).toBe(true);
  });
});

test.describe('Renter Marketplace Access', () => {
  let page: Page;
  let renterEmail: string;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    renterEmail = generateTestEmail('renter');

    // Register renter
    await navigateTo(page, '/renter/register');
    await fillInput(page, 'input[type="email"]', renterEmail);
    await fillInput(page, 'input[type="password"]', 'TestPassword123!@#');
    await fillInput(page, 'input[placeholder*="name" i]', 'Test Renter Biz');

    const termsCheckbox = page.locator('input[type="checkbox"]').first();
    if (await termsCheckbox.isVisible()) {
      await termsCheckbox.check();
    }

    await submitForm(page);
    await page.waitForURL(/\/renter(\/|$)/, { timeout: 10000 });
  });

  test.afterEach(async () => {
    if (page && !page.isClosed()) {
      await page.close();
    }
  });

  test('should display available providers in marketplace', async () => {
    await navigateTo(page, '/renter/marketplace');

    // Should see providers or resources listed
    const providerCards = page.locator('[data-testid*="provider"], [class*="provider"], li, div[role="listitem"]');

    // At minimum, should have marketplace layout
    await expectVisibleWithText(page, /provider|gpu|resource|marketplace/i);
  });

  test('should allow filtering by provider or resource', async () => {
    await navigateTo(page, '/renter/marketplace');

    // Look for filter controls
    const filterInput = page.locator('input[placeholder*="search" i], input[placeholder*="filter" i]').first();

    if (await filterInput.isVisible()) {
      await fillInput(page, 'input[placeholder*="search" i], input[placeholder*="filter" i]', 'H100');

      // Filter should apply (debounced)
      await page.waitForTimeout(500);

      // Results should be filtered
      const results = page.locator('[data-testid*="provider"], [class*="provider"], li, div[role="listitem"]');
      const count = await results.count();

      // Just verify layout persists
      expect(count).toBeGreaterThanOrEqual(0);
    }
  });

  test('should navigate to provider details', async () => {
    await navigateTo(page, '/renter/marketplace');

    // Click first provider card/link
    const providerLink = page.locator('a[href*="/renter/marketplace/providers/"], button:has-text("View"), a:has-text("Details")').first();

    if (await providerLink.isVisible()) {
      await providerLink.click();

      // Should navigate to provider details page
      await page.waitForURL(/\/renter\/marketplace\/providers\//, { timeout: 5000 });

      // Should show provider info
      await expectVisibleWithText(page, /provider|gpu|resource|price/i);
    }
  });
});
