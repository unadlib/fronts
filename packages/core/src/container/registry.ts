import { FrontsError, frontsErrorCodes, throwIfAborted } from '../errors.js';
import { createDomContainer } from './dom.js';
import { createShadowContainer } from './shadow.js';
import type {
  ContainerAdapter,
  ContainerPrepareContext,
  ContainerRequest,
  PreparedContainer,
} from './types.js';

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
    throwIfAborted(context.signal, 'container');
    const adapter = this.#adapters.get(context.request.type);
    if (adapter === undefined) {
      throw new FrontsError(
        frontsErrorCodes.containerFailed,
        `No container adapter named "${context.request.type}" is registered.`,
        { details: { type: context.request.type }, phase: 'container' },
      );
    }

    try {
      return await adapter.prepare(context);
    } catch (error) {
      throwIfAborted(context.signal, 'container');
      if (error instanceof FrontsError) {
        throw error;
      }
      throw new FrontsError(
        frontsErrorCodes.containerFailed,
        `Container "${context.request.type}" failed to prepare.`,
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
