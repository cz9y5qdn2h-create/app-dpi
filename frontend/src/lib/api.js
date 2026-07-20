import axios from 'axios';
import { supabase as supabaseAuth } from './supabase';

const API_BASE = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace(/\/$/, '') + '/api'
  : '';

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
    if (status === 403) return Promise.reject(new Error(msg));
    if (status === 404) return Promise.reject(new Error(msg));
    if (status >= 500) return Promise.reject(new Error(msg));

    return Promise.reject(new Error(msg));
  }
);

export default api;
