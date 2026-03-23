# End-to-End (E2E) Test Suite

This directory contains Playwright E2E tests for the DCP platform, covering critical user flows: provider registration, resource listing, renter registration, job submission, execution, and payment settlement.

## Quick Start

### Installation

```bash
npm install
npx playwright install
```

### Running Tests Locally

```bash
# Run all E2E tests
npm run test:e2e

# Run tests in debug mode (opens browser)
npm run test:e2e:debug

# Run tests in UI mode (interactive mode)
npm run test:e2e:ui

# Run specific test file
npx playwright test e2e/provider-registration.spec.ts

# Run tests matching a pattern
npx playwright test --grep "provider"
```

## Test Structure

### Test Files

- **`provider-registration.spec.ts`** - Provider signup flow and validation
- **`provider-onboarding.spec.ts`** - GPU resource listing and setup
- **`renter-registration.spec.ts`** - Renter signup and marketplace access
- **`job-submission.spec.ts`** - Job submission and parameter selection
- **`job-execution.spec.ts`** - Job execution status, payment tracking, provider earnings
- **`helpers.ts`** - Shared test utilities and helper functions

### Test Coverage

Each test file covers:
- Happy path (successful user flows)
- Input validation (email, password requirements)
- Error handling (invalid inputs, missing fields)
- Navigation between pages
- UI element visibility and interactions

## Test Flows

### Provider Flow
1. **Registration** → Email/password validation → Account creation
2. **Onboarding** → GPU listing → Resource setup
3. **Dashboard** → View assigned jobs → Execute jobs → Earnings tracking

### Renter Flow
1. **Registration** → Email/password validation → Account creation
2. **Marketplace** → Browse providers → Filter resources
3. **Job Submission** → Select provider → Fill job parameters → Submit
4. **Job Management** → View status → Monitor execution → Track costs
5. **Billing** → View payment history → Add payment methods

## Writing New Tests

### Pattern

```typescript
test.describe('Feature Name', () => {
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    // Setup: login, navigate, etc
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('should do something', async () => {
    // Arrange
    await navigateTo(page, '/path');

    // Act
    await fillInput(page, 'input[type="email"]', 'test@example.com');
    await submitForm(page);

    // Assert
    await expectVisibleWithText(page, 'Success');
  });
});
```

### Helper Functions

- `generateTestEmail()` - Create unique test emails
- `fillInput()` - Fill form fields with retry logic
- `submitForm()` - Submit forms and wait for navigation
- `expectVisibleWithText()` - Check element visibility
- `navigateTo()` - Navigate with proper wait states
- `isLoggedIn()` - Check authentication state

## CI/CD Integration

Tests run automatically on:
- Push to `main` or `develop` branches
- Pull requests to `main` or `develop` branches

Workflow file: `.github/workflows/e2e-tests.yml`

### GitHub Actions Output

- Test reports in HTML format (Playwright Report)
- JSON test results for CI/CD analysis
- Screenshots/videos for failed tests
- Artifacts retained for 7-30 days

## Debugging

### View Failed Test Details

```bash
# After a test failure, view the HTML report
npx playwright show-report
```

### Debug Mode

```bash
# Opens interactive Playwright inspector
npm run test:e2e:debug
```

### Check Test Video

Videos are saved for failed tests in `test-results/` directory.

## Configuration

### `playwright.config.ts`

Key settings:
- **baseURL**: `http://localhost:3000` (must match your dev server)
- **timeout**: 30 seconds per test
- **retries**: 2 retries in CI, 0 locally
- **browsers**: Chromium (add Firefox/Safari as needed)
- **workers**: 1 worker (sequential tests for data isolation)

### Environment Variables

- `CI=true` - Used to configure test behavior for CI runs
- `BASE_URL` - Override test server URL if needed

## Troubleshooting

### Tests timeout
- Ensure dev server is running: `npm run dev`
- Check network conditions
- Increase timeout in `playwright.config.ts` if needed

### Flaky tests
- Use proper wait strategies (waitForLoadState, waitForURL)
- Avoid hardcoded waits; use dynamic waits instead
- Verify selectors are stable (data-testid preferred)

### Selector not found
- Use browser DevTools to find correct selector
- Prefer `data-testid` attributes > aria labels > visible text
- Test selectors in Playwright Inspector

### Authentication issues
- Check email/password validation logic in app
- Verify test user can actually register
- Check session/cookie handling

## Best Practices

1. **Isolation**: Each test should be independent (use unique emails)
2. **Selectors**: Prefer `data-testid` > `aria-label` > CSS class > text
3. **Waits**: Use `waitForLoadState()`, `waitForURL()` instead of `sleep()`
4. **Cleanup**: Always close browser pages in `afterEach`
5. **Descriptive names**: Test names should clearly describe what's being tested
6. **No hardcoded waits**: Rely on Playwright's auto-wait mechanisms

## Maintenance

### Regular Tasks

- **Weekly**: Review flaky test reports and fix root causes
- **After UI changes**: Update selectors and test expectations
- **After API changes**: Update test data and assertions
- **Quarterly**: Review test coverage and add missing flows

### Adding New Tests

When adding new features:
1. Create new `.spec.ts` file in `e2e/` directory
2. Add helper functions to `helpers.ts` if needed
3. Follow existing test patterns
4. Run locally: `npm run test:e2e`
5. Commit with E2E test file changes

## Performance Notes

- Each test takes ~10-30 seconds
- Full suite takes ~3-5 minutes
- CI runs on every push, keep in mind
- Sequential execution (1 worker) ensures data isolation

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Best Practices](https://playwright.dev/docs/best-practices)
- [API Reference](https://playwright.dev/docs/api/class-page)
- [Debugging Guide](https://playwright.dev/docs/debug)
