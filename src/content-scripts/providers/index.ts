import type { IProviderAdapter, ProviderId } from '../../shared/types';
import { ChatGPTAdapter } from './chatgpt-adapter';
import { ClaudeAdapter } from './claude-adapter';
import { GeminiAdapter } from './gemini-adapter';

export const ADAPTERS: Record<ProviderId, new () => IProviderAdapter> = {
  chatgpt: ChatGPTAdapter,
  claude: ClaudeAdapter,
  gemini: GeminiAdapter,
};

export function createAdapter(providerId: ProviderId): IProviderAdapter {
  const AdapterClass = ADAPTERS[providerId];
  if (!AdapterClass) {
    throw new Error(`Unknown provider: ${providerId}`);
  }
  return new AdapterClass();
}
