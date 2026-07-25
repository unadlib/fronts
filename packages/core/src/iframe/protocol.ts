import type { ApplicationIdentity, ServiceKey } from '../app/index.js';
import { stringifyUnknown } from '../errors.js';
import type { NormalizedAppRef, ResolvedApp } from '../resolver/index.js';

export const FRONTS_IFRAME_PROTOCOL = 'fronts.iframe' as const;
export const FRONTS_IFRAME_PROTOCOL_VERSION = 1 as const;

const forbiddenCapabilityNames = new Set(['__proto__', 'constructor', 'prototype']);

export function parseIframeCapabilities(value: unknown, label: string): readonly string[] {
  if (!Array.isArray(value)) {
    throw new TypeError(`${label} must be an array of capability names.`);
  }

  const capabilities = new Set<string>();
  for (const capability of value as unknown[]) {
    if (
      typeof capability !== 'string' ||
      capability.length === 0 ||
      forbiddenCapabilityNames.has(capability)
    ) {
      throw new TypeError(
        `${label} contains invalid capability "${stringifyUnknown(capability)}".`,
      );
    }
    capabilities.add(capability);
  }
  return Object.freeze([...capabilities]);
}

export interface IframeConnectMessage<Source = unknown, Props = unknown> {
  readonly protocol: typeof FRONTS_IFRAME_PROTOCOL;
  readonly protocolVersion: typeof FRONTS_IFRAME_PROTOCOL_VERSION;
  readonly type: 'connect';
  readonly channelId: string;
  readonly identity: ApplicationIdentity;
  readonly ref: NormalizedAppRef;
  readonly resolved: ResolvedApp<Source>;
  readonly props: Props;
  /** Parent-authorized offer derived from its configured maximum, not the session's final grant. */
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
    capabilities: parseIframeCapabilities(options.capabilities, 'Iframe host capabilities'),
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
  const validShape =
    message.protocol === FRONTS_IFRAME_PROTOCOL &&
    message.protocolVersion === FRONTS_IFRAME_PROTOCOL_VERSION &&
    message.type === 'connect' &&
    typeof message.channelId === 'string' &&
    message.channelId !== '' &&
    typeof message.identity === 'object' &&
    message.identity !== null &&
    typeof message.resolved === 'object' &&
    message.resolved !== null;
  if (!validShape) {
    return false;
  }
  try {
    parseIframeCapabilities(message.capabilities, 'Iframe connect capabilities');
    return true;
  } catch {
    return false;
  }
}

function readStringProperty(value: object, property: PropertyKey): string | undefined {
  try {
    const result = Reflect.get(value, property) as unknown;
    return typeof result === 'string' ? result : undefined;
  } catch {
    return undefined;
  }
}

function stringifyError(value: unknown): string {
  try {
    return String(value);
  } catch {
    return 'An unknown iframe error occurred.';
  }
}

export function serializeIframeError(error: unknown): SerializedIframeError {
  if ((typeof error === 'object' && error !== null) || typeof error === 'function') {
    const message = readStringProperty(error, 'message') ?? stringifyError(error);
    const name = readStringProperty(error, 'name') ?? 'Error';
    const code = readStringProperty(error, 'code');
    const phase = readStringProperty(error, 'phase');
    return {
      message,
      name,
      ...(code === undefined ? {} : { code }),
      ...(phase === undefined ? {} : { phase }),
    };
  }
  return { message: stringifyError(error), name: 'Error' };
}
