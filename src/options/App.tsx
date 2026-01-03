import { useState, useEffect } from 'react';
import type { UserPreferences, ProviderId } from '../shared/types';
import { DEFAULT_PREFERENCES } from '../shared/types';
import { PROVIDERS } from '../shared/constants';

export function App() {
  const [preferences, setPreferences] =
    useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    // Load preferences
    chrome.storage.local.get('preferences').then((result: { preferences?: UserPreferences }) => {
      if (result.preferences) {
        setPreferences(result.preferences);
      }
    });
  }, []);

  const handleSave = async () => {
    await chrome.storage.local.set({ preferences });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const toggleProvider = (providerId: ProviderId) => {
    setPreferences((prev) => ({
      ...prev,
      defaultProviders: prev.defaultProviders.includes(providerId)
        ? prev.defaultProviders.filter((p) => p !== providerId)
        : [...prev.defaultProviders, providerId],
    }));
  };

  const handleClearHistory = async () => {
    if (confirm('Are you sure you want to clear all history?')) {
      await chrome.storage.local.set({
        queries: [],
        responses: [],
        ratings: [],
        stats: {
          totalQueries: 0,
          totalRatings: 0,
          averageByProvider: {},
          winsByProvider: {},
        },
      });
      alert('History cleared!');
    }
  };

  return (
    <div style={{ padding: '16px' }}>
      <h1
        style={{
          fontSize: '24px',
          marginBottom: '24px',
          background: 'linear-gradient(90deg, #4facfe, #00f2fe)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}
      >
        AI Blaster Options
      </h1>

      <section style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '16px', marginBottom: '12px', color: '#ccc' }}>
          Default Providers
        </h2>
        <p style={{ fontSize: '14px', color: '#888', marginBottom: '12px' }}>
          Select which providers are selected by default when you open the
          extension.
        </p>
        <div style={{ display: 'flex', gap: '8px' }}>
          {(['chatgpt', 'claude', 'gemini'] as ProviderId[]).map(
            (providerId) => (
              <button
                key={providerId}
                onClick={() => toggleProvider(providerId)}
                style={{
                  padding: '8px 16px',
                  border: `1px solid ${
                    preferences.defaultProviders.includes(providerId)
                      ? PROVIDERS[providerId].color
                      : '#3a3a5c'
                  }`,
                  borderRadius: '6px',
                  background: preferences.defaultProviders.includes(providerId)
                    ? `${PROVIDERS[providerId].color}20`
                    : 'transparent',
                  color: preferences.defaultProviders.includes(providerId)
                    ? PROVIDERS[providerId].color
                    : '#888',
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
              >
                {PROVIDERS[providerId].name}
              </button>
            )
          )}
        </div>
      </section>

      <section style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '16px', marginBottom: '12px', color: '#ccc' }}>
          History
        </h2>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '14px', color: '#888' }}>
            Max history items:
          </span>
          <input
            type="number"
            min={10}
            max={500}
            value={preferences.maxHistoryItems}
            onChange={(e) =>
              setPreferences((prev) => ({
                ...prev,
                maxHistoryItems: parseInt(e.target.value) || 100,
              }))
            }
            style={{
              width: '80px',
              padding: '6px 10px',
              border: '1px solid #3a3a5c',
              borderRadius: '4px',
              background: 'rgba(255, 255, 255, 0.05)',
              color: '#eee',
              fontSize: '14px',
            }}
          />
        </label>
      </section>

      <section style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '16px', marginBottom: '12px', color: '#ccc' }}>
          Data Management
        </h2>
        <button
          onClick={handleClearHistory}
          style={{
            padding: '8px 16px',
            border: '1px solid #ef4444',
            borderRadius: '6px',
            background: 'rgba(239, 68, 68, 0.1)',
            color: '#ef4444',
            cursor: 'pointer',
            fontSize: '14px',
          }}
        >
          Clear All History
        </button>
      </section>

      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        <button
          onClick={handleSave}
          style={{
            padding: '10px 24px',
            border: 'none',
            borderRadius: '6px',
            background: 'linear-gradient(90deg, #4facfe, #00f2fe)',
            color: '#fff',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '600',
          }}
        >
          Save Changes
        </button>
        {saved && (
          <span style={{ color: '#10b981', fontSize: '14px' }}>Saved!</span>
        )}
      </div>
    </div>
  );
}
