import { useState, useEffect, CSSProperties } from 'react';
import type { UserPreferences, ProviderId } from '../shared/types';
import { DEFAULT_PREFERENCES } from '../shared/types';
import { PROVIDERS, PROVIDER_IDS } from '../shared/constants';

/**
 * Centralized styles for the Options page.
 */
const styles = {
  container: {
    padding: '16px',
  } as CSSProperties,

  title: {
    fontSize: '24px',
    marginBottom: '24px',
    background: 'linear-gradient(90deg, #4facfe, #00f2fe)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  } as CSSProperties,

  section: {
    marginBottom: '24px',
  } as CSSProperties,

  sectionTitle: {
    fontSize: '16px',
    marginBottom: '12px',
    color: '#ccc',
  } as CSSProperties,

  sectionDescription: {
    fontSize: '14px',
    color: '#888',
    marginBottom: '12px',
  } as CSSProperties,

  buttonRow: {
    display: 'flex',
    gap: '8px',
  } as CSSProperties,

  footerRow: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
  } as CSSProperties,

  baseButton: {
    padding: '8px 16px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
  } as CSSProperties,

  primaryButton: {
    padding: '10px 24px',
    border: 'none',
    borderRadius: '6px',
    background: 'linear-gradient(90deg, #4facfe, #00f2fe)',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
  } as CSSProperties,

  dangerButton: {
    padding: '8px 16px',
    border: '1px solid #ef4444',
    borderRadius: '6px',
    background: 'rgba(239, 68, 68, 0.1)',
    color: '#ef4444',
    cursor: 'pointer',
    fontSize: '14px',
  } as CSSProperties,

  successText: {
    color: '#10b981',
    fontSize: '14px',
  } as CSSProperties,
};

/**
 * Creates provider toggle button styles based on selection state.
 */
function getProviderButtonStyle(providerId: ProviderId, isSelected: boolean): CSSProperties {
  const providerColor = PROVIDERS[providerId].color;
  return {
    ...styles.baseButton,
    border: `1px solid ${isSelected ? providerColor : '#3a3a5c'}`,
    background: isSelected ? `${providerColor}20` : 'transparent',
    color: isSelected ? providerColor : '#888',
  };
}

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
      });
      alert('History cleared!');
    }
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>AI Blaster Options</h1>

      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Default Providers</h2>
        <p style={styles.sectionDescription}>
          Select which providers are selected by default when you open the
          extension.
        </p>
        <div style={styles.buttonRow}>
          {PROVIDER_IDS.map((providerId) => (
            <button
              key={providerId}
              onClick={() => toggleProvider(providerId)}
              style={getProviderButtonStyle(
                providerId,
                preferences.defaultProviders.includes(providerId)
              )}
            >
              {PROVIDERS[providerId].name}
            </button>
          ))}
        </div>
      </section>

      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Data Management</h2>
        <button onClick={handleClearHistory} style={styles.dangerButton}>
          Clear All History
        </button>
      </section>

      <div style={styles.footerRow}>
        <button onClick={handleSave} style={styles.primaryButton}>
          Save Changes
        </button>
        {saved && <span style={styles.successText}>Saved!</span>}
      </div>
    </div>
  );
}
