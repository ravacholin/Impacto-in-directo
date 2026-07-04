import React from 'react';
import { ErrorScreen } from './Shared';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

// Catches render-time exceptions so a crash shows a recovery screen instead of a
// blank page (important for the offline-first PWA).
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: unknown) {
    console.error('Uncaught error in render tree:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <ErrorScreen
          error="Se produjo un fallo inesperado. Reiniciá la aplicación."
          onRetry={() => window.location.reload()}
        />
      );
    }
    return this.props.children;
  }
}
