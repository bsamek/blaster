import type { ExtensionMessage, ProviderId } from '../shared/types';
import type { QueryOrchestrator } from './query-orchestrator';
import type { TabManager } from './tab-manager';

export class MessageHandler {
  constructor(
    private orchestrator: QueryOrchestrator,
    private tabManager: TabManager
  ) {}

  handleMessage(
    message: ExtensionMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: unknown) => void
  ): boolean {
    switch (message.type) {
      case 'SUBMIT_QUERY':
        this.handleSubmitQuery(message.payload, sendResponse);
        return true;

      case 'NEW_CHAT':
        this.handleNewChat(message.payload, sendResponse);
        return true;

      case 'RESPONSE_RECEIVED':
        this.handleResponseReceived(message.payload);
        sendResponse({ success: true });
        return false;

      case 'RESPONSE_ERROR':
        this.handleResponseError(message.payload);
        sendResponse({ success: true });
        return false;

      case 'PROVIDER_STATUS_UPDATE':
        this.handleProviderStatusUpdate(message.payload, sender);
        sendResponse({ success: true });
        return false;

      case 'GET_PROVIDER_STATUS':
        sendResponse(this.tabManager.getAllStatuses());
        return false;

      default:
        return false;
    }
  }

  private async handleSubmitQuery(
    payload: { queryId?: string; text: string; providers: ProviderId[] },
    sendResponse: (response: unknown) => void
  ): Promise<void> {
    try {
      const session = await this.orchestrator.submitQuery(
        payload.text,
        payload.providers
      );
      sendResponse({ success: true, session });
    } catch (error) {
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private async handleNewChat(
    payload: { providers: ProviderId[] },
    sendResponse: (response: unknown) => void
  ): Promise<void> {
    try {
      await this.tabManager.openNewChats(payload.providers);
      sendResponse({ success: true });
    } catch (error) {
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private handleResponseReceived(payload: {
    queryId: string;
    providerId: ProviderId;
    text: string;
    durationMs: number;
  }): void {
    this.orchestrator.handleResponseReceived(
      payload.queryId,
      payload.providerId,
      payload.text,
      payload.durationMs
    );
  }

  private handleResponseError(payload: {
    queryId: string;
    providerId: ProviderId;
    error: string;
  }): void {
    this.orchestrator.handleResponseError(
      payload.queryId,
      payload.providerId,
      payload.error
    );
  }

  private handleProviderStatusUpdate(
    payload: {
      status: {
        providerId: ProviderId;
        isReady: boolean;
        isLoggedIn: boolean;
      };
    },
    sender: chrome.runtime.MessageSender
  ): void {
    const { providerId, isReady, isLoggedIn } = payload.status;

    // Update tab manager with new status
    if (sender.tab?.id) {
      this.tabManager.updateTabStatus(providerId, isReady, isLoggedIn);
    }
  }
}
