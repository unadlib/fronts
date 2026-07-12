import type { ApplicationIdentity, ServiceKey } from '../app/index.js';
import type { NormalizedAppRef, ResolvedApp } from '../resolver/index.js';

export const FRONTS_IFRAME_PROTOCOL = 'fronts.iframe' as const;
export const FRONTS_IFRAME_PROTOCOL_VERSION = 1 as const;

export interface IframeConnectMessage<Source = unknown, Props = unknown> {
  readonly protocol: typeof FRONTS_IFRAME_PROTOCOL;
  readonly protocolVersion: typeof FRONTS_IFRAME_PROTOCOL_VERSION;
  readonly type: 'connect';
  readonly channelId: string;
  readonly identity: ApplicationIdentity;
  readonly ref: NormalizedAppRef;
  readonly resolved: ResolvedApp<Source>;
  readonly props: Props;
  readonly capabilities: readonly string[];
}

export interface SerializedIframeError {
  readonly name: string;
  readonly message: string;
  readonly code?: string;
  readonly phase?: string;
}

export interface IframeServiceCall {
  readonly capability: string;
  readonly method: string;
  readonly args: readonly unknown[];
}

export function createIframeConnectMessage<
  Source,
  Props,
  Services extends object = object,
>(options: {
  readonly channelId: string;
  readonly identity: ApplicationIdentity;
  readonly ref: NormalizedAppRef;
  readonly resolved: ResolvedApp<Source>;
  readonly props: Props;
  readonly capabilities: readonly ServiceKey<Services>[];
}): IframeConnectMessage<Source, Props> {
  return {
    capabilities: options.capabilities,
    channelId: options.channelId,
    identity: options.identity,
    props: options.props,
    protocol: FRONTS_IFRAME_PROTOCOL,
    protocolVersion: FRONTS_IFRAME_PROTOCOL_VERSION,
    ref: options.ref,
    resolved: options.resolved,
    type: 'connect',
  };
}

export function isIframeConnectMessage(value: unknown): value is IframeConnectMessage {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const message = value as Partial<IframeConnectMessage>;
  return (
    message.protocol === FRONTS_IFRAME_PROTOCOL &&
    message.protocolVersion === FRONTS_IFRAME_PROTOCOL_VERSION &&
    message.type === 'connect' &&
    typeof message.channelId === 'string' &&
    message.channelId !== '' &&
    typeof message.identity === 'object' &&
    message.identity !== null &&
    typeof message.resolved === 'object' &&
    message.resolved !== null &&
    Array.isArray(message.capabilities)
  );
}

export function serializeIframeError(error: unknown): SerializedIframeError {
  if (error instanceof Error) {
    const candidate = error as Error & { code?: unknown; phase?: unknown };
    return {
      message: error.message,
      name: error.name,
      ...(typeof candidate.code === 'string' ? { code: candidate.code } : {}),
      ...(typeof candidate.phase === 'string' ? { phase: candidate.phase } : {}),
    };
  }
  return { message: String(error), name: 'Error' };
}
