import { MessageHandler } from './message-handler';
import { QueryOrchestrator } from './query-orchestrator';
import { TabManager } from './tab-manager';
import { DEFAULT_PREFERENCES } from '../shared/types';

// Service worker entry point
// Initialize components
const tabManager = new TabManager();
const queryOrchestrator = new QueryOrchestrator(tabManager);
const messageHandler = new MessageHandler(queryOrchestrator, tabManager);

// Register message listener synchronously (MV3 requirement)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  return messageHandler.handleMessage(message, sender, sendResponse);
});

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    initializeDefaultSettings();
  }
});

// Set up side panel
chrome.sidePanel.setOptions({
  enabled: true,
});

// Open side panel when extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
  if (tab.id) {
    chrome.sidePanel.open({ tabId: tab.id });
  }
});

async function initializeDefaultSettings(): Promise<void> {
  await chrome.storage.local.set({
    preferences: DEFAULT_PREFERENCES,
    queries: [],
    responses: [],
  });
}

// Export for testing
export { tabManager, queryOrchestrator, messageHandler };
