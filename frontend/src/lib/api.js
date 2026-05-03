import axios from 'axios';
import { createClient } from '@supabase/supabase-js';

const API_BASE = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace(/\/$/, '') + '/api'
  : '';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://xlfycuhmbnzeofgnleof.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhsZnljdWhtYm56ZW9mZ25sZW9mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5OTY1MTAsImV4cCI6MjA5MTU3MjUxMH0.NcLXD5xzgokCnKcZv0laDMDP7ixrMqZvJNuCNQXLt3s';

const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const api = axios.create({
  baseURL: API_BASE || '/api',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' }
});

let isRedirectingTo401 = false;

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = 'Bearer ' + token;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (!error.response) {
      return Promise.reject(new Error('Le serveur est inaccessible. Verifiez votre connexion.'));
    }
    const status = error.response.status;
    const raw = error.response.data?.error ?? error.response.data?.message ?? error.message;
    const msg = typeof raw === 'string' ? raw : (raw?.message ?? JSON.stringify(raw) ?? 'Erreur inconnue');

    if (status === 401) {
      if (!isRedirectingTo401) {
        isRedirectingTo401 = true;
        localStorage.removeItem('access_token');
        try { await supabaseAuth.auth.signOut(); } catch {}
        if (!window.location.pathname.includes('/login')) {
          window.location.href = '/login';
        }
      }
      return Promise.reject(new Error('Session expirée, reconnectez-vous.'));
    }
    if (status === 403) return Promise.reject(new Error('Accès refusé.'));
    if (status === 404) return Promise.reject(new Error('Ressource introuvable.'));
    if (status >= 500) return Promise.reject(new Error(msg));

    return Promise.reject(new Error(msg));
  }
);

export default api;
