import { PROVIDERS } from '../shared/constants';
import type { ProviderId, ProviderStatus } from '../shared/types';

interface ManagedTab {
  tabId: number;
  providerId: ProviderId;
  isReady: boolean;
  isLoggedIn: boolean;
}

export class TabManager {
  private tabs = new Map<ProviderId, ManagedTab>();

  constructor() {
    this.setupTabListeners();
  }

  private setupTabListeners(): void {
    // Listen for tab updates
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      this.onTabUpdated(tabId, changeInfo, tab);
    });

    // Listen for tab removal
    chrome.tabs.onRemoved.addListener((tabId) => {
      this.onTabRemoved(tabId);
    });
  }

  onTabUpdated(
    tabId: number,
    changeInfo: { status?: string },
    tab: chrome.tabs.Tab
  ): void {
    if (changeInfo.status !== 'complete' || !tab.url) return;

    // Check if this tab is for one of our providers
    for (const [providerId, config] of Object.entries(PROVIDERS)) {
      const isMatch = config.urlPatterns.some((pattern) => {
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
        return regex.test(tab.url!);
      });

      if (isMatch) {
        this.tabs.set(providerId as ProviderId, {
          tabId,
          providerId: providerId as ProviderId,
          isReady: false,
          isLoggedIn: false,
        });

        // Ping the content script to check status
        this.pingTab(tabId, providerId as ProviderId);
        break;
      }
    }
  }

  onTabRemoved(tabId: number): void {
    for (const [providerId, managedTab] of this.tabs) {
      if (managedTab.tabId === tabId) {
        this.tabs.delete(providerId);
        break;
      }
    }
  }

  private async pingTab(tabId: number, providerId: ProviderId): Promise<void> {
    try {
      const response = await chrome.tabs.sendMessage(tabId, {
        type: 'PING',
        payload: {},
        timestamp: Date.now(),
      });

      if (response) {
        const managedTab = this.tabs.get(providerId);
        if (managedTab) {
          managedTab.isReady = response.isReady;
          managedTab.isLoggedIn = response.isLoggedIn;
        }
      }
    } catch {
      // Content script not ready yet, will retry on next update
    }
  }

  async ensureProviderTab(providerId: ProviderId, newChat: boolean = false): Promise<number> {
    const config = PROVIDERS[providerId];

    // If newChat is requested, navigate existing tab to new chat URL or create new tab
    if (newChat) {
      const existingTab = this.tabs.get(providerId);
      if (existingTab) {
        try {
          await chrome.tabs.get(existingTab.tabId);
          // Navigate existing tab to new chat URL
          await chrome.tabs.update(existingTab.tabId, {
            url: config.newChatUrl,
            active: true
          });
          existingTab.isReady = false;
          return existingTab.tabId;
        } catch {
          this.tabs.delete(providerId);
        }
      }

      // No existing tab, create a new one with newChatUrl
      const newTab = await chrome.tabs.create({
        url: config.newChatUrl,
        active: false,
      });

      if (!newTab.id) {
        throw new Error(`Failed to create tab for ${providerId}`);
      }

      this.tabs.set(providerId, {
        tabId: newTab.id,
        providerId,
        isReady: false,
        isLoggedIn: false,
      });

      return newTab.id;
    }

    // Check if we already have an active tab for this provider
    const existingTab = this.tabs.get(providerId);
    if (existingTab) {
      // Verify tab still exists
      try {
        await chrome.tabs.get(existingTab.tabId);
        return existingTab.tabId;
      } catch {
        // Tab no longer exists
        this.tabs.delete(providerId);
      }
    }

    // Search for existing tabs matching the provider URL
    const existingTabs = await chrome.tabs.query({
      url: config.urlPatterns,
    });

    if (existingTabs.length > 0 && existingTabs[0].id) {
      const tabId = existingTabs[0].id;
      this.tabs.set(providerId, {
        tabId,
        providerId,
        isReady: false,
        isLoggedIn: false,
      });

      // Activate the tab
      await chrome.tabs.update(tabId, { active: true });

      // Ping to check status
      await this.pingTab(tabId, providerId);

      return tabId;
    }

    // Create a new tab
    const newTab = await chrome.tabs.create({
      url: config.baseUrl,
      active: false, // Don't steal focus
    });

    if (!newTab.id) {
      throw new Error(`Failed to create tab for ${providerId}`);
    }

    this.tabs.set(providerId, {
      tabId: newTab.id,
      providerId,
      isReady: false,
      isLoggedIn: false,
    });

    return newTab.id;
  }

  getTabId(providerId: ProviderId): number | null {
    return this.tabs.get(providerId)?.tabId ?? null;
  }

  getStatus(providerId: ProviderId): ProviderStatus {
    const tab = this.tabs.get(providerId);
    return {
      providerId,
      isConnected: !!tab,
      isLoggedIn: tab?.isLoggedIn ?? false,
      isReady: tab?.isReady ?? false,
      tabId: tab?.tabId,
    };
  }

  getAllStatuses(): ProviderStatus[] {
    return (['chatgpt', 'claude', 'gemini'] as ProviderId[]).map((id) =>
      this.getStatus(id)
    );
  }

  updateTabStatus(
    providerId: ProviderId,
    isReady: boolean,
    isLoggedIn: boolean
  ): void {
    const tab = this.tabs.get(providerId);
    if (tab) {
      tab.isReady = isReady;
      tab.isLoggedIn = isLoggedIn;
    }
  }
}
