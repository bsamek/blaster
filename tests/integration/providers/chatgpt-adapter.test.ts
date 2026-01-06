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

  describe('submitQuery with ProseMirror contenteditable', () => {
    beforeEach(() => {
      // Replace textarea with ProseMirror-style contenteditable div
      const textarea = dom.window.document.querySelector('#prompt-textarea');
      if (textarea) {
        const proseMirror = dom.window.document.createElement('div');
        proseMirror.id = 'prompt-textarea';
        proseMirror.setAttribute('contenteditable', 'true');
        proseMirror.classList.add('ProseMirror');
        proseMirror.innerHTML = '<p></p>';
        textarea.parentNode?.replaceChild(proseMirror, textarea);
      }
    });

    it('should populate contenteditable div with text', async () => {
      await adapter.initialize();

      const submitSpy = vi.fn();
      const submitBtn = dom.window.document.querySelector(
        'button[data-testid="send-button"]'
      ) as HTMLButtonElement;
      submitBtn.addEventListener('click', submitSpy);

      await adapter.submitQuery('Hello via ProseMirror!');

      const proseMirror = dom.window.document.querySelector(
        '#prompt-textarea'
      ) as HTMLElement;
      const paragraph = proseMirror.querySelector('p');
      expect(paragraph?.textContent).toBe('Hello via ProseMirror!');
      expect(submitSpy).toHaveBeenCalled();
    });

    it('should set text directly when no paragraph element exists', async () => {
      // Remove the paragraph from ProseMirror
      const proseMirror = dom.window.document.querySelector('#prompt-textarea') as HTMLElement;
      proseMirror.innerHTML = '';

      await adapter.initialize();

      const submitSpy = vi.fn();
      const submitBtn = dom.window.document.querySelector(
        'button[data-testid="send-button"]'
      ) as HTMLButtonElement;
      submitBtn.addEventListener('click', submitSpy);

      await adapter.submitQuery('Direct text input');

      expect(proseMirror.textContent).toBe('Direct text input');
      expect(submitSpy).toHaveBeenCalled();
    });

    it('should dispatch input events for contenteditable', async () => {
      await adapter.initialize();

      const inputSpy = vi.fn();
      const proseMirror = dom.window.document.querySelector('#prompt-textarea') as HTMLElement;
      proseMirror.addEventListener('input', inputSpy);

      await adapter.submitQuery('Test input events');

      expect(inputSpy).toHaveBeenCalled();
    });
  });

  describe('message handling', () => {
    it('should respond to SUBMIT_QUERY message', async () => {
      await adapter.initialize();

      // Get the message listener that was registered
      const addListenerCalls = mockChrome.runtime.onMessage.addListener.mock.calls;
      expect(addListenerCalls.length).toBeGreaterThan(0);

      const messageListener = addListenerCalls[0][0];
      const sendResponse = vi.fn();

      // Inject a response that will be found
      injectResponse(dom.window.document, 'chatgpt', 'Test response');

      // Send SUBMIT_QUERY message
      const result = messageListener(
        { type: 'SUBMIT_QUERY', payload: { queryId: 'q1', text: 'Hello' } },
        {},
        sendResponse
      );

      // Should return true for async response
      expect(result).toBe(true);
    });

    it('should respond to PING message with status', async () => {
      await adapter.initialize();

      const addListenerCalls = mockChrome.runtime.onMessage.addListener.mock.calls;
      const messageListener = addListenerCalls[0][0];
      const sendResponse = vi.fn();

      messageListener({ type: 'PING' }, {}, sendResponse);

      expect(sendResponse).toHaveBeenCalledWith({
        providerId: 'chatgpt',
        isReady: true,
        isLoggedIn: true,
      });
    });
  });

});
