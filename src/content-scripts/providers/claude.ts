// Content script entry point for Claude
import { ClaudeAdapter } from './claude-adapter';

const adapter = new ClaudeAdapter();

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
