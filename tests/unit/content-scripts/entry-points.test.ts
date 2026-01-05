import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { installMockChromeAPI, resetMockChromeAPI } from '@tests/mocks/chrome-api';

// Create mock methods that can be tracked
const mockInitialize = vi.fn().mockResolvedValue(undefined);
const mockDestroy = vi.fn();

// Mock the adapters before importing the entry points using class syntax
vi.mock('@/content-scripts/providers/chatgpt-adapter', () => {
  return {
    ChatGPTAdapter: class ChatGPTAdapter {
      initialize = mockInitialize;
      destroy = mockDestroy;
    },
  };
});

vi.mock('@/content-scripts/providers/claude-adapter', () => {
  return {
    ClaudeAdapter: class ClaudeAdapter {
      initialize = mockInitialize;
      destroy = mockDestroy;
    },
  };
});

vi.mock('@/content-scripts/providers/gemini-adapter', () => {
  return {
    GeminiAdapter: class GeminiAdapter {
      initialize = mockInitialize;
      destroy = mockDestroy;
    },
  };
});

describe('Content Script Entry Points', () => {
  const mockChrome = installMockChromeAPI();
  let dom: JSDOM;
  let originalDocument: Document;
  let originalWindow: Window & typeof globalThis;

  beforeEach(() => {
    resetMockChromeAPI(mockChrome);
    vi.clearAllMocks();
    mockInitialize.mockClear();
    mockDestroy.mockClear();

    // Save original globals
    originalDocument = global.document;
    originalWindow = global.window;

    // Create DOM
    dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
      url: 'https://test.com/',
      runScripts: 'dangerously',
    });

    // Set up globals
    global.document = dom.window.document;
    global.window = dom.window as unknown as Window & typeof globalThis;
  });

  afterEach(() => {
    // Restore globals
    global.document = originalDocument;
    global.window = originalWindow;
    vi.resetModules();
  });

  describe('ChatGPT entry point', () => {
    it('should initialize adapter when DOM is complete', async () => {
      // Set readyState to complete to trigger immediate init
      Object.defineProperty(dom.window.document, 'readyState', {
        value: 'complete',
        writable: true,
        configurable: true,
      });

      vi.resetModules();
      await import('@/content-scripts/providers/chatgpt');

      // Wait for async initialization
      await new Promise((r) => setTimeout(r, 50));

      expect(mockInitialize).toHaveBeenCalled();
    });

    it('should wait for DOMContentLoaded when document is loading', async () => {
      Object.defineProperty(dom.window.document, 'readyState', {
        value: 'loading',
        writable: true,
        configurable: true,
      });

      const addEventListenerSpy = vi.spyOn(dom.window.document, 'addEventListener');

      vi.resetModules();
      await import('@/content-scripts/providers/chatgpt');

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'DOMContentLoaded',
        expect.any(Function)
      );
    });

    it('should register unload listener', async () => {
      const addEventListenerSpy = vi.spyOn(dom.window, 'addEventListener');

      vi.resetModules();
      await import('@/content-scripts/providers/chatgpt');

      expect(addEventListenerSpy).toHaveBeenCalledWith('unload', expect.any(Function));
    });
  });

  describe('Claude entry point', () => {
    it('should initialize adapter when DOM is complete', async () => {
      Object.defineProperty(dom.window.document, 'readyState', {
        value: 'complete',
        writable: true,
        configurable: true,
      });

      vi.resetModules();
      await import('@/content-scripts/providers/claude');

      await new Promise((r) => setTimeout(r, 50));

      expect(mockInitialize).toHaveBeenCalled();
    });

    it('should wait for DOMContentLoaded when document is loading', async () => {
      Object.defineProperty(dom.window.document, 'readyState', {
        value: 'loading',
        writable: true,
        configurable: true,
      });

      const addEventListenerSpy = vi.spyOn(dom.window.document, 'addEventListener');

      vi.resetModules();
      await import('@/content-scripts/providers/claude');

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'DOMContentLoaded',
        expect.any(Function)
      );
    });

    it('should register unload listener', async () => {
      const addEventListenerSpy = vi.spyOn(dom.window, 'addEventListener');

      vi.resetModules();
      await import('@/content-scripts/providers/claude');

      expect(addEventListenerSpy).toHaveBeenCalledWith('unload', expect.any(Function));
    });
  });

  describe('Gemini entry point', () => {
    it('should initialize adapter when DOM is complete', async () => {
      Object.defineProperty(dom.window.document, 'readyState', {
        value: 'complete',
        writable: true,
        configurable: true,
      });

      vi.resetModules();
      await import('@/content-scripts/providers/gemini');

      await new Promise((r) => setTimeout(r, 50));

      expect(mockInitialize).toHaveBeenCalled();
    });

    it('should wait for DOMContentLoaded when document is loading', async () => {
      Object.defineProperty(dom.window.document, 'readyState', {
        value: 'loading',
        writable: true,
        configurable: true,
      });

      const addEventListenerSpy = vi.spyOn(dom.window.document, 'addEventListener');

      vi.resetModules();
      await import('@/content-scripts/providers/gemini');

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'DOMContentLoaded',
        expect.any(Function)
      );
    });

    it('should register unload listener', async () => {
      const addEventListenerSpy = vi.spyOn(dom.window, 'addEventListener');

      vi.resetModules();
      await import('@/content-scripts/providers/gemini');

      expect(addEventListenerSpy).toHaveBeenCalledWith('unload', expect.any(Function));
    });
  });

  describe('cleanup on unload', () => {
    it('should call destroy on unload', async () => {
      Object.defineProperty(dom.window.document, 'readyState', {
        value: 'complete',
        writable: true,
        configurable: true,
      });

      vi.resetModules();
      await import('@/content-scripts/providers/chatgpt');

      // Trigger unload event
      const unloadEvent = new dom.window.Event('unload');
      dom.window.dispatchEvent(unloadEvent);

      expect(mockDestroy).toHaveBeenCalled();
    });
  });
});
