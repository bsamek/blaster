import type { IProviderAdapter, ProviderId, ProviderSelectors } from '../shared/types';
import { DOMObserver, waitForElement, waitForElementRemoval } from './dom-observer';

export abstract class BaseProviderAdapter implements IProviderAdapter {
  abstract readonly providerId: ProviderId;

  protected observer: DOMObserver;
  protected isInitialized = false;
  protected currentQueryId: string | null = null;
  protected queryStartTime = 0;

  constructor() {
    this.observer = new DOMObserver();
  }

  abstract getSelectors(): ProviderSelectors;

  async initialize(): Promise<void> {
    await this.waitForDOMReady();
    this.setupEventListeners();
    this.isInitialized = true;
    this.notifyReady();
  }

  destroy(): void {
    this.observer.disconnect();
    this.isInitialized = false;
  }

  protected abstract waitForDOMReady(): Promise<void>;
  protected abstract setupEventListeners(): void;

  isReady(): boolean {
    if (!this.isInitialized) return false;
    const selectors = this.getSelectors();
    return !!document.querySelector(selectors.textareaSelector);
  }

  abstract isLoggedIn(): boolean;
  abstract hasActiveConversation(): boolean;

  async submitQuery(query: string): Promise<void> {
    const selectors = this.getSelectors();

    // Wait for textarea to be available
    const textarea = await waitForElement(selectors.textareaSelector);

    // Set the value and trigger input events
    this.setInputValue(textarea as HTMLTextAreaElement, query);

    // Wait a bit for the button to become enabled
    await this.sleep(100);

    // Find and click submit button
    const submitButton = await waitForElement(selectors.submitButtonSelector);
    await this.waitForButtonEnabled(submitButton as HTMLButtonElement);
    (submitButton as HTMLButtonElement).click();

    this.queryStartTime = Date.now();
  }

  async waitForResponse(timeoutMs = 60000): Promise<string> {
    const selectors = this.getSelectors();
    const startTime = Date.now();

    // Get initial response count to detect new responses
    const initialResponseCount = document.querySelectorAll(selectors.responseContainerSelector).length;

    // Wait for loading indicator to appear (if it exists)
    if (selectors.loadingIndicatorSelector) {
      try {
        await waitForElement(selectors.loadingIndicatorSelector, 5000);
      } catch {
        // Loading indicator might not appear for fast responses
      }

      // Wait for loading indicator to disappear
      try {
        await waitForElementRemoval(
          selectors.loadingIndicatorSelector,
          timeoutMs - (Date.now() - startTime)
        );
      } catch {
        // Don't throw here - try to get response anyway
        console.log('Loading indicator timeout, trying to get response anyway');
      }
    }

    // Wait a bit for final content to settle
    await this.sleep(500);

    // Try to extract response
    let response = this.extractResponseText();

    // If no response found, poll for content changes
    if (!response) {
      const pollInterval = 500;
      const maxPollTime = Math.min(30000, timeoutMs - (Date.now() - startTime));
      const pollEndTime = Date.now() + maxPollTime;

      while (Date.now() < pollEndTime) {
        await this.sleep(pollInterval);

        // Check if we have more responses now
        const currentResponseCount = document.querySelectorAll(selectors.responseContainerSelector).length;
        if (currentResponseCount > initialResponseCount) {
          await this.sleep(1000); // Wait for streaming to complete
          response = this.extractResponseText();
          if (response) break;
        }

        // Try extracting anyway
        response = this.extractResponseText();
        if (response) break;
      }
    }

    if (!response) {
      throw new Error('No response received');
    }

    return response;
  }

  abstract getResponse(): string | null;
  protected abstract extractResponseText(): string;

  protected setInputValue(textarea: HTMLTextAreaElement, value: string): void {
    textarea.focus();

    // Clear existing content
    textarea.value = '';

    // Set new value
    textarea.value = value;

    // Trigger events to notify React/Vue/Angular
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.dispatchEvent(new Event('change', { bubbles: true }));

    // Also try setting via native input (for shadow DOM or heavily controlled inputs)
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      'value'
    )?.set;

    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(textarea, value);
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  protected async waitForButtonEnabled(
    button: HTMLButtonElement,
    timeout = 5000
  ): Promise<void> {
    const startTime = Date.now();

    while (button.disabled && Date.now() - startTime < timeout) {
      await this.sleep(100);
    }

    if (button.disabled) {
      throw new Error('Submit button remained disabled');
    }
  }

  protected sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  protected notifyReady(): void {
    chrome.runtime.sendMessage({
      type: 'PROVIDER_STATUS_UPDATE',
      payload: {
        status: {
          providerId: this.providerId,
          isConnected: true,
          isLoggedIn: this.isLoggedIn(),
          isReady: this.isReady(),
        },
      },
      timestamp: Date.now(),
    });
  }

  protected notifyResponse(queryId: string, text: string): void {
    const durationMs = Date.now() - this.queryStartTime;

    chrome.runtime.sendMessage({
      type: 'RESPONSE_RECEIVED',
      payload: {
        queryId,
        providerId: this.providerId,
        text,
        durationMs,
      },
      timestamp: Date.now(),
    });
  }

  protected notifyError(queryId: string, error: string): void {
    chrome.runtime.sendMessage({
      type: 'RESPONSE_ERROR',
      payload: {
        queryId,
        providerId: this.providerId,
        error,
      },
      timestamp: Date.now(),
    });
  }
}
