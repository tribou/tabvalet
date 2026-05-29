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
