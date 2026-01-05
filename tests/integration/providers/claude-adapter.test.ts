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
  });

});
