import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace(/\/$/, '') + '/api'
  : '';

const api = axios.create({
  baseURL: API_BASE || '/api',
  timeout: 60000,
  headers: { 'Content-Type': 'application/json' }
});

// Injecter le token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = 'Bearer ' + token;
  return config;
});

// Gestion erreurs
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (!error.response) {
      // Erreur reseau - backend inaccessible
      return Promise.reject(new Error('Le serveur est inaccessible. Verifiez votre connexion.'));
    }
    const status = error.response.status;
    const msg = error.response.data?.error || error.message;

    if (status === 401) {
      localStorage.removeItem('access_token');
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
      return Promise.reject(new Error('Session expiree, reconnectez-vous.'));
    }
    if (status === 403) return Promise.reject(new Error('Acces refuse.'));
    if (status === 404) return Promise.reject(new Error('Ressource introuvable.'));
    if (status >= 500) return Promise.reject(new Error('Erreur serveur: ' + msg));

    return Promise.reject(new Error(msg));
  }
);

export default api;
