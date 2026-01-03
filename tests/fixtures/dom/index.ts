import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function loadFixture(filename: string): string {
  return readFileSync(join(__dirname, filename), 'utf-8');
}

export function injectResponse(
  document: Document,
  provider: 'chatgpt' | 'claude' | 'gemini',
  responseText: string,
  isStreaming = false
): Element {
  let container: HTMLElement;

  switch (provider) {
    case 'chatgpt': {
      container = document.createElement('div');
      container.setAttribute('data-message-author-role', 'assistant');
      if (isStreaming) {
        container.classList.add('result-streaming');
      }
      container.innerHTML = `<div class="markdown">${responseText}</div>`;
      const conversation = document.querySelector('.conversation');
      conversation?.appendChild(container);
      break;
    }
    case 'claude': {
      container = document.createElement('div');
      container.classList.add('font-claude-message');
      if (isStreaming) {
        container.setAttribute('data-is-streaming', 'true');
      }
      container.innerHTML = `<div class="prose"><p>${responseText}</p></div>`;
      const conversation = document.querySelector('.conversation');
      conversation?.appendChild(container);
      break;
    }
    case 'gemini': {
      container = document.createElement('message-content');
      container.classList.add('model');
      container.innerHTML = `<div class="markdown-main-panel"><p>${responseText}</p></div>`;
      const conversation = document.querySelector('.conversation');
      conversation?.appendChild(container);
      break;
    }
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }

  return container;
}

export function clearResponses(
  document: Document,
  provider: 'chatgpt' | 'claude' | 'gemini'
): void {
  const selectors: Record<string, string> = {
    chatgpt: '[data-message-author-role="assistant"]',
    claude: '.font-claude-message',
    gemini: 'message-content.model',
  };

  const elements = document.querySelectorAll(selectors[provider]);
  elements.forEach((el) => el.remove());
}
