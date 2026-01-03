import type { ExtensionMessage, ProviderId, Rating, RatingStats, Query, QueryResponse } from '../shared/types';
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

      case 'SAVE_RATING':
        this.handleSaveRating(message.payload, sendResponse);
        return true;

      case 'GET_HISTORY':
        this.handleGetHistory(sendResponse);
        return true;

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

  private async handleSaveRating(
    payload: {
      queryId: string;
      providerId: ProviderId;
      score: number;
      notes?: string;
    },
    sendResponse: (response: unknown) => void
  ): Promise<void> {
    try {
      const rating: Rating = {
        queryId: payload.queryId,
        providerId: payload.providerId,
        score: payload.score,
        timestamp: Date.now(),
        notes: payload.notes,
      };

      // Save rating to storage
      const result = await chrome.storage.local.get(['ratings', 'stats']) as {
        ratings?: Rating[];
        stats?: RatingStats;
      };
      const ratings: Rating[] = result.ratings || [];
      ratings.push(rating);
      await chrome.storage.local.set({ ratings });

      // Update stats
      const stats: RatingStats = result.stats || {
        totalQueries: 0,
        totalRatings: 0,
        averageByProvider: {},
        winsByProvider: {},
      };

      stats.totalRatings++;

      // Calculate new average for provider
      const providerRatings = ratings.filter(
        (r) => r.providerId === payload.providerId
      );
      const average =
        providerRatings.reduce((sum, r) => sum + r.score, 0) /
        providerRatings.length;
      stats.averageByProvider[payload.providerId] = average;

      // Check if this is the highest rated for the query
      const queryRatings = ratings.filter((r) => r.queryId === payload.queryId);
      if (queryRatings.length > 0) {
        const maxScore = Math.max(...queryRatings.map((r) => r.score));
        const winners = queryRatings.filter((r) => r.score === maxScore);
        if (winners.length === 1) {
          const winnerId = winners[0].providerId;
          stats.winsByProvider[winnerId] =
            (stats.winsByProvider[winnerId] || 0) + 1;
        }
      }

      await chrome.storage.local.set({ stats });

      sendResponse({ success: true, rating });
    } catch (error) {
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private async handleGetHistory(
    sendResponse: (response: unknown) => void
  ): Promise<void> {
    try {
      const result = await chrome.storage.local.get([
        'queries',
        'responses',
        'ratings',
        'stats',
      ]) as {
        queries?: Query[];
        responses?: QueryResponse[];
        ratings?: Rating[];
        stats?: RatingStats;
      };

      sendResponse({
        success: true,
        queries: result.queries || [],
        responses: result.responses || [],
        ratings: result.ratings || [],
        stats: result.stats || {
          totalQueries: 0,
          totalRatings: 0,
          averageByProvider: {},
          winsByProvider: {},
        },
      });
    } catch (error) {
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
