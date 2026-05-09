import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '@/App';
import './index.css';
import './i18n';
import ErrorBoundary from '@/shared/components/ErrorBoundary';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);