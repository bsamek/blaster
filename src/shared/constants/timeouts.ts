/**
 * Timeout and interval constants used throughout the extension.
 * Centralizing these makes it easier to tune performance and maintain consistency.
 */

export const TIMEOUTS = {
  /** Maximum time to wait for DOM to be ready (ms) */
  DOM_READY: 30000,

  /** Maximum time to wait for a response from a provider (ms) */
  RESPONSE_WAIT: 60000,

  /** Time to wait for loading indicator to appear (ms) */
  LOADING_INDICATOR: 5000,

  /** Maximum time to wait for submit button to become enabled (ms) */
  BUTTON_ENABLED: 5000,

  /** Interval between polling checks (ms) */
  POLL_INTERVAL: 500,

  /** Time to wait after detecting response completion for content to settle (ms) */
  STREAMING_COMPLETE: 1000,

  /** Delay before clicking submit button after setting input (ms) */
  PRE_SUBMIT_DELAY: 200,

  /** Delay for button enable polling (ms) */
  BUTTON_POLL_INTERVAL: 100,

  /** Time to wait for content to settle after response (ms) */
  CONTENT_SETTLE: 500,

  /** Time to wait during Claude streaming check (ms) */
  STREAMING_CHECK: 200,

  /** Time to wait after Claude streaming completes (ms) */
  CLAUDE_SETTLE: 300,

  /** Maximum time to poll for new content when no loading indicator (ms) */
  MAX_POLL_TIME: 30000,

  /** Default element wait timeout (ms) */
  ELEMENT_WAIT: 10000,
} as const;

export const STORAGE_LIMITS = {
  /** Maximum number of queries to keep in history */
  QUERY_HISTORY: 100,

  /** Maximum number of responses to keep in history */
  RESPONSE_HISTORY: 500,
} as const;

export type TimeoutKey = keyof typeof TIMEOUTS;
export type StorageLimitKey = keyof typeof STORAGE_LIMITS;
