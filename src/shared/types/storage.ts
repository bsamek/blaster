import type { ProviderId } from './providers';
import type { Query, QueryResponse } from './query';

export interface UserPreferences {
  defaultProviders: ProviderId[];
}

export interface StorageSchema {
  preferences: UserPreferences;
  queries: Query[];
  responses: QueryResponse[];
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  defaultProviders: ['chatgpt', 'claude', 'gemini'],
};
