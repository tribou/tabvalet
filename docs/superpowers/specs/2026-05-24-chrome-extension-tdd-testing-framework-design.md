# Design Specification: Chrome Extension TDD & Hybrid Testing Framework

This design document outlines the architecture, tooling, and workflow for introducing a robust, high-performance hybrid testing framework to the **Arc Vertical Tabs Sidebar** Chrome Extension. It enables strict Test-Driven Development (TDD) by balancing sub-second local unit test loops with comprehensive, real-browser end-to-end integration tests.

---

## Architectural Goals

1. **Sub-second Feedback Loop for Business Logic**:
   Allow developers to write and run unit tests for core extension behaviors (tab sorting, URL normalizations, state transformations) inside an ultra-fast, mock-driven local environment.

2. **Full-Fidelity End-to-End Testing**:
   Automate interaction tests within a real Chromium instance using the unpacked extension, validating that the sidepanel UI, background service worker, and storage layers synchronize correctly.

3. **Native ES Modules (Zero Bundler overhead)**:
   Avoid heavy and complex building/bundling configurations (like Webpack, Rollup, or Vite) for the production extension by leveraging Google Chrome's native support for ES Modules in MV3.

---

## Directory Structure

To introduce this framework, we will establish dedicated namespaces for production logic (`src/`) and testing suites (`tests/`):

```
joyful-pascal/
├── package.json
├── manifest.json              # Updated: background worker type="module"
├── sidepanel.html             # Updated: script type="module"
├── background.js              # Glue: background service worker importing logic modules
├── sidepanel.js               # Glue: sidepanel script importing logic modules
│
├── src/                       # NEW: Core, modularized business logic
│   ├── logic/
│   │   ├── tab-manager.js     # Pure business logic (matching, sorting, state transitions)
│   │   └── storage.js         # Pure wrappers around storage (chrome.storage.local/session)
│   └── utils/
│       └── url.js             # Pure URL normalization and matching logic
│
└── tests/                     # NEW: Comprehensive Test Suites
    ├── unit/
    │   ├── tab-manager.test.js  # Vitest unit tests for tab-manager logic
    │   └── url.test.js          # Vitest unit tests for URL normalization
    ├── e2e/
    │   ├── sidebar.spec.js      # Playwright integration tests (sidepanel DOM + background)
    │   └── fixtures.js          # Playwright custom fixtures for loading extension unpacked
    ├── setup.js               # Vitest testing environment initialization (chrome api mocks)
    └── playwright.config.js   # Playwright configuration
```

---

## Technical Specifications & Tooling Config

### 1. Production MV3 Module Enabling

To utilize native ES Modules inside Chrome extension components, we adjust declarations:

*   **`manifest.json`**:
    ```json
    "background": {
      "service_worker": "background.js",
      "type": "module"
    }
    ```
*   **`sidepanel.html`**:
    ```html
    <script type="module" src="sidepanel.js"></script>
    ```

### 2. Fast-Feedback Unit Testing (Vitest & JSDOM)

We use **Vitest** configured with the `jsdom` environment and the `jest-chrome` API mocking package to safely run tests under Node.js without throwing `ReferenceError: chrome is not defined`.

*   **`vitest.config.js`**:
    ```javascript
    import { defineConfig } from 'vitest/config';

    export default defineConfig({
      test: {
        environment: 'jsdom',
        setupFiles: ['./tests/setup.js'],
        globals: true,
      },
    });
    ```

*   **`tests/setup.js`**:
    ```javascript
    import { vi } from 'vitest';
    import 'jest-chrome';

    // Clear and reset mocks before each individual test
    beforeEach(() => {
      chrome.storage.local.clear();
      chrome.storage.session.clear();
      vi.clearAllMocks();
    });
    ```

### 3. End-to-End Integration Testing (Playwright)

We configure Playwright to launch a Chromium context with standard CLI arguments instructing Chrome to load our unpacked folder. 

*   **`tests/playwright.config.js`**:
    ```javascript
    import { defineConfig, devices } from '@playwright/test';

    export default defineConfig({
      testDir: './e2e',
      timeout: 30000,
      retries: 1,
      workers: 1, // Headful extension tests are best run sequentially
      reporter: 'list',
      use: {
        headless: false, // Required for extensions in Playwright
      },
      projects: [
        {
          name: 'chromium',
          use: { ...devices['Desktop Chrome'] },
        },
      ],
    });
    ```

*   **`tests/e2e/fixtures.js`**:
    ```javascript
    import { test as base, chromium } from '@playwright/test';
    import path from 'path';

    export const test = base.extend({
      context: async ({}, use) => {
        const pathToExtension = path.resolve(__dirname, '../../');
        const context = await chromium.launchPersistentContext('', {
          headless: false, // Extension testing requires headful or headless=new
          args: [
            `--disable-extensions-except=${pathToExtension}`,
            `--load-extension=${pathToExtension}`,
          ],
        });
        await use(context);
        await context.close();
      },
      extensionId: async ({ context }, use) => {
        let [background] = context.serviceWorkers();
        if (!background) {
          background = await context.waitForEvent('serviceworker');
        }
        const extensionId = background.url().split('/')[2];
        await use(extensionId);
      },
      sidepanelPage: async ({ context, extensionId }, use) => {
        const page = await context.newPage();
        await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
        await use(page);
        await page.close();
      }
    });

    export { expect } from '@playwright/test';
    ```

---

## Detailed Logic Extraction (Refactoring Plan)

To make code highly testable, we decouple "pure calculation logic" from "impure DOM update logic".

### 1. URL Normalization Logic (`src/utils/url.js`)
```javascript
export function normalizeUrl(url) {
  if (!url) return '';
  let clean = url.replace(/^(https?:\/\/)?(www\.)?/, '');
  clean = clean.split('#')[0].split('?')[0];
  clean = clean.replace(/\/$/, '');
  return clean.toLowerCase();
}
```

### 2. Tab Synchronization & Mapping Logic (`src/logic/tab-manager.js`)
Currently, `sidepanel.js` has a massive, stateful `syncOpenTabs` function. We extract the calculation block to a pure function:

```javascript
import { normalizeUrl } from '../utils/url.js';

/**
 * Calculates a new mapping dictionary between active open tab IDs and pinned tab IDs.
 * @param {Array} openTabs List of currently open tabs in the window
 * @param {Array} pinnedTabs List of currently stored pinned tabs
 * @param {Object} activePinnedMap Current active mappings cache
 * @returns {Object} A fresh dictionary map of openTabIdStr -> pinnedTabId
 */
export function calculateTabMappings(openTabs, pinnedTabs, activePinnedMap) {
  const nextMap = { ...activePinnedMap };
  const mappedPinnedIds = [];

  // 1. Identify existing active mappings
  for (const [tId, pId] of Object.entries(nextMap)) {
    const tIdNum = parseInt(tId);
    if (openTabs.some(o => o.id === tIdNum)) {
      mappedPinnedIds.push(pId);
    } else {
      delete nextMap[tId]; // Clean up obsolete mappings
    }
  }

  // 2. Scan remaining unmapped open tabs and match to pinned tabs by URL normalization
  openTabs.forEach(openTab => {
    const openTabIdStr = openTab.id.toString();
    if (nextMap[openTabIdStr] === undefined) {
      const match = pinnedTabs.find(pTab => {
        if (mappedPinnedIds.includes(pTab.id)) return false;
        
        const normOpen = normalizeUrl(openTab.url);
        const normPinned = normalizeUrl(pTab.pinnedUrl);
        const normActive = pTab.activeUrl ? normalizeUrl(pTab.activeUrl) : null;
        
        return normOpen === normPinned || normOpen === normActive;
      });
      
      if (match) {
        nextMap[openTabIdStr] = match.id;
        mappedPinnedIds.push(match.id);
      }
    }
  });

  return nextMap;
}
```

This allows us to test mapping edge cases in pure, lightning-fast unit tests (e.g. matching logic, cleaning up closed tabs, preventing double mapping) with zero DOM/Chrome environment.

---

## Verification Plan

We will verify the testing framework's operational success with a multi-step checklist:

### Automated Framework Validation
1. **Unit Suite Runs & Passes**:
   `npm run test` executes the unit tests (`tests/unit/*.test.js`) inside Node + JSDOM via Vitest in < 10ms.
2. **E2E Suite Runs & Passes**:
   `npm run test:e2e` successfully launches a Chromium browser with the extension loaded, navigates to the side panel view, and successfully runs through target actions (like validating empty states and tab rendering).

### Manual Verification
1. Load the unpacked extension folder inside a real Google Chrome browser (`chrome://extensions` → Load unpacked).
2. Open the sidebar, pin several tabs, navigate them, and verify that the extension remains fully operational, confirming that the ES module integration did not introduce runtime syntax or resolution errors.
