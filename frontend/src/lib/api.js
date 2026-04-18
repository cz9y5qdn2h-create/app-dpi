import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace(/\/$/, '') + '/api'
  : '';

const api = axios.create({
  baseURL: API_BASE || '/api',
  timeout: 90000,
  headers: { 'Content-Type': 'application/json' }
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = 'Bearer ' + token;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.code === 'ECONNABORTED') {
      return Promise.reject(new Error('Délai dépassé — le serveur met trop de temps à répondre. Réessayez.'));
    }
    if (!error.response) {
      return Promise.reject(new Error('Serveur inaccessible — vérifiez votre connexion internet.'));
    }
    const status = error.response.status;
    const msg = error.response.data?.error || error.response.data?.message || error.message;
    if (status === 401) {
      localStorage.removeItem('access_token');
      if (!window.location.pathname.includes('/login')) window.location.href = '/login';
      return Promise.reject(new Error('Session expirée — reconnectez-vous.'));
    }
    if (status === 403) return Promise.reject(new Error('Accès refusé.'));
    if (status === 404) return Promise.reject(new Error('Ressource introuvable.'));
    if (status === 409) return Promise.reject(new Error(msg || 'Conflit de données.'));
    if (status === 413) return Promise.reject(new Error('Fichier trop volumineux (max 15 Mo).'));
    if (status === 429) return Promise.reject(new Error('Trop de requêtes — attendez quelques minutes.'));
    if (status >= 500) return Promise.reject(new Error('Erreur serveur : ' + msg));
    return Promise.reject(new Error(msg || 'Erreur inconnue'));
  }
);

export default api;
