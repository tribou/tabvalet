import { vi } from 'vitest';
import 'jest-chrome';

beforeEach(() => {
  chrome.storage.local.clear();
  chrome.storage.session.clear();
  vi.clearAllMocks();
});
