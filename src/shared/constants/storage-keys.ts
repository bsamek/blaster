export const STORAGE_KEYS = {
  PREFERENCES: 'preferences',
  QUERIES: 'queries',
  RESPONSES: 'responses',
  RATINGS: 'ratings',
  PROVIDER_STATES: 'providerStates',
  STATS: 'stats',
} as const;

export type StorageKey = typeof STORAGE_KEYS[keyof typeof STORAGE_KEYS];
