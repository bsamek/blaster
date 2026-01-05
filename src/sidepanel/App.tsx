import React, { useState, useEffect } from 'react';
import type { ProviderId, QuerySession } from '../shared/types';
import { PROVIDERS } from '../shared/constants';

export function App() {
  const [query, setQuery] = useState('');
  const [selectedProviders, setSelectedProviders] = useState<ProviderId[]>([
    'chatgpt',
    'claude',
    'gemini',
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sessions, setSessions] = useState<QuerySession[]>([]);

  useEffect(() => {
    // Listen for session updates
    const listener = (message: { type: string; payload: { session: QuerySession } }) => {
      if (message.type === 'SESSION_UPDATE') {
        setSessions((prev) => {
          const existing = prev.find(
            (s) => s.query.id === message.payload.session.query.id
          );
          if (existing) {
            return prev.map((s) =>
              s.query.id === message.payload.session.query.id
                ? message.payload.session
                : s
            );
          }
          return [message.payload.session, ...prev];
        });
      }
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

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
        <button
          className="submit-button"
          onClick={handleSubmit}
          disabled={!query.trim() || selectedProviders.length === 0 || isSubmitting}
        >
          {isSubmitting ? 'Sending...' : 'Send to All'}
        </button>
      </div>

      <div className="content">
        {sessions.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">⚡</div>
            <div className="empty-state-title">No active queries</div>
            <div className="empty-state-text">
              Enter a question above to compare responses.
            </div>
          </div>
        ) : (
          <>
            {sessions.map((session) => (
              <div key={session.query.id} className="query-session" data-testid="query-session">
                <div className="query-header">
                  <div className="query-text" data-testid="query-text">{session.query.text}</div>
                  <div className="query-meta">
                    <span className={`query-status ${session.status}`}>
                      {session.status}
                    </span>
                    <span>
                      {new Date(session.query.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                </div>

                <div className="responses-grid">
                  {session.query.providers.map((providerId) => (
                    <div key={providerId} className="response-card">
                      <div className="response-header">
                        <span className={`provider-badge ${providerId}`}>
                          {PROVIDERS[providerId].name}
                        </span>
                      </div>
                      <div className="response-status">
                        {session.responses[providerId] ? '✓ Sent' : 'Sending...'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
