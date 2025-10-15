/**
 * Error Boundary Component
 * Catches React errors and automatically creates notifications
 */

'use client';

import React from 'react';
import { vendorErrorTracker } from '@/lib/vendorErrorTracker';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error; resetError: () => void }>;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error Boundary caught an error:', error, errorInfo);
    
    // Track the error
    vendorErrorTracker.trackError({
      type: 'REACT_ERROR',
      code: 'ERROR_BOUNDARY',
      message: error.message,
      stack: error.stack,
      component: this.getComponentName(errorInfo),
      timestamp: new Date().toISOString(),
      metadata: {
        componentStack: errorInfo.componentStack,
        errorBoundary: true
      }
    });

    this.setState({ error, errorInfo });
  }

  private getComponentName(errorInfo: React.ErrorInfo): string | undefined {
    // Extract component name from component stack
    const stack = errorInfo.componentStack;
    if (!stack) return undefined;
    const match = stack.match(/in\s+(\w+)/);
    return match ? match[1] : undefined;
  }

  private resetError = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return <FallbackComponent error={this.state.error!} resetError={this.resetError} />;
      }

      // Default error UI
      return (
        <div className="flex flex-col items-center justify-center min-h-[200px] p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="text-center">
            <h2 className="text-lg font-semibold text-red-800 mb-2">
              Something went wrong
            </h2>
            <p className="text-red-600 mb-4">
              An error occurred in the vendor panel. The error has been reported to the admin team.
            </p>
            <button
              onClick={this.resetError}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Hook for functional components to track errors
export function useErrorTracker() {
  const trackError = React.useCallback((error: any, component?: string, action?: string) => {
    vendorErrorTracker.trackComponentError(
      component || 'Unknown Component',
      action || 'Unknown Action',
      error
    );
  }, []);

  const trackApiError = React.useCallback((operation: string, error: any) => {
    vendorErrorTracker.trackApiError(operation, error);
  }, []);

  return { trackError, trackApiError };
}
