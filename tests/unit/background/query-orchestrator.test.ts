import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryOrchestrator } from '@/background/query-orchestrator';
import { installMockChromeAPI, resetMockChromeAPI } from '@tests/mocks/chrome-api';

describe('QueryOrchestrator', () => {
  const mockChrome = installMockChromeAPI();
  let orchestrator: QueryOrchestrator;
  let mockTabManager: {
    ensureProviderTab: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    resetMockChromeAPI(mockChrome);

    mockTabManager = {
      ensureProviderTab: vi.fn().mockResolvedValue(123),
    };

    // Mock tabs.sendMessage to return success
    mockChrome.tabs.sendMessage.mockImplementation(async (_tabId, message) => {
      if (message.type === 'PING') {
        return { isReady: true, isLoggedIn: true };
      }
      return { success: true };
    });

    orchestrator = new QueryOrchestrator(mockTabManager as any);
  });

  describe('submitQuery', () => {
    it('should create a session with correct query data', async () => {
      const session = await orchestrator.submitQuery('Test query', [
        'chatgpt',
        'claude',
      ]);

      expect(session.query.text).toBe('Test query');
      expect(session.query.providers).toEqual(['chatgpt', 'claude']);
      expect(session.status).toBe('in-progress');
    });

    it('should generate unique query IDs', async () => {
      const session1 = await orchestrator.submitQuery('Query 1', ['chatgpt']);
      const session2 = await orchestrator.submitQuery('Query 2', ['chatgpt']);

      expect(session1.query.id).not.toBe(session2.query.id);
    });

    it('should call ensureProviderTab for each provider', async () => {
      await orchestrator.submitQuery('Test', ['chatgpt', 'claude', 'gemini']);

      expect(mockTabManager.ensureProviderTab).toHaveBeenCalledTimes(3);
      expect(mockTabManager.ensureProviderTab).toHaveBeenCalledWith('chatgpt', false);
      expect(mockTabManager.ensureProviderTab).toHaveBeenCalledWith('claude', false);
      expect(mockTabManager.ensureProviderTab).toHaveBeenCalledWith('gemini', false);
    });

    it('should call ensureProviderTab with newChat: true when specified', async () => {
      await orchestrator.submitQuery('Test', ['chatgpt', 'claude'], true);

      expect(mockTabManager.ensureProviderTab).toHaveBeenCalledTimes(2);
      expect(mockTabManager.ensureProviderTab).toHaveBeenCalledWith('chatgpt', true);
      expect(mockTabManager.ensureProviderTab).toHaveBeenCalledWith('claude', true);
    });

    it('should save query to storage', async () => {
      await orchestrator.submitQuery('Test query', ['chatgpt']);

      const result = await chrome.storage.local.get('queries');
      expect(result.queries).toHaveLength(1);
      expect(result.queries[0].text).toBe('Test query');
    });
  });

  describe('handleResponseReceived', () => {
    it('should update session with response', async () => {
      const session = await orchestrator.submitQuery('Test', ['chatgpt']);

      orchestrator.handleResponseReceived(
        session.query.id,
        'chatgpt',
        'Test response',
        1500
      );

      const updatedSession = orchestrator.getSession(session.query.id);
      expect(updatedSession?.responses.chatgpt?.text).toBe('Test response');
      expect(updatedSession?.responses.chatgpt?.durationMs).toBe(1500);
    });

    it('should mark session as completed when all responses received', async () => {
      const session = await orchestrator.submitQuery('Test', [
        'chatgpt',
        'claude',
      ]);

      orchestrator.handleResponseReceived(
        session.query.id,
        'chatgpt',
        'Response 1',
        1000
      );

      let updatedSession = orchestrator.getSession(session.query.id);
      expect(updatedSession?.status).toBe('in-progress');

      orchestrator.handleResponseReceived(
        session.query.id,
        'claude',
        'Response 2',
        1200
      );

      updatedSession = orchestrator.getSession(session.query.id);
      expect(updatedSession?.status).toBe('completed');
    });

    it('should save response to storage', async () => {
      const session = await orchestrator.submitQuery('Test', ['chatgpt']);

      orchestrator.handleResponseReceived(
        session.query.id,
        'chatgpt',
        'Test response',
        1000
      );

      // Wait for async storage operation to complete
      await new Promise((r) => setTimeout(r, 50));

      const result = await chrome.storage.local.get('responses');
      expect(result.responses).toHaveLength(1);
      expect(result.responses[0].text).toBe('Test response');
    });
  });

  describe('handleResponseError', () => {
    it('should update session with error', async () => {
      const session = await orchestrator.submitQuery('Test', ['chatgpt']);

      orchestrator.handleResponseError(
        session.query.id,
        'chatgpt',
        'Connection failed'
      );

      const updatedSession = orchestrator.getSession(session.query.id);
      expect(updatedSession?.responses.chatgpt?.error).toBe('Connection failed');
    });

    it('should mark session as error when all responses have errors', async () => {
      const session = await orchestrator.submitQuery('Test', ['chatgpt']);

      orchestrator.handleResponseError(
        session.query.id,
        'chatgpt',
        'Connection failed'
      );

      const updatedSession = orchestrator.getSession(session.query.id);
      expect(updatedSession?.status).toBe('error');
    });
  });

  describe('session notifications', () => {
    it('should send session update via chrome.runtime.sendMessage', async () => {
      await orchestrator.submitQuery('Test', ['chatgpt']);

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'SESSION_UPDATE',
          payload: expect.objectContaining({
            session: expect.objectContaining({
              query: expect.objectContaining({ text: 'Test' }),
            }),
          }),
        })
      );
    });
  });
});
