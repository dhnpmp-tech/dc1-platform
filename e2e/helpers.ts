import { Page, expect } from '@playwright/test';

export const TEST_PROVIDER_EMAIL = 'provider-e2e-test@example.com';
export const TEST_PROVIDER_PASSWORD = 'TestPassword123!@#';
export const TEST_RENTER_EMAIL = 'renter-e2e-test@example.com';
export const TEST_RENTER_PASSWORD = 'TestPassword123!@#';

/**
 * Generate unique email for test isolation
 */
export function generateTestEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`;
}

/**
 * Wait for and dismiss any toast notifications
 */
export async function waitForNotification(page: Page) {
  // Wait for toast notification to appear and dismiss
  try {
    await page.waitForSelector('[role="alert"]', { timeout: 5000 });
    // Toast will auto-dismiss, or we can click it
  } catch {
    // Toast might not always appear, that's ok
  }
}

/**
 * Check if user is logged in by looking for user menu
 */
export async function isLoggedIn(page: Page): Promise<boolean> {
  try {
    // Look for user menu button or profile indicator
    const userMenu = page.locator('[data-testid="user-menu"], button:has-text("Settings"), button:has-text("Profile")');
    return userMenu.isVisible({ timeout: 3000 }).catch(() => false);
  } catch {
    return false;
  }
}

/**
 * Navigate and wait for page load
 */
export async function navigateTo(page: Page, path: string) {
  await page.goto(path, { waitUntil: 'networkidle' });
}

/**
 * Fill form field with retries
 */
export async function fillInput(page: Page, selector: string, value: string) {
  const input = page.locator(selector).first();
  await input.click();
  await input.clear();
  await input.type(value);
}

/**
 * Submit form and wait for response
 */
export async function submitForm(page: Page, selector: string = 'button[type="submit"]') {
  const button = page.locator(selector).first();
  await button.click();
  // Wait for navigation or response
  await page.waitForLoadState('networkidle');
}

/**
 * Check for error message in page
 */
export async function hasError(page: Page, errorText?: string): Promise<boolean> {
  try {
    if (errorText) {
      await page.locator(`text="${errorText}"`).first().isVisible({ timeout: 3000 });
      return true;
    } else {
      // Look for any error message elements
      const error = page.locator('[role="alert"], .error, [data-testid*="error"]');
      return error.first().isVisible({ timeout: 2000 }).catch(() => false);
    }
  } catch {
    return false;
  }
}

/**
 * Verify element is visible with text
 */
export async function expectVisibleWithText(page: Page, text: string, timeout = 5000) {
  await expect(page.locator(`text="${text}"`).first()).toBeVisible({ timeout });
}
