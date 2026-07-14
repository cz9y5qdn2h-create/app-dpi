import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { HelmetProvider } from 'react-helmet-async';
import './i18n';
import App from './App';
import ThemeProvider from './context/ThemeContext';
import { installGlobalErrorHandlers } from './lib/errorJournal';
import './index.css';
import './styles/liquid-glass.css';

installGlobalErrorHandlers();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      staleTime: 30000,
      refetchOnWindowFocus: false
    },
    mutations: { retry: 0 }
  }
});

function ThemedToaster() {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        style: {
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(20px)',
          color: 'rgb(var(--text-primary))',
          border: '1px solid var(--border-default)',
          borderRadius: '10px',
          fontFamily: 'Geist, sans-serif',
          fontSize: '14px',
          boxShadow: 'var(--glass-shadow)',
        },
        success: { iconTheme: { primary: 'rgb(var(--gold))', secondary: 'transparent' } },
        error:   { iconTheme: { primary: 'rgb(var(--danger))', secondary: 'transparent' } },
      }}
    />
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <BrowserRouter>
            <App />
            <ThemedToaster />
          </BrowserRouter>
        </ThemeProvider>
      </QueryClientProvider>
    </HelmetProvider>
  </React.StrictMode>
);
