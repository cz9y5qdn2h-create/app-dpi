import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import App from './App';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30000, refetchOnWindowFocus: true, refetchOnReconnect: true },
    mutations: { retry: 0 }
  }
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#141414', color: '#F4F2EE',
              border: '1px solid rgba(200,169,110,0.25)',
              borderRadius: '8px', fontFamily: 'DM Sans, sans-serif', fontSize: '14px',
            },
            success: { duration: 3000, iconTheme: { primary: '#C8A96E', secondary: '#080808' } },
            error: { duration: 6000, iconTheme: { primary: '#ef4444', secondary: '#080808' }, style: { border: '1px solid rgba(239,68,68,0.3)' } },
          }}
        />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
