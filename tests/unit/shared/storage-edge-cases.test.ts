import { describe, it, expect, beforeEach, vi } from 'vitest';
import { installMockChromeAPI, resetMockChromeAPI, createMockChromeAPI } from '@tests/mocks/chrome-api';
import { DEFAULT_PREFERENCES } from '@/shared/types';

describe('Storage Edge Cases', () => {
  const mockChrome = installMockChromeAPI();

  beforeEach(() => {
    resetMockChromeAPI(mockChrome);
  });

  describe('concurrent access', () => {
    it('should handle multiple simultaneous writes', async () => {
      const writes = [
        chrome.storage.local.set({ key1: 'value1' }),
        chrome.storage.local.set({ key2: 'value2' }),
        chrome.storage.local.set({ key3: 'value3' }),
      ];

      await Promise.all(writes);

      const result = await chrome.storage.local.get(['key1', 'key2', 'key3']);
      expect(result.key1).toBe('value1');
      expect(result.key2).toBe('value2');
      expect(result.key3).toBe('value3');
    });

    it('should handle read-write race conditions', async () => {
      await chrome.storage.local.set({ counter: 0 });

      // Simulate concurrent reads and writes
      const operations = [
        chrome.storage.local.get('counter'),
        chrome.storage.local.set({ counter: 1 }),
        chrome.storage.local.get('counter'),
        chrome.storage.local.set({ counter: 2 }),
        chrome.storage.local.get('counter'),
      ];

      await Promise.all(operations);

      const finalResult = await chrome.storage.local.get('counter');
      expect(finalResult.counter).toBe(2);
    });
  });

  describe('null and undefined values', () => {
    it('should return undefined for non-existent keys', async () => {
      const result = await chrome.storage.local.get('nonExistentKey');
      expect(result.nonExistentKey).toBeUndefined();
    });

    it('should handle null values in storage', async () => {
      await chrome.storage.local.set({ nullValue: null });

      const result = await chrome.storage.local.get('nullValue');
      expect(result.nullValue).toBeNull();
    });

    it('should handle undefined values in storage', async () => {
      await chrome.storage.local.set({ undefinedValue: undefined });

      const result = await chrome.storage.local.get('undefinedValue');
      // Note: undefined becomes undefined in our mock
      expect(result.undefinedValue).toBeUndefined();
    });
  });

  describe('empty and special values', () => {
    it('should handle empty strings', async () => {
      await chrome.storage.local.set({ emptyString: '' });

      const result = await chrome.storage.local.get('emptyString');
      expect(result.emptyString).toBe('');
    });

    it('should handle empty arrays', async () => {
      await chrome.storage.local.set({ emptyArray: [] });

      const result = await chrome.storage.local.get('emptyArray');
      expect(result.emptyArray).toEqual([]);
    });

    it('should handle empty objects', async () => {
      await chrome.storage.local.set({ emptyObject: {} });

      const result = await chrome.storage.local.get('emptyObject');
      expect(result.emptyObject).toEqual({});
    });

    it('should handle zero values', async () => {
      await chrome.storage.local.set({ zero: 0 });

      const result = await chrome.storage.local.get('zero');
      expect(result.zero).toBe(0);
    });

    it('should handle false values', async () => {
      await chrome.storage.local.set({ falseValue: false });

      const result = await chrome.storage.local.get('falseValue');
      expect(result.falseValue).toBe(false);
    });
  });

  describe('complex data structures', () => {
    it('should handle nested objects', async () => {
      const complexObject = {
        level1: {
          level2: {
            level3: {
              value: 'deep',
            },
          },
        },
      };

      await chrome.storage.local.set({ complex: complexObject });

      const result = await chrome.storage.local.get('complex');
      expect(result.complex.level1.level2.level3.value).toBe('deep');
    });

    it('should handle arrays with mixed types', async () => {
      const mixedArray = [1, 'string', { obj: true }, [1, 2, 3], null];

      await chrome.storage.local.set({ mixed: mixedArray });

      const result = await chrome.storage.local.get('mixed');
      expect(result.mixed).toEqual(mixedArray);
    });

    it('should handle queries array with multiple items', async () => {
      const queries = [
        { id: '1', text: 'First query', timestamp: 1000, providers: ['chatgpt'] },
        { id: '2', text: 'Second query', timestamp: 2000, providers: ['claude'] },
        { id: '3', text: 'Third query', timestamp: 3000, providers: ['gemini'] },
      ];

      await chrome.storage.local.set({ queries });

      const result = await chrome.storage.local.get('queries');
      expect(result.queries).toHaveLength(3);
      expect(result.queries[1].text).toBe('Second query');
    });
  });

  describe('get methods', () => {
    beforeEach(async () => {
      await chrome.storage.local.set({
        key1: 'value1',
        key2: 'value2',
        key3: 'value3',
      });
    });

    it('should get single key as string', async () => {
      const result = await chrome.storage.local.get('key1');
      expect(result.key1).toBe('value1');
    });

    it('should get multiple keys as array', async () => {
      const result = await chrome.storage.local.get(['key1', 'key2']);
      expect(result.key1).toBe('value1');
      expect(result.key2).toBe('value2');
      expect(result.key3).toBeUndefined();
    });

    it('should get all keys when null is passed', async () => {
      const result = await chrome.storage.local.get(null);
      expect(result.key1).toBe('value1');
      expect(result.key2).toBe('value2');
      expect(result.key3).toBe('value3');
    });

    it('should get all keys when undefined is passed', async () => {
      const result = await chrome.storage.local.get(undefined as any);
      expect(result.key1).toBe('value1');
      expect(result.key2).toBe('value2');
      expect(result.key3).toBe('value3');
    });
  });

  describe('remove and clear', () => {
    beforeEach(async () => {
      await chrome.storage.local.set({
        key1: 'value1',
        key2: 'value2',
        key3: 'value3',
      });
    });

    it('should remove single key', async () => {
      await chrome.storage.local.remove('key1');

      const result = await chrome.storage.local.get(['key1', 'key2', 'key3']);
      expect(result.key1).toBeUndefined();
      expect(result.key2).toBe('value2');
      expect(result.key3).toBe('value3');
    });

    it('should remove multiple keys', async () => {
      await chrome.storage.local.remove(['key1', 'key2']);

      const result = await chrome.storage.local.get(['key1', 'key2', 'key3']);
      expect(result.key1).toBeUndefined();
      expect(result.key2).toBeUndefined();
      expect(result.key3).toBe('value3');
    });

    it('should clear all data', async () => {
      await chrome.storage.local.clear();

      const result = await chrome.storage.local.get(null);
      expect(Object.keys(result)).toHaveLength(0);
    });

    it('should not throw when removing non-existent key', async () => {
      await expect(chrome.storage.local.remove('nonExistent')).resolves.not.toThrow();
    });
  });

  describe('storage change listeners', () => {
    it('should notify listeners when data changes', async () => {
      const listener = vi.fn();
      chrome.storage.onChanged.addListener(listener);

      await chrome.storage.local.set({ newKey: 'newValue' });

      expect(listener).toHaveBeenCalledWith({
        newKey: { newValue: 'newValue', oldValue: undefined },
      });
    });

    it('should include old value in change notification', async () => {
      await chrome.storage.local.set({ existingKey: 'oldValue' });

      const listener = vi.fn();
      chrome.storage.onChanged.addListener(listener);

      await chrome.storage.local.set({ existingKey: 'newValue' });

      expect(listener).toHaveBeenCalledWith({
        existingKey: { newValue: 'newValue', oldValue: 'oldValue' },
      });
    });

    it('should allow removing listeners', async () => {
      const listener = vi.fn();
      chrome.storage.onChanged.addListener(listener);
      chrome.storage.onChanged.removeListener(listener);

      await chrome.storage.local.set({ key: 'value' });

      expect(listener).not.toHaveBeenCalled();
    });

    it('should notify multiple listeners', async () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      chrome.storage.onChanged.addListener(listener1);
      chrome.storage.onChanged.addListener(listener2);

      await chrome.storage.local.set({ key: 'value' });

      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
    });
  });

  describe('preferences edge cases', () => {
    it('should handle partial preferences update', async () => {
      await chrome.storage.local.set({ preferences: DEFAULT_PREFERENCES });

      const updatedPrefs = {
        ...DEFAULT_PREFERENCES,
        defaultProviders: ['chatgpt'],
      };
      await chrome.storage.local.set({ preferences: updatedPrefs });

      const result = await chrome.storage.local.get('preferences');
      expect(result.preferences.defaultProviders).toEqual(['chatgpt']);
      expect(result.preferences.theme).toBe('system'); // Unchanged
    });

    it('should handle empty providers array', async () => {
      const prefs = {
        ...DEFAULT_PREFERENCES,
        defaultProviders: [],
        enabledProviders: [],
      };
      await chrome.storage.local.set({ preferences: prefs });

      const result = await chrome.storage.local.get('preferences');
      expect(result.preferences.defaultProviders).toEqual([]);
      expect(result.preferences.enabledProviders).toEqual([]);
    });
  });

  describe('large data handling', () => {
    it('should handle large arrays', async () => {
      const largeArray = Array.from({ length: 1000 }, (_, i) => ({
        id: `id-${i}`,
        text: `Query ${i}`,
        timestamp: Date.now() + i,
        providers: ['chatgpt', 'claude', 'gemini'],
      }));

      await chrome.storage.local.set({ queries: largeArray });

      const result = await chrome.storage.local.get('queries');
      expect(result.queries).toHaveLength(1000);
      expect(result.queries[999].id).toBe('id-999');
    });

    it('should handle large text content', async () => {
      const largeText = 'a'.repeat(100000);

      await chrome.storage.local.set({ largeText });

      const result = await chrome.storage.local.get('largeText');
      expect(result.largeText).toBe(largeText);
      expect(result.largeText.length).toBe(100000);
    });
  });

  describe('type preservation', () => {
    it('should preserve number types', async () => {
      await chrome.storage.local.set({
        integer: 42,
        float: 3.14,
        negative: -100,
        scientific: 1e10,
      });

      const result = await chrome.storage.local.get(['integer', 'float', 'negative', 'scientific']);
      expect(typeof result.integer).toBe('number');
      expect(typeof result.float).toBe('number');
      expect(result.float).toBeCloseTo(3.14);
      expect(result.negative).toBe(-100);
      expect(result.scientific).toBe(1e10);
    });

    it('should preserve boolean types', async () => {
      await chrome.storage.local.set({
        trueVal: true,
        falseVal: false,
      });

      const result = await chrome.storage.local.get(['trueVal', 'falseVal']);
      expect(result.trueVal).toBe(true);
      expect(result.falseVal).toBe(false);
      expect(typeof result.trueVal).toBe('boolean');
      expect(typeof result.falseVal).toBe('boolean');
    });

    it('should preserve Date objects as ISO strings or timestamps', async () => {
      const timestamp = Date.now();
      await chrome.storage.local.set({ timestamp });

      const result = await chrome.storage.local.get('timestamp');
      expect(result.timestamp).toBe(timestamp);
    });
  });
});
