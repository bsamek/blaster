import { beforeEach, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { installMockChromeAPI, resetMockChromeAPI } from './mocks/chrome-api';
import '@testing-library/jest-dom/vitest';

// Install Chrome API mock globally before all tests
const mockChrome = installMockChromeAPI();

beforeEach(() => {
  // Reset the mock state before each test
  resetMockChromeAPI(mockChrome);
});

afterEach(() => {
  vi.restoreAllMocks();
  cleanup(); // Clean up React components after each test
});

// Suppress console errors in tests unless specifically testing error scenarios
const originalConsoleError = console.error;
beforeEach(() => {
  console.error = vi.fn();
});

afterEach(() => {
  console.error = originalConsoleError;
});
