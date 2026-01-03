import { BaseProviderAdapter } from '../base-adapter';
import { waitForElement } from '../dom-observer';
import type { ProviderId, ProviderSelectors } from '../../shared/types';

export class ClaudeAdapter extends BaseProviderAdapter {
  readonly providerId: ProviderId = 'claude';

  getSelectors(): ProviderSelectors {
    return {
      // Claude uses a contenteditable div (ProseMirror)
      textareaSelector: 'div[contenteditable="true"].ProseMirror, div.ProseMirror[contenteditable="true"], fieldset div[contenteditable="true"]',
      submitButtonSelector: 'button[aria-label*="Send"], button[aria-label*="send message"], fieldset button:not([disabled])',
      // Claude's response containers - look for assistant/Claude messages
      responseContainerSelector: '[data-is-streaming], div[class*="font-claude"], div.prose, div[data-testid*="message"]',
      responseTextSelector: '.prose, .whitespace-pre-wrap, p, span',
      loadingIndicatorSelector: '[data-is-streaming="true"], .animate-pulse, .typing-indicator',
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
    // Try multiple strategies to find Claude's response
    const selectors = this.getSelectors();

    // Strategy 1: Look for specific response containers (Claude/assistant messages)
    let containers = document.querySelectorAll(selectors.responseContainerSelector);

    // Strategy 2: Look for Claude-specific response elements (avoid human messages)
    if (containers.length === 0) {
      containers = document.querySelectorAll(
        'div[class*="font-claude"], div[class*="assistant"], div[class*="claude-message"]'
      );
    }

    // Strategy 3: Look in conversation area for prose that's NOT in a human/user message
    if (containers.length === 0) {
      const conversationArea = document.querySelector('main, [role="main"], .conversation');
      if (conversationArea) {
        // Get all prose elements that are NOT inside human/user message containers
        const proseElements = conversationArea.querySelectorAll('div.prose');
        const filtered: Element[] = [];
        proseElements.forEach((el) => {
          const parent = el.closest('.human-message, .user-message, [data-author="user"]');
          if (!parent) {
            filtered.push(el);
          }
        });
        if (filtered.length > 0) {
          containers = filtered as unknown as NodeListOf<Element>;
        }
      }
    }

    if (containers.length === 0) return null;

    // Get the last container (most recent response)
    const lastContainer = Array.isArray(containers)
      ? containers[containers.length - 1]
      : containers[containers.length - 1];

    const textElements = lastContainer.querySelectorAll(selectors.responseTextSelector);

    // Combine all text from prose elements
    let text = '';
    if (textElements.length > 0) {
      textElements.forEach((el: Element) => {
        text += el.textContent + '\n';
      });
    } else {
      text = lastContainer.textContent || '';
    }

    return text.trim() || null;
  }

  protected extractResponseText(): string {
    return this.getResponse() || '';
  }
}
