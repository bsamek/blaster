import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MessageHandler } from '@/background/message-handler';
import { installMockChromeAPI, resetMockChromeAPI } from '@tests/mocks/chrome-api';
import type { ExtensionMessage, ProviderId } from '@/shared/types';

describe('MessageHandler', () => {
  const mockChrome = installMockChromeAPI();
  let messageHandler: MessageHandler;
  let mockOrchestrator: {
    submitQuery: ReturnType<typeof vi.fn>;
    handleResponseReceived: ReturnType<typeof vi.fn>;
    handleResponseError: ReturnType<typeof vi.fn>;
  };
  let mockTabManager: {
    getAllStatuses: ReturnType<typeof vi.fn>;
    updateTabStatus: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    resetMockChromeAPI(mockChrome);

    mockOrchestrator = {
      submitQuery: vi.fn().mockResolvedValue({
        query: { id: 'test-query-id', text: 'Test query', providers: ['chatgpt'] },
        status: 'in-progress',
        responses: {},
      }),
      handleResponseReceived: vi.fn(),
      handleResponseError: vi.fn(),
    };

    mockTabManager = {
      getAllStatuses: vi.fn().mockReturnValue([
        { providerId: 'chatgpt', isConnected: true, isLoggedIn: true, isReady: true },
        { providerId: 'claude', isConnected: false, isLoggedIn: false, isReady: false },
        { providerId: 'gemini', isConnected: false, isLoggedIn: false, isReady: false },
      ]),
      updateTabStatus: vi.fn(),
    };

    messageHandler = new MessageHandler(
      mockOrchestrator as any,
      mockTabManager as any
    );
  });

  describe('SUBMIT_QUERY message', () => {
    it('should call orchestrator.submitQuery with correct parameters', async () => {
      const message: ExtensionMessage = {
        type: 'SUBMIT_QUERY',
        payload: {
          queryId: 'test-id',
          text: 'What is TypeScript?',
          providers: ['chatgpt', 'claude'] as ProviderId[],
        },
        timestamp: Date.now(),
      };

      const sendResponse = vi.fn();
      const result = messageHandler.handleMessage(
        message,
        {} as chrome.runtime.MessageSender,
        sendResponse
      );

      // Should return true for async response
      expect(result).toBe(true);

      // Wait for async operation
      await new Promise((r) => setTimeout(r, 10));

      expect(mockOrchestrator.submitQuery).toHaveBeenCalledWith(
        'What is TypeScript?',
        ['chatgpt', 'claude'],
        false
      );
      expect(sendResponse).toHaveBeenCalledWith({
        success: true,
        session: expect.objectContaining({
          query: expect.objectContaining({ text: 'Test query' }),
        }),
      });
    });

    it('should handle errors when submitQuery fails', async () => {
      mockOrchestrator.submitQuery.mockRejectedValue(new Error('Provider not available'));

      const message: ExtensionMessage = {
        type: 'SUBMIT_QUERY',
        payload: {
          queryId: 'test-id',
          text: 'Test query',
          providers: ['chatgpt'] as ProviderId[],
        },
        timestamp: Date.now(),
      };

      const sendResponse = vi.fn();
      messageHandler.handleMessage(
        message,
        {} as chrome.runtime.MessageSender,
        sendResponse
      );

      await new Promise((r) => setTimeout(r, 10));

      expect(sendResponse).toHaveBeenCalledWith({
        success: false,
        error: 'Provider not available',
      });
    });

    it('should handle non-Error exceptions', async () => {
      mockOrchestrator.submitQuery.mockRejectedValue('String error');

      const message: ExtensionMessage = {
        type: 'SUBMIT_QUERY',
        payload: {
          queryId: 'test-id',
          text: 'Test query',
          providers: ['chatgpt'] as ProviderId[],
        },
        timestamp: Date.now(),
      };

      const sendResponse = vi.fn();
      messageHandler.handleMessage(
        message,
        {} as chrome.runtime.MessageSender,
        sendResponse
      );

      await new Promise((r) => setTimeout(r, 10));

      expect(sendResponse).toHaveBeenCalledWith({
        success: false,
        error: 'Unknown error',
      });
    });
  });

  describe('RESPONSE_RECEIVED message', () => {
    it('should call orchestrator.handleResponseReceived with correct parameters', () => {
      const message: ExtensionMessage = {
        type: 'RESPONSE_RECEIVED',
        payload: {
          queryId: 'query-123',
          providerId: 'chatgpt' as ProviderId,
          text: 'This is a test response',
          durationMs: 1500,
        },
        timestamp: Date.now(),
      };

      const sendResponse = vi.fn();
      const result = messageHandler.handleMessage(
        message,
        {} as chrome.runtime.MessageSender,
        sendResponse
      );

      expect(result).toBe(false); // Synchronous response
      expect(mockOrchestrator.handleResponseReceived).toHaveBeenCalledWith(
        'query-123',
        'chatgpt',
        'This is a test response',
        1500
      );
      expect(sendResponse).toHaveBeenCalledWith({ success: true });
    });
  });

  describe('RESPONSE_ERROR message', () => {
    it('should call orchestrator.handleResponseError with correct parameters', () => {
      const message: ExtensionMessage = {
        type: 'RESPONSE_ERROR',
        payload: {
          queryId: 'query-123',
          providerId: 'claude' as ProviderId,
          error: 'Connection timeout',
        },
        timestamp: Date.now(),
      };

      const sendResponse = vi.fn();
      const result = messageHandler.handleMessage(
        message,
        {} as chrome.runtime.MessageSender,
        sendResponse
      );

      expect(result).toBe(false);
      expect(mockOrchestrator.handleResponseError).toHaveBeenCalledWith(
        'query-123',
        'claude',
        'Connection timeout'
      );
      expect(sendResponse).toHaveBeenCalledWith({ success: true });
    });
  });

  describe('PROVIDER_STATUS_UPDATE message', () => {
    it('should update tab status when sender has tab id', () => {
      const message: ExtensionMessage = {
        type: 'PROVIDER_STATUS_UPDATE',
        payload: {
          status: {
            providerId: 'gemini' as ProviderId,
            isConnected: true,
            isReady: true,
            isLoggedIn: true,
          },
        },
        timestamp: Date.now(),
      };

      const sender: chrome.runtime.MessageSender = {
        tab: { id: 123 } as chrome.tabs.Tab,
      };

      const sendResponse = vi.fn();
      const result = messageHandler.handleMessage(message, sender, sendResponse);

      expect(result).toBe(false);
      expect(mockTabManager.updateTabStatus).toHaveBeenCalledWith(
        'gemini',
        true,
        true
      );
      expect(sendResponse).toHaveBeenCalledWith({ success: true });
    });

    it('should not update tab status when sender has no tab id', () => {
      const message: ExtensionMessage = {
        type: 'PROVIDER_STATUS_UPDATE',
        payload: {
          status: {
            providerId: 'gemini' as ProviderId,
            isConnected: true,
            isReady: true,
            isLoggedIn: true,
          },
        },
        timestamp: Date.now(),
      };

      const sender: chrome.runtime.MessageSender = {};

      const sendResponse = vi.fn();
      messageHandler.handleMessage(message, sender, sendResponse);

      expect(mockTabManager.updateTabStatus).not.toHaveBeenCalled();
      expect(sendResponse).toHaveBeenCalledWith({ success: true });
    });
  });

  describe('GET_PROVIDER_STATUS message', () => {
    it('should return all provider statuses from tab manager', () => {
      const message: ExtensionMessage = {
        type: 'GET_PROVIDER_STATUS',
        payload: {},
        timestamp: Date.now(),
      };

      const sendResponse = vi.fn();
      const result = messageHandler.handleMessage(
        message,
        {} as chrome.runtime.MessageSender,
        sendResponse
      );

      expect(result).toBe(false);
      expect(mockTabManager.getAllStatuses).toHaveBeenCalled();
      expect(sendResponse).toHaveBeenCalledWith([
        { providerId: 'chatgpt', isConnected: true, isLoggedIn: true, isReady: true },
        { providerId: 'claude', isConnected: false, isLoggedIn: false, isReady: false },
        { providerId: 'gemini', isConnected: false, isLoggedIn: false, isReady: false },
      ]);
    });
  });

  describe('unknown message types', () => {
    it('should return false for unknown message types', () => {
      const message = {
        type: 'UNKNOWN_MESSAGE_TYPE',
        payload: {},
        timestamp: Date.now(),
      } as unknown as ExtensionMessage;

      const sendResponse = vi.fn();
      const result = messageHandler.handleMessage(
        message,
        {} as chrome.runtime.MessageSender,
        sendResponse
      );

      expect(result).toBe(false);
      expect(sendResponse).not.toHaveBeenCalled();
    });
  });
});
