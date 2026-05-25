# Spec: Shared Drop Target Indicator Refactor

Rethinking and refactoring the drop target indicator line to use a single, shared, absolute-positioned indicator element rather than row-level before/after pseudo-elements. This resolves vertical shifting and visual jitter as the cursor moves across adjacent tab rows.

## Goal & Problem Statement

Currently, the vertical tabs sidebar renders insertion lines using `::before` and `::after` pseudo-elements attached to individual hovered `.tab-row` containers. Because there is a `2px` visual gap between adjacent tab rows:
1. Moving the mouse from the bottom half of Tab A to the top half of Tab B switches the active CSS class from `.drag-after` (on Tab A) to `.drag-before` (on Tab B).
2. Since these are separate elements relative to their respective rows, the line physically shifts or jumps by 2px due to the visual gap.
3. This creates visual clutter and subtle flickering.

This refactor introduces a **single, shared, absolute-positioned `#drop-indicator`** that sits inside the `.lists-wrapper` container. The `dragover` logic calculates the precise vertical position in the middle of the gap and stores the target row metadata directly as `data-` attributes on the indicator. The `drop` handler reads this metadata, completely eliminating double-rendering and coordinate recalculations.

## Proposed Changes

### 1. HTML DOM Structure
Modify [sidepanel.html](file:///Users/tribou/dev/joyful-pascal/sidepanel.html) to inject the shared drop indicator inside the scrollable `.lists-wrapper`:

```html
<div class="lists-wrapper">
  <!-- Shared Drop Indicator Line -->
  <div id="drop-indicator"></div>

  <div class="section-container" id="pinned-section">...</div>
  ...
</div>
```

### 2. CSS Styling
Modify [sidepanel.html](file:///Users/tribou/dev/joyful-pascal/sidepanel.html) `<style>` block to style the `#drop-indicator` absolutely and remove legacy row-level drop indicator pseudo-elements:

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
  pointer-events: none; /* Let events pass through to underlying elements */
  display: none; /* Hidden by default */
  transition: top 0.08s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.1s ease;
}

#drop-indicator.visible {
  display: block;
}
```

*Legacy styles to remove*:
- `.tab-row.drag-before`, `.tab-row.drag-after`
- `.tab-row.drag-before::before`
- `.tab-row.drag-after::after`

### 3. JavaScript Event Coordination
Modify [sidepanel.js](file:///Users/tribou/dev/joyful-pascal/sidepanel.js) to position and store state on the `#drop-indicator` during `dragover`, retrieve it during `drop`, and toggle visibility on cleanup.

#### Dragover Handler (Positioning & Metadata Writing)
```javascript
// Inside listsWrapper 'dragover' event listener:
const targetRow = e.target.closest(".tab-row");
if (!targetRow) {
  const indicator = document.getElementById("drop-indicator");
  if (indicator) indicator.classList.remove("visible");
  return;
}

if (targetRow.classList.contains("dragging")) return;

e.preventDefault();
e.dataTransfer.dropEffect = "move";

const wrapperRect = listsWrapper.getBoundingClientRect();
const rowRect = targetRow.getBoundingClientRect();
const relativeTop = rowRect.top - wrapperRect.top + listsWrapper.scrollTop;

const relY = e.clientY - rowRect.top;
const isTopHalf = relY < rowRect.height / 2;

// Position exactly in the middle of the 2px gap (above or below target row)
const indicatorTop = isTopHalf 
  ? relativeTop - 1 
  : relativeTop + rowRect.height + 1;

const indicator = document.getElementById("drop-indicator");
if (indicator) {
  indicator.style.top = `${indicatorTop}px`;
  indicator.dataset.targetId = targetRow.id;
  indicator.dataset.position = isTopHalf ? "before" : "after";
  indicator.classList.add("visible");
}
```

#### Drop Handler (Metadata Querying)
```javascript
// Inside document 'drop' event listener:
const targetRow = e.target.closest(".tab-row");
if (!targetRow) return;

e.preventDefault();
e.stopPropagation();

const indicator = document.getElementById("drop-indicator");
if (!indicator || !indicator.classList.contains("visible")) return;

const dragId = e.dataTransfer.getData("text/plain");
if (!dragId || (!dragId.startsWith("temp-") && !dragId.startsWith("pinned-"))) return;

const targetIdAttr = indicator.dataset.targetId;
const relativePosition = indicator.dataset.position;

clearDragClasses();

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
```

#### Cleanup Function (`clearDragClasses`)
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

## E2E Testing Strategy

We will update [tests/e2e/sidebar.spec.js](file:///Users/tribou/dev/joyful-pascal/tests/e2e/sidebar.spec.js) to:
1. Assert the visibility and correct coordinate alignment of the shared `#drop-indicator` element instead of row-level CSS classes.
2. Ensure the drop indicator is positioned exactly 1px above/below the row bounds (relative to scroll).

### Updated Test Snippet
```javascript
test('displays and correctly positions the drop indicator when dragging over a pinned tab row', async ({ sidepanelPage }) => {
  // ... Setup active pinned tab ...
  
  // Verify indicator is visible
  const indicator = sidepanelPage.locator('#drop-indicator');
  await expect(indicator).toHaveClass(/visible/);
  
  // Assert indicator style top matches the expected position (1px above row boundary)
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
```
