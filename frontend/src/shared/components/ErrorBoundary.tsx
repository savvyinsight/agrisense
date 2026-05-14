import React from 'react';

interface ErrorBoundaryState { hasError: boolean; error: Error | null }

class ErrorBoundary extends React.Component<React.PropsWithChildren<{}>, ErrorBoundaryState> {
  constructor(props: React.PropsWithChildren<{}>) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-surface-base flex items-center justify-center p-4">
          <div className="text-center max-w-sm">
            <span className="text-4xl block mb-4">⚠</span>
            <h2 className="text-lg font-bold text-text-primary mb-2">Something went wrong</h2>
            <div className="bg-critical-bg border border-critical/30 text-critical text-sm p-3 rounded-lg mb-4">
              {this.state.error?.message || 'An unexpected error occurred'}
            </div>
            <button onClick={this.handleReset} className="px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-medium transition-colors">
              Return to Dashboard
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
