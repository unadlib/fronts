import {
  FRONTS_IFRAME_PROTOCOL,
  FRONTS_IFRAME_PROTOCOL_VERSION,
  serializeIframeError,
  type SerializedIframeError,
} from './protocol.js';
import { FrontsError, createAbortedError, frontsErrorCodes } from '../errors.js';
import { assertIframeTimeout } from './validation.js';

interface RpcMessageBase {
  readonly protocol: typeof FRONTS_IFRAME_PROTOCOL;
  readonly protocolVersion: typeof FRONTS_IFRAME_PROTOCOL_VERSION;
  readonly channelId: string;
}

interface RpcRequestMessage extends RpcMessageBase {
  readonly type: 'request';
  readonly id: string;
  readonly method: string;
  readonly params: unknown;
}

interface RpcResponseMessage extends RpcMessageBase {
  readonly type: 'response';
  readonly id: string;
  readonly ok: boolean;
  readonly result?: unknown;
  readonly error?: SerializedIframeError;
}

interface RpcNotificationMessage extends RpcMessageBase {
  readonly type: 'notification';
  readonly method: string;
  readonly params: unknown;
}

interface RpcCancelMessage extends RpcMessageBase {
  readonly type: 'cancel';
  readonly id: string;
}

interface RpcCloseMessage extends RpcMessageBase {
  readonly type: 'close';
  readonly reason: string;
}

type RpcWireMessage =
  | RpcCancelMessage
  | RpcCloseMessage
  | RpcNotificationMessage
  | RpcRequestMessage
  | RpcResponseMessage;

export interface IframeRpcHandlerContext {
  readonly signal: AbortSignal;
}

export type IframeRpcHandler = (
  params: unknown,
  context: IframeRpcHandlerContext,
) => unknown | PromiseLike<unknown>;

export type IframeRpcNotificationListener = (params: unknown) => void;

export interface IframeRpcPeerOptions {
  readonly channelId: string;
  readonly requestTimeoutMs?: number;
  readonly idPrefix?: string;
}

interface PendingRequest {
  readonly resolve: (value: unknown) => void;
  readonly reject: (reason: unknown) => void;
  readonly timer: ReturnType<typeof setTimeout> | undefined;
  readonly unlinkAbort: () => void;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

function assertRpcMethod(method: unknown): asserts method is string {
  if (!isNonEmptyString(method) || method !== method.trim()) {
    throw new FrontsError(
      frontsErrorCodes.iframeProtocol,
      'An iframe RPC method must be a non-empty, trimmed string.',
    );
  }
}

function isSerializedIframeError(value: unknown): value is SerializedIframeError {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const error = value as Partial<SerializedIframeError>;
  return (
    typeof error.name === 'string' &&
    typeof error.message === 'string' &&
    (error.code === undefined || typeof error.code === 'string') &&
    (error.phase === undefined || typeof error.phase === 'string')
  );
}

function isRpcWireMessage(value: unknown, channelId: string): value is RpcWireMessage {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const message = value as Partial<RpcWireMessage>;
  if (
    message.protocol === FRONTS_IFRAME_PROTOCOL &&
    message.protocolVersion === FRONTS_IFRAME_PROTOCOL_VERSION &&
    message.channelId === channelId
  ) {
    switch (message.type) {
      case 'cancel':
        return isNonEmptyString(message.id);
      case 'close':
        return typeof message.reason === 'string';
      case 'notification':
        return isNonEmptyString(message.method);
      case 'request':
        return isNonEmptyString(message.id) && isNonEmptyString(message.method);
      case 'response':
        return (
          isNonEmptyString(message.id) &&
          typeof message.ok === 'boolean' &&
          (message.ok || message.error === undefined || isSerializedIframeError(message.error))
        );
    }
  }
  return false;
}

function deserializeIframeError(error: SerializedIframeError | undefined): Error {
  const result = new Error(error?.message ?? 'The iframe RPC request failed.');
  result.name = error?.name ?? 'IframeRemoteError';
  if (error?.code !== undefined) {
    Object.defineProperty(result, 'code', { enumerable: true, value: error.code });
  }
  if (error?.phase !== undefined) {
    Object.defineProperty(result, 'phase', { enumerable: true, value: error.phase });
  }
  return result;
}

export class IframeRpcPeer {
  readonly #port: MessagePort;
  readonly #channelId: string;
  readonly #requestTimeoutMs: number;
  readonly #idPrefix: string;
  readonly #handlers = new Map<string, IframeRpcHandler>();
  readonly #notifications = new Map<string, Set<IframeRpcNotificationListener>>();
  readonly #pending = new Map<string, PendingRequest>();
  readonly #inflight = new Map<string, AbortController>();
  #sequence = 0;
  #closed = false;

  constructor(port: MessagePort, options: IframeRpcPeerOptions) {
    if (!isNonEmptyString(options.channelId) || options.channelId !== options.channelId.trim()) {
      throw new FrontsError(
        frontsErrorCodes.iframeProtocol,
        'An iframe RPC channel id must be a non-empty, trimmed string.',
      );
    }
    this.#port = port;
    this.#channelId = options.channelId;
    this.#requestTimeoutMs = options.requestTimeoutMs ?? 10_000;
    assertIframeTimeout(this.#requestTimeoutMs, 'requestTimeoutMs');
    this.#idPrefix = options.idPrefix ?? 'rpc';
    this.#port.addEventListener('message', this.#onMessage);
    this.#port.start();
  }

  get closed(): boolean {
    return this.#closed;
  }

  handle(method: string, handler: IframeRpcHandler): () => void {
    this.#assertOpen();
    assertRpcMethod(method);
    if (typeof handler !== 'function') {
      throw new FrontsError(
        frontsErrorCodes.iframeProtocol,
        `The iframe RPC handler for "${method}" must be a function.`,
      );
    }
    if (this.#handlers.has(method)) {
      throw new FrontsError(
        frontsErrorCodes.iframeProtocol,
        `An iframe RPC handler for "${method}" is already registered.`,
      );
    }
    this.#handlers.set(method, handler);
    let active = true;
    return () => {
      if (!active) {
        return;
      }
      active = false;
      if (this.#handlers.get(method) === handler) {
        this.#handlers.delete(method);
      }
    };
  }

  on(method: string, listener: IframeRpcNotificationListener): () => void {
    this.#assertOpen();
    assertRpcMethod(method);
    if (typeof listener !== 'function') {
      throw new FrontsError(
        frontsErrorCodes.iframeProtocol,
        `The iframe RPC listener for "${method}" must be a function.`,
      );
    }
    const listeners = this.#notifications.get(method) ?? new Set();
    const registration: IframeRpcNotificationListener = (params) => listener(params);
    listeners.add(registration);
    this.#notifications.set(method, listeners);
    return () => {
      listeners.delete(registration);
      if (listeners.size === 0 && this.#notifications.get(method) === listeners) {
        this.#notifications.delete(method);
      }
    };
  }

  request<Result = unknown>(
    method: string,
    params?: unknown,
    options: { readonly signal?: AbortSignal; readonly timeoutMs?: number } = {},
  ): Promise<Result> {
    this.#assertOpen();
    assertRpcMethod(method);
    const id = `${this.#idPrefix}:${++this.#sequence}`;
    const timeoutMs = options.timeoutMs ?? this.#requestTimeoutMs;
    try {
      assertIframeTimeout(timeoutMs, 'timeoutMs');
    } catch (error) {
      return Promise.reject(error);
    }

    return new Promise<Result>((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const cancel = (reason: unknown) => {
        const pending = this.#pending.get(id);
        if (pending === undefined) {
          return;
        }
        this.#pending.delete(id);
        pending.unlinkAbort();
        if (pending.timer !== undefined) {
          clearTimeout(pending.timer);
        }
        try {
          this.#post({ id, type: 'cancel' });
        } catch {
          // The local request must still settle when the cancellation frame cannot be delivered.
        }
        reject(reason);
      };

      const abort = () => cancel(createAbortedError('mount', options.signal?.reason));
      if (options.signal?.aborted === true) {
        reject(createAbortedError('mount', options.signal.reason));
        return;
      }
      options.signal?.addEventListener('abort', abort, { once: true });
      const unlinkAbort = () => options.signal?.removeEventListener('abort', abort);

      if (timeoutMs > 0) {
        timer = setTimeout(() => {
          cancel(
            new FrontsError(
              frontsErrorCodes.rpcTimeout,
              `Iframe RPC method "${method}" timed out after ${timeoutMs}ms.`,
              { details: { method, timeoutMs } },
            ),
          );
        }, timeoutMs);
      }

      this.#pending.set(id, {
        reject,
        resolve: resolve as (value: unknown) => void,
        timer,
        unlinkAbort,
      });
      try {
        this.#post({ id, method, params, type: 'request' });
      } catch (error) {
        cancel(error);
      }
    });
  }

  notify(method: string, params?: unknown): void {
    this.#assertOpen();
    assertRpcMethod(method);
    this.#post({ method, params, type: 'notification' });
  }

  close(reason: unknown = 'Iframe RPC channel closed'): void {
    this.#close(reason, true);
  }

  #close(reason: unknown, notifyRemote: boolean): void {
    if (this.#closed) {
      return;
    }
    let description = 'Iframe RPC channel closed';
    try {
      description = String(reason);
    } catch {
      // Closing must continue even if a caller supplied a hostile reason value.
    }
    if (notifyRemote) {
      try {
        this.#post({ reason: description, type: 'close' });
      } catch {
        // The local peer still owns and must release all of its resources.
      }
    }
    this.#closed = true;
    this.#port.removeEventListener('message', this.#onMessage);
    this.#port.close();

    const error = new FrontsError(frontsErrorCodes.rpcClosed, description);
    for (const pending of this.#pending.values()) {
      pending.unlinkAbort();
      if (pending.timer !== undefined) {
        clearTimeout(pending.timer);
      }
      pending.reject(error);
    }
    this.#pending.clear();
    for (const controller of this.#inflight.values()) {
      controller.abort(reason);
    }
    this.#inflight.clear();
    this.#handlers.clear();
    this.#notifications.clear();
  }

  readonly #onMessage = (event: MessageEvent<unknown>): void => {
    if (!isRpcWireMessage(event.data, this.#channelId) || this.#closed) {
      return;
    }
    const message = event.data;
    switch (message.type) {
      case 'request':
        void this.#handleRequest(message).catch((error: unknown) => {
          try {
            this.#close(error, true);
          } catch {
            // A fire-and-forget request dispatch must never create an unhandled rejection.
          }
        });
        break;
      case 'response':
        this.#handleResponse(message);
        break;
      case 'notification':
        for (const listener of this.#notifications.get(message.method) ?? []) {
          try {
            listener(message.params);
          } catch {
            // One notification observer must not block the remaining listeners or RPC traffic.
          }
        }
        break;
      case 'cancel':
        this.#inflight.get(message.id)?.abort('Remote request cancelled');
        break;
      case 'close':
        this.#close(message.reason, false);
        break;
    }
  };

  async #handleRequest(message: RpcRequestMessage): Promise<void> {
    if (this.#inflight.has(message.id)) {
      return;
    }
    const handler = this.#handlers.get(message.method);
    if (handler === undefined) {
      this.#post({
        error: serializeIframeError(
          new FrontsError(
            frontsErrorCodes.iframeProtocol,
            `No iframe RPC handler is registered for "${message.method}".`,
          ),
        ),
        id: message.id,
        ok: false,
        type: 'response',
      });
      return;
    }

    const controller = new AbortController();
    this.#inflight.set(message.id, controller);
    try {
      const result = await handler(message.params, { signal: controller.signal });
      if (!controller.signal.aborted && !this.#closed) {
        this.#post({ id: message.id, ok: true, result, type: 'response' });
      }
    } catch (error) {
      if (!this.#closed) {
        this.#post({
          error: serializeIframeError(error),
          id: message.id,
          ok: false,
          type: 'response',
        });
      }
    } finally {
      this.#inflight.delete(message.id);
    }
  }

  #handleResponse(message: RpcResponseMessage): void {
    const pending = this.#pending.get(message.id);
    if (pending === undefined) {
      return;
    }
    this.#pending.delete(message.id);
    pending.unlinkAbort();
    if (pending.timer !== undefined) {
      clearTimeout(pending.timer);
    }
    if (message.ok) {
      pending.resolve(message.result);
    } else {
      pending.reject(deserializeIframeError(message.error));
    }
  }

  #post(
    message:
      | Omit<RpcCancelMessage, keyof RpcMessageBase>
      | Omit<RpcCloseMessage, keyof RpcMessageBase>
      | Omit<RpcNotificationMessage, keyof RpcMessageBase>
      | Omit<RpcRequestMessage, keyof RpcMessageBase>
      | Omit<RpcResponseMessage, keyof RpcMessageBase>,
  ): void {
    this.#assertOpen();
    this.#port.postMessage({
      ...message,
      channelId: this.#channelId,
      protocol: FRONTS_IFRAME_PROTOCOL,
      protocolVersion: FRONTS_IFRAME_PROTOCOL_VERSION,
    } satisfies RpcWireMessage);
  }

  #assertOpen(): void {
    if (this.#closed) {
      throw new FrontsError(frontsErrorCodes.rpcClosed, 'The iframe RPC channel is closed.');
    }
  }
}
