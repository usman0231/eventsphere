import axios from 'axios';
import { toast } from 'react-toastify';

// In production the client is served by the same Express server (SERVE_CLIENT),
// so use a relative base URL (same origin). In dev, talk to the local API.
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5000')
});

api.interceptors.request.use(config => {
  const token = localStorage.getItem('es_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  res => res,
  err => {
    const status = err.response?.status;
    const message = err.response?.data?.message || '';

    if (status === 401) {
      localStorage.removeItem('es_token');
      if (window.location.pathname !== '/login') window.location.href = '/login';
    } else if (status === 403 && /suspend/i.test(message)) {
      // Server says this account is suspended — kick out
      localStorage.removeItem('es_token');
      toast.error(message);
      setTimeout(() => { window.location.href = '/login'; }, 1500);
    } else if (status === 403) {
      toast.error(message || "You don't have permission to do that.");
    }
    return Promise.reject(err);
  }
);

export default api;