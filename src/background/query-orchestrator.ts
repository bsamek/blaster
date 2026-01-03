import type { ProviderId, Query, QueryResponse, QuerySession, RatingStats } from '../shared/types';
import type { TabManager } from './tab-manager';
import { generateId } from '../shared/utils';

export class QueryOrchestrator {
  private activeSessions = new Map<string, QuerySession>();
  private sessionListeners: ((session: QuerySession) => void)[] = [];

  constructor(private tabManager: TabManager) {}

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
    Promise.all(submissions).then(() => {
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
    await chrome.tabs.sendMessage(tabId, {
      type: 'SUBMIT_QUERY',
      payload: {
        queryId: query.id,
        text: query.text,
      },
      timestamp: Date.now(),
    });
  }

  private async waitForTabReady(
    tabId: number,
    providerId: ProviderId,
    timeout = 30000
  ): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      try {
        const response = await chrome.tabs.sendMessage(tabId, {
          type: 'PING',
          payload: {},
          timestamp: Date.now(),
        });

        if (response?.isReady) {
          return;
        }
      } catch {
        // Content script not ready yet
      }

      await new Promise((resolve) => setTimeout(resolve, 500));
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

  getActiveSessions(): QuerySession[] {
    return Array.from(this.activeSessions.values());
  }

  onSessionUpdate(listener: (session: QuerySession) => void): () => void {
    this.sessionListeners.push(listener);
    return () => {
      const index = this.sessionListeners.indexOf(listener);
      if (index > -1) {
        this.sessionListeners.splice(index, 1);
      }
    };
  }

  private notifySessionUpdate(session: QuerySession): void {
    for (const listener of this.sessionListeners) {
      listener(session);
    }

    // Also send to all extension pages
    chrome.runtime.sendMessage({
      type: 'SESSION_UPDATE',
      payload: { session },
      timestamp: Date.now(),
    }).catch(() => {
      // Ignore errors if no listeners
    });
  }

  private async saveQueryToHistory(query: Query): Promise<void> {
    const result = await chrome.storage.local.get('queries') as { queries?: Query[] };
    const queries: Query[] = result.queries || [];
    queries.unshift(query);

    // Keep only the last 100 queries
    const trimmedQueries = queries.slice(0, 100);
    await chrome.storage.local.set({ queries: trimmedQueries });

    // Update stats
    const statsResult = await chrome.storage.local.get('stats') as { stats?: RatingStats };
    const stats: RatingStats = statsResult.stats || {
      totalQueries: 0,
      totalRatings: 0,
      averageByProvider: {},
      winsByProvider: {},
    };
    stats.totalQueries++;
    await chrome.storage.local.set({ stats });
  }

  private async saveResponseToHistory(response: QueryResponse): Promise<void> {
    const result = await chrome.storage.local.get('responses') as { responses?: QueryResponse[] };
    const responses: QueryResponse[] = result.responses || [];
    responses.push(response);
    await chrome.storage.local.set({ responses });
  }
}
