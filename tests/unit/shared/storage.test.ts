import { describe, it, expect, beforeEach } from 'vitest';
import { installMockChromeAPI, resetMockChromeAPI } from '@tests/mocks/chrome-api';
import { DEFAULT_PREFERENCES, DEFAULT_STATS } from '@/shared/types';

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

  describe('ratings', () => {
    it('should store ratings', async () => {
      const rating = {
        queryId: 'test-id',
        providerId: 'chatgpt',
        vote: 'up' as const,
        timestamp: Date.now(),
      };

      await chrome.storage.local.set({ ratings: [rating] });

      const result = await chrome.storage.local.get('ratings');
      expect(result.ratings).toHaveLength(1);
      expect(result.ratings[0].vote).toBe('up');
    });
  });

  describe('stats', () => {
    it('should initialize with default stats', async () => {
      await chrome.storage.local.set({ stats: DEFAULT_STATS });

      const result = await chrome.storage.local.get('stats');
      expect(result.stats.totalQueries).toBe(0);
      expect(result.stats.totalRatings).toBe(0);
    });

    it('should update stats correctly', async () => {
      await chrome.storage.local.set({
        stats: {
          ...DEFAULT_STATS,
          totalQueries: 5,
          totalRatings: 10,
          thumbsUpByProvider: { chatgpt: 8 },
          thumbsDownByProvider: { chatgpt: 2 },
        },
      });

      const result = await chrome.storage.local.get('stats');
      expect(result.stats.totalQueries).toBe(5);
      expect(result.stats.thumbsUpByProvider.chatgpt).toBe(8);
      expect(result.stats.thumbsDownByProvider.chatgpt).toBe(2);
    });
  });
});
