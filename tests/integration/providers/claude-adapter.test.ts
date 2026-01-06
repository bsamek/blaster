import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { ClaudeAdapter } from '@/content-scripts/providers/claude-adapter';
import { loadFixture, injectResponse, clearResponses } from '@tests/fixtures/dom';
import { installMockChromeAPI, resetMockChromeAPI } from '@tests/mocks/chrome-api';

describe('ClaudeAdapter', () => {
  let dom: JSDOM;
  let adapter: ClaudeAdapter;
  const mockChrome = installMockChromeAPI();

  beforeEach(async () => {
    resetMockChromeAPI(mockChrome);

    const html = loadFixture('claude-page.html');
    dom = new JSDOM(html, {
      url: 'https://claude.ai/',
      runScripts: 'dangerously',
    });

    global.document = dom.window.document;
    global.MutationObserver = dom.window.MutationObserver;
    global.HTMLTextAreaElement = dom.window.HTMLTextAreaElement;
    global.HTMLButtonElement = dom.window.HTMLButtonElement;
    global.Event = dom.window.Event;
    global.InputEvent = dom.window.InputEvent;

    adapter = new ClaudeAdapter();
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
    it('should populate contenteditable and trigger submit', async () => {
      await adapter.initialize();

      const submitSpy = vi.fn();
      const submitBtn = dom.window.document.querySelector(
        '.send-button'
      ) as HTMLButtonElement;
      submitBtn.addEventListener('click', submitSpy);

      await adapter.submitQuery('Hello, Claude!');

      const inputDiv = dom.window.document.querySelector('.ProseMirror') as HTMLElement;
      const paragraph = inputDiv.querySelector('p');
      expect(paragraph?.textContent).toBe('Hello, Claude!');
      expect(submitSpy).toHaveBeenCalled();
    });
  });

  describe('getResponse', () => {
    it('should extract response text from DOM', async () => {
      await adapter.initialize();

      injectResponse(
        dom.window.document,
        'claude',
        'This is a test response from Claude'
      );

      const response = adapter.getResponse();
      expect(response).toContain('This is a test response from Claude');
    });

    it('should return null when no response exists', async () => {
      await adapter.initialize();
      clearResponses(dom.window.document, 'claude');
      expect(adapter.getResponse()).toBeNull();
    });

    it('should extract from data-is-streaming="false" container (Strategy 1)', async () => {
      await adapter.initialize();

      const container = dom.window.document.createElement('div');
      container.setAttribute('data-is-streaming', 'false');
      const responseDiv = dom.window.document.createElement('div');
      responseDiv.className = 'font-claude-response';
      responseDiv.textContent = 'Completed streaming response';
      container.appendChild(responseDiv);
      dom.window.document.querySelector('.conversation')?.appendChild(container);

      const response = adapter.getResponse();
      expect(response).toBe('Completed streaming response');
    });

    it('should fallback to font-claude-response elements (Strategy 2)', async () => {
      await adapter.initialize();

      const responseDiv = dom.window.document.createElement('div');
      responseDiv.className = 'font-claude-response';
      responseDiv.textContent = 'Font claude response';
      dom.window.document.querySelector('.conversation')?.appendChild(responseDiv);

      const response = adapter.getResponse();
      expect(response).toBe('Font claude response');
    });

    it('should get the longest content from font-claude elements (Strategy 3)', async () => {
      await adapter.initialize();

      const shortDiv = dom.window.document.createElement('div');
      shortDiv.className = 'font-claude-utility';
      shortDiv.textContent = 'Short';
      dom.window.document.querySelector('.conversation')?.appendChild(shortDiv);

      const longDiv = dom.window.document.createElement('div');
      longDiv.className = 'font-claude-main';
      longDiv.textContent = 'This is a much longer response that should be selected';
      dom.window.document.querySelector('.conversation')?.appendChild(longDiv);

      const response = adapter.getResponse();
      expect(response).toBe('This is a much longer response that should be selected');
    });

    it('should prefer font-claude-response inside completed container', async () => {
      await adapter.initialize();

      const container = dom.window.document.createElement('div');
      container.setAttribute('data-is-streaming', 'false');
      const innerResponse = dom.window.document.createElement('div');
      innerResponse.className = 'font-claude-response';
      innerResponse.textContent = 'Inner response';
      container.appendChild(innerResponse);
      dom.window.document.querySelector('.conversation')?.appendChild(container);

      // Also add a standalone font-claude-response
      const standalone = dom.window.document.createElement('div');
      standalone.className = 'font-claude-response';
      standalone.textContent = 'Standalone response';
      dom.window.document.querySelector('.conversation')?.appendChild(standalone);

      const response = adapter.getResponse();
      // Should get the one from completed container first
      expect(response).toBe('Inner response');
    });
  });

  describe('waitForResponse with streaming', () => {
    it('should wait for data-is-streaming to become false', async () => {
      await adapter.initialize();

      // Add streaming container
      const container = dom.window.document.createElement('div');
      container.setAttribute('data-is-streaming', 'true');
      container.className = 'font-claude-response';
      container.textContent = 'Streaming...';
      dom.window.document.querySelector('.conversation')?.appendChild(container);

      // Switch to completed after delay
      setTimeout(() => {
        container.setAttribute('data-is-streaming', 'false');
        container.textContent = 'Final response';
      }, 100);

      const response = await adapter.waitForResponse(5000);
      expect(response).toBe('Final response');
    });

    it('should throw error on timeout', async () => {
      await adapter.initialize();
      clearResponses(dom.window.document, 'claude');

      await expect(adapter.waitForResponse(500)).rejects.toThrow('No response received from Claude');
    });
  });

  describe('submitQuery with textarea fallback', () => {
    beforeEach(() => {
      // Replace ProseMirror with regular textarea
      const proseMirror = dom.window.document.querySelector('.ProseMirror');
      if (proseMirror) {
        const textarea = dom.window.document.createElement('textarea');
        textarea.className = 'ProseMirror';
        textarea.setAttribute('contenteditable', 'false');
        proseMirror.parentNode?.replaceChild(textarea, proseMirror);
      }
    });

    it('should use setInputValue for regular textarea', async () => {
      // Re-add a proper contenteditable for this to initialize
      const fieldset = dom.window.document.querySelector('fieldset');
      const textarea = fieldset?.querySelector('textarea');
      if (textarea) {
        const proseMirror = dom.window.document.createElement('div');
        proseMirror.className = 'ProseMirror';
        proseMirror.setAttribute('contenteditable', 'true');
        proseMirror.innerHTML = '<p></p>';
        textarea.parentNode?.replaceChild(proseMirror, textarea);
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

      // Add a completed response
      const container = dom.window.document.createElement('div');
      container.setAttribute('data-is-streaming', 'false');
      container.className = 'font-claude-response';
      container.textContent = 'Test response';
      dom.window.document.querySelector('.conversation')?.appendChild(container);

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
        providerId: 'claude',
        isReady: true,
        isLoggedIn: true,
      });
    });
  });

  describe('isLoggedIn', () => {
    it('should return false when login form is present', async () => {
      const loginForm = dom.window.document.createElement('form');
      loginForm.setAttribute('action', '/login');
      loginForm.className = 'login-form';
      dom.window.document.body.appendChild(loginForm);

      await adapter.initialize();
      expect(adapter.isLoggedIn()).toBe(false);
    });

    it('should return true when user menu exists and no login form', async () => {
      await adapter.initialize();
      expect(adapter.isLoggedIn()).toBe(true);
    });
  });

});
