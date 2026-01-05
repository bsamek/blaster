import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '@/options/App';
import { installMockChromeAPI, resetMockChromeAPI } from '@tests/mocks/chrome-api';
import { DEFAULT_PREFERENCES } from '@/shared/types';

// Mock window.confirm and window.alert
const originalConfirm = window.confirm;
const originalAlert = window.alert;

describe('Options App', () => {
  const mockChrome = installMockChromeAPI();

  beforeEach(() => {
    resetMockChromeAPI(mockChrome);
    window.confirm = vi.fn(() => true);
    window.alert = vi.fn();
  });

  afterEach(() => {
    window.confirm = originalConfirm;
    window.alert = originalAlert;
  });

  describe('rendering', () => {
    it('should render the header', () => {
      render(<App />);
      expect(screen.getByText('AI Blaster Options')).toBeInTheDocument();
    });

    it('should render Default Providers section', () => {
      render(<App />);
      expect(screen.getByText('Default Providers')).toBeInTheDocument();
    });

    it('should render all provider toggle buttons', () => {
      render(<App />);
      expect(screen.getByText('ChatGPT')).toBeInTheDocument();
      expect(screen.getByText('Claude')).toBeInTheDocument();
      expect(screen.getByText('Gemini')).toBeInTheDocument();
    });

    it('should render Data Management section', () => {
      render(<App />);
      expect(screen.getByText('Data Management')).toBeInTheDocument();
    });

    it('should render Clear All History button', () => {
      render(<App />);
      expect(screen.getByText('Clear All History')).toBeInTheDocument();
    });

    it('should render Save Changes button', () => {
      render(<App />);
      expect(screen.getByText('Save Changes')).toBeInTheDocument();
    });
  });

  describe('loading preferences', () => {
    it('should load preferences from storage on mount', async () => {
      const customPrefs = {
        ...DEFAULT_PREFERENCES,
        defaultProviders: ['chatgpt'],
      };
      mockChrome.storage.local.data.set('preferences', customPrefs);

      render(<App />);

      await waitFor(() => {
        expect(mockChrome.storage.local.get).toHaveBeenCalledWith('preferences');
      });
    });

    it('should use default preferences when none stored', async () => {
      render(<App />);

      // All providers should be selected by default
      await waitFor(() => {
        const buttons = screen.getAllByRole('button');
        const providerButtons = buttons.filter((btn) =>
          ['ChatGPT', 'Claude', 'Gemini'].includes(btn.textContent || '')
        );
        // All provider buttons should show as selected (have the color border)
        expect(providerButtons.length).toBe(3);
      });
    });
  });

  describe('provider toggle', () => {
    it('should toggle provider selection when clicked', async () => {
      const user = userEvent.setup();
      render(<App />);

      const chatgptBtn = screen.getByText('ChatGPT');

      // Click to deselect
      await user.click(chatgptBtn);

      // The button style should change (we can't easily test inline styles,
      // but we can verify the save will include the change)
      await user.click(screen.getByText('Save Changes'));

      await waitFor(() => {
        expect(mockChrome.storage.local.set).toHaveBeenCalledWith({
          preferences: expect.objectContaining({
            defaultProviders: expect.not.arrayContaining(['chatgpt']),
          }),
        });
      });
    });

    it('should re-add provider when clicked again', async () => {
      const user = userEvent.setup();
      render(<App />);

      const chatgptBtn = screen.getByText('ChatGPT');

      // Click to deselect
      await user.click(chatgptBtn);
      // Click to re-select
      await user.click(chatgptBtn);

      await user.click(screen.getByText('Save Changes'));

      await waitFor(() => {
        expect(mockChrome.storage.local.set).toHaveBeenCalledWith({
          preferences: expect.objectContaining({
            defaultProviders: expect.arrayContaining(['chatgpt']),
          }),
        });
      });
    });
  });

  describe('saving preferences', () => {
    it('should save preferences to storage when Save Changes is clicked', async () => {
      const user = userEvent.setup();
      render(<App />);

      await user.click(screen.getByText('Save Changes'));

      await waitFor(() => {
        expect(mockChrome.storage.local.set).toHaveBeenCalledWith({
          preferences: expect.objectContaining({
            defaultProviders: expect.any(Array),
          }),
        });
      });
    });

    it('should show "Saved!" message after saving', async () => {
      const user = userEvent.setup();
      render(<App />);

      await user.click(screen.getByText('Save Changes'));

      await waitFor(() => {
        expect(screen.getByText('Saved!')).toBeInTheDocument();
      });
    });

    it('should hide "Saved!" message after timeout', async () => {
      const user = userEvent.setup();
      render(<App />);

      await user.click(screen.getByText('Save Changes'));

      await waitFor(() => {
        expect(screen.getByText('Saved!')).toBeInTheDocument();
      });

      // Wait for the timeout (2 seconds + buffer)
      await waitFor(
        () => {
          expect(screen.queryByText('Saved!')).not.toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });
  });

  describe('clear history', () => {
    it('should show confirmation dialog when Clear All History is clicked', async () => {
      const user = userEvent.setup();
      render(<App />);

      await user.click(screen.getByText('Clear All History'));

      expect(window.confirm).toHaveBeenCalledWith(
        'Are you sure you want to clear all history?'
      );
    });

    it('should clear storage when user confirms', async () => {
      const user = userEvent.setup();
      window.confirm = vi.fn(() => true);

      render(<App />);

      await user.click(screen.getByText('Clear All History'));

      await waitFor(() => {
        expect(mockChrome.storage.local.set).toHaveBeenCalledWith({
          queries: [],
          responses: [],
        });
      });
    });

    it('should show alert after clearing history', async () => {
      const user = userEvent.setup();
      window.confirm = vi.fn(() => true);

      render(<App />);

      await user.click(screen.getByText('Clear All History'));

      await waitFor(() => {
        expect(window.alert).toHaveBeenCalledWith('History cleared!');
      });
    });

    it('should not clear storage when user cancels', async () => {
      const user = userEvent.setup();
      window.confirm = vi.fn(() => false);

      render(<App />);

      await user.click(screen.getByText('Clear All History'));

      // Storage.set should not have been called for clearing
      expect(mockChrome.storage.local.set).not.toHaveBeenCalledWith({
        queries: [],
        responses: [],
      });
    });
  });

  describe('preferences persistence', () => {
    it('should load saved preferences and display them correctly', async () => {
      const customPrefs = {
        ...DEFAULT_PREFERENCES,
        defaultProviders: ['claude'] as const,
      };
      mockChrome.storage.local.data.set('preferences', customPrefs);

      render(<App />);

      // Wait for preferences to load
      await waitFor(() => {
        expect(mockChrome.storage.local.get).toHaveBeenCalled();
      });

      // When we save, it should keep the loaded preferences
      const user = userEvent.setup();
      await user.click(screen.getByText('Save Changes'));

      await waitFor(() => {
        expect(mockChrome.storage.local.set).toHaveBeenCalledWith({
          preferences: expect.objectContaining({
            defaultProviders: ['claude'],
          }),
        });
      });
    });
  });
});
