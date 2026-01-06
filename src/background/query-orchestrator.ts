import type { ProviderId, Query, QueryResponse, QuerySession } from '../shared/types';
import type { TabManager } from './tab-manager';
import { generateId } from '../shared/utils';
import { MessageService } from '../shared/services';
import { STORAGE_LIMITS, TIMEOUTS } from '../shared/constants';

export class QueryOrchestrator {
  private activeSessions = new Map<string, QuerySession>();

  constructor(private tabManager: TabManager) {}

  /**
   * Generic helper to save items to storage history with optional limits.
   */
  private async saveToHistory<T>(
    storageKey: string,
    item: T,
    options?: { prepend?: boolean; limit?: number }
  ): Promise<void> {
    const result = await chrome.storage.local.get(storageKey);
    const items = (result[storageKey] as T[]) || [];

    if (options?.prepend) {
      items.unshift(item);
    } else {
      items.push(item);
    }

    const finalItems = options?.limit ? items.slice(0, options.limit) : items;
    await chrome.storage.local.set({ [storageKey]: finalItems });
  }

  async submitQuery(
    text: string,
    providers: ProviderId[]
  ): Promise<QuerySession> {
    const query: Query = {
      id: generateId(),
      text,
      timestamp: Date.now(),
      providers,
    };

    const session: QuerySession = {
      query,
      responses: {},
      status: 'in-progress',
    };

    this.activeSessions.set(query.id, session);

    // Save query to storage
    await this.saveQueryToHistory(query);

    // Notify listeners
    this.notifySessionUpdate(session);

    // Submit to all providers in parallel
    const submissions = providers.map(async (providerId) => {
      try {
        await this.submitToProvider(query, providerId);
      } catch (error) {
        const errorResponse: QueryResponse = {
          queryId: query.id,
          providerId,
          text: '',
          timestamp: Date.now(),
          durationMs: 0,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
        session.responses[providerId] = errorResponse;
        await this.saveResponseToHistory(errorResponse);
        this.notifySessionUpdate(session);
      }
    });

    // Don't await all - let responses come in asynchronously
    // But ensure we always check completion, even if all submissions fail
    Promise.all(submissions)
      .then(() => {
        this.checkSessionComplete(query.id);
      })
      .catch((error) => {
        console.error('Failed to complete submissions:', error);
        this.checkSessionComplete(query.id);
      });

    return session;
  }

  private async submitToProvider(
    query: Query,
    providerId: ProviderId
  ): Promise<void> {
    const tabId = await this.tabManager.ensureProviderTab(providerId);

    // Wait for tab to be ready
    await this.waitForTabReady(tabId, providerId);

    // Send message to content script
    await MessageService.submitQueryToTab(tabId, query.id, query.text);
  }

  private async waitForTabReady(
    tabId: number,
    providerId: ProviderId,
    timeout = TIMEOUTS.DOM_READY
  ): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const response = await MessageService.pingTab(tabId);

      if (response?.isReady) {
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, TIMEOUTS.POLL_INTERVAL));
    }

    throw new Error(`Tab for ${providerId} not ready after ${timeout}ms`);
  }

  handleResponseReceived(
    queryId: string,
    providerId: ProviderId,
    text: string,
    durationMs: number
  ): void {
    const session = this.activeSessions.get(queryId);
    if (!session) return;

    const response: QueryResponse = {
      queryId,
      providerId,
      text,
      timestamp: Date.now(),
      durationMs,
    };

    session.responses[providerId] = response;
    this.saveResponseToHistory(response);
    this.notifySessionUpdate(session);
    this.checkSessionComplete(queryId);
  }

  handleResponseError(
    queryId: string,
    providerId: ProviderId,
    error: string
  ): void {
    const session = this.activeSessions.get(queryId);
    if (!session) return;

    const response: QueryResponse = {
      queryId,
      providerId,
      text: '',
      timestamp: Date.now(),
      durationMs: 0,
      error,
    };

    session.responses[providerId] = response;
    this.saveResponseToHistory(response);
    this.notifySessionUpdate(session);
    this.checkSessionComplete(queryId);
  }

  private checkSessionComplete(queryId: string): void {
    const session = this.activeSessions.get(queryId);
    if (!session) return;

    const allReceived = session.query.providers.every(
      (p) => session.responses[p] !== undefined
    );

    if (allReceived) {
      const hasErrors = Object.values(session.responses).some((r) => r?.error);
      session.status = hasErrors ? 'error' : 'completed';
      this.notifySessionUpdate(session);
    }
  }

  getSession(queryId: string): QuerySession | undefined {
    return this.activeSessions.get(queryId);
  }

  private notifySessionUpdate(session: QuerySession): void {
    MessageService.notifySessionUpdate(session);
  }

  private async saveQueryToHistory(query: Query): Promise<void> {
    await this.saveToHistory('queries', query, {
      prepend: true,
      limit: STORAGE_LIMITS.QUERY_HISTORY,
    });
  }

  private async saveResponseToHistory(response: QueryResponse): Promise<void> {
    await this.saveToHistory('responses', response);
  }
}
