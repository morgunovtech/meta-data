import React, { Component, ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  details?: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, details: error?.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('app-error', error, info);
  }

  handleReset = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <h1>Something went wrong</h1>
          <p>{this.state.details ?? 'Unexpected error.'}</p>
          <button type="button" onClick={this.handleReset}>
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

