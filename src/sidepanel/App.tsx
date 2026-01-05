import React, { useState } from 'react';
import type { ProviderId } from '../shared/types';
import { PROVIDERS } from '../shared/constants';

export function App() {
  const [query, setQuery] = useState('');
  const [selectedProviders, setSelectedProviders] = useState<ProviderId[]>([
    'chatgpt',
    'claude',
    'gemini',
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleProvider = (providerId: ProviderId) => {
    setSelectedProviders((prev) =>
      prev.includes(providerId)
        ? prev.filter((p) => p !== providerId)
        : [...prev, providerId]
    );
  };

  const handleSubmit = async (newChat: boolean = false) => {
    if (!query.trim() || selectedProviders.length === 0) return;

    setIsSubmitting(true);
    try {
      await chrome.runtime.sendMessage({
        type: 'SUBMIT_QUERY',
        payload: {
          text: query.trim(),
          providers: selectedProviders,
          newChat,
        },
        timestamp: Date.now(),
      });
      setQuery('');
    } finally {
      setIsSubmitting(false);
    }
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
            onClick={() => handleSubmit(false)}
            disabled={!query.trim() || selectedProviders.length === 0 || isSubmitting}
          >
            {isSubmitting ? 'Sending...' : 'Send'}
          </button>
          <button
            className="submit-button secondary"
            onClick={() => handleSubmit(true)}
            disabled={!query.trim() || selectedProviders.length === 0 || isSubmitting}
          >
            {isSubmitting ? 'Sending...' : 'Send to New Chat'}
          </button>
        </div>
      </div>
    </div>
  );
}
