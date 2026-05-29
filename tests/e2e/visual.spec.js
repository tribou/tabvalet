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
