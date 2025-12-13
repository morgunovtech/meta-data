import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { I18nProvider } from './i18n';
import { ThemeProvider } from './theme';
import { ErrorBoundary } from './components/ErrorBoundary';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider>
      <I18nProvider>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </I18nProvider>
    </ThemeProvider>
  </React.StrictMode>
);
