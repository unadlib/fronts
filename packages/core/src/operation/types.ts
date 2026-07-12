import type { ApplicationIdentity } from '../app/index.js';

export type HostOperationIntent = 'load' | 'mount' | 'preload' | 'replace' | 'resolve';

interface HostOperationContextBase {
  readonly hostId: string;
  readonly operationId: string;
  readonly signal: AbortSignal;
  readonly traceId?: string;
}

export interface DetachedHostOperationContext extends HostOperationContextBase {
  readonly intent: 'load' | 'preload' | 'resolve';
  readonly identity?: never;
}

export interface ApplicationHostOperationContext extends HostOperationContextBase {
  readonly identity: ApplicationIdentity;
  readonly intent: 'mount' | 'replace';
  readonly traceId: string;
}

export type HostOperationContext = ApplicationHostOperationContext | DetachedHostOperationContext;
