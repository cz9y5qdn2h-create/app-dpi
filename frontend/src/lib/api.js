import axios from 'axios';
import toast from 'react-hot-toast';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL
    ? `${import.meta.env.VITE_API_URL}/api`
    : '/api',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' }
});

// Injecter le token automatiquement
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Gestion erreurs globale
api.interceptors.response.use(
  (res) => res,
  (error) => {
    const msg = error.response?.data?.error || error.message || 'Erreur réseau';
    if (error.response?.status === 401) {
      localStorage.removeItem('access_token');
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(new Error(msg));
  }
);

export default api;
