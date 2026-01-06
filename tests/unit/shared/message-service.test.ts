import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MessageService } from '@/shared/services/message-service';
import { installMockChromeAPI, resetMockChromeAPI } from '@tests/mocks/chrome-api';

describe('MessageService', () => {
  const mockChrome = installMockChromeAPI();

  beforeEach(() => {
    resetMockChromeAPI(mockChrome);
  });

  describe('notifyProviderStatus', () => {
    it('should send PROVIDER_STATUS_UPDATE message', async () => {
      const status = {
        providerId: 'chatgpt' as const,
        isConnected: true,
        isLoggedIn: true,
        isReady: true,
      };

      await MessageService.notifyProviderStatus(status);

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'PROVIDER_STATUS_UPDATE',
          payload: { status },
          timestamp: expect.any(Number),
        })
      );
    });

    it('should not throw on error', async () => {
      mockChrome.runtime.sendMessage.mockRejectedValueOnce(new Error('No listeners'));

      const status = {
        providerId: 'chatgpt' as const,
        isConnected: true,
        isLoggedIn: true,
        isReady: true,
      };

      await expect(MessageService.notifyProviderStatus(status)).resolves.not.toThrow();
    });
  });

  describe('notifyResponseReceived', () => {
    it('should send RESPONSE_RECEIVED message with correct payload', async () => {
      await MessageService.notifyResponseReceived('query-123', 'claude', 'Response text', 1500);

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'RESPONSE_RECEIVED',
          payload: {
            queryId: 'query-123',
            providerId: 'claude',
            text: 'Response text',
            durationMs: 1500,
          },
          timestamp: expect.any(Number),
        })
      );
    });

    it('should not throw on error', async () => {
      mockChrome.runtime.sendMessage.mockRejectedValueOnce(new Error('No listeners'));

      await expect(
        MessageService.notifyResponseReceived('query-123', 'claude', 'text', 1000)
      ).resolves.not.toThrow();
    });
  });

  describe('notifyResponseError', () => {
    it('should send RESPONSE_ERROR message with correct payload', async () => {
      await MessageService.notifyResponseError('query-123', 'gemini', 'Connection failed');

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'RESPONSE_ERROR',
          payload: {
            queryId: 'query-123',
            providerId: 'gemini',
            error: 'Connection failed',
          },
          timestamp: expect.any(Number),
        })
      );
    });

    it('should not throw on error', async () => {
      mockChrome.runtime.sendMessage.mockRejectedValueOnce(new Error('No listeners'));

      await expect(
        MessageService.notifyResponseError('query-123', 'gemini', 'error')
      ).resolves.not.toThrow();
    });
  });

  describe('notifySessionUpdate', () => {
    it('should send SESSION_UPDATE message', async () => {
      const session = {
        query: {
          id: 'query-123',
          text: 'Test query',
          timestamp: Date.now(),
          providers: ['chatgpt' as const],
        },
        responses: {},
        status: 'in-progress' as const,
      };

      await MessageService.notifySessionUpdate(session);

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'SESSION_UPDATE',
          payload: { session },
          timestamp: expect.any(Number),
        })
      );
    });

    it('should not throw on error', async () => {
      mockChrome.runtime.sendMessage.mockRejectedValueOnce(new Error('No listeners'));

      const session = {
        query: { id: '1', text: 't', timestamp: 0, providers: ['chatgpt' as const] },
        responses: {},
        status: 'in-progress' as const,
      };

      await expect(MessageService.notifySessionUpdate(session)).resolves.not.toThrow();
    });
  });

  describe('submitQuery', () => {
    it('should send SUBMIT_QUERY message', async () => {
      await MessageService.submitQuery('Test query', ['chatgpt', 'claude']);

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'SUBMIT_QUERY',
          payload: {
            text: 'Test query',
            providers: ['chatgpt', 'claude'],
          },
          timestamp: expect.any(Number),
        })
      );
    });
  });

  describe('newChat', () => {
    it('should send NEW_CHAT message', async () => {
      await MessageService.newChat(['chatgpt', 'gemini']);

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'NEW_CHAT',
          payload: {
            providers: ['chatgpt', 'gemini'],
          },
          timestamp: expect.any(Number),
        })
      );
    });
  });

  describe('pingTab', () => {
    it('should send PING message to specific tab', async () => {
      mockChrome.tabs.sendMessage.mockResolvedValue({
        providerId: 'chatgpt',
        isReady: true,
        isLoggedIn: true,
      });

      const result = await MessageService.pingTab(123);

      expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(
        123,
        expect.objectContaining({
          type: 'PING',
          payload: {},
          timestamp: expect.any(Number),
        })
      );
      expect(result).toEqual({
        providerId: 'chatgpt',
        isReady: true,
        isLoggedIn: true,
      });
    });

    it('should return null on error', async () => {
      mockChrome.tabs.sendMessage.mockRejectedValue(new Error('Tab not found'));

      const result = await MessageService.pingTab(999);
      expect(result).toBeNull();
    });
  });

  describe('submitQueryToTab', () => {
    it('should send SUBMIT_QUERY message to specific tab', async () => {
      mockChrome.tabs.sendMessage.mockResolvedValue({ success: true });

      const result = await MessageService.submitQueryToTab(123, 'query-456', 'Test text');

      expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(
        123,
        expect.objectContaining({
          type: 'SUBMIT_QUERY',
          payload: {
            queryId: 'query-456',
            text: 'Test text',
          },
          timestamp: expect.any(Number),
        })
      );
      expect(result).toEqual({ success: true });
    });
  });
});
