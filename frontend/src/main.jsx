import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import App from './App';
import ThemeProvider, { useTheme } from './context/ThemeContext';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30000 },
    mutations: { retry: 0 }
  }
});

const DARK_THEMES = new Set(['nuit', 'azur', 'emeraude']);

function ThemedToaster() {
  const { theme } = useTheme();
  const dark = DARK_THEMES.has(theme);
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        style: {
          background: dark ? 'var(--glass-bg)' : 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(20px)',
          color: dark ? 'rgb(var(--text-primary))' : '#1a1825',
          border: '1px solid var(--border-default)',
          borderRadius: '10px',
          fontFamily: 'DM Sans, sans-serif',
          fontSize: '14px',
          boxShadow: 'var(--glass-shadow)',
        },
        success: { iconTheme: { primary: 'rgb(var(--gold))', secondary: 'transparent' } },
        error:   { iconTheme: { primary: '#ef4444', secondary: 'transparent' } },
      }}
    />
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <BrowserRouter>
          <App />
          <ThemedToaster />
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
