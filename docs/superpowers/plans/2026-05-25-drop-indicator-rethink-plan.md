# Drop Target Indicator Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the vertical drop target indicator line to use a single shared absolute-positioned element inside `.lists-wrapper` that positions itself exactly in the middle of gaps, utilizing DOM metadata to handle drops cleanly for all states (normal rows, empty sections, and margins).

**Architecture:** We will inject a single `#drop-indicator` element into the DOM, absolutely position it during `dragover` using scroll-aware calculations relative to `.lists-wrapper`, store target metadata (`data-target-id`, `data-position`, `data-target-zone`) directly on it, and read this metadata in the `drop` event to handle the action state-free.

**Tech Stack:** Vanilla JavaScript (ES6+ Modules), HTML5 Drag and Drop API, Vanilla CSS (with absolute placement and smooth transitions), and Playwright/Vitest for E2E tests.

---

## Plan Structure

### Task 1: Update E2E Tests for the Drop Indicator (TDD Setup)

**Files:**
- Modify: `tests/e2e/sidebar.spec.js`

- [ ] **Step 1: Write the updated E2E tests**
  Modify [tests/e2e/sidebar.spec.js](../../tests/e2e/sidebar.spec.js) to replace the legacy `.drag-before` class checks and pseudo-element computed height assertions with assertions against the `#drop-indicator` element.
  
  Replace lines 173–294 in `tests/e2e/sidebar.spec.js` with:
  ```javascript
  test('displays and correctly positions the drop indicator when dragging over a pinned tab row', async ({ sidepanelPage }) => {
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
      await new Promise((resolve) => {
        chrome.tabs.create({ url: 'https://example.com/active', active: true }, resolve);
      });
      // Force a sync wait to let sidebar render the active pinned tab
      await new Promise(resolve => setTimeout(resolve, 800));
    });

    // 3. Verify it is rendered in the UI
    const pinnedRow = await sidepanelPage.locator('#pinned-pin-active');
    await expect(pinnedRow).toBeVisible();

    // 4. Dispatch dragover on the active pinned tab row (upper half)
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

    // 5. Verify the unified drop indicator becomes visible
    const indicator = sidepanelPage.locator('#drop-indicator');
    await expect(indicator).toHaveClass(/visible/);

    // 6. Assert indicator style top matches the expected position (1px above row boundary)
    const positioningMatches = await sidepanelPage.evaluate(() => {
      const indicatorEl = document.getElementById('drop-indicator');
      const rowEl = document.getElementById('pinned-pin-active');
      const wrapperEl = document.querySelector('.lists-wrapper');
      
      const indicatorTop = parseInt(indicatorEl.style.top);
      const rowRect = rowEl.getBoundingClientRect();
      const wrapperRect = wrapperEl.getBoundingClientRect();
      const expectedTop = Math.round(rowRect.top - wrapperRect.top + wrapperEl.scrollTop) - 1;
      
      return Math.abs(indicatorTop - expectedTop) <= 1; // 1px rounding tolerance
    });

    expect(positioningMatches).toBe(true);
  });

  test('displays unified drop indicator when dragging over empty pinned section', async ({ sidepanelPage }) => {
    const indicator = await sidepanelPage.locator('#drop-indicator');
    await expect(indicator).not.toHaveClass(/visible/);

    // 1. Dispatch dragover on #pinned-section
    await sidepanelPage.dispatchEvent('#pinned-section', 'dragover');

    // 2. Verify unified drop indicator becomes visible
    await expect(indicator).toHaveClass(/visible/);
  });

  test('retains drop indicator on child element transitions (prevents flickering)', async ({ sidepanelPage }) => {
    // 1. Setup a pinned tab
    await sidepanelPage.evaluate(async () => {
      await chrome.storage.local.set({
        pinned_tabs: [
          { id: 'pin-flicker', pinnedUrl: 'https://example.com/flicker', title: 'Flicker Pinned', order: 0 }
        ]
      });
    });

    await sidepanelPage.reload();

    // 2. Mock open tabs sync
    await sidepanelPage.evaluate(async () => {
      await new Promise(resolve => setTimeout(resolve, 500));
    });

    const pinnedRow = await sidepanelPage.locator('#pinned-pin-flicker');
    await expect(pinnedRow).toBeVisible();

    // 3. Dispatch dragover on the active pinned tab row
    await sidepanelPage.evaluate(() => {
      const row = document.getElementById('pinned-pin-flicker');
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

    // 4. Verify indicator is visible
    const indicator = sidepanelPage.locator('#drop-indicator');
    await expect(indicator).toHaveClass(/visible/);

    // 5. Dispatch dragleave on the row (simulating child element entry or transition)
    await sidepanelPage.evaluate(() => {
      const row = document.getElementById('pinned-pin-flicker');
      const titleSpan = row.querySelector('.tab-title');
      const event = new DragEvent('dragleave', {
        bubbles: true,
        cancelable: true,
        relatedTarget: titleSpan
      });
      row.dispatchEvent(event);
    });

    // 6. Verify indicator remains visible (should not be stripped by child element leaves)
    await expect(indicator).toHaveClass(/visible/);
  });
  ```

- [ ] **Step 2: Run test to verify it fails**
  Run: `npm run test:e2e`
  Expected: E2E tests fail (indicator selector returns no elements).

- [ ] **Step 3: Commit**
  ```bash
  git add tests/e2e/sidebar.spec.js
  git commit -m "test: update e2e tests to assert shared drop-indicator visibility and coordinates"
  ```

---

### Task 2: Implement DOM Structure & CSS Styling for Shared Indicator

**Files:**
- Modify: `sidepanel.html`

- [ ] **Step 1: Inject the shared `#drop-indicator` element**
  Modify [sidepanel.html](../../sidepanel.html) around line 312 to insert the shared indicator `div` directly inside the `.lists-wrapper` container:
  ```html
  <div class="lists-wrapper">
    <!-- Shared Drop Indicator Line -->
    <div id="drop-indicator"></div>
    
    <div class="section-container" id="pinned-section">
  ```

- [ ] **Step 2: Update CSS Styles & remove legacy rules**
  Modify [sidepanel.html](../../sidepanel.html) `<style>` block to add `#drop-indicator` styling and clean up legacy row-level insertion line styles.
  
  Delete lines 65–80 (legacy `#pinned-zone.drag-over-empty` styles):
  ```css
  /* REMOVE */
  #pinned-zone.drag-over-empty { ... }
  #pinned-zone.drag-over-empty::after { ... }
  ```
  
  Delete lines 101–133 (legacy `.tab-row.drag-before`, `.drag-after` pseudo-element rules):
  ```css
  /* REMOVE */
  .tab-row.drag-before,
  .tab-row.drag-after { ... }
  .tab-row.drag-before::before { ... }
  .tab-row.drag-after::after { ... }
  ```

  Inject new CSS for `#drop-indicator` inside the `<style>` tag around line 64:
  ```css
  /* Shared absolute-positioned drop line */
  #drop-indicator {
    position: absolute;
    left: 8px;
    right: 8px;
    height: 2px;
    background: var(--accent);
    border-radius: 1px;
    z-index: 100;
    box-shadow: 0 0 4px var(--accent);
    pointer-events: none; /* Let drag/mouse events pass straight through */
    display: none; /* Hidden by default */
    transition: top 0.08s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.1s ease;
  }

  #drop-indicator.visible {
    display: block;
  }
  ```

- [ ] **Step 3: Commit**
  ```bash
  git add sidepanel.html
  git commit -m "style: replace legacy row-level drop lines with absolute shared drop-indicator styles"
  ```

---

### Task 3: Implement JavaScript Positioning & Dragover Logic

**Files:**
- Modify: `sidepanel.js:254-325`

- [ ] **Step 1: Rewrite listsWrapper `dragover` positioning logic**
  Replace lines 260–301 in [sidepanel.js](../../sidepanel.js) with the scroll-aware, metadata-writing positioning calculations. Add a safety check to automatically clear any stale container `targetZone` data attributes as well.
  
  ```javascript
      listsWrapper.addEventListener("dragover", (e) => {
        const targetRow = e.target.closest(".tab-row");
        const dropZone = e.target.closest(".drop-zone");
        
        const indicator = document.getElementById("drop-indicator");
        if (!indicator) return;

        // Reset stale empty target zone mapping immediately
        delete indicator.dataset.targetZone;

        if (!targetRow && !dropZone) {
          indicator.classList.remove("visible");
          return;
        }

        e.preventDefault();
        e.dataTransfer.dropEffect = "move";

        const wrapperRect = listsWrapper.getBoundingClientRect();

        // 1. Handle drag over empty section zones
        if (dropZone && dropZone.children.length === 0) {
          const zoneRect = dropZone.getBoundingClientRect();
          const relativeTop = zoneRect.top - wrapperRect.top + listsWrapper.scrollTop;
          
          indicator.style.top = `${relativeTop}px`;
          indicator.dataset.targetZone = dropZone.id;
          indicator.classList.add("visible");
          return;
        }

        // 2. Handle drag over populated tab rows
        if (targetRow) {
          if (targetRow.classList.contains("dragging")) return;

          const rowRect = targetRow.getBoundingClientRect();
          const relativeTop = rowRect.top - wrapperRect.top + listsWrapper.scrollTop;

          const relY = e.clientY - rowRect.top;
          const isTopHalf = relY < rowRect.height / 2;

          // Position indicator exactly in the center of the 2px gap (above or below row)
          const indicatorTop = isTopHalf 
            ? relativeTop - 1 
            : relativeTop + rowRect.height + 1;

          indicator.style.top = `${indicatorTop}px`;
          indicator.dataset.targetId = targetRow.id;
          indicator.dataset.position = isTopHalf ? "before" : "after";
          indicator.classList.add("visible");
        }
      });
  ```

- [ ] **Step 2: Update dragleave to toggle indicator off**
  Replace listsWrapper's `dragleave` listener (lines 293–301) with a simple clean check:
  ```javascript
      listsWrapper.addEventListener("dragleave", (e) => {
        if (!listsWrapper.contains(e.relatedTarget)) {
          const indicator = document.getElementById("drop-indicator");
          if (indicator) {
            indicator.classList.remove("visible");
          }
        }
      });
  ```

- [ ] **Step 3: Update empty section zone drag listeners**
  Simplify section dragover/dragleave logic (lines 307–325 in [sidepanel.js](../../sidepanel.js)) to avoid applying the legacy classes since `#drop-indicator` handles empty states cleanly.
  
  Replace lines 307–324 with:
  ```javascript
      section.addEventListener("dragover", (e) => {
        e.preventDefault();
      });

      section.addEventListener("dragleave", () => {
        // Handled cleanly by unified listsWrapper dragover and dragleave
      });
  ```

- [ ] **Step 4: Update `clearDragClasses()`**
  Replace `clearDragClasses()` around lines 657–665 with:
  ```javascript
  function clearDragClasses() {
    document.querySelectorAll(".tab-row").forEach(el => {
      el.classList.remove("dragging");
    });
    const pinnedZone = document.getElementById("pinned-zone");
    if (pinnedZone) {
      pinnedZone.classList.remove("drag-over-empty");
    }
    
    const indicator = document.getElementById("drop-indicator");
    if (indicator) {
      indicator.classList.remove("visible");
    }
  }
  ```

- [ ] **Step 5: Run tests**
  Run E2E tests: `npm run test:e2e`
  Expected: Dragover E2E tests pass now! (Drop handler tests will still fail, as they expect drops to work, which is Task 4).

- [ ] **Step 6: Commit**
  ```bash
  git add sidepanel.js
  git commit -m "feat: implement scroll-aware dragover positioning and DOM metadata writing"
  ```

---

### Task 4: Implement Metadata-Driven Drop Handling

**Files:**
- Modify: `sidepanel.js:326-403`

- [ ] **Step 1: Rewrite section drop listener to support empty zones**
  Replace the general section `drop` handler (lines 326–358 in [sidepanel.js](../../sidepanel.js)) since empty-zone drops are now routed cleanly via `targetZone`. 
  
  Wait, to keep everything clean and prevent double-triggering, we will direct all drops (both row-level and empty-zone) to be resolved by our new metadata-driven document-level `drop` listener!
  
  Delete the section-level `drop` listeners entirely (lines 326–358) and make sure `section` only has `dragover`.
  
  Specifically, replace lines 304–358 with:
  ```javascript
    // Container dragover listeners for general section zones
    [pinnedSection, tempSection].forEach(section => {
      section.addEventListener("dragover", (e) => {
        e.preventDefault();
      });
    });
  ```

- [ ] **Step 2: Rewrite the document-level `drop` listener**
  Replace lines 361–403 in [sidepanel.js](../../sidepanel.js) with the metadata-reading drop resolution logic:
  
  ```javascript
    // Delegate drop listeners to dynamic drop indicators
    document.addEventListener("drop", (e) => {
      e.preventDefault();
      e.stopPropagation();

      const indicator = document.getElementById("drop-indicator");
      if (!indicator || !indicator.classList.contains("visible")) return;

      const dragId = e.dataTransfer.getData("text/plain");
      if (!dragId || (!dragId.startsWith("temp-") && !dragId.startsWith("pinned-"))) return;

      const targetZone = indicator.dataset.targetZone;
      const targetIdAttr = indicator.dataset.targetId;
      const relativePosition = indicator.dataset.position;

      clearDragClasses();

      // 1. Resolve Drops into Empty Zones
      if (targetZone) {
        const isPinned = targetZone === "pinned-zone";
        if (isPinned) {
          if (dragId.startsWith("temp-")) {
            const tabId = parseInt(dragId.replace("temp-", ""));
            pinOpenTab(tabId, 0); // Drop as the first pinned item
          } else {
            const pinnedId = dragId.replace("pinned-", "");
            reorderPinnedTab(pinnedId, null, "after");
          }
        } else {
          if (!dragId.startsWith("temp-")) {
            const pinnedId = dragId.replace("pinned-", "");
            unpinTab(pinnedId, 0); // Drop as the first normal item
          } else {
            const tabId = parseInt(dragId.replace("temp-", ""));
            chrome.tabs.move(tabId, { windowId: currentWindowId, index: 0 });
          }
        }
        return;
      }

      // 2. Resolve Standard Row Drops
      if (!targetIdAttr || !relativePosition) return;

      const isTargetPinned = targetIdAttr.startsWith("pinned-");
      const targetId = targetIdAttr.replace("pinned-", "").replace("temp-", "");

      if (isTargetPinned) {
        if (dragId.startsWith("temp-")) {
          const tabId = parseInt(dragId.replace("temp-", ""));
          pinOpenTabAtPosition(tabId, targetId, relativePosition);
        } else {
          const pinnedId = dragId.replace("pinned-", "");
          reorderPinnedTab(pinnedId, targetId, relativePosition);
        }
      } else {
        const targetTabId = parseInt(targetId);
        if (!dragId.startsWith("temp-")) {
          const pinnedId = dragId.replace("pinned-", "");
          unpinTabAtPosition(pinnedId, targetTabId, relativePosition);
        } else {
          const tabId = parseInt(dragId.replace("temp-", ""));
          reorderTempTab(tabId, targetTabId, relativePosition);
        }
      }
    });
  ```

- [ ] **Step 3: Run all unit and E2E tests to verify completion**
  Run unit tests: `npm test`
  Run integration tests: `npm run test:e2e`
  Expected: ALL tests pass flawlessly!

- [ ] **Step 4: Commit**
  ```bash
  git add sidepanel.js
  git commit -m "feat: implement metadata-driven drop resolution for both rows and empty zones"
  ```
