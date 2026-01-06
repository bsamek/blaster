import { BaseProviderAdapter } from '../base-adapter';
import { waitForElement } from '../dom-observer';
import type { ProviderId, ProviderSelectors } from '../../shared/types';

export class GeminiAdapter extends BaseProviderAdapter {
  readonly providerId: ProviderId = 'gemini';

  getSelectors(): ProviderSelectors {
    return {
      // Gemini uses a rich text editor
      textareaSelector: 'rich-textarea textarea, .ql-editor, div[contenteditable="true"][role="textbox"]',
      submitButtonSelector: 'button[aria-label*="Send"], button.send-button, button[data-test-id="send-button"]',
      responseContainerSelector: '.model-response-text, .response-content, message-content[class*="model"]',
      responseTextSelector: '.markdown-main-panel, .response-text, p',
      loadingIndicatorSelector: '.loading-indicator, .thinking-indicator, mat-progress-bar',
    };
  }

  protected async waitForDOMReady(): Promise<void> {
    await waitForElement(this.getSelectors().textareaSelector, 30000);
  }

  async submitQuery(query: string): Promise<void> {
    const selectors = this.getSelectors();
    const inputElement = await waitForElement(selectors.textareaSelector);

    if (inputElement.getAttribute('contenteditable') === 'true') {
      // Contenteditable div
      (inputElement as HTMLElement).focus();
      inputElement.textContent = query;
      inputElement.dispatchEvent(new InputEvent('input', { bubbles: true, data: query }));
    } else {
      // Regular textarea
      this.setInputValue(inputElement as HTMLTextAreaElement, query);
    }

    await this.sleep(200);

    const submitButton = await waitForElement(selectors.submitButtonSelector);
    await this.waitForButtonEnabled(submitButton as HTMLButtonElement);
    (submitButton as HTMLButtonElement).click();

    this.queryStartTime = Date.now();
  }

  isLoggedIn(): boolean {
    // Gemini requires Google login
    const userAvatar = document.querySelector('img[alt*="profile"], .user-avatar, [data-user-id]');
    const loginButton = document.querySelector('a[href*="accounts.google.com"], .sign-in-button');
    return !!userAvatar && !loginButton;
  }

  getResponse(): string | null {
    const selectors = this.getSelectors();
    const containers = document.querySelectorAll(selectors.responseContainerSelector);
    if (containers.length === 0) return null;

    const lastContainer = containers[containers.length - 1];
    const textElement = lastContainer.querySelector(selectors.responseTextSelector);
    return textElement?.textContent?.trim() || lastContainer.textContent?.trim() || null;
  }

  protected extractResponseText(): string {
    return this.getResponse() || '';
  }
}
