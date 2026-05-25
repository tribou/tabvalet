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

  test('reorders pinned tabs and persists order in local storage', async ({ sidepanelPage }) => {
    // 1. Setup two pinned tabs in local storage
    await sidepanelPage.evaluate(async () => {
      await chrome.storage.local.set({
        pinned_tabs: [
          { id: 'pin-1', pinnedUrl: 'https://github.com', title: 'GitHub', order: 0 },
          { id: 'pin-2', pinnedUrl: 'https://google.com', title: 'Google', order: 1 }
        ]
      });
    });

    await sidepanelPage.reload();

    // 2. Verify initial UI order in pinned zone
    const pinnedRows = await sidepanelPage.locator('#pinned-zone .tab-row');
    await expect(pinnedRows.nth(0)).toContainText('GitHub');
    await expect(pinnedRows.nth(1)).toContainText('Google');

    // 3. Trigger reorder programmatically via exposed reorderPinnedTab API
    await sidepanelPage.evaluate(() => {
      window.reorderPinnedTab('pin-1', 'pin-2', 'after');
    });

    // 4. Verify updated UI order
    await expect(pinnedRows.nth(0)).toContainText('Google');
    await expect(pinnedRows.nth(1)).toContainText('GitHub');

    // 5. Verify local storage updated correctly
    const storageState = await sidepanelPage.evaluate(async () => {
      const data = await chrome.storage.local.get(['pinned_tabs']);
      return data.pinned_tabs;
    });

    expect(storageState[0].id).toBe('pin-2');
    expect(storageState[0].order).toBe(0);
    expect(storageState[1].id).toBe('pin-1');
    expect(storageState[1].order).toBe(1);
  });
});
