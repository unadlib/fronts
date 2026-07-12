import { FrontsError, frontsErrorCodes, throwIfAborted } from '../errors.js';
import { createDomContainer } from './dom.js';
import { createShadowContainer } from './shadow.js';
import type {
  ContainerAdapter,
  ContainerPrepareContext,
  ContainerRequest,
  PreparedContainer,
} from './types.js';

function isRecord(value: unknown): value is Record<PropertyKey, unknown> {
  return typeof value === 'object' && value !== null;
}

function isElementNode(value: unknown): value is Element {
  return isRecord(value) && value.nodeType === 1;
}

function isMountTarget(value: unknown): boolean {
  return (
    isElementNode(value) || (isRecord(value) && value.nodeType === 11 && isElementNode(value.host))
  );
}

function assertPreparedContainer(
  value: unknown,
  expectedType: string,
): asserts value is PreparedContainer {
  if (
    !isRecord(value) ||
    value.type !== expectedType ||
    !isElementNode(value.element) ||
    !isMountTarget(value.target) ||
    typeof value.dispose !== 'function' ||
    (value.ownsElement !== undefined && typeof value.ownsElement !== 'boolean')
  ) {
    throw new FrontsError(
      frontsErrorCodes.containerFailed,
      `Container "${expectedType}" returned an invalid prepared container.`,
      {
        details: {
          expectedType,
          receivedType: isRecord(value) ? value.type : undefined,
        },
        phase: 'container',
      },
    );
  }
}

async function cleanupInvalidContainer(value: unknown): Promise<readonly unknown[]> {
  if (!isRecord(value)) {
    return [];
  }

  const errors: unknown[] = [];
  try {
    if (typeof value.dispose === 'function') {
      await Reflect.apply(value.dispose, value, []);
    }
  } catch (error) {
    errors.push(error);
  }

  try {
    if (
      value.ownsElement === true &&
      isElementNode(value.element) &&
      value.element.parentNode !== null
    ) {
      value.element.remove();
    }
  } catch (error) {
    errors.push(error);
  }
  return errors;
}

export class ContainerRegistry {
  readonly #adapters = new Map<string, ContainerAdapter>();

  constructor(adapters: readonly ContainerAdapter[] = []) {
    for (const adapter of adapters) {
      this.register(adapter);
    }
  }

  register<Request extends ContainerRequest>(adapter: ContainerAdapter<Request>): this {
    if (this.#adapters.has(adapter.type)) {
      throw new FrontsError(
        frontsErrorCodes.containerFailed,
        `A container adapter named "${adapter.type}" is already registered.`,
        { phase: 'container' },
      );
    }
    this.#adapters.set(adapter.type, adapter as ContainerAdapter);
    return this;
  }

  has(type: string): boolean {
    return this.#adapters.has(type);
  }

  async prepare<Request extends ContainerRequest>(
    context: ContainerPrepareContext<Request>,
  ): Promise<PreparedContainer> {
    const signal = context.signal;
    throwIfAborted(signal, 'container');
    const requestedType = context.request.type;
    const adapter = this.#adapters.get(requestedType);
    if (adapter === undefined) {
      throw new FrontsError(
        frontsErrorCodes.containerFailed,
        `No container adapter named "${requestedType}" is registered.`,
        { details: { type: requestedType }, phase: 'container' },
      );
    }

    try {
      const prepared: unknown = await adapter.prepare(context);
      try {
        assertPreparedContainer(prepared, requestedType);
        return prepared;
      } catch (error) {
        const cleanupErrors = await cleanupInvalidContainer(prepared);
        if (cleanupErrors.length > 0) {
          throw new FrontsError(
            frontsErrorCodes.containerFailed,
            `Container "${requestedType}" returned an invalid result and failed rollback.`,
            {
              cause: new AggregateError([error, ...cleanupErrors]),
              details: { cleanupFailureCount: cleanupErrors.length },
              phase: 'container',
            },
          );
        }
        throw error;
      }
    } catch (error) {
      throwIfAborted(signal, 'container');
      if (error instanceof FrontsError) {
        throw error;
      }
      throw new FrontsError(
        frontsErrorCodes.containerFailed,
        `Container "${requestedType}" failed to prepare.`,
        { cause: error, phase: 'container' },
      );
    }
  }
}

export function createContainerRegistry(
  adapters: readonly ContainerAdapter[] = [createDomContainer(), createShadowContainer()],
): ContainerRegistry {
  return new ContainerRegistry(adapters);
}
