import { describe, test, expect } from 'vitest';
import { calculateTabMappings } from '../../src/logic/tab-manager.js';

describe('Tab Synchronization Manager', () => {
  test('matches unmapped open tabs to pinned tabs by normalized URL', () => {
    const openTabs = [
      { id: 1, url: 'https://github.com/trending/' }
    ];
    const pinnedTabs = [
      { id: 'pin-100', pinnedUrl: 'http://github.com/trending', order: 0 }
    ];
    const activePinnedMap = {};

    const nextMap = calculateTabMappings(openTabs, pinnedTabs, activePinnedMap);

    expect(nextMap).toEqual({ '1': 'pin-100' });
  });

  test('clears active mappings when open tabs are closed', () => {
    const openTabs = []; // Open tab 1 was closed
    const pinnedTabs = [
      { id: 'pin-100', pinnedUrl: 'https://github.com', order: 0 }
    ];
    const activePinnedMap = { '1': 'pin-100' };

    const nextMap = calculateTabMappings(openTabs, pinnedTabs, activePinnedMap);

    expect(nextMap).toEqual({});
  });
});
