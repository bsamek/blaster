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
      vote: 'up' | 'down';
      notes?: string;
    },
    sendResponse: (response: unknown) => void
  ): Promise<void> {
    try {
      const rating: Rating = {
        queryId: payload.queryId,
        providerId: payload.providerId,
        vote: payload.vote,
        timestamp: Date.now(),
        notes: payload.notes,
      };

      // Save rating to storage
      const result = await chrome.storage.local.get(['ratings', 'stats']) as {
        ratings?: Rating[];
        stats?: RatingStats;
      };

      // Filter out any existing rating for this query/provider combination
      const existingRatings: Rating[] = result.ratings || [];
      const existingRating = existingRatings.find(
        (r) => r.queryId === payload.queryId && r.providerId === payload.providerId
      );
      const ratings = existingRatings.filter(
        (r) => !(r.queryId === payload.queryId && r.providerId === payload.providerId)
      );
      ratings.push(rating);
      await chrome.storage.local.set({ ratings });

      // Update stats
      const stats: RatingStats = result.stats || {
        totalQueries: 0,
        totalRatings: 0,
        thumbsUpByProvider: {},
        thumbsDownByProvider: {},
      };

      // If there was an existing rating, adjust the counts
      if (existingRating) {
        // Remove the old vote from counts
        if (existingRating.vote === 'up') {
          stats.thumbsUpByProvider[payload.providerId] =
            Math.max(0, (stats.thumbsUpByProvider[payload.providerId] || 0) - 1);
        } else {
          stats.thumbsDownByProvider[payload.providerId] =
            Math.max(0, (stats.thumbsDownByProvider[payload.providerId] || 0) - 1);
        }
      } else {
        // Only increment total if this is a new rating
        stats.totalRatings++;
      }

      // Add the new vote to counts
      if (payload.vote === 'up') {
        stats.thumbsUpByProvider[payload.providerId] =
          (stats.thumbsUpByProvider[payload.providerId] || 0) + 1;
      } else {
        stats.thumbsDownByProvider[payload.providerId] =
          (stats.thumbsDownByProvider[payload.providerId] || 0) + 1;
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
          thumbsUpByProvider: {},
          thumbsDownByProvider: {},
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
