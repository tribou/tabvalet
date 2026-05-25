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
