import React, { useState, useEffect } from 'react';
import type { ProviderId, ProviderStatus } from '../shared/types';
import { PROVIDERS } from '../shared/constants';

type SubmitStatus = 'idle' | 'submitting' | 'success' | 'error';

export function App() {
  const [query, setQuery] = useState('');
  const [selectedProviders, setSelectedProviders] = useState<ProviderId[]>([
    'chatgpt',
    'claude',
    'gemini',
  ]);
  const [providerStatuses, setProviderStatuses] = useState<
    Record<ProviderId, ProviderStatus>
  >({} as Record<ProviderId, ProviderStatus>);
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    // Get initial provider statuses
    chrome.runtime.sendMessage(
      { type: 'GET_PROVIDER_STATUS', payload: {}, timestamp: Date.now() },
      (statuses: ProviderStatus[]) => {
        if (statuses) {
          const statusMap: Record<ProviderId, ProviderStatus> = {} as Record<
            ProviderId,
            ProviderStatus
          >;
          statuses.forEach((s) => {
            statusMap[s.providerId] = s;
          });
          setProviderStatuses(statusMap);
        }
      }
    );

    // Listen for status updates
    const listener = (message: { type: string; payload: { status: ProviderStatus } }) => {
      if (message.type === 'PROVIDER_STATUS_UPDATE') {
        setProviderStatuses((prev) => ({
          ...prev,
          [message.payload.status.providerId]: message.payload.status,
        }));
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

    setSubmitStatus('submitting');
    setErrorMessage('');

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'SUBMIT_QUERY',
        payload: {
          text: query.trim(),
          providers: selectedProviders,
        },
        timestamp: Date.now(),
      });

      if (response?.success) {
        setSubmitStatus('success');
        setQuery('');

        // Open side panel to show results
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]?.id) {
            chrome.sidePanel.open({ tabId: tabs[0].id });
          }
        });
      } else {
        setSubmitStatus('error');
        setErrorMessage(response?.error || 'Failed to submit query');
      }
    } catch (error) {
      setSubmitStatus('error');
      setErrorMessage(
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSubmit();
    }
  };

  const getProviderStatusClass = (providerId: ProviderId): string => {
    const status = providerStatuses[providerId];
    if (status?.isReady) return 'ready';
    if (status?.isConnected) return 'connected';
    return '';
  };

  return (
    <div className="popup-container">
      <div className="header">
        <h1>AI Blaster</h1>
      </div>

      <div className="query-section">
        <textarea
          className="query-input"
          placeholder="Enter your question..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          data-testid="query-input"
        />
      </div>

      <div className="providers-section">
        <div className="providers-label">Compare with:</div>
        <div className="providers-list">
          {(['chatgpt', 'claude', 'gemini'] as ProviderId[]).map((providerId) => (
            <button
              key={providerId}
              className={`provider-toggle ${providerId} ${
                selectedProviders.includes(providerId) ? 'selected' : ''
              }`}
              onClick={() => toggleProvider(providerId)}
              data-testid={`provider-toggle-${providerId}`}
            >
              <span
                className={`provider-dot ${getProviderStatusClass(providerId)}`}
              />
              <span className="provider-name">
                {PROVIDERS[providerId].name}
              </span>
            </button>
          ))}
        </div>
      </div>

      <button
        className="submit-button"
        onClick={handleSubmit}
        disabled={
          !query.trim() ||
          selectedProviders.length === 0 ||
          submitStatus === 'submitting'
        }
        data-testid="submit-button"
      >
        {submitStatus === 'submitting' ? 'Sending...' : 'Compare Responses'}
      </button>

      {submitStatus === 'success' && (
        <div className="status-bar success">
          Query sent! Check the side panel for results.
        </div>
      )}

      {submitStatus === 'error' && (
        <div className="status-bar error">{errorMessage}</div>
      )}
    </div>
  );
}
