import { normalizeUrl } from '../utils/url.js';

/**
 * Calculates next mapping state dictionary.
 * @param {Array} openTabs 
 * @param {Array} pinnedTabs 
 * @param {Object} activePinnedMap 
 * @returns {Object} map of openTabIdStr -> pinnedTabId
 */
export function calculateTabMappings(openTabs, pinnedTabs, activePinnedMap) {
  const nextMap = { ...activePinnedMap };
  const mappedPinnedIds = [];

  // 1. Clean up stale maps and collect mapped pin IDs
  for (const [tId, pId] of Object.entries(nextMap)) {
    const tIdNum = parseInt(tId);
    if (openTabs.some(o => o.id === tIdNum)) {
      mappedPinnedIds.push(pId);
    } else {
      delete nextMap[tId];
    }
  }

  // 2. Automap unmapped open tabs
  openTabs.forEach(openTab => {
    const openTabIdStr = openTab.id.toString();
    if (nextMap[openTabIdStr] === undefined) {
      const match = pinnedTabs.find(pTab => {
        if (mappedPinnedIds.includes(pTab.id)) return false;

        const normOpen = normalizeUrl(openTab.url);
        const normPinned = normalizeUrl(pTab.pinnedUrl);
        const normActive = pTab.activeUrl ? normalizeUrl(pTab.activeUrl) : null;

        return normOpen === normPinned || normOpen === normActive;
      });

      if (match) {
        nextMap[openTabIdStr] = match.id;
        mappedPinnedIds.push(match.id);
      }
    }
  });

  return nextMap;
}

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

