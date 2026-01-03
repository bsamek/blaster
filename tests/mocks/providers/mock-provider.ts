import { vi } from 'vitest';
import type { IProviderAdapter, ProviderId, ProviderSelectors } from '@/shared/types';

export interface MockProviderOptions {
  providerId: ProviderId;
  isReady?: boolean;
  isLoggedIn?: boolean;
  responseDelay?: number;
  defaultResponse?: string;
}

export function createMockProvider(options: MockProviderOptions): IProviderAdapter & {
  __setReady: (ready: boolean) => void;
  __setLoggedIn: (loggedIn: boolean) => void;
  __setResponse: (text: string) => void;
  __setError: (error: string | null) => void;
} {
  let isReady = options.isReady ?? true;
  let isLoggedIn = options.isLoggedIn ?? true;
  let responseText = options.defaultResponse ?? `Mock response from ${options.providerId}`;
  let errorMessage: string | null = null;
  const responseDelay = options.responseDelay ?? 100;

  return {
    providerId: options.providerId,

    initialize: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn(),

    isReady: vi.fn(() => isReady),
    isLoggedIn: vi.fn(() => isLoggedIn),
    hasActiveConversation: vi.fn(() => false),

    submitQuery: vi.fn().mockImplementation(async () => {
      if (!isReady) {
        throw new Error('Provider not ready');
      }
      await new Promise((r) => setTimeout(r, responseDelay));
    }),

    waitForResponse: vi.fn().mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, responseDelay));
      if (errorMessage) {
        throw new Error(errorMessage);
      }
      return responseText;
    }),

    getResponse: vi.fn(() => (errorMessage ? null : responseText)),

    getSelectors: vi.fn((): ProviderSelectors => ({
      textareaSelector: '#mock-textarea',
      submitButtonSelector: '#mock-submit',
      responseContainerSelector: '.mock-response',
      responseTextSelector: '.mock-text',
    })),

    // Test helpers
    __setReady: (ready: boolean) => {
      isReady = ready;
    },
    __setLoggedIn: (loggedIn: boolean) => {
      isLoggedIn = loggedIn;
    },
    __setResponse: (text: string) => {
      responseText = text;
      errorMessage = null;
    },
    __setError: (error: string | null) => {
      errorMessage = error;
    },
  };
}

export function createMockChatGPT() {
  return createMockProvider({
    providerId: 'chatgpt',
    defaultResponse: 'This is a response from ChatGPT.',
  });
}

export function createMockClaude() {
  return createMockProvider({
    providerId: 'claude',
    defaultResponse: 'This is a response from Claude.',
  });
}

export function createMockGemini() {
  return createMockProvider({
    providerId: 'gemini',
    defaultResponse: 'This is a response from Gemini.',
  });
}
