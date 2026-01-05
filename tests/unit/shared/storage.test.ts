import { describe, it, expect, beforeEach } from 'vitest';
import { installMockChromeAPI, resetMockChromeAPI } from '@tests/mocks/chrome-api';
import { DEFAULT_PREFERENCES } from '@/shared/types';

describe('Storage', () => {
  const mockChrome = installMockChromeAPI();

  beforeEach(() => {
    resetMockChromeAPI(mockChrome);
  });

  describe('preferences', () => {
    it('should store and retrieve preferences', async () => {
      await chrome.storage.local.set({ preferences: DEFAULT_PREFERENCES });

      const result = await chrome.storage.local.get('preferences');
      expect(result.preferences).toEqual(DEFAULT_PREFERENCES);
    });

    it('should merge preferences correctly', async () => {
      await chrome.storage.local.set({ preferences: DEFAULT_PREFERENCES });

      const customPrefs = {
        ...DEFAULT_PREFERENCES,
        defaultProviders: ['chatgpt'],
      };
      await chrome.storage.local.set({ preferences: customPrefs });

      const result = await chrome.storage.local.get('preferences');
      expect(result.preferences.defaultProviders).toEqual(['chatgpt']);
    });
  });

  describe('queries', () => {
    it('should store queries', async () => {
      const query = {
        id: 'test-id',
        text: 'What is TypeScript?',
        timestamp: Date.now(),
        providers: ['chatgpt', 'claude'],
      };

      await chrome.storage.local.set({ queries: [query] });

      const result = await chrome.storage.local.get('queries');
      expect(result.queries).toHaveLength(1);
      expect(result.queries[0].text).toBe('What is TypeScript?');
    });
  });

  describe('responses', () => {
    it('should store responses', async () => {
      const response = {
        queryId: 'test-id',
        providerId: 'chatgpt',
        text: 'TypeScript is a typed superset of JavaScript.',
        timestamp: Date.now(),
        durationMs: 1500,
      };

      await chrome.storage.local.set({ responses: [response] });

      const result = await chrome.storage.local.get('responses');
      expect(result.responses).toHaveLength(1);
      expect(result.responses[0].text).toBe('TypeScript is a typed superset of JavaScript.');
    });
  });
});
