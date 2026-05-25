import { test, expect } from './fixtures.js';

test.describe('Vertical Tabs Sidebar Extension UI', () => {
  test('renders initial empty states for tabs', async ({ sidepanelPage }) => {
    const pinnedZone = await sidepanelPage.locator('#pinned-zone');
    const tempZone = await sidepanelPage.locator('#temp-zone');
    await expect(pinnedZone).toBeEmpty();
    await expect(tempZone).toBeVisible();
  });

  test('renders pinned tab when loaded from local storage state', async ({ sidepanelPage }) => {
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

    await sidepanelPage.reload();

    const pinnedRow = await sidepanelPage.locator('#pinned-pin-abc');
    await expect(pinnedRow).toBeVisible();
    await expect(pinnedRow).toContainText('Example Pinned');
  });

  test('exposes reordering functions on global window object for E2E tests', async ({ sidepanelPage }) => {
    const areFunctionsExposed = await sidepanelPage.evaluate(() => {
      return typeof window.reorderPinnedTab === 'function' && typeof window.reorderTempTab === 'function';
    });
    expect(areFunctionsExposed).toBe(true);
  });
});
