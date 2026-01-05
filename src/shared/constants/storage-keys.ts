export const STORAGE_KEYS = {
  PREFERENCES: 'preferences',
  QUERIES: 'queries',
  RESPONSES: 'responses',
  PROVIDER_STATES: 'providerStates',
  SELECTED_PROVIDERS: 'selectedProviders',
} as const;

export type StorageKey = typeof STORAGE_KEYS[keyof typeof STORAGE_KEYS];
