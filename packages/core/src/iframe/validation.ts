import { FrontsError, frontsErrorCodes } from '../errors.js';

export function assertIframeTimeout(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new FrontsError(
      frontsErrorCodes.iframeProtocol,
      `${label} must be a finite, non-negative duration.`,
    );
  }
}
