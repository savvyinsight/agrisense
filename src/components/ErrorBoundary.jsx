import React from 'react';
import { Alert, Box, Button, Container, Typography } from '@mui/material';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
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