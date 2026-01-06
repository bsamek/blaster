import type { IProviderAdapter } from '../shared/types';

/**
 * Initializes a provider adapter with standard lifecycle handling.
 * This consolidates the identical initialization logic from all provider entry points.
 */
export function initializeAdapter(adapter: IProviderAdapter): void {
  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      adapter.initialize().catch(console.error);
    });
  } else {
    adapter.initialize().catch(console.error);
  }

  // Clean up on unload
  window.addEventListener('unload', () => {
    adapter.destroy();
  });
}
