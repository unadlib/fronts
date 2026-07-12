import { Component, type ErrorInfo, type ReactNode } from 'react';

export interface ReactAppErrorBoundaryProps {
  readonly children?: ReactNode;
  readonly fallback?: ReactNode | ((error: Error) => ReactNode);
  readonly onError: (error: Error, info: ErrorInfo) => void;
}

interface ReactAppErrorBoundaryState {
  readonly error: Error | null;
}

export class ReactAppErrorBoundary extends Component<
  ReactAppErrorBoundaryProps,
  ReactAppErrorBoundaryState
> {
  override state: ReactAppErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ReactAppErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    this.props.onError(error, info);
  }

  override render(): ReactNode {
    if (this.state.error !== null) {
      return typeof this.props.fallback === 'function'
        ? this.props.fallback(this.state.error)
        : (this.props.fallback ?? null);
    }
    return this.props.children;
  }
}
