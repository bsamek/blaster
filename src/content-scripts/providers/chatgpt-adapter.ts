import { BaseProviderAdapter } from '../base-adapter';
import { waitForElement } from '../dom-observer';
import { isContentEditable, setContentEditableText, asButton } from '../dom-utils';
import { TIMEOUTS } from '../../shared/constants';
import type { ProviderId, ProviderSelectors } from '../../shared/types';

export class ChatGPTAdapter extends BaseProviderAdapter {
  readonly providerId: ProviderId = 'chatgpt';

  getSelectors(): ProviderSelectors {
    return {
      // ChatGPT uses a contenteditable div (ProseMirror) in newer versions
      textareaSelector: '#prompt-textarea, div[contenteditable="true"][id="prompt-textarea"], div.ProseMirror[contenteditable="true"]',
      submitButtonSelector: 'button[data-testid="send-button"], button[aria-label="Send prompt"], button.composer-submit-btn',
      responseContainerSelector: '[data-message-author-role="assistant"], div[data-message-author-role="assistant"]',
      responseTextSelector: '.markdown, .prose, .whitespace-pre-wrap',
      loadingIndicatorSelector: '.result-streaming, [data-testid="stop-button"], .animate-spin',
    };
  }

  protected async waitForDOMReady(): Promise<void> {
    await waitForElement(this.getSelectors().textareaSelector, TIMEOUTS.DOM_READY);
  }

  async submitQuery(query: string): Promise<void> {
    const selectors = this.getSelectors();
    const inputElement = await waitForElement(selectors.textareaSelector);

    // ChatGPT uses a contenteditable div (ProseMirror style)
    if (isContentEditable(inputElement)) {
      setContentEditableText(inputElement, query);
    } else {
      // Fallback for regular textarea
      this.setInputValue(inputElement as HTMLTextAreaElement, query);
    }

    await this.sleep(TIMEOUTS.PRE_SUBMIT_DELAY);

    // Find and click submit button
    const submitButton = await waitForElement(selectors.submitButtonSelector);
    const button = asButton(submitButton, selectors.submitButtonSelector);
    await this.waitForButtonEnabled(button);
    button.click();

    this.queryStartTime = Date.now();
  }

  isLoggedIn(): boolean {
    // Check for login button or other indicators
    const loginButton = document.querySelector('[data-testid="login-button"]');
    const userMenu = document.querySelector('[data-testid="user-menu"], .avatar, [data-testid="profile-button"]');
    return !loginButton && !!userMenu;
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
