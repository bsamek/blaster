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
  });

});
