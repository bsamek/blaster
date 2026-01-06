import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';

describe('initializeAdapter', () => {
  let dom: JSDOM;
  let originalDocument: Document;
  let originalWindow: Window & typeof globalThis;
  let mockAdapter: {
    initialize: ReturnType<typeof vi.fn>;
    destroy: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
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

    // Create mock adapter
    mockAdapter = {
      initialize: vi.fn().mockResolvedValue(undefined),
      destroy: vi.fn(),
    };
  });

  afterEach(() => {
    // Restore globals
    global.document = originalDocument;
    global.window = originalWindow;
    vi.resetModules();
  });

  it('should call initialize immediately when DOM is ready', async () => {
    Object.defineProperty(dom.window.document, 'readyState', {
      value: 'complete',
      writable: true,
      configurable: true,
    });

    const { initializeAdapter } = await import('@/content-scripts/adapter-initializer');
    initializeAdapter(mockAdapter as any);

    await new Promise((r) => setTimeout(r, 10));
    expect(mockAdapter.initialize).toHaveBeenCalledTimes(1);
  });

  it('should wait for DOMContentLoaded when document is loading', async () => {
    Object.defineProperty(dom.window.document, 'readyState', {
      value: 'loading',
      writable: true,
      configurable: true,
    });

    const addEventListenerSpy = vi.spyOn(dom.window.document, 'addEventListener');

    const { initializeAdapter } = await import('@/content-scripts/adapter-initializer');
    initializeAdapter(mockAdapter as any);

    expect(addEventListenerSpy).toHaveBeenCalledWith(
      'DOMContentLoaded',
      expect.any(Function)
    );
    expect(mockAdapter.initialize).not.toHaveBeenCalled();
  });

  it('should call initialize after DOMContentLoaded fires', async () => {
    Object.defineProperty(dom.window.document, 'readyState', {
      value: 'loading',
      writable: true,
      configurable: true,
    });

    const { initializeAdapter } = await import('@/content-scripts/adapter-initializer');
    initializeAdapter(mockAdapter as any);

    // Fire DOMContentLoaded
    const event = new dom.window.Event('DOMContentLoaded');
    dom.window.document.dispatchEvent(event);

    await new Promise((r) => setTimeout(r, 10));
    expect(mockAdapter.initialize).toHaveBeenCalledTimes(1);
  });

  it('should register unload listener', async () => {
    const addEventListenerSpy = vi.spyOn(dom.window, 'addEventListener');

    const { initializeAdapter } = await import('@/content-scripts/adapter-initializer');
    initializeAdapter(mockAdapter as any);

    expect(addEventListenerSpy).toHaveBeenCalledWith('unload', expect.any(Function));
  });

  it('should call destroy on unload', async () => {
    Object.defineProperty(dom.window.document, 'readyState', {
      value: 'complete',
      writable: true,
      configurable: true,
    });

    const { initializeAdapter } = await import('@/content-scripts/adapter-initializer');
    initializeAdapter(mockAdapter as any);

    // Trigger unload event
    const unloadEvent = new dom.window.Event('unload');
    dom.window.dispatchEvent(unloadEvent);

    expect(mockAdapter.destroy).toHaveBeenCalledTimes(1);
  });

  it('should handle initialization errors gracefully', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockAdapter.initialize.mockRejectedValue(new Error('Init failed'));

    Object.defineProperty(dom.window.document, 'readyState', {
      value: 'complete',
      writable: true,
      configurable: true,
    });

    const { initializeAdapter } = await import('@/content-scripts/adapter-initializer');
    initializeAdapter(mockAdapter as any);

    await new Promise((r) => setTimeout(r, 10));
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.any(Error));
    consoleErrorSpy.mockRestore();
  });
});
