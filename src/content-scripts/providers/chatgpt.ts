// Content script entry point for ChatGPT
import { ChatGPTAdapter } from './chatgpt-adapter';

const adapter = new ChatGPTAdapter();

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
