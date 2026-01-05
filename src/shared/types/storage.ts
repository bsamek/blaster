import type { ProviderId, ProviderStatus } from './providers';
import type { Query, QueryResponse } from './query';

export interface UserPreferences {
  enabledProviders: ProviderId[];
  defaultProviders: ProviderId[];
  autoSubmit: boolean;
  theme: 'light' | 'dark' | 'system';
}

export interface StorageSchema {
  preferences: UserPreferences;
  queries: Query[];
  responses: QueryResponse[];
  providerStates: Partial<Record<ProviderId, ProviderStatus>>;
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  enabledProviders: ['chatgpt', 'claude', 'gemini'],
  defaultProviders: ['chatgpt', 'claude', 'gemini'],
  autoSubmit: false,
  theme: 'system',
};
