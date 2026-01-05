import { useState, useEffect } from 'react';
import type { QuerySession } from '../shared/types';
import { PROVIDERS } from '../shared/constants';

export function App() {
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

  return (
    <div className="sidepanel-container">
      <header className="header">
        <h1>AI Blaster</h1>
      </header>

      <div className="content">
        {sessions.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">⚡</div>
            <div className="empty-state-title">No active queries</div>
            <div className="empty-state-text">
              Queries sent to AI assistants will appear here.
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
