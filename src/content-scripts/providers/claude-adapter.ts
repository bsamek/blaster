import { BaseProviderAdapter } from '../base-adapter';
import { waitForElement } from '../dom-observer';
import type { ProviderId, ProviderSelectors } from '../../shared/types';

export class ClaudeAdapter extends BaseProviderAdapter {
  readonly providerId: ProviderId = 'claude';

  getSelectors(): ProviderSelectors {
    return {
      // Claude uses a contenteditable div
      textareaSelector: 'div[contenteditable="true"].ProseMirror, fieldset textarea, div[data-placeholder]',
      submitButtonSelector: 'button[aria-label*="Send"], button:has(svg[data-icon="send"]), fieldset button[type="button"]',
      responseContainerSelector: '[data-is-streaming], .font-claude-message, div[class*="claude-message"]',
      responseTextSelector: '.prose, .whitespace-pre-wrap, p',
      loadingIndicatorSelector: '[data-is-streaming="true"], .animate-pulse',
    };
  }

  protected async waitForDOMReady(): Promise<void> {
    await waitForElement(this.getSelectors().textareaSelector, 30000);
  }

  protected setupEventListeners(): void {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.type === 'SUBMIT_QUERY') {
        this.handleSubmitQuery(message.payload.queryId, message.payload.text)
          .then(() => sendResponse({ success: true }))
          .catch((error) => sendResponse({ success: false, error: error.message }));
        return true;
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

    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    }, () => {
      // Track streaming responses if needed
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

    // Claude uses ProseMirror contenteditable
    if (inputElement.classList.contains('ProseMirror') || inputElement.getAttribute('contenteditable') === 'true') {
      (inputElement as HTMLElement).focus();

      // Clear existing content
      const paragraph = inputElement.querySelector('p');
      if (paragraph) {
        paragraph.textContent = query;
      } else {
        inputElement.textContent = query;
      }

      // Trigger input events
      inputElement.dispatchEvent(new InputEvent('input', { bubbles: true, data: query }));
    } else {
      // Fallback for textarea
      this.setInputValue(inputElement as HTMLTextAreaElement, query);
    }

    await this.sleep(100);

    const submitButton = await waitForElement(selectors.submitButtonSelector);
    await this.waitForButtonEnabled(submitButton as HTMLButtonElement);
    (submitButton as HTMLButtonElement).click();

    this.queryStartTime = Date.now();
  }

  isLoggedIn(): boolean {
    // Check for user avatar or menu
    const userMenu = document.querySelector('[data-testid="user-menu"], .user-avatar, nav button');
    const loginPage = document.querySelector('form[action*="login"], .login-form');
    return !!userMenu && !loginPage;
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
    const textElements = lastContainer.querySelectorAll(selectors.responseTextSelector);

    // Combine all text from prose elements
    let text = '';
    textElements.forEach((el) => {
      text += el.textContent + '\n';
    });

    return text.trim() || lastContainer.textContent?.trim() || null;
  }

  protected extractResponseText(): string {
    return this.getResponse() || '';
  }
}
