import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { ChatGPTAdapter } from '@/content-scripts/providers/chatgpt-adapter';
import { loadFixture, injectResponse, clearResponses } from '@tests/fixtures/dom';
import { installMockChromeAPI, resetMockChromeAPI } from '@tests/mocks/chrome-api';

describe('ChatGPTAdapter', () => {
  let dom: JSDOM;
  let adapter: ChatGPTAdapter;
  const mockChrome = installMockChromeAPI();

  beforeEach(async () => {
    resetMockChromeAPI(mockChrome);

    const html = loadFixture('chatgpt-page.html');
    dom = new JSDOM(html, {
      url: 'https://chatgpt.com/',
      runScripts: 'dangerously',
    });

    global.document = dom.window.document;
    global.MutationObserver = dom.window.MutationObserver;
    global.HTMLTextAreaElement = dom.window.HTMLTextAreaElement;
    global.HTMLButtonElement = dom.window.HTMLButtonElement;
    global.Event = dom.window.Event;
    global.InputEvent = dom.window.InputEvent;

    adapter = new ChatGPTAdapter();
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

    it('should show not logged in when login button present', async () => {
      const loginButton = dom.window.document.createElement('button');
      loginButton.setAttribute('data-testid', 'login-button');
      dom.window.document.body.appendChild(loginButton);

      // Remove user menu
      const userMenu = dom.window.document.querySelector('[data-testid="user-menu"]');
      userMenu?.remove();

      await adapter.initialize();
      expect(adapter.isLoggedIn()).toBe(false);
    });
  });

  describe('submitQuery', () => {
    it('should populate textarea and trigger submit', async () => {
      await adapter.initialize();

      const submitSpy = vi.fn();
      const submitBtn = dom.window.document.querySelector(
        'button[data-testid="send-button"]'
      ) as HTMLButtonElement;
      submitBtn.addEventListener('click', submitSpy);

      await adapter.submitQuery('Hello, ChatGPT!');

      const textarea = dom.window.document.querySelector(
        '#prompt-textarea'
      ) as HTMLTextAreaElement;
      expect(textarea.value).toBe('Hello, ChatGPT!');
      expect(submitSpy).toHaveBeenCalled();
    });
  });

  describe('getResponse', () => {
    it('should extract response text from DOM', async () => {
      await adapter.initialize();

      injectResponse(
        dom.window.document,
        'chatgpt',
        'This is a test response from ChatGPT'
      );

      const response = adapter.getResponse();
      expect(response).toBe('This is a test response from ChatGPT');
    });

    it('should return null when no response exists', async () => {
      await adapter.initialize();
      clearResponses(dom.window.document, 'chatgpt');
      expect(adapter.getResponse()).toBeNull();
    });

    it('should get the most recent response', async () => {
      await adapter.initialize();

      injectResponse(dom.window.document, 'chatgpt', 'First response');
      injectResponse(dom.window.document, 'chatgpt', 'Second response');

      const response = adapter.getResponse();
      expect(response).toBe('Second response');
    });
  });

});
