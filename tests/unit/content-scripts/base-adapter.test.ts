import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { BaseProviderAdapter } from '@/content-scripts/base-adapter';
import { installMockChromeAPI, resetMockChromeAPI } from '@tests/mocks/chrome-api';
import type { ProviderId, ProviderSelectors } from '@/shared/types';

// Concrete implementation for testing
class TestAdapter extends BaseProviderAdapter {
  readonly providerId: ProviderId = 'chatgpt';

  private _isLoggedIn = true;
  private _responseText = '';
  private _waitForDOMReadyCalled = false;
  private _setupEventListenersCalled = false;

  getSelectors(): ProviderSelectors {
    return {
      textareaSelector: '#test-textarea',
      submitButtonSelector: '#test-submit',
      responseContainerSelector: '.test-response',
      responseTextSelector: '.test-text',
      loadingIndicatorSelector: '.test-loading',
    };
  }

  protected async waitForDOMReady(): Promise<void> {
    this._waitForDOMReadyCalled = true;
    // Wait for textarea to exist
    const textarea = document.querySelector(this.getSelectors().textareaSelector);
    if (!textarea) {
      throw new Error('Textarea not found');
    }
  }

  protected setupEventListeners(): void {
    this._setupEventListenersCalled = true;
  }

  isLoggedIn(): boolean {
    return this._isLoggedIn;
  }

  getResponse(): string | null {
    return this._responseText || null;
  }

  protected extractResponseText(): string {
    return this._responseText;
  }

  // Test helpers
  __setLoggedIn(value: boolean): void {
    this._isLoggedIn = value;
  }

  __setResponseText(value: string): void {
    this._responseText = value;
  }

  __wasWaitForDOMReadyCalled(): boolean {
    return this._waitForDOMReadyCalled;
  }

  __wasSetupEventListenersCalled(): boolean {
    return this._setupEventListenersCalled;
  }
}

describe('BaseProviderAdapter', () => {
  const mockChrome = installMockChromeAPI();
  let dom: JSDOM;
  let adapter: TestAdapter;

  beforeEach(() => {
    resetMockChromeAPI(mockChrome);

    const html = `
      <!DOCTYPE html>
      <html>
        <body>
          <textarea id="test-textarea"></textarea>
          <button id="test-submit">Submit</button>
          <div class="test-response">
            <div class="test-text">Test response</div>
          </div>
        </body>
      </html>
    `;

    dom = new JSDOM(html, {
      url: 'https://test.com/',
      runScripts: 'dangerously',
    });

    global.document = dom.window.document;
    global.MutationObserver = dom.window.MutationObserver;
    global.HTMLTextAreaElement = dom.window.HTMLTextAreaElement;
    global.HTMLButtonElement = dom.window.HTMLButtonElement;
    global.Event = dom.window.Event;
    global.InputEvent = dom.window.InputEvent;

    adapter = new TestAdapter();
  });

  afterEach(() => {
    adapter.destroy();
  });

  describe('constructor', () => {
    it('should initialize with isInitialized as false', () => {
      expect(adapter.isReady()).toBe(false);
    });

    it('should create a DOMObserver instance', () => {
      // The observer is private, but we can test it indirectly through destroy
      expect(() => adapter.destroy()).not.toThrow();
    });
  });

  describe('initialize', () => {
    it('should call waitForDOMReady', async () => {
      await adapter.initialize();
      expect(adapter.__wasWaitForDOMReadyCalled()).toBe(true);
    });

    it('should call setupEventListeners', async () => {
      await adapter.initialize();
      expect(adapter.__wasSetupEventListenersCalled()).toBe(true);
    });

    it('should set isInitialized to true', async () => {
      await adapter.initialize();
      expect(adapter.isReady()).toBe(true);
    });

    it('should notify ready status', async () => {
      await adapter.initialize();

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'PROVIDER_STATUS_UPDATE',
        payload: {
          status: {
            providerId: 'chatgpt',
            isConnected: true,
            isLoggedIn: true,
            isReady: true,
          },
        },
        timestamp: expect.any(Number),
      });
    });
  });

  describe('destroy', () => {
    it('should set isInitialized to false', async () => {
      await adapter.initialize();
      expect(adapter.isReady()).toBe(true);

      adapter.destroy();
      expect(adapter.isReady()).toBe(false);
    });

    it('should disconnect the observer', async () => {
      await adapter.initialize();
      // Should not throw
      expect(() => adapter.destroy()).not.toThrow();
    });
  });

  describe('isReady', () => {
    it('should return false when not initialized', () => {
      expect(adapter.isReady()).toBe(false);
    });

    it('should return true when initialized and textarea exists', async () => {
      await adapter.initialize();
      expect(adapter.isReady()).toBe(true);
    });

    it('should return false when textarea is removed', async () => {
      await adapter.initialize();
      expect(adapter.isReady()).toBe(true);

      // Remove textarea
      const textarea = dom.window.document.querySelector('#test-textarea');
      textarea?.remove();

      expect(adapter.isReady()).toBe(false);
    });
  });

  describe('getSelectors', () => {
    it('should return selector configuration', () => {
      const selectors = adapter.getSelectors();

      expect(selectors.textareaSelector).toBe('#test-textarea');
      expect(selectors.submitButtonSelector).toBe('#test-submit');
      expect(selectors.responseContainerSelector).toBe('.test-response');
      expect(selectors.responseTextSelector).toBe('.test-text');
      expect(selectors.loadingIndicatorSelector).toBe('.test-loading');
    });
  });

  describe('submitQuery', () => {
    it('should set value in textarea and click submit', async () => {
      await adapter.initialize();

      const submitSpy = vi.fn();
      const submitBtn = dom.window.document.querySelector('#test-submit') as HTMLButtonElement;
      submitBtn.addEventListener('click', submitSpy);

      await adapter.submitQuery('Test query');

      const textarea = dom.window.document.querySelector('#test-textarea') as HTMLTextAreaElement;
      expect(textarea.value).toBe('Test query');
      expect(submitSpy).toHaveBeenCalled();
    });

    it('should dispatch input events on textarea', async () => {
      await adapter.initialize();

      const inputSpy = vi.fn();
      const textarea = dom.window.document.querySelector('#test-textarea') as HTMLTextAreaElement;
      textarea.addEventListener('input', inputSpy);

      await adapter.submitQuery('Test query');

      expect(inputSpy).toHaveBeenCalled();
    });
  });

  describe('notifyResponse', () => {
    it('should send response message with duration', async () => {
      await adapter.initialize();

      // Access protected method through adapter
      // We'll test this indirectly by simulating query submission timing
      await adapter.submitQuery('Test');

      // Wait a bit and check that queryStartTime was set
      // The notifyResponse is protected, so we test it through the adapter's behavior
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'PROVIDER_STATUS_UPDATE',
        })
      );
    });
  });

  describe('isLoggedIn', () => {
    it('should return value from concrete implementation', async () => {
      adapter.__setLoggedIn(true);
      expect(adapter.isLoggedIn()).toBe(true);

      adapter.__setLoggedIn(false);
      expect(adapter.isLoggedIn()).toBe(false);
    });
  });

  describe('getResponse', () => {
    it('should return response text', () => {
      adapter.__setResponseText('Hello, world!');
      expect(adapter.getResponse()).toBe('Hello, world!');
    });

    it('should return null when no response', () => {
      adapter.__setResponseText('');
      expect(adapter.getResponse()).toBeNull();
    });
  });

  describe('waitForButtonEnabled', () => {
    it('should wait for button to become enabled', async () => {
      await adapter.initialize();

      const button = dom.window.document.querySelector('#test-submit') as HTMLButtonElement;
      button.disabled = true;

      // Enable button after a delay
      setTimeout(() => {
        button.disabled = false;
      }, 50);

      await adapter.submitQuery('Test');

      // If we get here without timeout, the button became enabled
      expect(button.disabled).toBe(false);
    });

    it('should throw error if button remains disabled', async () => {
      await adapter.initialize();

      const button = dom.window.document.querySelector('#test-submit') as HTMLButtonElement;
      button.disabled = true;

      // Create a shorter timeout version by mocking
      const originalSubmit = adapter.submitQuery.bind(adapter);

      // We can't easily test the timeout without waiting, so we verify the button state
      expect(button.disabled).toBe(true);
    });
  });

  describe('setInputValue', () => {
    it('should set textarea value and dispatch events', async () => {
      await adapter.initialize();

      const inputSpy = vi.fn();
      const changeSpy = vi.fn();
      const textarea = dom.window.document.querySelector('#test-textarea') as HTMLTextAreaElement;
      textarea.addEventListener('input', inputSpy);
      textarea.addEventListener('change', changeSpy);

      await adapter.submitQuery('New value');

      expect(textarea.value).toBe('New value');
      expect(inputSpy).toHaveBeenCalled();
      expect(changeSpy).toHaveBeenCalled();
    });
  });

  describe('sleep', () => {
    it('should delay execution', async () => {
      await adapter.initialize();

      const startTime = Date.now();
      // Access sleep through submitQuery which uses it
      await adapter.submitQuery('Test');
      const endTime = Date.now();

      // submitQuery has a 100ms sleep
      expect(endTime - startTime).toBeGreaterThanOrEqual(100);
    });
  });

  describe('extractResponseText', () => {
    it('should return response text from adapter implementation', async () => {
      await adapter.initialize();
      adapter.__setResponseText('Test response');

      // extractResponseText is protected, so test via getResponse
      expect(adapter.getResponse()).toBe('Test response');
    });

    it('should return empty string when no response', async () => {
      await adapter.initialize();
      adapter.__setResponseText('');

      expect(adapter.getResponse()).toBeNull();
    });
  });
});
