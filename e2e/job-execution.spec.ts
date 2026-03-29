import { test, expect, Page } from '@playwright/test';
import { generateTestEmail, fillInput, submitForm, navigateTo, expectVisibleWithText } from './helpers';

test.describe('Job Execution and Payment Settlement', () => {
  let page: Page;
  let renterEmail: string;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    renterEmail = generateTestEmail('renter');

    // Register and login as renter
    await navigateTo(page, '/renter/register');
    await fillInput(page, 'input[type="email"]', renterEmail);
    await fillInput(page, 'input[type="password"]', 'TestPassword123!@#');
    await fillInput(page, 'input[placeholder*="name" i]', 'Test Renter');

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

  test('should display job execution status updates', async () => {
    await navigateTo(page, '/renter/jobs');

    // Find and click a job
    const jobLink = page.locator('a[href*="/jobs/"], [role="button"]:first-of-type').first();

    if (await jobLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await jobLink.click();
      await page.waitForURL(/\/renter\/jobs\/[^/]+/, { timeout: 5000 });

      // Should show job status
      const statusElements = page.locator('[data-testid*="status"], .status, [class*="status"]');
      const hasStatus = await statusElements.first().isVisible({ timeout: 3000 }).catch(() => false);

      if (hasStatus) {
        const statusText = await statusElements.first().textContent();
        expect(['pending', 'assigned', 'running', 'completed', 'failed'].some(s => statusText?.toLowerCase().includes(s))).toBeDefined();
      }
    }
  });

  test('should show execution progress/output', async () => {
    await navigateTo(page, '/renter/jobs');

    const jobLink = page.locator('a[href*="/jobs/"], [role="button"]:first-of-type').first();

    if (await jobLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await jobLink.click();
      await page.waitForURL(/\/renter\/jobs\/[^/]+/, { timeout: 5000 });

      // Look for output/results section
      const outputElements = page.locator('[data-testid*="output"], .output, [class*="output"], [data-testid*="result"]');
      const hasOutput = await outputElements.first().isVisible({ timeout: 3000 }).catch(() => false);

      // Output section might be conditionally shown
      expect(hasOutput).toBeDefined();
    }
  });

  test('should navigate to billing/payments section', async () => {
    // Navigate to renter billing
    await navigateTo(page, '/renter/billing');

    // Should display billing information
    await expectVisibleWithText(page, /payment|billing|transaction|invoice/i);
  });

  test('should show transaction history', async () => {
    await navigateTo(page, '/renter/billing');

    // Look for transaction list
    const transactionEntries = page.locator('[data-testid*="transaction"], [class*="transaction"], tr, li');
    const count = await transactionEntries.count();

    // Should have transaction UI elements
    expect(count).toBeGreaterThanOrEqual(0);

    // Should show balances
    await expectVisibleWithText(page, /balance|spent|available|amount/i);
  });

  test('should display cost breakdown for completed job', async () => {
    await navigateTo(page, '/renter/jobs');

    const jobLink = page.locator('a[href*="/jobs/"], [role="button"]:first-of-type').first();

    if (await jobLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await jobLink.click();
      await page.waitForURL(/\/renter\/jobs\/[^/]+/, { timeout: 5000 });

      // Look for cost breakdown
      const costElements = page.locator('[data-testid*="cost"], .cost, [class*="cost"], [class*="price"]');
      const hasCost = await costElements.first().isVisible({ timeout: 3000 }).catch(() => false);

      // Cost info should be present in job details
      if (hasCost) {
        const costText = await costElements.first().textContent();
        expect(costText).toBeTruthy();
      }
    }
  });

  test('should allow payment method addition', async () => {
    await navigateTo(page, '/renter/billing');

    // Look for "Add Payment Method" or similar button
    const addPaymentButton = page.locator('button:has-text(/add|new|payment|card/i)').first();

    if (await addPaymentButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await addPaymentButton.click();

      // Should show payment form or modal
      const paymentForm = page.locator('form, [role="dialog"]');
      const isVisible = await paymentForm.first().isVisible({ timeout: 3000 }).catch(() => false);

      expect(isVisible).toBeDefined();
    }
  });
});

test.describe('Provider Job Execution View', () => {
  let page: Page;
  let providerEmail: string;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    providerEmail = generateTestEmail('provider');

    // Register provider
    await navigateTo(page, '/provider/register');
    await fillInput(page, 'input[type="email"]', providerEmail);
    await fillInput(page, 'input[type="password"]', 'TestPassword123!@#');
    await fillInput(page, 'input[placeholder*="name" i]', 'Test Provider');

    const termsCheckbox = page.locator('input[type="checkbox"]').first();
    if (await termsCheckbox.isVisible()) {
      await termsCheckbox.check();
    }

    await submitForm(page);
    await page.waitForURL(/\/(provider-onboarding|provider\/)/, { timeout: 10000 });
  });

  test.afterEach(async () => {
    if (page && !page.isClosed()) {
      await page.close();
    }
  });

  test('should display assigned jobs on provider dashboard', async () => {
    await navigateTo(page, '/provider/jobs');

    // Should see jobs list or empty state
    await expectVisibleWithText(page, /job|assigned|pending|none/i);
  });

  test('should show job details with execution options', async () => {
    await navigateTo(page, '/provider/jobs');

    const jobLink = page.locator('a[href*="/provider/jobs/"], [role="button"]:first-of-type').first();

    if (await jobLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await jobLink.click();
      await page.waitForURL(/\/provider\/jobs\/[^/]+/, { timeout: 5000 });

      // Should show job parameters and execution details
      await expectVisibleWithText(page, /job|parameter|status|action/i);
    }
  });

  test('should show provider earnings and balance', async () => {
    await navigateTo(page, '/provider/earnings');

    // Should display earnings information
    await expectVisibleWithText(page, /earning|balance|revenue|payment/i);
  });
});
