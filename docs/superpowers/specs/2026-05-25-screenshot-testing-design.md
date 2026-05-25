# Playwright Visual Regression Testing in Docker Design

This document establishes the architecture, configuration, and implementation plan for adding pixel-perfect screenshot tests to the TabValet extension E2E suite. By leveraging the official Playwright Docker environment, we ensure that visual assertions are evaluated under a strict 100% pixel-match standard on a uniform Linux platform, preventing platform-specific font or anti-aliasing rendering pollution.

---

## User Review Required

No active user review blocks remain. We have aligned on:
*   Standardizing the primary `npm run test:e2e` script to run the entire test suite inside Docker.
*   Preserving host-only execution under `npm run test:e2e:ui` for fast, native host-side debugging using Playwright’s interactive UI runner.
*   Enforcing a strict visual check in Linux Docker, while auto-skipping the visual-only tests on host platforms (macOS) to prevent visual false-positives during manual developer cycles.

---

## Proposed Changes

### Docker and Scripts Integration

#### [MODIFY] [package.json](file:///Users/tribou/dev/joyful-pascal/package.json)
We will update the `test:e2e` command to invoke Playwright inside the official Linux container using a virtual framebuffer (`xvfb-run`). The host-only E2E UI mode `test:e2e:ui` remains native for rapid debugging.

```json
"scripts": {
  "test": "vitest run",
  "test:watch": "vitest",
  "test:e2e": "docker run --rm -v $(pwd):/work -w /work --ipc=host -it mcr.microsoft.com/playwright:v1.60.0-noble xvfb-run npx playwright test -c tests/playwright.config.js",
  "test:e2e:ui": "playwright test -c tests/playwright.config.js --ui"
}
```

---

### E2E Visual Testing Specification

#### [NEW] [visual.spec.js](file:///Users/tribou/dev/joyful-pascal/tests/e2e/visual.spec.js)
A dedicated E2E visual verification suite that captures three high-impact design states. It contains environmental isolation checks to only execute screenshots when running under Linux (Docker).

```js
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

---

## Verification Plan

### Automated Tests
1.  **Docker E2E Execution**: Run `npm run test:e2e` to spawn the suite inside the official Playwright Docker container. This will run functional tests and generate/assert the visual screenshots.
2.  **Snapshot Update Execution**: Use Playwright's update flag within the Docker container to capture the initial baseline images:
    ```bash
    docker run --rm -v $(pwd):/work -w /work --ipc=host -it mcr.microsoft.com/playwright:v1.60.0-noble npx playwright test --update-snapshots
    ```
3.  **Local Host Execution**: Run `npm run test:e2e:ui` natively on macOS to confirm that:
    *   Functional E2E assertions run and pass normally.
    *   The `visual.spec.js` file is skipped automatically without failures or visual mismatches.
