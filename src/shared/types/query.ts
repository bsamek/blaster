import type { ProviderId } from './providers';

export interface Query {
  id: string;
  text: string;
  timestamp: number;
  providers: ProviderId[];
}

export interface QueryResponse {
  queryId: string;
  providerId: ProviderId;
  text: string;
  timestamp: number;
  durationMs: number;
  error?: string;
}

export interface QuerySession {
  query: Query;
  responses: Partial<Record<ProviderId, QueryResponse>>;
  status: 'pending' | 'in-progress' | 'completed' | 'error';
}
