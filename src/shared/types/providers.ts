export type ProviderId = 'chatgpt' | 'claude' | 'gemini';

export interface ProviderConfig {
  id: ProviderId;
  name: string;
  baseUrl: string;
  urlPatterns: string[];
  iconUrl: string;
  color: string;
}

export interface ProviderSelectors {
  textareaSelector: string;
  submitButtonSelector: string;
  responseContainerSelector: string;
  responseTextSelector: string;
  loadingIndicatorSelector?: string;
}

export interface ProviderStatus {
  providerId: ProviderId;
  isConnected: boolean;
  isLoggedIn: boolean;
  isReady: boolean;
  lastError?: string;
  tabId?: number;
}

export interface IProviderAdapter {
  readonly providerId: ProviderId;

  initialize(): Promise<void>;
  destroy(): void;

  isReady(): boolean;
  isLoggedIn(): boolean;

  submitQuery(query: string): Promise<void>;
  waitForResponse(timeoutMs?: number): Promise<string>;
  getResponse(): string | null;

  getSelectors(): ProviderSelectors;
}
