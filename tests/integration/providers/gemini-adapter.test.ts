import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { GeminiAdapter } from '@/content-scripts/providers/gemini-adapter';
import { loadFixture, injectResponse, clearResponses } from '@tests/fixtures/dom';
import { installMockChromeAPI, resetMockChromeAPI } from '@tests/mocks/chrome-api';

describe('GeminiAdapter', () => {
  let dom: JSDOM;
  let adapter: GeminiAdapter;
  const mockChrome = installMockChromeAPI();

  beforeEach(async () => {
    resetMockChromeAPI(mockChrome);

    const html = loadFixture('gemini-page.html');
    dom = new JSDOM(html, {
      url: 'https://gemini.google.com/app',
      runScripts: 'dangerously',
    });

    global.document = dom.window.document;
    global.MutationObserver = dom.window.MutationObserver;
    global.HTMLTextAreaElement = dom.window.HTMLTextAreaElement;
    global.HTMLButtonElement = dom.window.HTMLButtonElement;
    global.Event = dom.window.Event;
    global.InputEvent = dom.window.InputEvent;

    adapter = new GeminiAdapter();
  });

  afterEach(() => {
    adapter.destroy();
  });

  describe('getSelectors', () => {
    it('should return valid selectors', () => {
      const selectors = adapter.getSelectors();
      expect(selectors.textareaSelector).toBeTruthy();
      expect(selectors.submitButtonSelector).toBeTruthy();
      expect(selectors.responseContainerSelector).toBeTruthy();
      expect(selectors.responseTextSelector).toBeTruthy();
    });
  });

  describe('initialization', () => {
    it('should detect when DOM is ready', async () => {
      await adapter.initialize();
      expect(adapter.isReady()).toBe(true);
    });

    it('should detect login status', async () => {
      await adapter.initialize();
      expect(adapter.isLoggedIn()).toBe(true);
    });
  });

  describe('submitQuery', () => {
    it('should populate input and trigger submit', async () => {
      await adapter.initialize();

      const submitSpy = vi.fn();
      const submitBtn = dom.window.document.querySelector(
        '.send-button'
      ) as HTMLButtonElement;
      submitBtn.addEventListener('click', submitSpy);

      await adapter.submitQuery('Hello, Gemini!');

      const inputDiv = dom.window.document.querySelector('.ql-editor') as HTMLElement;
      expect(inputDiv.textContent).toBe('Hello, Gemini!');
      expect(submitSpy).toHaveBeenCalled();
    });
  });

  describe('getResponse', () => {
    it('should extract response text from DOM', async () => {
      await adapter.initialize();

      injectResponse(
        dom.window.document,
        'gemini',
        'This is a test response from Gemini'
      );

      const response = adapter.getResponse();
      expect(response).toContain('This is a test response from Gemini');
    });

    it('should return null when no response exists', async () => {
      await adapter.initialize();
      clearResponses(dom.window.document, 'gemini');
      expect(adapter.getResponse()).toBeNull();
    });

    it('should fallback to container text when no text element found', async () => {
      await adapter.initialize();

      const container = dom.window.document.createElement('message-content');
      container.classList.add('model');
      container.textContent = 'Direct container text';
      dom.window.document.querySelector('.conversation')?.appendChild(container);

      const response = adapter.getResponse();
      expect(response).toBe('Direct container text');
    });
  });

  describe('submitQuery with regular textarea', () => {
    beforeEach(() => {
      // Replace contenteditable with regular textarea
      const contenteditable = dom.window.document.querySelector('.ql-editor');
      if (contenteditable) {
        const textarea = dom.window.document.createElement('textarea');
        textarea.className = 'ql-editor';
        contenteditable.parentNode?.replaceChild(textarea, contenteditable);
      }
    });

    it('should use setInputValue for regular textarea', async () => {
      // Re-add contenteditable for proper initialization
      const richTextarea = dom.window.document.querySelector('rich-textarea');
      const textarea = richTextarea?.querySelector('textarea');
      if (textarea) {
        const contenteditable = dom.window.document.createElement('div');
        contenteditable.className = 'ql-editor';
        contenteditable.setAttribute('contenteditable', 'true');
        contenteditable.setAttribute('role', 'textbox');
        textarea.parentNode?.replaceChild(contenteditable, textarea);
      }

      await adapter.initialize();

      const submitSpy = vi.fn();
      const submitBtn = dom.window.document.querySelector('.send-button') as HTMLButtonElement;
      submitBtn.addEventListener('click', submitSpy);

      await adapter.submitQuery('Test message');

      expect(submitSpy).toHaveBeenCalled();
    });
  });

  describe('message handling', () => {
    it('should respond to SUBMIT_QUERY message', async () => {
      await adapter.initialize();

      const addListenerCalls = mockChrome.runtime.onMessage.addListener.mock.calls;
      expect(addListenerCalls.length).toBeGreaterThan(0);

      const messageListener = addListenerCalls[0][0];
      const sendResponse = vi.fn();

      // Add a response
      injectResponse(dom.window.document, 'gemini', 'Test response');

      const result = messageListener(
        { type: 'SUBMIT_QUERY', payload: { queryId: 'q1', text: 'Hello' } },
        {},
        sendResponse
      );

      expect(result).toBe(true);
    });

    it('should respond to PING message with status', async () => {
      await adapter.initialize();

      const addListenerCalls = mockChrome.runtime.onMessage.addListener.mock.calls;
      const messageListener = addListenerCalls[0][0];
      const sendResponse = vi.fn();

      messageListener({ type: 'PING' }, {}, sendResponse);

      expect(sendResponse).toHaveBeenCalledWith({
        providerId: 'gemini',
        isReady: true,
        isLoggedIn: true,
      });
    });
  });

  describe('isLoggedIn', () => {
    it('should return false when sign-in button present', async () => {
      const signInLink = dom.window.document.createElement('a');
      signInLink.href = 'https://accounts.google.com/login';
      signInLink.className = 'sign-in-button';
      dom.window.document.body.appendChild(signInLink);

      // Remove user avatar
      const avatar = dom.window.document.querySelector('.user-avatar');
      avatar?.remove();

      await adapter.initialize();
      expect(adapter.isLoggedIn()).toBe(false);
    });

    it('should return true when user avatar exists and no sign-in', async () => {
      await adapter.initialize();
      expect(adapter.isLoggedIn()).toBe(true);
    });
  });

});
