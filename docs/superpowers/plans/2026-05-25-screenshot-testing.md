# Playwright Visual Regression Testing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish a robust visual regression testing workflow for the TabValet extension E2E suite using a unified, strict Linux environment inside the official Playwright Docker container.

**Architecture:** We will configure the primary E2E script `test:e2e` in `package.json` to execute inside the Playwright Docker container with a virtual framebuffer (`xvfb-run`), ensuring 100% consistent pixel comparisons. We will create a dedicated `visual.spec.js` suite that captures three visual states, configured to auto-skip on macOS developers' hosts while running strictly in Docker on Linux.

**Tech Stack:** Playwright E2E, Docker (`mcr.microsoft.com/playwright:v1.60.0-noble`), xvfb-run, Node.js.

---

### Task 1: Update package.json scripts

**Files:**
*   Modify: `package.json`

- [ ] **Step 1: Write the minimal implementation to modify package.json**

    Modify [package.json](../../../package.json) to update the `test:e2e` command to run in the official Playwright Docker container using a virtual framebuffer. Leave `test:e2e:ui` unchanged.

    Modify the `scripts` section from lines 9 to 14:
    ```json
      "scripts": {
        "test": "vitest run",
        "test:watch": "vitest",
        "test:e2e": "docker run --rm -v $(pwd):/work -w /work --ipc=host mcr.microsoft.com/playwright:v1.60.0-noble xvfb-run npx playwright test -c tests/playwright.config.js",
        "test:e2e:ui": "playwright test -c tests/playwright.config.js --ui"
      },
    ```

- [ ] **Step 2: Run functional tests inside Docker to verify setup**

    Execute the updated E2E script:
    ```bash
    npm run test:e2e
    ```
    *Expected Output*: The existing E2E functional tests (e.g. `sidebar.spec.js`) successfully run inside the Playwright Docker container and all pass.

- [ ] **Step 3: Commit scripts change**

    ```bash
    git add package.json
    git commit -m "feat: configure test:e2e to run inside playwright docker"
    ```

---

### Task 2: Implement Visual Regression Suite Structure (State A: Empty Pinned State)

**Files:**
*   Create: `tests/e2e/visual.spec.js`

- [ ] **Step 1: Create the visual test file with skip logic and State A**

    Create [tests/e2e/visual.spec.js](../../../tests/e2e/visual.spec.js) with environment check and the first visual state (State A: Empty Pinned State).

    ```javascript
    import { test, expect } from './fixtures.js';

    // Visual regression is strictly enforced inside Docker/Linux.
    // On macOS host developer environments, this suite skips to prevent false failures.
    const isVisualSuiteEnabled = process.platform === 'linux';

    test.describe('Visual Regression Suite', () => {
      test.beforeEach(async ({}) => {
        test.skip(!isVisualSuiteEnabled, 'Visual assertions are only executed inside the Linux Docker container.');
      });

      test('captures empty pinned state', async ({ sidepanelPage }) => {
        // 1. Setup empty storage
        await sidepanelPage.evaluate(async () => {
          await chrome.storage.local.set({ pinned_tabs: [] });
        });
        await sidepanelPage.reload();

        // 2. Take visual screenshot of the viewport
        await expect(sidepanelPage).toHaveScreenshot('empty-pinned-state.png', {
          animations: 'disabled'
        });
      });
    });
    ```

- [ ] **Step 2: Run test locally on macOS host to verify graceful skip**

    Run the Playwright test suite natively on macOS:
    ```bash
    npx playwright test tests/e2e/visual.spec.js -c tests/playwright.config.js
    ```
    *Expected Output*: The test suite is skipped automatically with a message "Visual assertions are only executed inside the Linux Docker container" and passes with 0 failures.

- [ ] **Step 3: Commit initial visual spec**

    ```bash
    git add tests/e2e/visual.spec.js
    git commit -m "feat: add visual regression spec structure and empty pinned state test"
    ```

---

### Task 3: Generate Visual Baselines inside Docker Container

**Files:**
*   Create: `tests/e2e/visual.spec.js-snapshots/empty-pinned-state-chromium-linux.png` (automatic output)

- [ ] **Step 1: Execute Playwright update-snapshots inside Docker container**

    Run the Playwright snapshot generation command inside the container:
    ```bash
    docker run --rm -v $(pwd):/work -w /work --ipc=host mcr.microsoft.com/playwright:v1.60.0-noble xvfb-run npx playwright test tests/e2e/visual.spec.js -c tests/playwright.config.js --update-snapshots
    ```
    *Expected Output*: Playwright generates the baseline snapshot successfully and outputs messages indicating the new screenshot is saved.

- [ ] **Step 2: Verify the baseline screenshot was created**

    Verify that the snapshot directory and file exist:
    ```bash
    ls -l tests/e2e/visual.spec.js-snapshots/empty-pinned-state-chromium-linux.png
    ```

- [ ] **Step 3: Commit initial visual baseline**

    ```bash
    git add tests/e2e/visual.spec.js-snapshots/
    git commit -m "test: generate and commit empty pinned state visual baseline"
    ```

---

### Task 4: Implement State B and State C Visual Tests

**Files:**
*   Modify: `tests/e2e/visual.spec.js`
*   Create: `tests/e2e/visual.spec.js-snapshots/multi-tab-standard-state-chromium-linux.png`
*   Create: `tests/e2e/visual.spec.js-snapshots/drag-drop-indicator-state-chromium-linux.png`

- [ ] **Step 1: Append State B and State C tests to visual.spec.js**

    Modify [tests/e2e/visual.spec.js](../../../tests/e2e/visual.spec.js) to append the `captures multi-tab standard state` and `captures drag-and-drop indicator state` tests.

    ```javascript
    import { test, expect } from './fixtures.js';

    // Visual regression is strictly enforced inside Docker/Linux.
    // On macOS host developer environments, this suite skips to prevent false failures.
    const isVisualSuiteEnabled = process.platform === 'linux';

    test.describe('Visual Regression Suite', () => {
      test.beforeEach(async ({}) => {
        test.skip(!isVisualSuiteEnabled, 'Visual assertions are only executed inside the Linux Docker container.');
      });

      test('captures empty pinned state', async ({ sidepanelPage }) => {
        // 1. Setup empty storage
        await sidepanelPage.evaluate(async () => {
          await chrome.storage.local.set({ pinned_tabs: [] });
        });
        await sidepanelPage.reload();

        // 2. Take visual screenshot of the viewport
        await expect(sidepanelPage).toHaveScreenshot('empty-pinned-state.png', {
          animations: 'disabled'
        });
      });

      test('captures multi-tab standard state', async ({ sidepanelPage }) => {
        // 1. Setup multiple pinned tabs (one standard/active, one navigated-away/inactive)
        await sidepanelPage.evaluate(async () => {
          await chrome.storage.local.set({
            pinned_tabs: [
              { id: 'pin-1', pinnedUrl: 'https://github.com', title: 'GitHub', order: 0 },
              { 
                id: 'pin-2', 
                pinnedUrl: 'https://google.com', 
                activeUrl: 'https://google.com/search?q=tabvalet', 
                title: 'Google', 
                activeTitle: 'Google Search - tabvalet', 
                order: 1 
              }
            ]
          });
          // Mock active open tab mapping to pin-1
          await new Promise(resolve => {
            chrome.tabs.create({ url: 'https://github.com', active: true }, resolve);
          });
          await new Promise(resolve => setTimeout(resolve, 500));
        });
        await sidepanelPage.reload();

        // 2. Take visual screenshot of the viewport
        await expect(sidepanelPage).toHaveScreenshot('multi-tab-standard-state.png', {
          animations: 'disabled'
        });
      });

      test('captures drag-and-drop indicator state', async ({ sidepanelPage }) => {
        // 1. Setup tab rows
        await sidepanelPage.evaluate(async () => {
          await chrome.storage.local.set({
            pinned_tabs: [{ id: 'pin-1', pinnedUrl: 'https://github.com', title: 'GitHub', order: 0 }]
          });
        });
        await sidepanelPage.reload();

        // 2. Dispatch simulated dragover to render the absolute indicator line
        await sidepanelPage.evaluate(() => {
          const row = document.getElementById('pinned-pin-1');
          const rect = row.getBoundingClientRect();
          const midY = rect.top + rect.height / 4; // upper half
          
          const event = new DragEvent('dragover', {
            bubbles: true,
            cancelable: true,
            clientY: midY
          });
          Object.defineProperty(event, 'dataTransfer', {
            value: { dropEffect: '', setData: () => {}, getData: () => '' }
          });
          row.dispatchEvent(event);
        });

        // 3. Take visual screenshot focusing on the lists area to capture indicator positioning
        const wrapper = sidepanelPage.locator('.lists-wrapper');
        await expect(wrapper).toHaveScreenshot('drag-drop-indicator-state.png', {
          animations: 'disabled'
        });
      });
    });
    ```

- [ ] **Step 2: Generate visual baselines for State B and State C**

    Run the update-snapshots command inside the container to capture these new baselines:
    ```bash
    docker run --rm -v $(pwd):/work -w /work --ipc=host mcr.microsoft.com/playwright:v1.60.0-noble xvfb-run npx playwright test tests/e2e/visual.spec.js -c tests/playwright.config.js --update-snapshots
    ```
    *Expected Output*: The remaining visual baselines are successfully captured and saved in `tests/e2e/visual.spec.js-snapshots/`.

- [ ] **Step 3: Run E2E test suite inside Docker to confirm everything passes**

    Execute:
    ```bash
    npm run test:e2e
    ```
    *Expected Output*: The E2E tests execute inside the Playwright Docker container and all functional + visual tests pass successfully.

- [ ] **Step 4: Commit tests and screenshot baselines**

    ```bash
    git add tests/e2e/visual.spec.js tests/e2e/visual.spec.js-snapshots/
    git commit -m "test: implement standard state and drag-drop indicator visual tests with baselines"
    ```
