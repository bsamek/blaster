import { BaseProviderAdapter } from '../base-adapter';
import { waitForElement } from '../dom-observer';
import type { ProviderId, ProviderSelectors } from '../../shared/types';

export class ClaudeAdapter extends BaseProviderAdapter {
  readonly providerId: ProviderId = 'claude';

  getSelectors(): ProviderSelectors {
    return {
      // Claude uses a contenteditable div (ProseMirror)
      textareaSelector: 'div[contenteditable="true"].ProseMirror, div.ProseMirror[contenteditable="true"], fieldset div[contenteditable="true"]',
      submitButtonSelector: 'button[aria-label="Send message"], button[aria-label*="Send"]:not([aria-label="Toggle menu"])',
      // Claude's response containers - look for assistant/Claude messages
      responseContainerSelector: '[data-is-streaming], div[class*="font-claude"], div.prose, div[data-testid*="message"]',
      responseTextSelector: '.prose, .whitespace-pre-wrap, p, span',
      loadingIndicatorSelector: '[data-is-streaming="true"], .animate-pulse, .typing-indicator',
    };
  }

  protected async waitForDOMReady(): Promise<void> {
    await waitForElement(this.getSelectors().textareaSelector, 30000);
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

  // Override waitForResponse with Claude-specific streaming detection
  async waitForResponse(timeoutMs = 60000): Promise<string> {
    const startTime = Date.now();

    // Wait for streaming to complete by checking for data-is-streaming="false"
    // This is more reliable than waiting for "true" to disappear
    while (Date.now() - startTime < timeoutMs) {
      // Check if there's a completed response (streaming = false)
      const completedResponse = document.querySelector('[data-is-streaming="false"]');
      if (completedResponse) {
        // Wait a bit for final content to settle
        await this.sleep(300);
        const response = this.extractResponseText();
        if (response) {
          return response;
        }
      }

      // Check if still streaming
      const stillStreaming = document.querySelector('[data-is-streaming="true"]');
      if (!stillStreaming && !completedResponse) {
        // Neither streaming nor completed - might be initial state, keep waiting
        await this.sleep(200);
        continue;
      }

      await this.sleep(200);
    }

    // Final attempt to extract response
    const response = this.extractResponseText();
    if (response) {
      return response;
    }

    throw new Error('No response received from Claude');
  }

  isLoggedIn(): boolean {
    // Check for user avatar or menu
    const userMenu = document.querySelector('[data-testid="user-menu"], .user-avatar, nav button');
    const loginPage = document.querySelector('form[action*="login"], .login-form');
    return !!userMenu && !loginPage;
  }

  getResponse(): string | null {
    // Strategy 1: Look for completed streaming response (most reliable)
    const completedContainer = document.querySelector('[data-is-streaming="false"]');
    if (completedContainer) {
      // Find the font-claude-response div inside, which contains the actual response
      const responseDiv = completedContainer.querySelector('div[class*="font-claude-response"]');
      if (responseDiv) {
        return responseDiv.textContent?.trim() || null;
      }
      // Fallback to container text
      return completedContainer.textContent?.trim() || null;
    }

    // Strategy 2: Look for font-claude elements (fallback)
    const fontClaudeElements = document.querySelectorAll('div[class*="font-claude-response"]');
    if (fontClaudeElements.length > 0) {
      const lastElement = fontClaudeElements[fontClaudeElements.length - 1];
      return lastElement.textContent?.trim() || null;
    }

    // Strategy 3: Look for any font-claude class elements
    const allFontClaude = document.querySelectorAll('div[class*="font-claude"]');
    if (allFontClaude.length > 0) {
      // Filter out small utility elements, get the largest content
      let bestMatch: Element | null = null;
      let maxLength = 0;
      allFontClaude.forEach((el) => {
        const text = el.textContent || '';
        if (text.length > maxLength) {
          maxLength = text.length;
          bestMatch = el;
        }
      });
      if (bestMatch) {
        return (bestMatch as Element).textContent?.trim() || null;
      }
    }

    return null;
  }

  protected extractResponseText(): string {
    return this.getResponse() || '';
  }
}
