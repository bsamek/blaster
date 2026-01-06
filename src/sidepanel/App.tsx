import React, { useState, useEffect } from 'react';
import type { ProviderId } from '../shared/types';
import { PROVIDERS, STORAGE_KEYS } from '../shared/constants';

export function App() {
  const [query, setQuery] = useState('');
  const [selectedProviders, setSelectedProviders] = useState<ProviderId[]>([
    'chatgpt',
    'claude',
    'gemini',
  ]);
  const [includePageContents, setIncludePageContents] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [sourceTabId, setSourceTabId] = useState<number | null>(null);

  // Capture the source tab ID on mount (before any AI tabs are opened)
  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      if (tab?.id) {
        setSourceTabId(tab.id);
      }
    });
  }, []);

  // Load settings from storage on mount
  useEffect(() => {
    chrome.storage.local
      .get([STORAGE_KEYS.SELECTED_PROVIDERS, STORAGE_KEYS.INCLUDE_PAGE_CONTENTS])
      .then((result) => {
        const savedProviders = result[STORAGE_KEYS.SELECTED_PROVIDERS] as
          | ProviderId[]
          | undefined;
        if (savedProviders) {
          setSelectedProviders(savedProviders);
        }
        const savedIncludePageContents = result[STORAGE_KEYS.INCLUDE_PAGE_CONTENTS] as
          | boolean
          | undefined;
        if (savedIncludePageContents !== undefined) {
          setIncludePageContents(savedIncludePageContents);
        }
        setIsLoaded(true);
      });
  }, []);

  // Save selected providers to storage when they change
  useEffect(() => {
    if (isLoaded) {
      chrome.storage.local.set({ [STORAGE_KEYS.SELECTED_PROVIDERS]: selectedProviders });
    }
  }, [selectedProviders, isLoaded]);

  // Save include page contents setting to storage when it changes
  useEffect(() => {
    if (isLoaded) {
      chrome.storage.local.set({ [STORAGE_KEYS.INCLUDE_PAGE_CONTENTS]: includePageContents });
    }
  }, [includePageContents, isLoaded]);

  const toggleProvider = (providerId: ProviderId) => {
    setSelectedProviders((prev) =>
      prev.includes(providerId)
        ? prev.filter((p) => p !== providerId)
        : [...prev, providerId]
    );
  };

  const getPageContents = async (): Promise<string> => {
    if (!sourceTabId) return '';

    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: sourceTabId },
        func: () => {
          // Try to find main content areas first (common for news articles)
          const selectors = [
            'article',
            'main',
            '[role="main"]',
            '.article-body',
            '.post-content',
          ];
          for (const selector of selectors) {
            const el = document.querySelector(selector);
            if (el && (el as HTMLElement).innerText.trim().length > 200) {
              return (el as HTMLElement).innerText.trim();
            }
          }

          // Fallback: get body text but exclude nav, header, footer, aside
          const clone = document.body.cloneNode(true) as HTMLElement;
          const excludeSelectors = [
            'nav',
            'header',
            'footer',
            'aside',
            '[role="navigation"]',
            '[role="banner"]',
            '[role="contentinfo"]',
            '.sidebar',
            '.menu',
          ];
          excludeSelectors.forEach((sel) => {
            clone.querySelectorAll(sel).forEach((el) => el.remove());
          });
          return clone.innerText.trim();
        },
      });

      return results[0]?.result || '';
    } catch {
      return '';
    }
  };

  const handleSubmit = async () => {
    if (!query.trim() || selectedProviders.length === 0) return;

    setIsSubmitting(true);
    try {
      let finalText = query.trim();

      if (includePageContents) {
        const pageContents = await getPageContents();
        if (pageContents) {
          finalText = `${finalText}\n\n---\nPage contents:\n${pageContents}`;
        }
      }

      await chrome.runtime.sendMessage({
        type: 'SUBMIT_QUERY',
        payload: {
          text: finalText,
          providers: selectedProviders,
        },
        timestamp: Date.now(),
      });
      setQuery('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNewChat = async () => {
    if (selectedProviders.length === 0) return;

    await chrome.runtime.sendMessage({
      type: 'NEW_CHAT',
      payload: {
        providers: selectedProviders,
      },
      timestamp: Date.now(),
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSubmit();
    }
  };

  return (
    <div className="sidepanel-container">
      <header className="header">
        <h1>AI Blaster</h1>
      </header>

      <div className="query-input-section">
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={includePageContents}
            onChange={(e) => setIncludePageContents(e.target.checked)}
            data-testid="include-page-contents"
          />
          Include page contents in prompt
        </label>
        <textarea
          className="query-input"
          placeholder="Enter your question..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          data-testid="query-input"
        />
        <div className="providers-row">
          {(['chatgpt', 'claude', 'gemini'] as ProviderId[]).map((providerId) => (
            <button
              key={providerId}
              className={`provider-toggle ${providerId} ${
                selectedProviders.includes(providerId) ? 'selected' : ''
              }`}
              onClick={() => toggleProvider(providerId)}
            >
              {PROVIDERS[providerId].name}
            </button>
          ))}
        </div>
        <div className="submit-buttons-row">
          <button
            className="submit-button"
            onClick={handleSubmit}
            disabled={!query.trim() || selectedProviders.length === 0 || isSubmitting}
          >
            {isSubmitting ? 'Sending...' : 'Send'}
          </button>
          <button
            className="submit-button secondary"
            onClick={handleNewChat}
            disabled={selectedProviders.length === 0}
          >
            New Chat
          </button>
        </div>
      </div>
    </div>
  );
}
