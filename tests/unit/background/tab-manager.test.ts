import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TabManager } from '@/background/tab-manager';
import { installMockChromeAPI, resetMockChromeAPI } from '@tests/mocks/chrome-api';

describe('TabManager', () => {
  const mockChrome = installMockChromeAPI();
  let tabManager: TabManager;

  beforeEach(() => {
    resetMockChromeAPI(mockChrome);

    // Capture the listeners that TabManager registers
    mockChrome.tabs.onUpdated.addListener.mockImplementation(() => {});
    mockChrome.tabs.onRemoved.addListener.mockImplementation(() => {});

    tabManager = new TabManager();
  });

  describe('constructor', () => {
    it('should set up tab listeners on creation', () => {
      expect(mockChrome.tabs.onUpdated.addListener).toHaveBeenCalled();
      expect(mockChrome.tabs.onRemoved.addListener).toHaveBeenCalled();
    });
  });

  describe('onTabUpdated', () => {
    it('should ignore tabs that are not complete', () => {
      tabManager.onTabUpdated(
        1,
        { status: 'loading' },
        { id: 1, url: 'https://chatgpt.com/' } as chrome.tabs.Tab
      );

      expect(tabManager.getTabId('chatgpt')).toBeNull();
    });

    it('should ignore tabs without a URL', () => {
      tabManager.onTabUpdated(
        1,
        { status: 'complete' },
        { id: 1 } as chrome.tabs.Tab
      );

      expect(tabManager.getTabId('chatgpt')).toBeNull();
    });

    it('should track ChatGPT tabs', () => {
      mockChrome.tabs.sendMessage.mockResolvedValue({ isReady: true, isLoggedIn: true });

      tabManager.onTabUpdated(
        101,
        { status: 'complete' },
        { id: 101, url: 'https://chatgpt.com/' } as chrome.tabs.Tab
      );

      expect(tabManager.getTabId('chatgpt')).toBe(101);
    });

    it('should track Claude tabs', () => {
      mockChrome.tabs.sendMessage.mockResolvedValue({ isReady: true, isLoggedIn: true });

      tabManager.onTabUpdated(
        102,
        { status: 'complete' },
        { id: 102, url: 'https://claude.ai/chat/123' } as chrome.tabs.Tab
      );

      expect(tabManager.getTabId('claude')).toBe(102);
    });

    it('should track Gemini tabs', () => {
      mockChrome.tabs.sendMessage.mockResolvedValue({ isReady: true, isLoggedIn: true });

      tabManager.onTabUpdated(
        103,
        { status: 'complete' },
        { id: 103, url: 'https://gemini.google.com/app' } as chrome.tabs.Tab
      );

      expect(tabManager.getTabId('gemini')).toBe(103);
    });

    it('should not track non-provider URLs', () => {
      tabManager.onTabUpdated(
        104,
        { status: 'complete' },
        { id: 104, url: 'https://google.com/' } as chrome.tabs.Tab
      );

      expect(tabManager.getTabId('chatgpt')).toBeNull();
      expect(tabManager.getTabId('claude')).toBeNull();
      expect(tabManager.getTabId('gemini')).toBeNull();
    });

    it('should ping tab when provider is detected', async () => {
      mockChrome.tabs.sendMessage.mockResolvedValue({ isReady: true, isLoggedIn: true });

      tabManager.onTabUpdated(
        105,
        { status: 'complete' },
        { id: 105, url: 'https://chatgpt.com/' } as chrome.tabs.Tab
      );

      // Wait for async ping
      await new Promise((r) => setTimeout(r, 10));

      expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(
        105,
        expect.objectContaining({
          type: 'PING',
          payload: {},
        })
      );
    });
  });

  describe('onTabRemoved', () => {
    it('should remove tracked tab when it is closed', () => {
      mockChrome.tabs.sendMessage.mockResolvedValue({ isReady: true, isLoggedIn: true });

      // First, add a tab
      tabManager.onTabUpdated(
        201,
        { status: 'complete' },
        { id: 201, url: 'https://chatgpt.com/' } as chrome.tabs.Tab
      );

      expect(tabManager.getTabId('chatgpt')).toBe(201);

      // Now remove it
      tabManager.onTabRemoved(201);

      expect(tabManager.getTabId('chatgpt')).toBeNull();
    });

    it('should not affect other tabs when removing untracked tab', () => {
      mockChrome.tabs.sendMessage.mockResolvedValue({ isReady: true, isLoggedIn: true });

      tabManager.onTabUpdated(
        203,
        { status: 'complete' },
        { id: 203, url: 'https://chatgpt.com/' } as chrome.tabs.Tab
      );

      // Remove a different tab
      tabManager.onTabRemoved(999);

      expect(tabManager.getTabId('chatgpt')).toBe(203);
    });
  });

  describe('ensureProviderTab', () => {
    it('should return existing tab if already tracked', async () => {
      mockChrome.tabs.sendMessage.mockResolvedValue({ isReady: true, isLoggedIn: true });
      mockChrome.tabs.get = vi.fn().mockResolvedValue({ id: 301 });

      // Add a tab
      tabManager.onTabUpdated(
        301,
        { status: 'complete' },
        { id: 301, url: 'https://chatgpt.com/' } as chrome.tabs.Tab
      );

      const tabId = await tabManager.ensureProviderTab('chatgpt');

      expect(tabId).toBe(301);
      expect(mockChrome.tabs.create).not.toHaveBeenCalled();
    });

    it('should clean up and re-search if tracked tab no longer exists', async () => {
      mockChrome.tabs.sendMessage.mockResolvedValue({ isReady: true, isLoggedIn: true });
      mockChrome.tabs.get = vi.fn().mockRejectedValue(new Error('Tab not found'));
      mockChrome.tabs.query.mockResolvedValue([]);
      mockChrome.tabs.create.mockResolvedValue({ id: 302 });

      // Add a tab
      tabManager.onTabUpdated(
        300,
        { status: 'complete' },
        { id: 300, url: 'https://chatgpt.com/' } as chrome.tabs.Tab
      );

      const tabId = await tabManager.ensureProviderTab('chatgpt');

      expect(tabId).toBe(302);
      expect(mockChrome.tabs.create).toHaveBeenCalled();
    });

    it('should find existing tabs matching provider URL', async () => {
      mockChrome.tabs.sendMessage.mockResolvedValue({ isReady: true, isLoggedIn: true });
      mockChrome.tabs.query.mockResolvedValue([{ id: 303, url: 'https://claude.ai/' }]);
      mockChrome.tabs.update.mockResolvedValue({ id: 303 });

      const tabId = await tabManager.ensureProviderTab('claude');

      expect(tabId).toBe(303);
      expect(mockChrome.tabs.update).toHaveBeenCalledWith(303, { active: true });
      expect(mockChrome.tabs.create).not.toHaveBeenCalled();
    });

    it('should create new tab if no existing tabs found', async () => {
      mockChrome.tabs.query.mockResolvedValue([]);
      mockChrome.tabs.create.mockResolvedValue({ id: 304 });

      const tabId = await tabManager.ensureProviderTab('gemini');

      expect(tabId).toBe(304);
      expect(mockChrome.tabs.create).toHaveBeenCalledWith({
        url: 'https://gemini.google.com/app',
        active: false,
      });
    });

    it('should throw error if tab creation fails', async () => {
      mockChrome.tabs.query.mockResolvedValue([]);
      mockChrome.tabs.create.mockResolvedValue({ id: undefined });

      await expect(tabManager.ensureProviderTab('chatgpt')).rejects.toThrow(
        'Failed to create tab for chatgpt'
      );
    });
  });

  describe('getStatus', () => {
    it('should return disconnected status for untracked provider', () => {
      const status = tabManager.getStatus('chatgpt');

      expect(status).toEqual({
        providerId: 'chatgpt',
        isConnected: false,
        isLoggedIn: false,
        isReady: false,
        tabId: undefined,
      });
    });

    it('should return connected status for tracked provider', async () => {
      mockChrome.tabs.sendMessage.mockResolvedValue({ isReady: true, isLoggedIn: true });

      tabManager.onTabUpdated(
        401,
        { status: 'complete' },
        { id: 401, url: 'https://chatgpt.com/' } as chrome.tabs.Tab
      );

      // Wait for ping to complete
      await new Promise((r) => setTimeout(r, 10));

      const status = tabManager.getStatus('chatgpt');

      expect(status.providerId).toBe('chatgpt');
      expect(status.isConnected).toBe(true);
      expect(status.tabId).toBe(401);
    });
  });

  describe('getAllStatuses', () => {
    it('should return status for all providers', () => {
      const statuses = tabManager.getAllStatuses();

      expect(statuses).toHaveLength(3);
      expect(statuses.map((s) => s.providerId)).toEqual(['chatgpt', 'claude', 'gemini']);
    });
  });

  describe('updateTabStatus', () => {
    it('should update status for tracked provider', () => {
      mockChrome.tabs.sendMessage.mockResolvedValue({ isReady: false, isLoggedIn: false });

      // First add the tab
      tabManager.onTabUpdated(
        601,
        { status: 'complete' },
        { id: 601, url: 'https://chatgpt.com/' } as chrome.tabs.Tab
      );

      // Update status
      tabManager.updateTabStatus('chatgpt', true, true);

      const status = tabManager.getStatus('chatgpt');
      expect(status.isReady).toBe(true);
      expect(status.isLoggedIn).toBe(true);
    });

    it('should not throw for untracked provider', () => {
      // Should not throw
      expect(() => tabManager.updateTabStatus('chatgpt', true, true)).not.toThrow();
    });
  });

  describe('URL pattern whitelisting', () => {
    beforeEach(() => {
      mockChrome.tabs.sendMessage.mockResolvedValue({ isReady: true, isLoggedIn: true });
    });

    describe('ChatGPT', () => {
      it('should match chatgpt.com homepage', () => {
        tabManager.onTabUpdated(
          700,
          { status: 'complete' },
          { id: 700, url: 'https://chatgpt.com/' } as chrome.tabs.Tab
        );
        expect(tabManager.getTabId('chatgpt')).toBe(700);
      });

      it('should match chatgpt.com/c/* conversation URLs', () => {
        tabManager.onTabUpdated(
          701,
          { status: 'complete' },
          { id: 701, url: 'https://chatgpt.com/c/abc123' } as chrome.tabs.Tab
        );
        expect(tabManager.getTabId('chatgpt')).toBe(701);
      });

      it('should NOT match chatgpt.com/images', () => {
        tabManager.onTabUpdated(
          702,
          { status: 'complete' },
          { id: 702, url: 'https://chatgpt.com/images' } as chrome.tabs.Tab
        );
        expect(tabManager.getTabId('chatgpt')).toBeNull();
      });

      it('should NOT match chatgpt.com/codex', () => {
        tabManager.onTabUpdated(
          703,
          { status: 'complete' },
          { id: 703, url: 'https://chatgpt.com/codex' } as chrome.tabs.Tab
        );
        expect(tabManager.getTabId('chatgpt')).toBeNull();
      });

      it('should NOT match chatgpt.com/apps', () => {
        tabManager.onTabUpdated(
          704,
          { status: 'complete' },
          { id: 704, url: 'https://chatgpt.com/apps' } as chrome.tabs.Tab
        );
        expect(tabManager.getTabId('chatgpt')).toBeNull();
      });

      it('should NOT match chatgpt.com/gpts', () => {
        tabManager.onTabUpdated(
          705,
          { status: 'complete' },
          { id: 705, url: 'https://chatgpt.com/gpts' } as chrome.tabs.Tab
        );
        expect(tabManager.getTabId('chatgpt')).toBeNull();
      });
    });

    describe('Claude', () => {
      it('should match claude.ai/new', () => {
        tabManager.onTabUpdated(
          710,
          { status: 'complete' },
          { id: 710, url: 'https://claude.ai/new' } as chrome.tabs.Tab
        );
        expect(tabManager.getTabId('claude')).toBe(710);
      });

      it('should match claude.ai/chat/* conversation URLs', () => {
        tabManager.onTabUpdated(
          711,
          { status: 'complete' },
          { id: 711, url: 'https://claude.ai/chat/abc123' } as chrome.tabs.Tab
        );
        expect(tabManager.getTabId('claude')).toBe(711);
      });

      it('should NOT match claude.ai homepage', () => {
        tabManager.onTabUpdated(
          712,
          { status: 'complete' },
          { id: 712, url: 'https://claude.ai/' } as chrome.tabs.Tab
        );
        expect(tabManager.getTabId('claude')).toBeNull();
      });

      it('should NOT match claude.ai/settings', () => {
        tabManager.onTabUpdated(
          713,
          { status: 'complete' },
          { id: 713, url: 'https://claude.ai/settings' } as chrome.tabs.Tab
        );
        expect(tabManager.getTabId('claude')).toBeNull();
      });

      it('should NOT match claude.ai/projects', () => {
        tabManager.onTabUpdated(
          714,
          { status: 'complete' },
          { id: 714, url: 'https://claude.ai/projects' } as chrome.tabs.Tab
        );
        expect(tabManager.getTabId('claude')).toBeNull();
      });
    });

    describe('Gemini', () => {
      it('should match gemini.google.com/app', () => {
        tabManager.onTabUpdated(
          720,
          { status: 'complete' },
          { id: 720, url: 'https://gemini.google.com/app' } as chrome.tabs.Tab
        );
        expect(tabManager.getTabId('gemini')).toBe(720);
      });

      it('should match gemini.google.com/app/* conversation URLs', () => {
        tabManager.onTabUpdated(
          721,
          { status: 'complete' },
          { id: 721, url: 'https://gemini.google.com/app/abc123' } as chrome.tabs.Tab
        );
        expect(tabManager.getTabId('gemini')).toBe(721);
      });

      it('should NOT match gemini.google.com homepage', () => {
        tabManager.onTabUpdated(
          722,
          { status: 'complete' },
          { id: 722, url: 'https://gemini.google.com/' } as chrome.tabs.Tab
        );
        expect(tabManager.getTabId('gemini')).toBeNull();
      });

      it('should NOT match gemini.google.com/extensions', () => {
        tabManager.onTabUpdated(
          723,
          { status: 'complete' },
          { id: 723, url: 'https://gemini.google.com/extensions' } as chrome.tabs.Tab
        );
        expect(tabManager.getTabId('gemini')).toBeNull();
      });

      it('should NOT match gemini.google.com/gems', () => {
        tabManager.onTabUpdated(
          724,
          { status: 'complete' },
          { id: 724, url: 'https://gemini.google.com/gems' } as chrome.tabs.Tab
        );
        expect(tabManager.getTabId('gemini')).toBeNull();
      });
    });
  });
});
