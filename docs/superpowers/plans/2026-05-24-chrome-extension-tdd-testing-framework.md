# Chrome Extension TDD & Hybrid Testing Framework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish a modern, zero-bundler Test-Driven Development (TDD) environment for the vertical tabs sidebar extension using Vitest for rapid unit testing and Playwright for real Chrome browser E2E tests.

**Architecture:** Refactor the codebase to leverage native ES modules in Manifest V3. Decouple impure DOM/Chrome operations from pure state calculation logic, allowing business rules (such as tab matching and sorting) to be test-driven locally under Node/JSDOM with sub-second feedback.

**Tech Stack:** Vitest, JSDOM, Playwright, jest-chrome, Native ES Modules.

---

## Technical File Layout mapping

Before starting, here is the exact responsibility of files being created/modified:
- `package.json` [MODIFY]: Manage dev dependencies and task scripts.
- `manifest.json` [MODIFY]: Enable module service worker via `"type": "module"`.
- `sidepanel.html` [MODIFY]: Load UI script via `<script type="module">`.
- `vitest.config.js` [NEW]: Configuration for Vitest with JSDOM.
- `tests/setup.js` [NEW]: Mock initialization mapping for `global.chrome`.
- `tests/playwright.config.js` [NEW]: Playwright E2E project configurations.
- `tests/e2e/fixtures.js` [NEW]: Playwright Chromium launching extensions recipe.
- `src/utils/url.js` [NEW]: Pure URL matching and comparison helpers.
- `src/logic/tab-manager.js` [NEW]: Pure mapping and sync calculations.
- `sidepanel.js` [MODIFY]: Import `calculateTabMappings` and handle DOM bindings.
- `background.js` [MODIFY]: Enable modular structure for background messaging.

---

### Task 1: Project & Tooling Setup

**Files:**
- Modify: `package.json`
- Create: `vitest.config.js`
- Create: `tests/setup.js`
- Create: `tests/playwright.config.js`

- [ ] **Step 1: Install testing framework dependencies**
  Run: `npm install -D vitest jsdom @playwright/test jest-chrome`
  Expected: Node packages install successfully.

- [ ] **Step 2: Create Vitest Configuration**
  Create `vitest.config.js` with content:
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

- [ ] **Step 3: Create Vitest Chrome Mock Setup**
  Create `tests/setup.js` with content:
  ```javascript
  import { vi } from 'vitest';
  import 'jest-chrome';

  beforeEach(() => {
    chrome.storage.local.clear();
    chrome.storage.session.clear();
    vi.clearAllMocks();
  });
  ```

- [ ] **Step 4: Create Playwright E2E Configuration**
  Create `tests/playwright.config.js` with content:
  ```javascript
  import { defineConfig, devices } from '@playwright/test';

  export default defineConfig({
    testDir: './e2e',
    timeout: 30000,
    retries: 1,
    workers: 1,
    reporter: 'list',
    use: {
      headless: false,
    },
    projects: [
      {
        name: 'chromium',
        use: { ...devices['Desktop Chrome'] },
      },
    ],
  });
  ```

- [ ] **Step 5: Add scripts to package.json**
  Modify `package.json` scripts:
  ```json
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test -c tests/playwright.config.js",
    "test:e2e:ui": "playwright test -c tests/playwright.config.js --ui"
  }
  ```

- [ ] **Step 6: Run empty tests runner verify**
  Run: `npm run test`
  Expected: "No test files found, exiting with code 1" (shows Vitest is working and configured).

- [ ] **Step 7: Commit setup**
  Run: `git add package.json vitest.config.js tests/setup.js tests/playwright.config.js`
  Run: `git commit -m "test: configure vitest and playwright testing framework"`

---

### Task 2: Implement URL Normalization Utility using TDD

**Files:**
- Create: `tests/unit/url.test.js`
- Create: `src/utils/url.js`

- [ ] **Step 1: Write failing test for URL normalization**
  Create `tests/unit/url.test.js` with content:
  ```javascript
  import { describe, test, expect } from 'vitest';
  import { normalizeUrl } from '../../src/utils/url.js';

  describe('URL Normalization Utilities', () => {
    test('strips query parameters and hashes', () => {
      const raw = 'https://example.com/path?foo=bar#section-1';
      expect(normalizeUrl(raw)).toBe('example.com/path');
    });

    test('removes trailing slashes', () => {
      const raw = 'https://example.com/path/';
      expect(normalizeUrl(raw)).toBe('example.com/path');
    });

    test('ignores http vs https protocol differences', () => {
      const http = 'http://example.com/home';
      const https = 'https://example.com/home';
      expect(normalizeUrl(http)).toBe(normalizeUrl(https));
    });
  });
  ```

- [ ] **Step 2: Run test to verify it fails**
  Run: `npm run test`
  Expected: FAIL with "Cannot find module../../src/utils/url.js" or "normalizeUrl is not a function".

- [ ] **Step 3: Create minimum URL normalization utility implementation**
  Create `src/utils/url.js` with content:
  ```javascript
  /**
   * Normalizes a URL for robust comparison across active and pinned states.
   * @param {string} url 
   * @returns {string}
   */
  export function normalizeUrl(url) {
    if (!url) return '';
    let clean = url.replace(/^(https?:\/\/)?(www\.)?/, '');
    clean = clean.split('#')[0].split('?')[0];
    clean = clean.replace(/\/$/, '');
    return clean.toLowerCase();
  }
  ```

- [ ] **Step 4: Run test to verify it passes**
  Run: `npm run test`
  Expected: PASS

- [ ] **Step 5: Commit URL logic**
  Run: `git add tests/unit/url.test.js src/utils/url.js`
  Run: `git commit -m "feat: add normalizeUrl utility with tests"`

---

### Task 3: Implement Pure Tab Mapping Logic (`calculateTabMappings`) using TDD

**Files:**
- Create: `tests/unit/tab-manager.test.js`
- Create: `src/logic/tab-manager.js`

- [ ] **Step 1: Write failing test for tab mapping logic**
  Create `tests/unit/tab-manager.test.js` with content:
  ```javascript
  import { describe, test, expect } from 'vitest';
  import { calculateTabMappings } from '../../src/logic/tab-manager.js';

  describe('Tab Synchronization Manager', () => {
    test('matches unmapped open tabs to pinned tabs by normalized URL', () => {
      const openTabs = [
        { id: 1, url: 'https://github.com/trending/' }
      ];
      const pinnedTabs = [
        { id: 'pin-100', pinnedUrl: 'http://github.com/trending', order: 0 }
      ];
      const activePinnedMap = {};

      const nextMap = calculateTabMappings(openTabs, pinnedTabs, activePinnedMap);

      expect(nextMap).toEqual({ '1': 'pin-100' });
    });

    test('clears active mappings when open tabs are closed', () => {
      const openTabs = []; // Open tab 1 was closed
      const pinnedTabs = [
        { id: 'pin-100', pinnedUrl: 'https://github.com', order: 0 }
      ];
      const activePinnedMap = { '1': 'pin-100' };

      const nextMap = calculateTabMappings(openTabs, pinnedTabs, activePinnedMap);

      expect(nextMap).toEqual({});
    });
  });
  ```

- [ ] **Step 2: Run test to verify it fails**
  Run: `npm run test`
  Expected: FAIL with "Cannot find module../../src/logic/tab-manager.js".

- [ ] **Step 3: Create pure calculateTabMappings implementation**
  Create `src/logic/tab-manager.js` with content:
  ```javascript
  import { normalizeUrl } from '../utils/url.js';

  /**
   * Calculates next mapping state dictionary.
   * @param {Array} openTabs 
   * @param {Array} pinnedTabs 
   * @param {Object} activePinnedMap 
   * @returns {Object} map of openTabIdStr -> pinnedTabId
   */
  export function calculateTabMappings(openTabs, pinnedTabs, activePinnedMap) {
    const nextMap = { ...activePinnedMap };
    const mappedPinnedIds = [];

    // 1. Clean up stale maps and collect mapped pin IDs
    for (const [tId, pId] of Object.entries(nextMap)) {
      const tIdNum = parseInt(tId);
      if (openTabs.some(o => o.id === tIdNum)) {
        mappedPinnedIds.push(pId);
      } else {
        delete nextMap[tId];
      }
    }

    // 2. Automap unmapped open tabs
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

- [ ] **Step 4: Run unit tests to verify they pass**
  Run: `npm run test`
  Expected: PASS (All tests pass)

- [ ] **Step 5: Commit tab-manager logic**
  Run: `git add tests/unit/tab-manager.test.js src/logic/tab-manager.js`
  Run: `git commit -m "feat: add calculateTabMappings utility with tests"`

---

### Task 4: Enable Production ES Modules & Integrate Core Logic

**Files:**
- Modify: `manifest.json`
- Modify: `sidepanel.html`
- Modify: `sidepanel.js`
- Modify: `background.js`

- [ ] **Step 1: Update background service worker script type in manifest**
  Modify `manifest.json` background key:
  ```json
  "background": {
    "service_worker": "background.js",
    "type": "module"
  }
  ```

- [ ] **Step 2: Update script declaration in sidepanel HTML**
  Modify line 108 of `sidepanel.html` to load sidepanel as a module:
  ```html
  <script type="module" src="sidepanel.js"></script>
  ```

- [ ] **Step 3: Refactor sidepanel.js to import pure functions**
  Modify `sidepanel.js` top-level to import utilities and refactor `syncOpenTabs` to delegate to `calculateTabMappings`.
  
  At the very top of `sidepanel.js`:
  ```javascript
  import { calculateTabMappings } from './src/logic/tab-manager.js';
  import { normalizeUrl } from './src/utils/url.js';
  ```

  Inside `syncOpenTabs()`:
  Replace lines 65-115 with the decoupled state update:
  ```javascript
      // Auto-map open tabs to pinned tabs by matching URLs if not already mapped
      const nextMap = calculateTabMappings(openTabs, pinnedTabs, activePinnedMap);
      
      // Persist any newly added mappings to service worker
      let mapUpdated = false;
      for (const [tId, pId] of Object.entries(nextMap)) {
        if (activePinnedMap[tId] === undefined) {
          chrome.runtime.sendMessage({
            action: "mapActiveTab",
            tabId: parseInt(tId),
            pinnedTabId: pId
          });
          mapUpdated = true;
        }
      }
      
      activePinnedMap = nextMap;
  ```

- [ ] **Step 4: Run unit tests to verify nothing broke**
  Run: `npm run test`
  Expected: PASS

- [ ] **Step 5: Commit integration**
  Run: `git add manifest.json sidepanel.html sidepanel.js`
  Run: `git commit -m "refactor: integrate native ES module structure and pure tab mappings"`

---

### Task 5: End-to-End Integration Verification with Playwright

**Files:**
- Create: `tests/e2e/fixtures.js`
- Create: `tests/e2e/sidebar.spec.js`

- [ ] **Step 1: Create Playwright custom browser fixtures**
  Create `tests/e2e/fixtures.js` with content:
  ```javascript
  import { test as base, chromium } from '@playwright/test';
  import path from 'path';

  export const test = base.extend({
    context: async ({}, use) => {
      const pathToExtension = path.resolve(__dirname, '../../');
      const context = await chromium.launchPersistentContext('', {
        headless: false,
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

- [ ] **Step 2: Create Playwright sidebar integration tests**
  Create `tests/e2e/sidebar.spec.js` with content:
  ```javascript
  import { test, expect } from './fixtures.js';

  test.describe('Vertical Tabs Sidebar Extension UI', () => {
    test('renders initial empty states for tabs', async ({ sidepanelPage }) => {
      // Check for presence of sections
      const pinnedZone = await sidepanelPage.locator('#pinned-zone');
      const tempZone = await sidepanelPage.locator('#temp-zone');
      await expect(pinnedZone).toBeEmpty();
      await expect(tempZone).toBeVisible();
    });

    test('renders pinned tab when loaded from local storage state', async ({ sidepanelPage }) => {
      // Set storage values
      await sidepanelPage.evaluate(async () => {
        await chrome.storage.local.set({
          pinned_tabs: [{
            id: 'pin-abc',
            pinnedUrl: 'https://example.com',
            title: 'Example Pinned',
            order: 0
          }]
        });
      });

      // Reload sidebar to trigger loadPinnedTabs
      await sidepanelPage.reload();

      const pinnedRow = await sidepanelPage.locator('#pinned-pin-abc');
      await expect(pinnedRow).toBeVisible();
      await expect(pinnedRow).toContainText('Example Pinned');
    });
  });
  ```

- [ ] **Step 3: Run Playwright integration tests**
  Run: `npm run test:e2e`
  Expected: PASS (Browser boots up, performs evaluation and assertions, and outputs successful runs).

- [ ] **Step 4: Commit E2E fixtures and tests**
  Run: `git add tests/e2e/fixtures.js tests/e2e/sidebar.spec.js`
  Run: `git commit -m "test: add playwright E2E integration test suite"`
