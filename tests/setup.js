import { vi } from 'vitest';

global.jest = vi;

import { chrome } from 'jest-chrome';

global.chrome = chrome;

if (!chrome.storage.session) {
  chrome.storage.session = {
    clear: vi.fn(),
    get: vi.fn(),
    getBytesInUse: vi.fn(),
    remove: vi.fn(),
    set: vi.fn(),
  };
}

beforeEach(() => {
  chrome.storage.local.clear();
  chrome.storage.session.clear();
  vi.clearAllMocks();
});
