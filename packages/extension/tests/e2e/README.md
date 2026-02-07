# E2E Testing for SCE2 Extension

This directory contains end-to-end tests for the SCE2 Chrome Extension using Playwright and chrome-devtools MCP integration.

## Test Structure

```
tests/e2e/
├── playwright.config.ts      # Playwright configuration
├── fixtures.ts               # Custom test fixtures
├── helpers/
│   ├── chrome-devtools.ts    # Chrome DevTools MCP integration
│   └── section-fixture.ts    # Form interaction helpers
└── scenarios/
    ├── full-flow.spec.ts           # Complete workflow tests
    ├── extension-integration.spec.ts # Extension API tests
    ├── additional-customer.spec.ts  # Section-specific tests
    ├── project.spec.ts
    ├── trade-ally.spec.ts
    ├── assessment.spec.ts
    ├── household.spec.ts
    ├── enrollment.spec.ts
    ├── equipment.spec.ts
    ├── basic-enrollment.spec.ts
    ├── bonus.spec.ts
    ├── terms.spec.ts
    ├── comments.spec.ts
    └── status.spec.ts
```

## Setup

### 1. Install Dependencies

```bash
cd packages/extension
npm install
```

### 2. Build Extension

```bash
npm run build
```

### 3. Load Extension in Chrome

For manual testing:
1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select `packages/extension/dist/`

For automated testing, the extension is loaded via Playwright config.

## Running Tests

### Run All E2E Tests

```bash
cd packages/extension
npm run test:e2e
```

### Run Specific Test File

```bash
npx playwright test scenarios/full-flow.spec.ts
```

### Run with UI Mode

```bash
npx playwright test --ui
```

### Run with Debugging

```bash
npx playwright test --debug
```

### Run Specific Test

```bash
npx playwright test -g "should extract customer name"
```

## Chrome DevTools MCP Integration

The chrome-devtools MCP integration allows inspecting and interacting with the loaded extension during tests.

### Available MCP Tools

- `mcp__chrome-devtools__list_pages` - List all open pages including extension pages
- `mcp__chrome-devtools__select_page` - Select a page for interaction
- `mcp__chrome-devtools__take_snapshot` - Get page content structure
- `mcp__chrome-devtools__click` - Click elements
- `mcp__chrome-devtools__fill` - Fill form fields
- `mcp__chrome-devtools__evaluate_script` - Run custom JavaScript

### Extension Inspector Helper

```typescript
import { ExtensionInspector } from './helpers/chrome-devtools';

const inspector = new ExtensionInspector();
const backgroundPage = await inspector.inspectBackgroundPage();
const contentScript = await inspector.inspectContentScript('https://sce.dsmcentral.com/');
```

## Test Fixtures

### `extensionTest`

Custom fixture that extends Playwright's base test:

```typescript
import { extensionTest } from './fixtures';

extensionTest('my test', async ({ extensionId, extensionPage }) => {
  // extensionId - The loaded extension's ID
  // extensionPage - The extension's background page
});
```

### `sectionTest`

Fixture for SCE website navigation:

```typescript
import { sectionTest } from './helpers/section-fixture';

sectionTest('section test', async ({ page, navigateToSection }) => {
  await page.goto('https://sce.dsmcentral.com/');
  const section = await navigateToSection('Project Information');
});
```

### `formFieldTest`

Fixture for Angular Material form interaction:

```typescript
import { formFieldTest } from './helpers/section-fixture';

formFieldTest('form test', async ({ page, findByLabel }) => {
  await page.goto('https://sce.dsmcentral.com/');

  const titleField = await findByLabel('Title');
  await titleField.fill('Mr.');
});
```

## Section Testing

Each form section has its own test file:

- `additional-customer.spec.ts` - 18 fields
- `project.spec.ts` - 3 fields + Zillow integration
- `trade-ally.spec.ts` - 5 fields
- `assessment.spec.ts` - 11 fields
- `household.spec.ts` - 2 fields
- `enrollment.spec.ts` - 2 fields
- `equipment.spec.ts` - 3 fields
- `basic-enrollment.spec.ts` - 2 fields
- `bonus.spec.ts` - 2 fields
- `terms.spec.ts` - 2 fields
- `comments.spec.ts` - 1 field
- `status.spec.ts` - 2 fields

## Writing New Tests

### Example: Section Extraction Test

```typescript
import { test, expect } from '@playwright/test';
import { sectionTest } from '../helpers/section-fixture';

sectionTest.describe('My Section', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('https://sce.dsmcentral.com/');
  });

  test('should extract field', async ({ page }) => {
    // Navigate to section
    // Extract data
    // Assert results
  });

  test('should fill field', async ({ page }) => {
    // Navigate to section
    // Fill field
    // Verify value
  });
});
```

### Example: Extension Message Test

```typescript
import { test, expect } from '@playwright/test';

test('content script responds to messages', async ({ page }) => {
  await page.goto('https://sce.dsmcentral.com/');

  const result = await page.evaluate(async () => {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { action: 'GET_CURRENT_SECTION' },
        resolve
      );
    });
  });

  expect(result).toHaveProperty('section');
});
```

## Debugging Failed Tests

### 1. Run with --headed flag

```bash
npx playwright test --headed
```

### 2. Use Playwright Inspector

```bash
npx playwright test --debug
```

### 3. View Trace Files

Failed tests generate trace files:

```bash
npx playwright show-trace trace.zip
```

### 4. Screenshots

Screenshots are saved to `test-results/` on failure.

### 5. Console Logs

View extension console logs:

```typescript
page.on('console', msg => {
  console.log('PAGE LOG:', msg.text());
});
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run build
      - run: npm run test:e2e
```

## Troubleshooting

### Extension Not Loading

1. Check `manifest.json` for syntax errors
2. Run `npm run build` to rebuild
3. Verify extension path in `playwright.config.ts`

### Selector Not Found

1. Use Chrome DevTools to inspect the actual DOM
2. Check for dynamic IDs or classes
3. Use `section-fixture.ts` helpers for Angular Material

### Timeout Errors

1. Increase timeout in test:
   ```typescript
   test.setTimeout(60000); // 60 seconds
   ```
2. Check for slow network conditions
3. Verify website is accessible

## Best Practices

1. **Use section fixtures** - They provide navigation helpers
2. **Test isolation** - Each test should work independently
3. **Wait for elements** - Use `waitForElement` from section-fixture
4. **Clean up** - Close pages and clear storage between tests
5. **Meaningful assertions** - Assert specific values, not just truthiness
6. **Error logging** - Use error-handler.ts utilities for robust tests

## Coverage Tracking

Track test coverage by section:

| Section | Extraction | Filling | E2E |
|---------|-----------|---------|-----|
| Customer Info | ✅ | ✅ | ✅ |
| Additional Customer | ✅ | ✅ | 🔄 |
| Project | ✅ | ✅ | 🔄 |
| Trade Ally | ✅ | ✅ | 🔄 |
| Assessment | ✅ | ✅ | 🔄 |
| Household | ✅ | ✅ | 🔄 |
| Enrollment | ✅ | ✅ | 🔄 |
| Equipment | ✅ | ✅ | 🔄 |
| Basic Enrollment | ✅ | ✅ | 🔄 |
| Bonus | ✅ | ✅ | 🔄 |
| Terms | ✅ | ✅ | 🔄 |
| Comments | ✅ | ✅ | 🔄 |
| Status | ✅ | ✅ | 🔄 |

Legend:
- ✅ Complete
- 🔄 In Progress
- ⏳ Not Started

## Contributing

When adding new sections:

1. Create section type in `src/lib/sections/`
2. Add extraction function to `sections-extractor.ts`
3. Add fill method to `sce-helper.ts`
4. Create test file in `tests/e2e/scenarios/`
5. Update this README with coverage status

## Resources

- [Playwright Documentation](https://playwright.dev/)
- [Chrome Extension MV3](https://developer.chrome.com/docs/extensions/mv3/)
- [Angular Material Testing](https://material.angular.io/guide/testing)
