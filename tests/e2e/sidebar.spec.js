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

  test('displays drag-over-empty class when dragging a tab over empty pinned section', async ({ sidepanelPage }) => {
    const pinnedZone = await sidepanelPage.locator('#pinned-zone');
    await expect(pinnedZone).toBeEmpty();
    await expect(pinnedZone).not.toHaveClass(/drag-over-empty/);

    // 1. Dispatch dragover on #pinned-section
    await sidepanelPage.dispatchEvent('#pinned-section', 'dragover');

    // 2. Verify the drag-over-empty class is present
    await expect(pinnedZone).toHaveClass(/drag-over-empty/);

    // 3. Dispatch dragleave on #pinned-section
    await sidepanelPage.dispatchEvent('#pinned-section', 'dragleave');

    // 4. Verify class is removed
    await expect(pinnedZone).not.toHaveClass(/drag-over-empty/);
  });

  test('unpins an active pinned tab and drops it at the top of normal tabs', async ({ sidepanelPage }) => {
    // 1. Setup a pinned tab
    await sidepanelPage.evaluate(async () => {
      await chrome.storage.local.set({
        pinned_tabs: [
          { id: 'pin-1', pinnedUrl: 'https://example.com/pinned', title: 'Pinned Tab', order: 0 }
        ]
      });
    });

    await sidepanelPage.reload();

    // 2. Open two tabs: one for the pinned tab, and one normal tab
    await sidepanelPage.evaluate(async () => {
      const tab1 = await new Promise((resolve) => {
        chrome.tabs.create({ url: 'https://example.com/pinned' }, resolve);
      });
      
      const tab2 = await new Promise((resolve) => {
        chrome.tabs.create({ url: 'https://example.com/normal' }, resolve);
      });

      // Force a sync wait
      await new Promise(resolve => setTimeout(resolve, 800));

      // Trigger the unpin and drop at the top spot of the normal section (before tab2)
      await window.unpinTabAtPosition('pin-1', tab2.id, 'before');

      // Force a sync wait
      await new Promise(resolve => setTimeout(resolve, 800));
    });

    // 3. Verify the final physical order of tabs in the window.
    const tabUrls = await sidepanelPage.evaluate(async () => {
      const tabs = await new Promise((resolve) => {
        chrome.tabs.query({ currentWindow: true }, resolve);
      });
      const relevantTabs = tabs.filter(t => t.url.includes('example.com'));
      relevantTabs.sort((a, b) => a.index - b.index);
      return relevantTabs.map(t => t.url);
    });

    expect(tabUrls).toEqual([
      'https://example.com/pinned',
      'https://example.com/normal'
    ]);

    // 4. Verify local storage has no pinned tabs
    const storageState = await sidepanelPage.evaluate(async () => {
      const data = await chrome.storage.local.get(['pinned_tabs']);
      return data.pinned_tabs;
    });
    expect(storageState).toEqual([]);

    // 5. Verify the sidebar UI DOM states
    const pinnedRows = await sidepanelPage.locator('#pinned-zone .tab-row');
    await expect(pinnedRows).toHaveCount(0);

    // Verify relative ordering of the unpinned and normal tabs inside the temporary section
    const [tab1Index, tab2Index] = await sidepanelPage.evaluate(async () => {
      const tabs = await new Promise((resolve) => {
        chrome.tabs.query({ currentWindow: true }, resolve);
      });
      const tab1 = tabs.find(t => t.url.includes('pinned'));
      const tab2 = tabs.find(t => t.url.includes('normal'));
      if (!tab1 || !tab2) return [-1, -1];

      const tempZone = document.getElementById('temp-zone');
      const rows = Array.from(tempZone.querySelectorAll('.tab-row'));
      const index1 = rows.findIndex(r => r.id === `temp-${tab1.id}`);
      const index2 = rows.findIndex(r => r.id === `temp-${tab2.id}`);
      return [index1, index2];
    });

    expect(tab1Index).not.toBe(-1);
    expect(tab2Index).not.toBe(-1);
    expect(tab1Index).toBe(tab2Index - 1); // Pinned tab (tab1) is immediately before normal tab (tab2) in the UI
  });

  test('displays drag-before drop indicator when dragging over an active pinned tab row', async ({ sidepanelPage }) => {
    // 1. Setup a pinned tab that will be active
    await sidepanelPage.evaluate(async () => {
      await chrome.storage.local.set({
        pinned_tabs: [
          { id: 'pin-active', pinnedUrl: 'https://example.com/active', title: 'Active Pinned', order: 0 }
        ]
      });
    });

    await sidepanelPage.reload();

    // 2. Mock active pinned tab in open tabs
    await sidepanelPage.evaluate(async () => {
      const tab = await new Promise((resolve) => {
        chrome.tabs.create({ url: 'https://example.com/active', active: true }, resolve);
      });
      // Force a sync wait to let sidebar render the active pinned tab
      await new Promise(resolve => setTimeout(resolve, 800));
    });

    // 3. Verify it is rendered as active in the UI
    const pinnedRow = await sidepanelPage.locator('#pinned-pin-active');
    await expect(pinnedRow).toHaveClass(/active/);

    // 4. Dispatch dragover on the active pinned tab row using evaluate to properly mock dataTransfer
    await sidepanelPage.evaluate(() => {
      const row = document.getElementById('pinned-pin-active');
      const rect = row.getBoundingClientRect();
      const midY = rect.top + rect.height / 4; // upper half
      
      const event = new DragEvent('dragover', {
        bubbles: true,
        cancelable: true,
        clientY: midY
      });
      
      Object.defineProperty(event, 'dataTransfer', {
        value: {
          dropEffect: '',
          setData: () => {},
          getData: () => ''
        }
      });
      
      row.dispatchEvent(event);
    });

    // 5. Verify the class 'drag-before' is added to the row
    await expect(pinnedRow).toHaveClass(/drag-before/);

    // 6. Verify the computed style height of the row's ::before pseudo-element is '2px'
    const beforeHeight = await sidepanelPage.evaluate(() => {
      const row = document.getElementById('pinned-pin-active');
      const style = window.getComputedStyle(row, '::before');
      return style.height;
    });

    expect(beforeHeight).toBe('2px');
  });
});

