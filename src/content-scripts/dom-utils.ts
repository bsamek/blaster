/**
 * DOM utility functions for type-safe element access.
 */

/**
 * Asserts that an element is of the expected type.
 * @throws TypeError if the element is not of the expected type
 */
export function assertElementType<T extends HTMLElement>(
  element: Element | null,
  elementType: new () => T,
  selector: string
): T {
  if (!element) {
    throw new Error(`Element not found: ${selector}`);
  }
  if (!(element instanceof elementType)) {
    throw new TypeError(
      `Element ${selector} is not a ${elementType.name}, got ${element.constructor.name}`
    );
  }
  return element;
}

/**
 * Safely casts an element to HTMLTextAreaElement with validation.
 */
export function asTextArea(element: Element | null, selector: string): HTMLTextAreaElement {
  return assertElementType(element, HTMLTextAreaElement, selector);
}

/**
 * Safely casts an element to HTMLButtonElement with validation.
 */
export function asButton(element: Element | null, selector: string): HTMLButtonElement {
  return assertElementType(element, HTMLButtonElement, selector);
}

/**
 * Safely casts an element to HTMLInputElement with validation.
 */
export function asInput(element: Element | null, selector: string): HTMLInputElement {
  return assertElementType(element, HTMLInputElement, selector);
}

/**
 * Checks if an element is a contenteditable div (ProseMirror style).
 */
export function isContentEditable(element: Element): boolean {
  return element.getAttribute('contenteditable') === 'true';
}

/**
 * Checks if an element is a ProseMirror editor.
 */
export function isProseMirror(element: Element): boolean {
  return element.classList.contains('ProseMirror') || isContentEditable(element);
}

/**
 * Sets text content in a contenteditable element.
 */
export function setContentEditableText(element: Element, text: string): void {
  (element as HTMLElement).focus();

  // Try to find and set content in a paragraph first (ProseMirror style)
  const paragraph = element.querySelector('p');
  if (paragraph) {
    paragraph.textContent = text;
  } else {
    element.textContent = text;
  }

  // Dispatch input events to notify frameworks
  element.dispatchEvent(new InputEvent('input', {
    bubbles: true,
    cancelable: true,
    inputType: 'insertText',
    data: text,
  }));
  element.dispatchEvent(new Event('input', { bubbles: true }));
}
