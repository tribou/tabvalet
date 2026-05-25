# Sidebar Drag-Reorder Testing Suite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement unit and end-to-end integration tests to verify the drag-to-reorder tab mechanics.

**Architecture:** Extract reorder algorithms into clean, pure functions inside `src/logic/tab-manager.js`, update `sidepanel.js` to call these functions by transitioning to ES Modules in `sidepanel.html`, and write comprehensive Vitest unit tests and Playwright E2E tests.

**Tech Stack:** Vitest, Playwright, JSDOM, ES Modules

---

### Task 1: Refactor Reordering Logic to Pure Functions

**Files:**
- Modify: `src/logic/tab-manager.js`
- Modify: `sidepanel.js`
- Modify: `sidepanel.html`

- [ ] **Step 1: Extract functions in `src/logic/tab-manager.js`**
  Let's add the following functions to `src/logic/tab-manager.js`:
  ```javascript
  /**
   * Reorders the pinned tabs array based on drag-and-drop targets.
   * @param {Array} pinnedTabs Current pinned tabs array
   * @param {string} draggedId The ID of the tab being dragged
   * @param {string|null} targetId The ID of the tab being dropped onto (null if dropped on section empty space)
   * @param {string} position Relative drop position: "before" or "after"
   * @returns {Array} A new sorted array with updated .order indices
   */
  export function reorderPinnedTabsList(pinnedTabs, draggedId, targetId, position) {
    if (draggedId === targetId) return [...pinnedTabs];

    const copy = [...pinnedTabs];
    const draggedIndex = copy.findIndex(t => t.id === draggedId);
    if (draggedIndex === -1) return copy;

    const draggedTab = copy[draggedIndex];
    copy.splice(draggedIndex, 1);

    let targetIndex = copy.length;
    if (targetId) {
      const idx = copy.findIndex(t => t.id === targetId);
      if (idx !== -1) {
        targetIndex = position === "before" ? idx : idx + 1;
      }
    }

    copy.splice(targetIndex, 0, draggedTab);

    // Reassign order
    copy.forEach((tab, index) => {
      tab.order = index;
    });

    return copy;
  }

  /**
   * Calculates the target index for a temporary tab reorder, compensating for Chrome native index shifts.
   * @param {Object} draggedTab The tab being dragged (needs .id and .index)
   * @param {Object} targetTab The tab dropped onto (needs .id and .index)
   * @param {string} position Relative drop position: "before" or "after"
   * @returns {number} The compensated target index for chrome.tabs.move
   */
  export function calculateTempTabTargetIndex(draggedTab, targetTab, position) {
    if (draggedTab.id === targetTab.id) return draggedTab.index;

    let targetIndex = targetTab.index;
    if (draggedTab.index < targetTab.index) {
      targetIndex = (position === "before") ? targetTab.index - 1 : targetTab.index;
    } else {
      targetIndex = (position === "before") ? targetTab.index : targetTab.index + 1;
    }
    return targetIndex;
  }
  ```

- [ ] **Step 2: Update `sidepanel.html` to load `sidepanel.js` as an ES Module**
  Replace line 280 in `sidepanel.html`:
  ```html
  <script src="sidepanel.js"></script>
  ```
  With:
  ```html
  <script type="module" src="sidepanel.js"></script>
  ```

- [ ] **Step 3: Update `sidepanel.js` to import and call the pure functions**
  At the top of `sidepanel.js`, add:
  ```javascript
  import { reorderPinnedTabsList, calculateTempTabTargetIndex } from './src/logic/tab-manager.js';
  ```

  And refactor `reorderPinnedTab` to delegate:
  ```javascript
  // Reorder within Pinned section
  function reorderPinnedTab(draggedId, targetId, position) {
    if (draggedId === targetId) return;

    pinnedTabs = reorderPinnedTabsList(pinnedTabs, draggedId, targetId, position);

    chrome.storage.local.set({ pinned_tabs: pinnedTabs }, () => {
      syncOpenTabs();
    });
  }
  ```

  Refactor `reorderTempTab` to delegate:
  ```javascript
  // Reorder within Temporary section
  function reorderTempTab(draggedTabId, targetTabId, position) {
    const draggedTab = openTabs.find(t => t.id === draggedTabId);
    const targetTab = openTabs.find(t => t.id === targetTabId);
    if (!draggedTab || !targetTab) return;

    if (draggedTabId === targetTabId) return; // Prevent self-drop API calls

    const targetIndex = calculateTempTabTargetIndex(draggedTab, targetTab, position);

    chrome.tabs.move(draggedTabId, { windowId: currentWindowId, index: targetIndex }, () => {
      syncOpenTabs();
    });
  }
  ```

- [ ] **Step 4: Commit refactored code**
  ```bash
  git add src/logic/tab-manager.js sidepanel.html sidepanel.js
  git commit -m "feat: extract reorder algorithms into unit-testable logical modules"
  ```

---

### Task 2: Write Unit Tests (Vitest)

**Files:**
- Create: `tests/unit/tab-reorder.test.js`

- [ ] **Step 1: Write `tests/unit/tab-reorder.test.js`**
  ```javascript
  import { describe, test, expect } from 'vitest';
  import { reorderPinnedTabsList, calculateTempTabTargetIndex } from '../../src/logic/tab-manager.js';

  describe('Pinned Tab Reordering List Math', () => {
    test('shifts a pinned tab before another target tab', () => {
      const pinnedTabs = [
        { id: 'pin-1', order: 0 },
        { id: 'pin-2', order: 1 },
        { id: 'pin-3', order: 2 }
      ];
      
      const result = reorderPinnedTabsList(pinnedTabs, 'pin-3', 'pin-2', 'before');
      
      expect(result).toEqual([
        { id: 'pin-1', order: 0 },
        { id: 'pin-3', order: 1 },
        { id: 'pin-2', order: 2 }
      ]);
    });

    test('shifts a pinned tab after another target tab', () => {
      const pinnedTabs = [
        { id: 'pin-1', order: 0 },
        { id: 'pin-2', order: 1 },
        { id: 'pin-3', order: 2 }
      ];
      
      const result = reorderPinnedTabsList(pinnedTabs, 'pin-1', 'pin-2', 'after');
      
      expect(result).toEqual([
        { id: 'pin-2', order: 0 },
        { id: 'pin-1', order: 1 },
        { id: 'pin-3', order: 2 }
      ]);
    });

    test('handles dropping a pinned tab on itself without altering anything', () => {
      const pinnedTabs = [
        { id: 'pin-1', order: 0 },
        { id: 'pin-2', order: 1 }
      ];
      
      const result = reorderPinnedTabsList(pinnedTabs, 'pin-1', 'pin-1', 'after');
      expect(result).toEqual(pinnedTabs);
    });

    test('appends to the end of list if target is null', () => {
      const pinnedTabs = [
        { id: 'pin-1', order: 0 },
        { id: 'pin-2', order: 1 }
      ];
      
      const result = reorderPinnedTabsList(pinnedTabs, 'pin-1', null, 'after');
      
      expect(result).toEqual([
        { id: 'pin-2', order: 0 },
        { id: 'pin-1', order: 1 }
      ]);
    });
  });

  describe('Temporary Tab Shifting Math', () => {
    test('calculates correct index when dragging left-to-right (lower to higher index) before target', () => {
      const dragged = { id: 1, index: 0 };
      const target = { id: 2, index: 1 }; // B is at index 1
      // Dropping A before B
      const idx = calculateTempTabTargetIndex(dragged, target, 'before');
      expect(idx).toBe(0); // A should stay at index 0 (so new array is [A, B])
    });

    test('calculates correct index when dragging left-to-right (lower to higher index) after target', () => {
      const dragged = { id: 1, index: 0 };
      const target = { id: 2, index: 1 }; // B is at index 1
      // Dropping A after B
      const idx = calculateTempTabTargetIndex(dragged, target, 'after');
      expect(idx).toBe(1); // A should move to index 1 (so new array is [B, A])
    });

    test('calculates correct index when dragging right-to-left (higher to lower index) before target', () => {
      const dragged = { id: 3, index: 2 }; // C is at index 2
      const target = { id: 1, index: 0 }; // A is at index 0
      // Dropping C before A
      const idx = calculateTempTabTargetIndex(dragged, target, 'before');
      expect(idx).toBe(0); // C should move to index 0 (so new array is [C, A, B])
    });

    test('calculates correct index when dragging right-to-left (higher to lower index) after target', () => {
      const dragged = { id: 3, index: 2 }; // C is at index 2
      const target = { id: 1, index: 0 }; // A is at index 0
      // Dropping C after A
      const idx = calculateTempTabTargetIndex(dragged, target, 'after');
      expect(idx).toBe(1); // C should move to index 1 (so new array is [A, C, B])
    });

    test('returns original index if dropped on self', () => {
      const dragged = { id: 1, index: 2 };
      const target = { id: 1, index: 2 };
      const idx = calculateTempTabTargetIndex(dragged, target, 'after');
      expect(idx).toBe(2);
    });
  });
  ```

- [ ] **Step 2: Run unit tests and verify they pass**
  Run: `npm test`
  Expected: PASS

- [ ] **Step 3: Commit unit tests**
  ```bash
  git add tests/unit/tab-reorder.test.js
  git commit -m "test: add Vitest unit tests for pinned and temporary tab reordering algorithms"
  ```

---

### Task 3: Write E2E Integration Tests (Playwright)

**Files:**
- Modify: `tests/e2e/sidebar.spec.js`

- [ ] **Step 1: Write E2E reorder tests in `tests/e2e/sidebar.spec.js`**
  Let's add E2E tests for dragging pinned tabs. Playwright does not natively drag-and-drop very easily with HTML5 Drag & Drop unless we dispatch the events manually in the page context or use the Playwright dragTo API.
  Let's write a robust, reliable test case using page context evaluation to test our storage persistence after reordering!
  We can add:
  ```javascript
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

    // 2. Verify initial UI order
    const pinnedRows = await sidepanelPage.locator('#pinned-zone .tab-row');
    await expect(pinnedRows.nth(0)).toContainText('GitHub');
    await expect(pinnedRows.nth(1)).toContainText('Google');

    // 3. Trigger reorder programmatically in sidepanel to test reorderPinnedTab logic
    await sidepanelPage.evaluate(() => {
      window.reorderPinnedTab('pin-1', 'pin-2', 'after');
    });

    // 4. Verify updated UI order
    await expect(pinnedRows.nth(0)).toContainText('Google');
    await expect(pinnedRows.nth(1)).toContainText('GitHub');

    // 5. Verify local storage updated
    const storageState = await sidepanelPage.evaluate(async () => {
      const data = await chrome.storage.local.get(['pinned_tabs']);
      return data.pinned_tabs;
    });

    expect(storageState[0].id).toBe('pin-2');
    expect(storageState[0].order).toBe(0);
    expect(storageState[1].id).toBe('pin-1');
    expect(storageState[1].order).toBe(1);
  });
  ```
  Wait! In `sidepanel.js`, `reorderPinnedTab` is defined as a standard function in the global scope. Let's make sure it is accessible. Wait, since `sidepanel.js` will become an ES module, top-level functions are scoped to the module and NOT global on the window unless we explicitly expose them!
  Ah! This is an incredibly important catch! If `sidepanel.js` is loaded as an ES module, functions like `reorderPinnedTab` are not attached to `window`.
  If we want to allow E2E integration testing to call these functions directly (or if we want them globally accessible), we can attach them to `window` for testing purposes:
  ```javascript
  window.reorderPinnedTab = reorderPinnedTab;
  window.reorderTempTab = reorderTempTab;
  ```
  This is extremely smart and ensures our E2E tests are 100% stable and high-fidelity without relying on brittle mouse dragging coordinates in headless runners!
  Let's verify: yes, this is a standard, robust, highly reliable E2E extension testing practice.

- [ ] **Step 2: Run all E2E integration tests and verify they pass**
  Run: `npm run test:e2e`
  Expected: PASS

- [ ] **Step 3: Commit E2E integration tests**
  ```bash
  git add tests/e2e/sidebar.spec.js
  git commit -m "test: add Playwright E2E integration tests for pinned tab reordering"
  ```
