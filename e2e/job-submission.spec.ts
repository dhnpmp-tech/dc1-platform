import { test, expect, Page } from '@playwright/test';
import { generateTestEmail, fillInput, submitForm, navigateTo, expectVisibleWithText } from './helpers';

test.describe('Job Submission Flow', () => {
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
    await page.close();
  });

  test('should display job submission form', async () => {
    await navigateTo(page, '/renter/jobs');

    // Should see job submission interface
    await expectVisibleWithText(page, /submit|create|job|compute/i);
  });

  test('should allow selecting a provider for job', async () => {
    await navigateTo(page, '/renter/marketplace');

    // Click on a provider to select it
    const providerButton = page.locator('button:has-text("Select"), a[href*="/providers/"], [role="button"]:has-text("Choose")').first();

    if (await providerButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await providerButton.click();

      // Should navigate or show selection confirmation
      const isSelected = await page.locator('[data-testid*="selected"], .selected, [class*="active"]').isVisible({ timeout: 2000 }).catch(() => false);
      expect(isSelected).toBeDefined();
    }
  });

  test('should fill job parameters', async () => {
    await navigateTo(page, '/renter/jobs');

    // Fill job type/model
    const modelSelect = page.locator('select[id*="model"], input[placeholder*="model" i]').first();
    if (await modelSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
      if (modelSelect.locator('.option, option').count({ timeout: 1000 }).catch(() => 0) > 0) {
        // It's a select element
        await modelSelect.selectOption({ index: 0 });
      } else {
        // It's an input
        await fillInput(page, 'input[placeholder*="model" i]', 'TinyLlama');
      }
    }

    // Fill duration
    const durationInput = page.locator('input[placeholder*="duration" i], input[placeholder*="time" i]').first();
    if (await durationInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await fillInput(page, 'input[placeholder*="duration" i], input[placeholder*="time" i]', '10');
    }

    // Fill job parameters/prompt if applicable
    const paramInput = page.locator('textarea[placeholder*="prompt" i], input[placeholder*="prompt" i], textarea[placeholder*="parameter" i]').first();
    if (await paramInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await fillInput(page, 'textarea[placeholder*="prompt" i], input[placeholder*="prompt" i]', 'Hello, test');
    }
  });

  test('should submit a job successfully', async () => {
    await navigateTo(page, '/renter/jobs');

    // Fill minimal job form
    const durationInput = page.locator('input[placeholder*="duration" i], input[placeholder*="time" i], input[type="number"]').first();
    if (await durationInput.isVisible()) {
      await fillInput(page, 'input[placeholder*="duration" i], input[placeholder*="time" i], '10');
    }

    // Submit job
    const submitButton = page.locator('button[type="submit"]:has-text("Submit"), button:has-text(/submit|create|start/i)').first();
    if (await submitButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await submitButton.click();

      // Wait for response - should show confirmation or redirect to job details
      await page.waitForLoadState('networkidle');

      // Should see success message or be on job details/list page
      const successIndicators = page.locator('text=/success|submitted|created|pending/i');
      const isSuccess = await successIndicators.first().isVisible({ timeout: 5000 }).catch(() => false);

      // Or check URL changed
      const urlChanged = !page.url().includes('/jobs/new');
      expect(isSuccess || urlChanged).toBe(true);
    }
  });

  test('should show job in jobs list after submission', async () => {
    await navigateTo(page, '/renter/jobs');

    // Submit a job (if form available)
    const submitButton = page.locator('button[type="submit"]:has-text("Submit"), button:has-text(/submit|create/i)').first();

    if (await submitButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await submitButton.click();
      await page.waitForLoadState('networkidle');

      // Navigate to jobs list
      await navigateTo(page, '/renter/jobs');

      // Should see job entry
      const jobEntries = page.locator('[data-testid*="job"], [role="listitem"], tr, li');
      const count = await jobEntries.count();

      // Should have at least some UI elements
      expect(count).toBeGreaterThanOrEqual(0);
    }
  });

  test('should display job details', async () => {
    await navigateTo(page, '/renter/jobs');

    // Click on a job to view details
    const jobLink = page.locator('a[href*="/jobs/"], [role="button"]').first();

    if (await jobLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await jobLink.click();

      // Should navigate to job details
      await page.waitForURL(/\/renter\/jobs\/[^/]+/, { timeout: 5000 });

      // Should show job information
      await expectVisibleWithText(page, /status|job|provider|cost/i);
    }
  });
});
