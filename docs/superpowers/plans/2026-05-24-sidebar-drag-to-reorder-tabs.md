# Sidebar Drag-to-Reorder Tabs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement precise drag-and-drop tab reordering within Pinned and Temporary sections, featuring elegant Target Insertion Lines and clean-up of legacy drag-over backgrounds.

**Architecture:** Extend the existing HTML5 drag-and-drop event handlers in `sidepanel.js` to calculate target insertion bounds (top/bottom 50% threshold) and render target lines via CSS pseudo-borders, then perform localized array sorting for Pinned tabs (persisted to storage) and native browser moves for Temporary tabs.

**Tech Stack:** HTML5 Drag & Drop API, Vanilla CSS, Vanilla JS, Chrome Extension APIs (`chrome.tabs`, `chrome.storage`)

---

### Task 1: CSS Styling Updates (`sidepanel.html`)

**Files:**
- Modify: `sidepanel.html` (inside the `<style>` tag)

- [ ] **Step 1: Write CSS rules for drag-to-reorder classes**
  We will add `.tab-row.dragging`, `.tab-row.drag-before`, and `.tab-row.drag-after` to `sidepanel.html`. We will also remove `.section-container.drag-over` background and color styling as requested.

  Let's replace:
  ```css
  /* Section Container and Drop Target */
  .section-container {
    display: flex;
    flex-direction: column;
    transition: background-color 0.15s ease;
    border-radius: 10px;
    margin: 4px 2px;
    padding-bottom: 6px;
  }
  .section-container.drag-over {
    background: rgba(10, 132, 255, 0.08);
  }
  .section-container.drag-over .section-header {
    color: var(--accent);
  }
  ```

  With:
  ```css
  /* Section Container */
  .section-container {
    display: flex;
    flex-direction: column;
    transition: background-color 0.15s ease;
    border-radius: 10px;
    margin: 4px 2px;
    padding-bottom: 6px;
  }

  /* Reduced opacity for the row currently being dragged */
  .tab-row.dragging {
    opacity: 0.4;
  }

  /* Target insertion line above the row */
  .tab-row.drag-before {
    position: relative;
  }
  .tab-row.drag-before::before {
    content: '';
    position: absolute;
    top: 0;
    left: 4px;
    right: 4px;
    height: 2px;
    background: var(--accent);
    border-radius: 1px;
    z-index: 10;
    box-shadow: 0 0 4px var(--accent);
  }

  /* Target insertion line below the row */
  .tab-row.drag-after {
    position: relative;
  }
  .tab-row.drag-after::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 4px;
    right: 4px;
    height: 2px;
    background: var(--accent);
    border-radius: 1px;
    z-index: 10;
    box-shadow: 0 0 4px var(--accent);
  }
  ```

- [ ] **Step 2: Commit styling changes**
  ```bash
  git add sidepanel.html
  git commit -m "style: add drag-reorder CSS states and remove legacy container hover highlights"
  ```

---

### Task 2: JS Drag Events & Boundary Calculations (`sidepanel.js`)

**Files:**
- Modify: `sidepanel.js` (around `renderPinnedTabs`, `renderTemporaryTabs`, and `setupDragAndDrop`)

- [ ] **Step 1: Update tab rows in `renderPinnedTabs` and `renderTemporaryTabs` to listen to boundary calculations**
  We must attach the following drag listeners to the dynamic row elements:
  * `dragstart`: sets the dragging ID, sets dropEffect, and adds `.dragging` class.
  * `dragover`: checks coordinate `relY` relative to `rect.height / 2`, adds `.drag-before` or `.drag-after` class, and clears the other.
  * `dragleave`: clears the drag classes.
  * `dragend`: clears all drag-related classes globally.

  Add these listeners to `renderPinnedTabs()` (around line 155):
  ```javascript
  row.addEventListener("dragstart", (e) => {
    e.dataTransfer.setData("text/plain", `pinned-${tab.id}`);
    e.dataTransfer.effectAllowed = "move";
    row.classList.add("dragging");
  });
  
  row.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const rect = row.getBoundingClientRect();
    const relY = e.clientY - rect.top;
    if (relY < rect.height / 2) {
      row.classList.add("drag-before");
      row.classList.remove("drag-after");
    } else {
      row.classList.add("drag-after");
      row.classList.remove("drag-before");
    }
  });

  row.addEventListener("dragleave", () => {
    row.classList.remove("drag-before", "drag-after");
  });

  row.addEventListener("dragend", () => {
    clearDragClasses();
  });
  ```

  Similarly, add these listeners to `renderTemporaryTabs()` (around line 230):
  ```javascript
  row.addEventListener("dragstart", (e) => {
    e.dataTransfer.setData("text/plain", `temp-${tab.id}`);
    e.dataTransfer.effectAllowed = "move";
    row.classList.add("dragging");
  });

  row.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const rect = row.getBoundingClientRect();
    const relY = e.clientY - rect.top;
    if (relY < rect.height / 2) {
      row.classList.add("drag-before");
      row.classList.remove("drag-after");
    } else {
      row.classList.add("drag-after");
      row.classList.remove("drag-before");
    }
  });

  row.addEventListener("dragleave", () => {
    row.classList.remove("drag-before", "drag-after");
  });

  row.addEventListener("dragend", () => {
    clearDragClasses();
  });
  ```

  And define the global utility function `clearDragClasses()` in `sidepanel.js` to ensure visual lines are perfectly cleared:
  ```javascript
  function clearDragClasses() {
    document.querySelectorAll(".tab-row").forEach(el => {
      el.classList.remove("dragging", "drag-before", "drag-after");
    });
  }
  ```

- [ ] **Step 2: Commit drag listeners update**
  ```bash
  git add sidepanel.js
  git commit -m "feat: implement HTML5 drag boundary checks and drag class handlers on sidebar tabs"
  ```

---

### Task 3: Implement Reordering Logic (`sidepanel.js`)

**Files:**
- Modify: `sidepanel.js` (refactoring `setupDragAndDrop`)

- [ ] **Step 1: Refactor `setupDragAndDrop` to support precise drop insertion**
  We will replace the entire `setupDragAndDrop()` function to handle reordering logic:
  - Identify where the tab was dropped (e.g. over a specific `.tab-row` target, or general zone container drop).
  - Calculate precise target index position.
  - Implement Pinned -> Pinned reordering.
  - Implement Temp -> Temp reordering.
  - Implement Temp -> Pinned cross-section drop.
  - Implement Pinned -> Temp cross-section drop.

  Let's replace `setupDragAndDrop()` with the following robust implementation:
  ```javascript
  function setupDragAndDrop() {
    const pinnedSection = document.getElementById("pinned-section");
    const tempSection = document.getElementById("temp-section");

    // Container dragover & drop listeners for general section zones (e.g. dropping at empty/end)
    [pinnedSection, tempSection].forEach(section => {
      const isPinned = section.id === "pinned-section";

      section.addEventListener("dragover", (e) => {
        e.preventDefault();
      });

      section.addEventListener("drop", (e) => {
        // Prevent event bubbling if a specific tab drop handled it already
        if (e.defaultPrevented) return;
        e.preventDefault();
        
        const dragId = e.dataTransfer.getData("text/plain");
        clearDragClasses();

        if (isPinned) {
          // Append to end of Pinned section
          if (dragId.startsWith("temp-")) {
            const tabId = parseInt(dragId.replace("temp-", ""));
            pinOpenTab(tabId, pinnedTabs.length);
          } else {
            const pinnedId = dragId.replace("pinned-", "");
            reorderPinnedTab(pinnedId, null, "after");
          }
        } else {
          // Append to end of Temporary section
          if (!dragId.startsWith("temp-")) {
            const pinnedId = dragId.replace("pinned-", "");
            unpinTab(pinnedId, openTabs.length);
          } else {
            const tabId = parseInt(dragId.replace("temp-", ""));
            chrome.tabs.move(tabId, { index: -1 });
          }
        }
      });
    });

    // Delegate drop listeners to dynamic tab rows
    document.addEventListener("drop", (e) => {
      const targetRow = e.target.closest(".tab-row");
      if (!targetRow) return;

      e.preventDefault();
      e.stopPropagation();

      const dragId = e.dataTransfer.getData("text/plain");
      const isDragBefore = targetRow.classList.contains("drag-before");
      const relativePosition = isDragBefore ? "before" : "after";
      
      clearDragClasses();

      const isTargetPinned = targetRow.id.startsWith("pinned-");
      const targetId = targetRow.id.replace("pinned-", "").replace("temp-", "");

      if (isTargetPinned) {
        // Target is in the Pinned section
        if (dragId.startsWith("temp-")) {
          // Cross-section Temp -> Pinned drop at precise position
          const tabId = parseInt(dragId.replace("temp-", ""));
          pinOpenTabAtPosition(tabId, targetId, relativePosition);
        } else {
          // Pinned -> Pinned reorder at precise position
          const pinnedId = dragId.replace("pinned-", "");
          reorderPinnedTab(pinnedId, targetId, relativePosition);
        }
      } else {
        // Target is in the Temp section
        const targetTabId = parseInt(targetId);
        if (!dragId.startsWith("temp-")) {
          // Cross-section Pinned -> Temp drop at precise position
          const pinnedId = dragId.replace("pinned-", "");
          unpinTabAtPosition(pinnedId, targetTabId, relativePosition);
        } else {
          // Temp -> Temp reorder at precise position
          const tabId = parseInt(dragId.replace("temp-", ""));
          reorderTempTab(tabId, targetTabId, relativePosition);
        }
      }
    });
  }
  ```

- [ ] **Step 2: Add auxiliary positioning helpers in `sidepanel.js`**
  Let's implement the helpers called in `setupDragAndDrop()`:

  ```javascript
  // Reorder within Pinned section
  function reorderPinnedTab(draggedId, targetId, position) {
    const draggedIndex = pinnedTabs.findIndex(t => t.id === draggedId);
    if (draggedIndex === -1) return;

    const draggedTab = pinnedTabs[draggedIndex];
    pinnedTabs.splice(draggedIndex, 1);

    let targetIndex = pinnedTabs.length;
    if (targetId) {
      const idx = pinnedTabs.findIndex(t => t.id === targetId);
      if (idx !== -1) {
        targetIndex = position === "before" ? idx : idx + 1;
      }
    }

    pinnedTabs.splice(targetIndex, 0, draggedTab);

    // Reassign order
    pinnedTabs.forEach((tab, index) => {
      tab.order = index;
    });

    chrome.storage.local.set({ pinned_tabs: pinnedTabs }, () => {
      syncOpenTabs();
    });
  }

  // Pin open tab at precise position
  function pinOpenTabAtPosition(tabId, targetPinnedId, position) {
    const tab = openTabs.find(o => o.id === tabId);
    if (!tab) return;

    let targetIndex = pinnedTabs.length;
    const idx = pinnedTabs.findIndex(t => t.id === targetPinnedId);
    if (idx !== -1) {
      targetIndex = position === "before" ? idx : idx + 1;
    }

    const newPinned = {
      id: Date.now().toString(),
      pinnedUrl: tab.url,
      activeUrl: null,
      title: tab.title,
      activeTitle: null,
      favIconUrl: tab.favIconUrl,
      order: targetIndex
    };

    pinnedTabs.splice(targetIndex, 0, newPinned);

    // Reassign orders
    pinnedTabs.forEach((t, i) => {
      t.order = i;
    });

    chrome.storage.local.set({ pinned_tabs: pinnedTabs }, () => {
      chrome.runtime.sendMessage({
        action: "mapActiveTab",
        tabId: tabId,
        pinnedTabId: newPinned.id
      }, () => {
        syncOpenTabs();
      });
    });
  }

  // Reorder within Temporary section
  function reorderTempTab(draggedTabId, targetTabId, position) {
    chrome.tabs.get(targetTabId, (targetTab) => {
      if (chrome.runtime.lastError || !targetTab) return;

      let targetIndex = targetTab.index;
      if (position === "after") {
        targetIndex += 1;
      }

      chrome.tabs.move(draggedTabId, { index: targetIndex }, () => {
        syncOpenTabs();
      });
    });
  }

  // Unpin a tab and drop it at a precise temporary tab position
  function unpinTabAtPosition(pinnedTabId, targetTabId, position) {
    const index = pinnedTabs.findIndex(t => t.id === pinnedTabId);
    if (index === -1) return;

    pinnedTabs.splice(index, 1);
    
    // Recalculate orders of remaining pinned tabs
    pinnedTabs.forEach((t, i) => {
      t.order = i;
    });

    chrome.storage.local.set({ pinned_tabs: pinnedTabs }, () => {
      chrome.runtime.sendMessage({
        action: "unmapActiveTab",
        pinnedTabId: pinnedTabId
      }, () => {
        // Now physically move the open tab to the target position
        chrome.tabs.get(targetTabId, (targetTab) => {
          if (chrome.runtime.lastError || !targetTab) {
            syncOpenTabs();
            return;
          }

          let targetIndex = targetTab.index;
          if (position === "after") {
            targetIndex += 1;
          }

          // We need to find the actual tab ID that was mapped to the pinned tab
          let mappedTabId = null;
          for (const [tId, pId] of Object.entries(activePinnedMap)) {
            if (pId === pinnedTabId) {
              mappedTabId = parseInt(tId);
              break;
            }
          }

          if (mappedTabId) {
            chrome.tabs.move(mappedTabId, { index: targetIndex }, () => {
              syncOpenTabs();
            });
          } else {
            syncOpenTabs();
          }
        });
      });
    });
  }
  ```

  Also replace `pinOpenTab` and `unpinTab` to support optional order parameters:
  ```javascript
  // Pin an active temporary tab
  function pinOpenTab(tabId, orderIndex) {
    const tab = openTabs.find(o => o.id === tabId);
    if (!tab) return;
    
    const newPinned = {
      id: Date.now().toString(),
      pinnedUrl: tab.url,
      activeUrl: null,
      title: tab.title,
      activeTitle: null,
      favIconUrl: tab.favIconUrl,
      order: orderIndex !== undefined ? orderIndex : pinnedTabs.length
    };
    
    pinnedTabs.push(newPinned);
    // Sort and re-index
    pinnedTabs.sort((a, b) => a.order - b.order);
    pinnedTabs.forEach((t, i) => { t.order = i; });

    chrome.storage.local.set({ pinned_tabs: pinnedTabs }, () => {
      chrome.runtime.sendMessage({
        action: "mapActiveTab",
        tabId: tabId,
        pinnedTabId: newPinned.id
      }, () => {
        syncOpenTabs();
      });
    });
  }

  // Unpin a tab
  function unpinTab(pinnedTabId, targetIndex) {
    const index = pinnedTabs.findIndex(t => t.id === pinnedTabId);
    if (index === -1) return;
    
    pinnedTabs.splice(index, 1);
    pinnedTabs.forEach((t, i) => { t.order = i; });

    chrome.storage.local.set({ pinned_tabs: pinnedTabs }, () => {
      chrome.runtime.sendMessage({
        action: "unmapActiveTab",
        pinnedTabId: pinnedTabId
      }, () => {
        if (targetIndex !== undefined) {
          let mappedTabId = null;
          for (const [tId, pId] of Object.entries(activePinnedMap)) {
            if (pId === pinnedTabId) {
              mappedTabId = parseInt(tId);
              break;
            }
          }
          if (mappedTabId) {
            chrome.tabs.move(mappedTabId, { index: targetIndex }, () => {
              syncOpenTabs();
            });
            return;
          }
        }
        syncOpenTabs();
      });
    });
  }
  ```

- [ ] **Step 3: Commit reordering logic**
  ```bash
  git add sidepanel.js
  git commit -m "feat: implement precise drop calculations and section-reordering handlers"
  ```

---

### Task 4: Verification & Manual Testing

- [ ] **Step 1: Load and test the extension manually**
  1. Open Chrome and navigate to `chrome://extensions/`.
  2. Turn on "Developer mode" in the top right.
  3. Click "Load unpacked" and select the project folder `/Users/tribou/dev/joyful-pascal`.
  4. Pin the extension and click the extension icon to open the Sidebar panel.
  5. Drag Pinned tabs up and down. Verify that a beautiful Target Insertion Line follows the cursor, and dropping them updates their sequence permanently (survives sidebar closes/reopens).
  6. Drag Temporary tabs up and down. Verify that dragging moves the actual Chrome browser tab index in the browser.
  7. Drag a Temporary tab between two Pinned tabs. Verify that it gets pinned at that exact slot.
  8. Drag a Pinned tab into Temporary tabs. Verify that it gets unpinned and moves to that slot in open tabs.
  9. Verify that canceling a drag cleanly removes all highlights.

- [ ] **Step 2: Save Walkthrough**
  Create `walkthrough.md` to document the completed implementation.
