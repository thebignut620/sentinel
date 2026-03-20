import axios from 'axios';

const BASE = 'https://sentinel-production-7d11.up.railway.app/api';
console.log('[api] baseURL =', BASE);
const api = axios.create({ baseURL: BASE });

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
      window.dispatchEvent(new Event('sentinel:session-expired'));
    }
    return Promise.reject(err);
  }
);

export default api;
