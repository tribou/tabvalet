import { describe, test, expect } from 'vitest';
import {
  calculateTabMappings,
  reorderPinnedTabsList,
  calculateTempTabTargetIndex
} from '../../src/logic/tab-manager.js';

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

describe('reorderPinnedTabsList', () => {
  test('returns a copy of array if draggedId equals targetId', () => {
    const pinned = [
      { id: 'pin-1', order: 0 },
      { id: 'pin-2', order: 1 }
    ];
    const result = reorderPinnedTabsList(pinned, 'pin-1', 'pin-1', 'before');
    expect(result).toEqual(pinned);
    expect(result).not.toBe(pinned); // check it's a new copy/array reference
  });

  test('returns a copy of array if draggedId is not found', () => {
    const pinned = [
      { id: 'pin-1', order: 0 },
      { id: 'pin-2', order: 1 }
    ];
    const result = reorderPinnedTabsList(pinned, 'nonexistent', 'pin-2', 'before');
    expect(result).toEqual(pinned);
    expect(result).not.toBe(pinned);
  });

  test('reorders a tab to be "before" the target tab', () => {
    const pinned = [
      { id: 'pin-1', order: 0 },
      { id: 'pin-2', order: 1 },
      { id: 'pin-3', order: 2 }
    ];
    const result = reorderPinnedTabsList(pinned, 'pin-3', 'pin-2', 'before');
    expect(result).toEqual([
      { id: 'pin-1', order: 0 },
      { id: 'pin-3', order: 1 },
      { id: 'pin-2', order: 2 }
    ]);
  });

  test('reorders a tab to be "after" the target tab', () => {
    const pinned = [
      { id: 'pin-1', order: 0 },
      { id: 'pin-2', order: 1 },
      { id: 'pin-3', order: 2 }
    ];
    const result = reorderPinnedTabsList(pinned, 'pin-1', 'pin-2', 'after');
    expect(result).toEqual([
      { id: 'pin-2', order: 0 },
      { id: 'pin-1', order: 1 },
      { id: 'pin-3', order: 2 }
    ]);
  });

  test('reorders a tab to the end if targetId is null', () => {
    const pinned = [
      { id: 'pin-1', order: 0 },
      { id: 'pin-2', order: 1 },
      { id: 'pin-3', order: 2 }
    ];
    const result = reorderPinnedTabsList(pinned, 'pin-1', null, 'after');
    expect(result).toEqual([
      { id: 'pin-2', order: 0 },
      { id: 'pin-3', order: 1 },
      { id: 'pin-1', order: 2 }
    ]);
  });
});

describe('calculateTempTabTargetIndex', () => {
  test('returns draggedTab.index if draggedTab.id matches targetTab.id', () => {
    const dragged = { id: 10, index: 2 };
    const target = { id: 10, index: 2 };
    expect(calculateTempTabTargetIndex(dragged, target, 'before')).toBe(2);
  });

  test('calculates correct index when dragging from left to right (low to high index)', () => {
    const dragged = { id: 1, index: 1 };
    const target = { id: 3, index: 3 };

    // dropping "before" target 3 -> target index should be 3 - 1 = 2
    expect(calculateTempTabTargetIndex(dragged, target, 'before')).toBe(2);

    // dropping "after" target 3 -> target index should be 3
    expect(calculateTempTabTargetIndex(dragged, target, 'after')).toBe(3);
  });

  test('calculates correct index when dragging from right to left (high to low index)', () => {
    const dragged = { id: 3, index: 3 };
    const target = { id: 1, index: 1 };

    // dropping "before" target 1 -> target index should be 1
    expect(calculateTempTabTargetIndex(dragged, target, 'before')).toBe(1);

    // dropping "after" target 1 -> target index should be 1 + 1 = 2
    expect(calculateTempTabTargetIndex(dragged, target, 'after')).toBe(2);
  });
});

