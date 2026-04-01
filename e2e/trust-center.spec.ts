import { expect, test } from '@playwright/test'

test.describe('Trust Center', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      ;(window as unknown as { __dc1Events: Array<Record<string, unknown>> }).__dc1Events = []
      window.addEventListener('dc1_analytics', (evt) => {
        const custom = evt as CustomEvent<Record<string, unknown>>
        ;(window as unknown as { __dc1Events: Array<Record<string, unknown>> }).__dc1Events.push(custom.detail)
      })
    })
  })

  test('renders trust-center sections with evidence state parity', async ({ page }) => {
    await page.goto('/trust-center')

    await expect(page.getByTestId('trust-center-sections')).toBeVisible()
    await expect(page.getByTestId('trust-section-compliance')).toBeVisible()
    await expect(page.getByTestId('trust-section-evidence')).toBeVisible()
    await expect(page.getByTestId('trust-section-roadmap')).toBeVisible()

    await expect(page.getByTestId('artifact-link-security-whitepaper')).toBeVisible()
    await expect(page.getByTestId('artifact-placeholder-audit-log-export-contract')).toBeVisible()

    const whitepaperHref = await page.getByTestId('artifact-link-security-whitepaper').getAttribute('href')
    expect(whitepaperHref).toBe('/docs/enterprise-trust-package/section-5-security-whitepaper')
  })

  test('supports EN/AR toggle with RTL and LTR token preservation', async ({ page }) => {
    await page.goto('/trust-center')

    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr')

    await page.getByRole('button', { name: /Switch to Arabic|العربية/ }).click()
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')

    const tokenContainer = page.getByText('/support?category=enterprise&source=trust-center')
    await expect(tokenContainer).toBeVisible()
    await expect(tokenContainer.locator('xpath=ancestor::*[@dir="ltr"][1]')).toBeVisible()
  })

  test('fires trust_center telemetry on CTA click', async ({ page }) => {
    await page.goto('/trust-center')

    await page.getByTestId('trust-cta-primary').click()

    const events = await page.evaluate(() => {
      return (window as unknown as { __dc1Events: Array<Record<string, unknown>> }).__dc1Events
    })

    const ctaEvent = events.find((event) => event.event === 'trust_center_cta_clicked')
    expect(ctaEvent).toBeTruthy()
    expect(ctaEvent?.source_page).toBe('trust_center')
  })
})
