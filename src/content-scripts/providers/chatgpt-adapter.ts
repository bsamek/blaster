import { BaseProviderAdapter } from '../base-adapter';
import { waitForElement } from '../dom-observer';
import type { ProviderId, ProviderSelectors } from '../../shared/types';

export class ChatGPTAdapter extends BaseProviderAdapter {
  readonly providerId: ProviderId = 'chatgpt';

  getSelectors(): ProviderSelectors {
    return {
      // ChatGPT uses a contenteditable div (ProseMirror) in newer versions
      textareaSelector: '#prompt-textarea, div[contenteditable="true"][id="prompt-textarea"], div.ProseMirror[contenteditable="true"]',
      submitButtonSelector: 'button[data-testid="send-button"], button[aria-label*="Send"], form button:not([disabled])',
      responseContainerSelector: '[data-message-author-role="assistant"], div[data-message-author-role="assistant"]',
      responseTextSelector: '.markdown, .prose, .whitespace-pre-wrap',
      loadingIndicatorSelector: '.result-streaming, [data-testid="stop-button"], .animate-spin',
    };
  }

  protected async waitForDOMReady(): Promise<void> {
    await waitForElement(this.getSelectors().textareaSelector, 30000);
  }

  protected setupEventListeners(): void {
    // Listen for message from background script
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.type === 'SUBMIT_QUERY') {
        this.handleSubmitQuery(message.payload.queryId, message.payload.text)
          .then(() => sendResponse({ success: true }))
          .catch((error) => sendResponse({ success: false, error: error.message }));
        return true; // Indicates async response
      }

      if (message.type === 'PING') {
        sendResponse({
          providerId: this.providerId,
          isReady: this.isReady(),
          isLoggedIn: this.isLoggedIn(),
        });
        return true;
      }
    });

    // Observe DOM for response updates
    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    }, () => {
      // Could track streaming responses here if needed
    });
  }

  private async handleSubmitQuery(queryId: string, text: string): Promise<void> {
    this.currentQueryId = queryId;

    try {
      await this.submitQuery(text);
      const response = await this.waitForResponse();
      this.notifyResponse(queryId, response);
    } catch (error) {
      this.notifyError(queryId, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  async submitQuery(query: string): Promise<void> {
    const selectors = this.getSelectors();
    const inputElement = await waitForElement(selectors.textareaSelector);

    // ChatGPT uses a contenteditable div (ProseMirror style)
    if (inputElement.getAttribute('contenteditable') === 'true') {
      // Focus the element
      (inputElement as HTMLElement).focus();

      // Clear existing content and set new text
      // ProseMirror typically has a <p> inside, or we set text directly
      const paragraph = inputElement.querySelector('p');
      if (paragraph) {
        paragraph.textContent = query;
      } else {
        inputElement.textContent = query;
      }

      // Dispatch input event to notify React/ProseMirror
      inputElement.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        cancelable: true,
        inputType: 'insertText',
        data: query
      }));

      // Also dispatch a keyboard event to ensure it's picked up
      inputElement.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      // Fallback for regular textarea
      this.setInputValue(inputElement as HTMLTextAreaElement, query);
    }

    await this.sleep(200);

    // Find and click submit button
    const submitButton = await waitForElement(selectors.submitButtonSelector);
    await this.waitForButtonEnabled(submitButton as HTMLButtonElement);
    (submitButton as HTMLButtonElement).click();

    this.queryStartTime = Date.now();
  }

  isLoggedIn(): boolean {
    // Check for login button or other indicators
    const loginButton = document.querySelector('[data-testid="login-button"]');
    const userMenu = document.querySelector('[data-testid="user-menu"], .avatar, [data-testid="profile-button"]');
    return !loginButton && !!userMenu;
  }

  hasActiveConversation(): boolean {
    const responses = document.querySelectorAll(this.getSelectors().responseContainerSelector);
    return responses.length > 0;
  }

  getResponse(): string | null {
    const selectors = this.getSelectors();
    const containers = document.querySelectorAll(selectors.responseContainerSelector);
    if (containers.length === 0) return null;

    const lastContainer = containers[containers.length - 1];
    const textElement = lastContainer.querySelector(selectors.responseTextSelector);
    return textElement?.textContent?.trim() || null;
  }

  protected extractResponseText(): string {
    return this.getResponse() || '';
  }
}
