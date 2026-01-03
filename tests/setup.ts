import { beforeEach, afterEach, vi } from 'vitest';
import { installMockChromeAPI, resetMockChromeAPI } from './mocks/chrome-api';

// Install Chrome API mock globally before all tests
const mockChrome = installMockChromeAPI();

beforeEach(() => {
  // Reset the mock state before each test
  resetMockChromeAPI(mockChrome);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// Suppress console errors in tests unless specifically testing error scenarios
const originalConsoleError = console.error;
beforeEach(() => {
  console.error = vi.fn();
});

afterEach(() => {
  console.error = originalConsoleError;
});
