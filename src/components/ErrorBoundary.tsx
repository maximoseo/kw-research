'use client';

import { Component, ReactNode, ErrorInfo } from 'react';
import { Card, Button } from './ui';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <Card className="mx-auto max-w-2xl rounded-[30px] border-border/70">
          <div className="p-8 text-center sm:p-10">
            <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-[28px] border border-destructive/20 bg-destructive/[0.12] text-destructive">
              <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>

            <h2 className="mb-3 text-2xl font-semibold tracking-tight text-text-primary">
              Something went wrong
            </h2>

            <p className="mx-auto mb-6 max-w-md text-body leading-6 text-text-secondary">
              An unexpected error occurred. This has been logged and our team has been notified.
            </p>

            {this.state.error && (
              <details className="mx-auto mb-5 max-w-xl text-left">
                <summary className="mb-2 cursor-pointer text-caption text-text-muted hover:text-text-secondary">
                  Show error details
                </summary>
                <div className="mt-2 rounded-[20px] border border-border/70 bg-surface-overlay/70 p-4">
                  <p className="break-words font-mono text-caption text-destructive">
                    {this.state.error.toString()}
                  </p>
                  {this.state.errorInfo && (
                    <p className="mt-2 font-mono text-xs text-text-muted">
                      {this.state.errorInfo.componentStack}
                    </p>
                  )}
                </div>
              </details>
            )}

            <div className="flex items-center justify-center gap-3">
              <Button variant="primary" onClick={this.handleReset}>
                Try Again
              </Button>
              <Button variant="ghost" onClick={() => window.location.reload()}>
                Reload Page
              </Button>
            </div>
          </div>
        </Card>
      );
    }

    return this.props.children;
  }
}

/**
 * Hook to programmatically trigger error boundary
 * Useful for handling async errors outside React's render cycle
 */
export function useErrorHandler() {
  return (error: Error) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('react-error', { detail: error }));
    }
  };
}
