import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import {
  isContentEditable,
  isProseMirror,
  setContentEditableText,
} from '@/content-scripts/dom-utils';

describe('dom-utils', () => {
  let dom: JSDOM;
  let originalDocument: Document;
  let originalWindow: Window & typeof globalThis;

  beforeEach(() => {
    originalDocument = global.document;
    originalWindow = global.window;
    dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
      url: 'https://test.com/',
    });
    global.document = dom.window.document;
    global.window = dom.window as unknown as Window & typeof globalThis;
    // Use JSDOM's HTMLElement types for instanceof checks
    (global as any).HTMLElement = dom.window.HTMLElement;
    (global as any).HTMLButtonElement = dom.window.HTMLButtonElement;
    (global as any).HTMLTextAreaElement = dom.window.HTMLTextAreaElement;
    (global as any).HTMLInputElement = dom.window.HTMLInputElement;
  });

  afterEach(() => {
    global.document = originalDocument;
    global.window = originalWindow;
  });

  describe('assertElementType', () => {
    it('should return element when type matches', async () => {
      // Re-import to use updated globals
      const { assertElementType } = await import('@/content-scripts/dom-utils');

      const button = document.createElement('button');
      document.body.appendChild(button);

      const result = assertElementType(button, HTMLButtonElement, 'button');
      expect(result).toBe(button);
      expect(result.tagName.toLowerCase()).toBe('button');
    });

    it('should throw Error when element is null', async () => {
      const { assertElementType } = await import('@/content-scripts/dom-utils');

      expect(() => assertElementType(null, HTMLButtonElement, '.selector')).toThrow(
        'Element not found: .selector'
      );
    });

    it('should throw TypeError when type does not match', async () => {
      const { assertElementType } = await import('@/content-scripts/dom-utils');

      const div = document.createElement('div');
      document.body.appendChild(div);

      expect(() => assertElementType(div, HTMLButtonElement, 'div')).toThrow(TypeError);
      expect(() => assertElementType(div, HTMLButtonElement, 'div')).toThrow(
        /is not a HTMLButtonElement/
      );
    });
  });

  describe('asTextArea', () => {
    it('should return textarea element', async () => {
      const { asTextArea } = await import('@/content-scripts/dom-utils');

      const textarea = document.createElement('textarea');
      document.body.appendChild(textarea);

      const result = asTextArea(textarea, 'textarea');
      expect(result).toBe(textarea);
      expect(result.tagName.toLowerCase()).toBe('textarea');
    });

    it('should throw for non-textarea elements', async () => {
      const { asTextArea } = await import('@/content-scripts/dom-utils');

      const div = document.createElement('div');
      expect(() => asTextArea(div, 'div')).toThrow(TypeError);
    });
  });

  describe('asButton', () => {
    it('should return button element', async () => {
      const { asButton } = await import('@/content-scripts/dom-utils');

      const button = document.createElement('button');
      document.body.appendChild(button);

      const result = asButton(button, 'button');
      expect(result).toBe(button);
      expect(result.tagName.toLowerCase()).toBe('button');
    });

    it('should throw for non-button elements', async () => {
      const { asButton } = await import('@/content-scripts/dom-utils');

      const div = document.createElement('div');
      expect(() => asButton(div, 'div')).toThrow(TypeError);
    });
  });

  describe('asInput', () => {
    it('should return input element', async () => {
      const { asInput } = await import('@/content-scripts/dom-utils');

      const input = document.createElement('input');
      document.body.appendChild(input);

      const result = asInput(input, 'input');
      expect(result).toBe(input);
      expect(result.tagName.toLowerCase()).toBe('input');
    });

    it('should throw for non-input elements', async () => {
      const { asInput } = await import('@/content-scripts/dom-utils');

      const div = document.createElement('div');
      expect(() => asInput(div, 'div')).toThrow(TypeError);
    });
  });

  describe('isContentEditable', () => {
    it('should return true for contenteditable elements', () => {
      const div = document.createElement('div');
      div.setAttribute('contenteditable', 'true');

      expect(isContentEditable(div)).toBe(true);
    });

    it('should return false for non-contenteditable elements', () => {
      const div = document.createElement('div');
      expect(isContentEditable(div)).toBe(false);

      div.setAttribute('contenteditable', 'false');
      expect(isContentEditable(div)).toBe(false);
    });
  });

  describe('isProseMirror', () => {
    it('should return true for elements with ProseMirror class', () => {
      const div = document.createElement('div');
      div.classList.add('ProseMirror');

      expect(isProseMirror(div)).toBe(true);
    });

    it('should return true for contenteditable elements', () => {
      const div = document.createElement('div');
      div.setAttribute('contenteditable', 'true');

      expect(isProseMirror(div)).toBe(true);
    });

    it('should return false for regular elements', () => {
      const div = document.createElement('div');
      expect(isProseMirror(div)).toBe(false);
    });
  });

  describe('setContentEditableText', () => {
    it('should set text content directly when no paragraph exists', () => {
      const div = document.createElement('div');
      div.setAttribute('contenteditable', 'true');
      document.body.appendChild(div);

      const focusSpy = vi.spyOn(div, 'focus');

      setContentEditableText(div, 'Hello World');

      expect(focusSpy).toHaveBeenCalled();
      expect(div.textContent).toBe('Hello World');
    });

    it('should set text content in paragraph when it exists', () => {
      const div = document.createElement('div');
      div.setAttribute('contenteditable', 'true');
      const paragraph = document.createElement('p');
      div.appendChild(paragraph);
      document.body.appendChild(div);

      setContentEditableText(div, 'Hello World');

      expect(paragraph.textContent).toBe('Hello World');
    });

    it('should dispatch input events', () => {
      const div = document.createElement('div');
      div.setAttribute('contenteditable', 'true');
      document.body.appendChild(div);

      const inputHandler = vi.fn();
      div.addEventListener('input', inputHandler);

      setContentEditableText(div, 'Test');

      // Should dispatch two input events (InputEvent + Event)
      expect(inputHandler).toHaveBeenCalledTimes(2);
    });

    it('should dispatch InputEvent with correct data', () => {
      const div = document.createElement('div');
      div.setAttribute('contenteditable', 'true');
      document.body.appendChild(div);

      let receivedEvent: InputEvent | null = null;
      div.addEventListener('input', (e) => {
        if (e instanceof InputEvent) {
          receivedEvent = e;
        }
      });

      setContentEditableText(div, 'Test text');

      expect(receivedEvent).not.toBeNull();
      expect(receivedEvent!.data).toBe('Test text');
      expect(receivedEvent!.inputType).toBe('insertText');
      expect(receivedEvent!.bubbles).toBe(true);
    });
  });
});
