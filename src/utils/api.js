import axios from 'axios';
import { toast } from 'react-toastify';

// Next.js serves the API at /api on the same origin in both dev and prod,
// so a relative base URL works everywhere. NEXT_PUBLIC_API_URL can override it.
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || ''
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