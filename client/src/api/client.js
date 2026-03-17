import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

// Inject token from localStorage on every request
api.interceptors.request.use(config => {
  const token = localStorage.getItem('sentinel_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-redirect on expired token
api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401 && !err.config.url.includes('/auth/')) {
      localStorage.removeItem('sentinel_token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
