import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '@/sidepanel/App';
import { installMockChromeAPI, resetMockChromeAPI } from '@tests/mocks/chrome-api';

describe('Sidepanel App', () => {
  const mockChrome = installMockChromeAPI();

  beforeEach(() => {
    resetMockChromeAPI(mockChrome);
    mockChrome.runtime.sendMessage.mockResolvedValue({ success: true });
  });

  describe('rendering', () => {
    it('should render the header', () => {
      render(<App />);
      expect(screen.getByText('AI Blaster')).toBeInTheDocument();
    });

    it('should render the query input textarea', () => {
      render(<App />);
      expect(screen.getByTestId('query-input')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Enter your question...')).toBeInTheDocument();
    });

    it('should render all provider toggle buttons', () => {
      render(<App />);
      expect(screen.getByText('ChatGPT')).toBeInTheDocument();
      expect(screen.getByText('Claude')).toBeInTheDocument();
      expect(screen.getByText('Gemini')).toBeInTheDocument();
    });

    it('should render the submit button', () => {
      render(<App />);
      expect(screen.getByText('Send to All')).toBeInTheDocument();
    });

    it('should have all providers selected by default', () => {
      render(<App />);
      const chatgptBtn = screen.getByText('ChatGPT');
      const claudeBtn = screen.getByText('Claude');
      const geminiBtn = screen.getByText('Gemini');

      expect(chatgptBtn).toHaveClass('selected');
      expect(claudeBtn).toHaveClass('selected');
      expect(geminiBtn).toHaveClass('selected');
    });
  });

  describe('provider toggle', () => {
    it('should toggle provider selection when clicked', async () => {
      const user = userEvent.setup();
      render(<App />);

      const chatgptBtn = screen.getByText('ChatGPT');
      expect(chatgptBtn).toHaveClass('selected');

      await user.click(chatgptBtn);
      expect(chatgptBtn).not.toHaveClass('selected');

      await user.click(chatgptBtn);
      expect(chatgptBtn).toHaveClass('selected');
    });

    it('should allow multiple providers to be deselected', async () => {
      const user = userEvent.setup();
      render(<App />);

      await user.click(screen.getByText('ChatGPT'));
      await user.click(screen.getByText('Claude'));

      expect(screen.getByText('ChatGPT')).not.toHaveClass('selected');
      expect(screen.getByText('Claude')).not.toHaveClass('selected');
      expect(screen.getByText('Gemini')).toHaveClass('selected');
    });
  });

  describe('submit button state', () => {
    it('should be disabled when query is empty', () => {
      render(<App />);
      const submitBtn = screen.getByText('Send to All');
      expect(submitBtn).toBeDisabled();
    });

    it('should be disabled when query is only whitespace', async () => {
      const user = userEvent.setup();
      render(<App />);

      await user.type(screen.getByTestId('query-input'), '   ');
      expect(screen.getByText('Send to All')).toBeDisabled();
    });

    it('should be disabled when no providers are selected', async () => {
      const user = userEvent.setup();
      render(<App />);

      await user.type(screen.getByTestId('query-input'), 'Test query');
      await user.click(screen.getByText('ChatGPT'));
      await user.click(screen.getByText('Claude'));
      await user.click(screen.getByText('Gemini'));

      expect(screen.getByText('Send to All')).toBeDisabled();
    });

    it('should be enabled when query has text and at least one provider selected', async () => {
      const user = userEvent.setup();
      render(<App />);

      await user.type(screen.getByTestId('query-input'), 'Test query');
      expect(screen.getByText('Send to All')).toBeEnabled();
    });
  });

  describe('query submission', () => {
    it('should send message to runtime when submit is clicked', async () => {
      const user = userEvent.setup();
      render(<App />);

      await user.type(screen.getByTestId('query-input'), 'What is TypeScript?');
      await user.click(screen.getByText('Send to All'));

      await waitFor(() => {
        expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
          type: 'SUBMIT_QUERY',
          payload: {
            text: 'What is TypeScript?',
            providers: ['chatgpt', 'claude', 'gemini'],
          },
          timestamp: expect.any(Number),
        });
      });
    });

    it('should only send selected providers', async () => {
      const user = userEvent.setup();
      render(<App />);

      await user.type(screen.getByTestId('query-input'), 'Test query');
      await user.click(screen.getByText('Claude'));
      await user.click(screen.getByText('Gemini'));
      await user.click(screen.getByText('Send to All'));

      await waitFor(() => {
        expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
          type: 'SUBMIT_QUERY',
          payload: {
            text: 'Test query',
            providers: ['chatgpt'],
          },
          timestamp: expect.any(Number),
        });
      });
    });

    it('should clear the query input after successful submission', async () => {
      const user = userEvent.setup();
      render(<App />);

      const input = screen.getByTestId('query-input');
      await user.type(input, 'Test query');
      await user.click(screen.getByText('Send to All'));

      await waitFor(() => {
        expect(input).toHaveValue('');
      });
    });

    it('should show "Sending..." during submission', async () => {
      const user = userEvent.setup();
      mockChrome.runtime.sendMessage.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ success: true }), 100))
      );

      render(<App />);

      await user.type(screen.getByTestId('query-input'), 'Test query');
      await user.click(screen.getByText('Send to All'));

      expect(screen.getByText('Sending...')).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByText('Send to All')).toBeInTheDocument();
      });
    });

    it('should disable button during submission', async () => {
      const user = userEvent.setup();
      mockChrome.runtime.sendMessage.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ success: true }), 100))
      );

      render(<App />);

      await user.type(screen.getByTestId('query-input'), 'Test query');
      await user.click(screen.getByText('Send to All'));

      // Button should be disabled during submission
      expect(screen.getByText('Sending...')).toBeDisabled();
    });

    it('should trim whitespace from query before submission', async () => {
      const user = userEvent.setup();
      render(<App />);

      await user.type(screen.getByTestId('query-input'), '  Test query  ');
      await user.click(screen.getByText('Send to All'));

      await waitFor(() => {
        expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            payload: expect.objectContaining({
              text: 'Test query',
            }),
          })
        );
      });
    });
  });

  describe('keyboard shortcuts', () => {
    it('should submit on Cmd+Enter (Mac)', async () => {
      const user = userEvent.setup();
      render(<App />);

      const input = screen.getByTestId('query-input');
      await user.type(input, 'Test query');

      fireEvent.keyDown(input, { key: 'Enter', metaKey: true });

      await waitFor(() => {
        expect(mockChrome.runtime.sendMessage).toHaveBeenCalled();
      });
    });

    it('should submit on Ctrl+Enter (Windows/Linux)', async () => {
      const user = userEvent.setup();
      render(<App />);

      const input = screen.getByTestId('query-input');
      await user.type(input, 'Test query');

      fireEvent.keyDown(input, { key: 'Enter', ctrlKey: true });

      await waitFor(() => {
        expect(mockChrome.runtime.sendMessage).toHaveBeenCalled();
      });
    });

    it('should not submit on Enter without modifier', async () => {
      const user = userEvent.setup();
      render(<App />);

      const input = screen.getByTestId('query-input');
      await user.type(input, 'Test query');

      fireEvent.keyDown(input, { key: 'Enter' });

      expect(mockChrome.runtime.sendMessage).not.toHaveBeenCalled();
    });
  });
});
