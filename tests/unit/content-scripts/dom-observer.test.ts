import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { DOMObserver, waitForElement, waitForElementRemoval } from '@/content-scripts/dom-observer';

describe('DOMObserver', () => {
  let dom: JSDOM;
  let observer: DOMObserver;

  beforeEach(() => {
    dom = new JSDOM('<!DOCTYPE html><html><body><div id="root"></div></body></html>', {
      runScripts: 'dangerously',
    });
    global.document = dom.window.document;
    global.MutationObserver = dom.window.MutationObserver;
    observer = new DOMObserver();
  });

  afterEach(() => {
    observer.disconnect();
  });

  it('should observe DOM mutations', async () => {
    const callback = vi.fn();

    observer.observe(
      document.body,
      { childList: true, subtree: true },
      callback
    );

    const newElement = document.createElement('div');
    newElement.id = 'new-element';
    document.body.appendChild(newElement);

    // Wait for mutation to be observed
    await new Promise((r) => setTimeout(r, 10));

    expect(callback).toHaveBeenCalled();
    expect(callback.mock.calls[0][0]).toBeInstanceOf(Array);
  });

  it('should stop observing after disconnect', async () => {
    const callback = vi.fn();

    observer.observe(
      document.body,
      { childList: true, subtree: true },
      callback
    );

    observer.disconnect();

    const newElement = document.createElement('div');
    document.body.appendChild(newElement);

    await new Promise((r) => setTimeout(r, 10));

    expect(callback).not.toHaveBeenCalled();
  });
});

describe('waitForElement', () => {
  let dom: JSDOM;

  beforeEach(() => {
    dom = new JSDOM('<!DOCTYPE html><html><body><div id="root"></div></body></html>', {
      runScripts: 'dangerously',
    });
    global.document = dom.window.document;
    global.MutationObserver = dom.window.MutationObserver;
  });

  it('should resolve immediately if element exists', async () => {
    const element = document.getElementById('root');
    const result = await waitForElement('#root', 1000, document);
    expect(result).toBe(element);
  });

  it('should wait for element to appear', async () => {
    const promise = waitForElement('#new-element', 1000, document);

    // Add element after a delay
    setTimeout(() => {
      const newElement = document.createElement('div');
      newElement.id = 'new-element';
      document.body.appendChild(newElement);
    }, 50);

    const result = await promise;
    expect(result.id).toBe('new-element');
  });

  it('should reject on timeout', async () => {
    await expect(
      waitForElement('#nonexistent', 50, document)
    ).rejects.toThrow('Timeout waiting for element');
  });
});

describe('waitForElementRemoval', () => {
  let dom: JSDOM;

  beforeEach(() => {
    dom = new JSDOM(
      '<!DOCTYPE html><html><body><div id="root"><div id="removable"></div></div></body></html>',
      {
        runScripts: 'dangerously',
      }
    );
    global.document = dom.window.document;
    global.MutationObserver = dom.window.MutationObserver;
  });

  it('should resolve immediately if element does not exist', async () => {
    await expect(
      waitForElementRemoval('#nonexistent', 1000, document)
    ).resolves.toBeUndefined();
  });

  it('should wait for element to be removed', async () => {
    const promise = waitForElementRemoval('#removable', 1000, document);

    // Remove element after a delay
    setTimeout(() => {
      const element = document.getElementById('removable');
      element?.remove();
    }, 50);

    await expect(promise).resolves.toBeUndefined();
  });

  it('should reject on timeout if element not removed', async () => {
    await expect(
      waitForElementRemoval('#removable', 50, document)
    ).rejects.toThrow('Timeout waiting for element removal');
  });
});
