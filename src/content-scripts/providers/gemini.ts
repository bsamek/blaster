// Content script entry point for Gemini
import { GeminiAdapter } from './gemini-adapter';

const adapter = new GeminiAdapter();

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
