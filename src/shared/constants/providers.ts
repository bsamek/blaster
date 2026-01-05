import type { ProviderConfig, ProviderId } from '../types';

export const PROVIDERS: Record<ProviderId, ProviderConfig> = {
  chatgpt: {
    id: 'chatgpt',
    name: 'ChatGPT',
    baseUrl: 'https://chatgpt.com',
    newChatUrl: 'https://chatgpt.com/',
    urlPatterns: ['https://chatgpt.com/', 'https://chatgpt.com/c/*'],
    iconUrl: '/icons/chatgpt.svg',
    color: '#10a37f',
  },
  claude: {
    id: 'claude',
    name: 'Claude',
    baseUrl: 'https://claude.ai',
    newChatUrl: 'https://claude.ai/new',
    urlPatterns: ['https://claude.ai/new', 'https://claude.ai/chat/*'],
    iconUrl: '/icons/claude.svg',
    color: '#d97706',
  },
  gemini: {
    id: 'gemini',
    name: 'Gemini',
    baseUrl: 'https://gemini.google.com/app',
    newChatUrl: 'https://gemini.google.com/app',
    urlPatterns: ['https://gemini.google.com/app', 'https://gemini.google.com/app/*'],
    iconUrl: '/icons/gemini.svg',
    color: '#4285f4',
  },
};
