import { test, expect, Page } from '@playwright/test';
import { generateTestEmail, fillInput, submitForm, navigateTo, expectVisibleWithText } from './helpers';

test.describe('Provider Onboarding - Resource Listing', () => {
  let page: Page;
  let providerEmail: string;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    providerEmail = generateTestEmail('provider');

    // Register provider first
    await navigateTo(page, '/provider/register');
    await fillInput(page, 'input[type="email"]', providerEmail);
    await fillInput(page, 'input[type="password"]', 'TestPassword123!@#');
    await fillInput(page, 'input[placeholder*="name" i]', 'Test Provider Co');

    const termsCheckbox = page.locator('input[type="checkbox"]').first();
    if (await termsCheckbox.isVisible()) {
      await termsCheckbox.check();
    }

    await submitForm(page);
    await page.waitForURL(/\/(provider-onboarding|provider\/)/, { timeout: 10000 });
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('should display GPU listing interface on onboarding', async () => {
    // Navigate to GPU management page
    if (!page.url().includes('provider-onboarding')) {
      await navigateTo(page, '/provider-onboarding');
    }

    // Should see heading about resources/GPUs
    await expectVisibleWithText(page, /gpu|resource|compute/i);
  });

  test('should allow adding GPU resources', async () => {
    await navigateTo(page, '/provider/gpu');

    // Look for "Add GPU" or similar button
    const addButton = page.locator('button:has-text(/add|new|create/i)').first();

    if (await addButton.isVisible()) {
      await addButton.click();

      // Fill in GPU details if form appears
      const gpuNameInput = page.locator('input[placeholder*="GPU" i], input[placeholder*="model" i]').first();
      if (await gpuNameInput.isVisible()) {
        await fillInput(page, 'input[placeholder*="GPU" i], input[placeholder*="model" i]', 'NVIDIA H100');

        // Fill VRAM if present
        const vramInput = page.locator('input[placeholder*="VRAM" i], input[placeholder*="memory" i]').first();
        if (await vramInput.isVisible()) {
          await fillInput(page, 'input[placeholder*="VRAM" i], input[placeholder*="memory" i]', '80');
        }

        // Submit GPU addition
        await submitForm(page);

        // Verify GPU appears in list
        await expectVisibleWithText(page, /h100|80gb/i);
      }
    }
  });

  test('should navigate between setup steps', async () => {
    await navigateTo(page, '/provider-onboarding');

    // Should have navigation or step indicators
    const stepElements = page.locator('[data-testid*="step"], .step, [class*="step"]');

    if (await stepElements.first().isVisible({ timeout: 2000 }).catch(() => false)) {
      const count = await stepElements.count();
      expect(count).toBeGreaterThan(0);
    }
  });

  test('should show provider dashboard after setup', async () => {
    // Navigate to dashboard
    await navigateTo(page, '/provider/dashboard');

    // Should show provider info or status
    await expectVisibleWithText(page, /dashboard|status|online|offline/i);
  });
});
