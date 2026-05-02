import React from 'react';
import { Alert, Button, Container, Typography } from '@mui/material';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

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
        <Container maxWidth="sm" sx={{ mt: 8, textAlign: 'center' }}>
          <Typography variant="h4" gutterBottom>
            Something went wrong
          </Typography>
          <Alert severity="error" sx={{ mb: 2 }}>
            {this.state.error?.message || 'An unexpected error occurred'}
          </Alert>
          <Button variant="contained" onClick={this.handleReset}>
            Return to Dashboard
          </Button>
        </Container>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;