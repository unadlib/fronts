/**
 * The host service surface a shell defines for its applications.
 *
 * Documentation examples reference this contract by name instead of redeclaring it, so a reader
 * sees the Fronts call being explained rather than the shell scaffolding around it.
 */
interface HostServices {
  readonly navigation: { go(path: string): void };
  readonly telemetry: { emit(name: string, data?: unknown): void };
}

declare const telemetry: HostServices['telemetry'];
