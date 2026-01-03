import type { ProviderConfig, ProviderId } from '../types';

export const PROVIDERS: Record<ProviderId, ProviderConfig> = {
  chatgpt: {
    id: 'chatgpt',
    name: 'ChatGPT',
    baseUrl: 'https://chatgpt.com',
    urlPatterns: ['https://chat.openai.com/*', 'https://chatgpt.com/*'],
    iconUrl: '/icons/chatgpt.svg',
    color: '#10a37f',
  },
  claude: {
    id: 'claude',
    name: 'Claude',
    baseUrl: 'https://claude.ai',
    urlPatterns: ['https://claude.ai/*'],
    iconUrl: '/icons/claude.svg',
    color: '#d97706',
  },
  gemini: {
    id: 'gemini',
    name: 'Gemini',
    baseUrl: 'https://gemini.google.com/app',
    urlPatterns: ['https://gemini.google.com/*'],
    iconUrl: '/icons/gemini.svg',
    color: '#4285f4',
  },
};

export const PROVIDER_IDS: ProviderId[] = ['chatgpt', 'claude', 'gemini'];

export function getProviderFromUrl(url: string): ProviderId | null {
  for (const [id, config] of Object.entries(PROVIDERS)) {
    for (const pattern of config.urlPatterns) {
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      if (regex.test(url)) {
        return id as ProviderId;
      }
    }
  }
  return null;
}
