import type { ProviderId, ProviderStatus } from './providers';
import type { Query, QueryResponse, Rating } from './query';

export interface UserPreferences {
  enabledProviders: ProviderId[];
  defaultProviders: ProviderId[];
  autoSubmit: boolean;
  maxHistoryItems: number;
  theme: 'light' | 'dark' | 'system';
}

export interface RatingStats {
  totalQueries: number;
  totalRatings: number;
  averageByProvider: Partial<Record<ProviderId, number>>;
  winsByProvider: Partial<Record<ProviderId, number>>;
}

export interface StorageSchema {
  preferences: UserPreferences;
  queries: Query[];
  responses: QueryResponse[];
  ratings: Rating[];
  providerStates: Partial<Record<ProviderId, ProviderStatus>>;
  stats: RatingStats;
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  enabledProviders: ['chatgpt', 'claude', 'gemini'],
  defaultProviders: ['chatgpt', 'claude', 'gemini'],
  autoSubmit: false,
  maxHistoryItems: 100,
  theme: 'system',
};

export const DEFAULT_STATS: RatingStats = {
  totalQueries: 0,
  totalRatings: 0,
  averageByProvider: {},
  winsByProvider: {},
};
