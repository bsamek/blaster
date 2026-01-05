import type { ProviderId, ProviderStatus } from './providers';
import type { QuerySession } from './query';

export type MessageType =
  | 'SUBMIT_QUERY'
  | 'RESPONSE_RECEIVED'
  | 'RESPONSE_ERROR'
  | 'GET_PROVIDER_STATUS'
  | 'PROVIDER_STATUS_UPDATE'
  | 'SESSION_UPDATE'
  | 'PING';

export interface BaseMessage<T extends MessageType, P = unknown> {
  type: T;
  payload: P;
  timestamp: number;
}

export interface SubmitQueryMessage extends BaseMessage<'SUBMIT_QUERY', {
  queryId?: string;
  text: string;
  providers: ProviderId[];
  newChat?: boolean;
}> {}

export interface ResponseReceivedMessage extends BaseMessage<'RESPONSE_RECEIVED', {
  queryId: string;
  providerId: ProviderId;
  text: string;
  durationMs: number;
}> {}

export interface ResponseErrorMessage extends BaseMessage<'RESPONSE_ERROR', {
  queryId: string;
  providerId: ProviderId;
  error: string;
}> {}

export interface ProviderStatusMessage extends BaseMessage<'PROVIDER_STATUS_UPDATE', {
  status: ProviderStatus;
}> {}

export interface SessionUpdateMessage extends BaseMessage<'SESSION_UPDATE', {
  session: QuerySession;
}> {}

export interface PingMessage extends BaseMessage<'PING', Record<string, never>> {}

export interface GetProviderStatusMessage extends BaseMessage<'GET_PROVIDER_STATUS', Record<string, never>> {}

export type ExtensionMessage =
  | SubmitQueryMessage
  | ResponseReceivedMessage
  | ResponseErrorMessage
  | ProviderStatusMessage
  | SessionUpdateMessage
  | PingMessage
  | GetProviderStatusMessage;
