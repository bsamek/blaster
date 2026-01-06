import React, { useState, useEffect } from 'react';
import type { ProviderId } from '../shared/types';
import { PROVIDERS, PROVIDER_IDS, STORAGE_KEYS } from '../shared/constants';

export function App() {
  const [query, setQuery] = useState('');
  const [selectedProviders, setSelectedProviders] = useState<ProviderId[]>([
    ...PROVIDER_IDS,
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load selected providers from storage on mount
  useEffect(() => {
    chrome.storage.local.get(STORAGE_KEYS.SELECTED_PROVIDERS).then((result) => {
      const saved = result[STORAGE_KEYS.SELECTED_PROVIDERS] as ProviderId[] | undefined;
      if (saved) {
        setSelectedProviders(saved);
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

  const toggleProvider = (providerId: ProviderId) => {
    setSelectedProviders((prev) =>
      prev.includes(providerId)
        ? prev.filter((p) => p !== providerId)
        : [...prev, providerId]
    );
  };

  const handleSubmit = async () => {
    if (!query.trim() || selectedProviders.length === 0) return;

    setIsSubmitting(true);
    try {
      await chrome.runtime.sendMessage({
        type: 'SUBMIT_QUERY',
        payload: {
          text: query.trim(),
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
        <textarea
          className="query-input"
          placeholder="Enter your question..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          data-testid="query-input"
        />
        <div className="providers-row">
          {PROVIDER_IDS.map((providerId) => (
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
