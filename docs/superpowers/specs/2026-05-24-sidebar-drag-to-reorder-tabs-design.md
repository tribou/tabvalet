# Design Specification: Sidebar Tab Drag-to-Reorder

Detailed architecture and design spec for implementing drag-and-drop tab reordering within the "Pinned Tabs" and "Temporary Tabs" sections of the Chrome Vertical Tabs Sidebar extension, including cross-section dragging with precise insertion indicators.

---

## 1. Goal Description & Scope

This specification defines the implementation details for extending the existing sidebar drag-and-drop system to support:
1. **Pinned Tabs Reordering**: Persisting custom order positions of bookmarked tabs in `chrome.storage.local`.
2. **Temporary Tabs Reordering**: Physically shifting Chrome browser tab positions in the active window when dragging temporary tabs in the sidebar.
3. **Cross-Section Drag-and-Pin / Unpin**: Dragging a temporary tab into a specific visual position in Pinned tabs immediately pins it at that position. Dragging a pinned tab below the divider and dropping it between temporary tabs unpins it and shifts the underlying Chrome tab to that index.
4. **Target Insertion Line**: Drawing a highly visible glowing line (using the standard theme blue accent `#0a84ff`) above or below a tab row as hover visual feedback during dragging, ensuring the user knows precisely where the dropped tab will land.

---

## 2. Technical Architecture & Component Updates

### 2.1 CSS Styling Updates (`sidepanel.html`)
To provide smooth, native-feeling feedback during drag operations, we define classes for active drag states:
* `.tab-row.dragging`: Styled with a reduced opacity (`opacity: 0.4`) to indicate it is the active element being moved.
* `.tab-row.drag-before`: Displays a sleek horizontal border above the tab row representing the insertion point.
* `.tab-row.drag-after`: Displays a sleek horizontal border below the tab row representing the insertion point.

Both insertion borders are rendered using CSS absolute pseudo-elements (with glowing box shadows) to prevent DOM reflow and layout jitter.

> [!NOTE]
> The legacy section hover highlight (`.section-container.drag-over` background color change) is removed to avoid distracting background flashes, keeping the interface clean and letting the target insertion lines serve as the exclusive spatial drop indicator.

```css
.tab-row.dragging {
  opacity: 0.4;
}

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

### 2.2 Drag-and-Drop Coordinate System (`sidepanel.js`)
We monitor the exact vertical position of the mouse relative to each tab row during the `dragover` event.
1. Capture the bounding client rectangle of the target row: `rect = row.getBoundingClientRect()`.
2. Compute the offset: `relY = clientY - rect.top`.
3. If `relY < rect.height / 2`, toggle `.drag-before` on. If `relY >= rect.height / 2`, toggle `.drag-after` on.

### 2.3 Reordering Action Logic (`sidepanel.js`)

When a drop event occurs, the system extracts the dragged item's ID from `e.dataTransfer.getData("text/plain")` and maps it to the target row:

1. **Within Pinned Section (Pinned -> Pinned)**:
   * Locates the dragged tab's object and target tab's object in the `pinnedTabs` array.
   * Calculates the target index. If dropped `after`, index is `targetIndex + 1`; if `before`, it is `targetIndex`.
   * Splits and rearranges the `pinnedTabs` array to insert the dragged tab at the computed index.
   * Reassigns sequential `.order` integers to all elements in the array.
   * Saves the updated list to `chrome.storage.local.set({ pinned_tabs })` to trigger an automatic UI sync and re-render.

2. **Within Temporary Section (Temp -> Temp)**:
   * Obtains the target open tab's index in the window via `openTabs` array.
   * Calculates the insertion index (adding 1 if dropping `after`).
   * Moves the Chrome tab physically via:
     ```javascript
     chrome.tabs.move(draggedTabId, { index: targetIndex });
     ```
   * The subsequent `chrome.tabs.onUpdated` / `syncOpenTabs` handler automatically updates the sidebar view.

3. **Temp -> Pinned (Pin at Position)**:
   * Resolves the open tab structure for the temporary tab.
   * Creates a new `PinnedTab` object.
   * Inserts the new object into the calculated position within the `pinnedTabs` array, updating all subsequent indices.
   * Saves to local storage and updates active mapping.

4. **Pinned -> Temp (Unpin at Position)**:
   * Removes the tab from `pinnedTabs` store.
   * Moves the underlying active tab in Chrome to the specific target index in the open tabs section.

---

## 3. Data Schema & State Management

The data format of `PinnedTab` remains consistent with the core spec:
```typescript
interface PinnedTab {
  id: string;
  pinnedUrl: string;
  activeUrl: string | null;
  title: string;
  activeTitle: string | null;
  favIconUrl: string;
  order: number;
}
```

The sorting is performed during rendering using:
```javascript
const sorted = [...pinnedTabs].sort((a, b) => a.order - b.order);
```

---

## 4. Edge Cases & Error Handling

1. **Dropping onto Empty Sections / Section Headers**:
   * If a section has no tab rows, the drop zone or section header acts as a drop target.
   * Dropping onto the Pinned section or header appends/pins the tab at the end of the section.
   * Dropping onto the Temp section divider or header appends the tab at the end of the open tabs index.
2. **Tab Closures During Drag Operations**:
   * If a tab is closed inside Chrome while the drag is active, `chrome.tabs.onRemoved` will trigger a sync safely, clearing stale drag states.
3. **Invalid Drop Zones**:
   * A document-level `dragend` listener is registered to completely clear all `.drag-before`, `.drag-after`, and `.dragging` classes from any elements, ensuring no visual styling elements get permanently stuck on the screen if a drop is cancelled.

---

## 5. Verification Plan

### 5.1 Manual UI and Drag Verification
1. **Pinned Sorting**:
   * Verify that dragging Pinned tab 1 below Pinned tab 2 shifts their order and updates local storage permanently.
   * Verify that closing and reopening the side panel displays the new correct custom order.
2. **Temporary Sorting**:
   * Verify that dragging Temporary tab 1 below Temporary tab 2 physically moves the browser tab position in Chrome's tab bar.
   * Verify that reordering tabs directly in Chrome's standard tab bar immediately updates their order in the side panel.
3. **Cross-Section Precise Insertion**:
   * Drag a temporary tab precisely between Pinned tab 1 and Pinned tab 2. Verify that it becomes pinned and inserts exactly at position index 1.
   * Drag a pinned tab precisely between Temporary tab 2 and Temporary tab 3. Verify that the pinned tab becomes temporary and its underlying tab in Chrome moves to that exact index position.
4. **Target Line Polish**:
   * Verify that moving a tab cursor over the top half of any tab row renders the target insertion line at the top.
   * Verify that moving it over the bottom half renders the insertion line at the bottom.
   * Verify that dragging outside the side panel or canceling the drag cleanly removes all highlight lines.
