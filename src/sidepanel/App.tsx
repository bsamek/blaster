import { useState, useEffect } from 'react';
import type {
  ProviderId,
  QuerySession,
  Query,
  QueryResponse,
  Rating,
  RatingStats,
} from '../shared/types';
import { PROVIDERS } from '../shared/constants';
import { formatDuration, truncate } from '../shared/utils';

type Tab = 'compare' | 'history' | 'stats';

export function App() {
  const [activeTab, setActiveTab] = useState<Tab>('compare');
  const [sessions, setSessions] = useState<QuerySession[]>([]);
  const [queries, setQueries] = useState<Query[]>([]);
  const [responses, setResponses] = useState<QueryResponse[]>([]);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [stats, setStats] = useState<RatingStats>({
    totalQueries: 0,
    totalRatings: 0,
    averageByProvider: {},
    winsByProvider: {},
  });

  useEffect(() => {
    // Load history
    loadHistory();

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

  const loadHistory = async () => {
    const response = await chrome.runtime.sendMessage({
      type: 'GET_HISTORY',
      payload: {},
      timestamp: Date.now(),
    });

    if (response?.success) {
      setQueries(response.queries || []);
      setResponses(response.responses || []);
      setRatings(response.ratings || []);
      setStats(response.stats || stats);
    }
  };

  const handleRate = async (
    queryId: string,
    providerId: ProviderId,
    score: number
  ) => {
    await chrome.runtime.sendMessage({
      type: 'SAVE_RATING',
      payload: { queryId, providerId, score },
      timestamp: Date.now(),
    });

    // Update local state
    setRatings((prev) => [
      ...prev.filter(
        (r) => !(r.queryId === queryId && r.providerId === providerId)
      ),
      { queryId, providerId, score, timestamp: Date.now() },
    ]);

    // Reload stats
    loadHistory();
  };

  const getRating = (queryId: string, providerId: ProviderId): number => {
    const rating = ratings.find(
      (r) => r.queryId === queryId && r.providerId === providerId
    );
    return rating?.score || 0;
  };

  return (
    <div className="sidepanel-container">
      <header className="header">
        <h1>AI Blaster</h1>
        <div className="tabs">
          <button
            className={`tab-button ${activeTab === 'compare' ? 'active' : ''}`}
            onClick={() => setActiveTab('compare')}
          >
            Compare
          </button>
          <button
            className={`tab-button ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            History
          </button>
          <button
            className={`tab-button ${activeTab === 'stats' ? 'active' : ''}`}
            onClick={() => setActiveTab('stats')}
          >
            Stats
          </button>
        </div>
      </header>

      <div className="content">
        {activeTab === 'compare' && (
          <CompareView
            sessions={sessions}
            getRating={getRating}
            onRate={handleRate}
          />
        )}
        {activeTab === 'history' && (
          <HistoryView
            queries={queries}
            responses={responses}
            ratings={ratings}
            onSelect={(query) => {
              // Build session from history
              const session: QuerySession = {
                query,
                responses: {},
                status: 'completed',
              };
              const queryResponses = responses.filter(
                (r) => r.queryId === query.id
              );
              queryResponses.forEach((r) => {
                session.responses[r.providerId] = r;
              });
              setSessions([session]);
              setActiveTab('compare');
            }}
          />
        )}
        {activeTab === 'stats' && <StatsView stats={stats} />}
      </div>
    </div>
  );
}

interface CompareViewProps {
  sessions: QuerySession[];
  getRating: (queryId: string, providerId: ProviderId) => number;
  onRate: (queryId: string, providerId: ProviderId, score: number) => void;
}

function CompareView({ sessions, getRating, onRate }: CompareViewProps) {
  if (sessions.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">⚡</div>
        <div className="empty-state-title">No active queries</div>
        <div className="empty-state-text">
          Use the popup to send a query to multiple AI assistants.
        </div>
      </div>
    );
  }

  return (
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
              <ResponseCard
                key={providerId}
                providerId={providerId}
                response={session.responses[providerId]}
                rating={getRating(session.query.id, providerId)}
                onRate={(score) => onRate(session.query.id, providerId, score)}
              />
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

interface ResponseCardProps {
  providerId: ProviderId;
  response?: QueryResponse;
  rating: number;
  onRate: (score: number) => void;
}

function ResponseCard({
  providerId,
  response,
  rating,
  onRate,
}: ResponseCardProps) {
  return (
    <div className="response-card">
      <div className="response-header">
        <span className={`provider-badge ${providerId}`}>
          {PROVIDERS[providerId].name}
        </span>
        {response && !response.error && (
          <span className="response-time">
            {formatDuration(response.durationMs)}
          </span>
        )}
      </div>

      {!response && (
        <div className="response-loading">
          <div className="loading-spinner" />
          Waiting for response...
        </div>
      )}

      {response?.error && (
        <div className="response-error">{response.error}</div>
      )}

      {response && !response.error && (
        <>
          <div className="response-text">{response.text}</div>
          <RatingControls rating={rating} onRate={onRate} />
        </>
      )}
    </div>
  );
}

interface RatingControlsProps {
  rating: number;
  onRate: (score: number) => void;
}

function RatingControls({ rating, onRate }: RatingControlsProps) {
  const [hoveredStar, setHoveredStar] = useState(0);

  return (
    <div className="rating-section">
      <span className="rating-label">Rate:</span>
      <div className="stars">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            className={`star-button ${
              star <= (hoveredStar || rating) ? 'filled' : 'empty'
            }`}
            onClick={() => onRate(star)}
            onMouseEnter={() => setHoveredStar(star)}
            onMouseLeave={() => setHoveredStar(0)}
          >
            ★
          </button>
        ))}
      </div>
      {rating > 0 && <span className="rating-saved">Saved</span>}
    </div>
  );
}

interface HistoryViewProps {
  queries: Query[];
  responses: QueryResponse[];
  ratings: Rating[];
  onSelect: (query: Query) => void;
}

function HistoryView({ queries, onSelect }: HistoryViewProps) {
  if (queries.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">📝</div>
        <div className="empty-state-title">No history yet</div>
        <div className="empty-state-text">
          Your query history will appear here.
        </div>
      </div>
    );
  }

  return (
    <div className="history-list">
      {queries.map((query) => (
        <div
          key={query.id}
          className="history-item"
          onClick={() => onSelect(query)}
        >
          <div className="history-query">{truncate(query.text, 100)}</div>
          <div className="history-meta">
            <span>{new Date(query.timestamp).toLocaleDateString()}</span>
            <span>{query.providers.length} providers</span>
          </div>
        </div>
      ))}
    </div>
  );
}

interface StatsViewProps {
  stats: RatingStats;
}

function StatsView({ stats }: StatsViewProps) {
  return (
    <>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{stats.totalQueries}</div>
          <div className="stat-label">Total Queries</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.totalRatings}</div>
          <div className="stat-label">Total Ratings</div>
        </div>
      </div>

      <div className="provider-stats">
        <h3>Provider Performance</h3>
        {(['chatgpt', 'claude', 'gemini'] as ProviderId[]).map((providerId) => (
          <div key={providerId} className="provider-stat-row">
            <div className="provider-stat-info">
              <span className={`provider-badge ${providerId}`}>
                {PROVIDERS[providerId].name}
              </span>
            </div>
            <div className="provider-stat-values">
              <span>
                Avg:{' '}
                <strong>
                  {(stats.averageByProvider[providerId] || 0).toFixed(1)}★
                </strong>
              </span>
              <span>
                Wins: <strong>{stats.winsByProvider[providerId] || 0}</strong>
              </span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
