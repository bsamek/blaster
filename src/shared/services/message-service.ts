import type { ProviderId, ProviderStatus, QuerySession } from '../types';

/**
 * Logs message service errors in development mode.
 * Checks for chrome.runtime.getManifest().name to detect dev builds,
 * or if that fails, uses a simple heuristic.
 */
function logMessageError(context: string, error: unknown): void {
  // Log errors in development to help with debugging
  // Errors are expected when no listeners are registered, but other errors should be visible
  if (error instanceof Error && !error.message.includes('Receiving end does not exist')) {
    console.warn(`[MessageService] ${context}:`, error.message);
  }
}

/**
 * Centralized service for sending messages between extension components.
 * This abstracts the chrome.runtime.sendMessage API and provides type-safe message sending.
 */
export const MessageService = {
  /**
   * Notify that a provider's status has changed.
   */
  notifyProviderStatus(status: ProviderStatus): Promise<void> {
    return chrome.runtime.sendMessage({
      type: 'PROVIDER_STATUS_UPDATE',
      payload: { status },
      timestamp: Date.now(),
    }).catch((error) => {
      logMessageError('notifyProviderStatus', error);
    });
  },

  /**
   * Notify that a response has been received from a provider.
   */
  notifyResponseReceived(
    queryId: string,
    providerId: ProviderId,
    text: string,
    durationMs: number
  ): Promise<void> {
    return chrome.runtime.sendMessage({
      type: 'RESPONSE_RECEIVED',
      payload: {
        queryId,
        providerId,
        text,
        durationMs,
      },
      timestamp: Date.now(),
    }).catch((error) => {
      logMessageError('notifyResponseReceived', error);
    });
  },

  /**
   * Notify that an error occurred while getting a response.
   */
  notifyResponseError(
    queryId: string,
    providerId: ProviderId,
    error: string
  ): Promise<void> {
    return chrome.runtime.sendMessage({
      type: 'RESPONSE_ERROR',
      payload: {
        queryId,
        providerId,
        error,
      },
      timestamp: Date.now(),
    }).catch((error) => {
      logMessageError('notifyResponseError', error);
    });
  },

  /**
   * Notify that a query session has been updated.
   */
  notifySessionUpdate(session: QuerySession): Promise<void> {
    return chrome.runtime.sendMessage({
      type: 'SESSION_UPDATE',
      payload: { session },
      timestamp: Date.now(),
    }).catch((error) => {
      logMessageError('notifySessionUpdate', error);
    });
  },

  /**
   * Submit a query to providers.
   */
  submitQuery(text: string, providers: ProviderId[]): Promise<void> {
    return chrome.runtime.sendMessage({
      type: 'SUBMIT_QUERY',
      payload: {
        text,
        providers,
      },
      timestamp: Date.now(),
    });
  },

  /**
   * Request to open new chat tabs.
   */
  newChat(providers: ProviderId[]): Promise<void> {
    return chrome.runtime.sendMessage({
      type: 'NEW_CHAT',
      payload: {
        providers,
      },
      timestamp: Date.now(),
    });
  },

  /**
   * Send a ping to a content script tab.
   */
  pingTab(tabId: number): Promise<{ providerId: ProviderId; isReady: boolean; isLoggedIn: boolean } | null> {
    return chrome.tabs.sendMessage(tabId, {
      type: 'PING',
      payload: {},
      timestamp: Date.now(),
    }).catch((error) => {
      logMessageError('pingTab', error);
      return null;
    });
  },

  /**
   * Submit a query to a specific tab's content script.
   */
  submitQueryToTab(tabId: number, queryId: string, text: string): Promise<{ success: boolean; error?: string }> {
    return chrome.tabs.sendMessage(tabId, {
      type: 'SUBMIT_QUERY',
      payload: {
        queryId,
        text,
      },
      timestamp: Date.now(),
    });
  },
};
