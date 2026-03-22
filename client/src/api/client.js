import axios from 'axios';

const BASE = 'https://sentinel-production-7d11.up.railway.app/api';
const api = axios.create({ baseURL: BASE });

// Inject access token on every request
api.interceptors.request.use(config => {
  const token = localStorage.getItem('sentinel_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ─── Refresh token logic ───────────────────────────────────────────────────────
let isRefreshing = false;
let refreshQueue = []; // callbacks waiting for the new token

function drainQueue(newToken) {
  refreshQueue.forEach(cb => cb(newToken));
  refreshQueue = [];
}

async function tryRefresh() {
  const refreshToken = localStorage.getItem('sentinel_refresh_token');
  if (!refreshToken) return null;
  try {
    const { data } = await axios.post(`${BASE}/auth/refresh`, { refreshToken });
    localStorage.setItem('sentinel_token', data.token);
    return data.token;
  } catch {
    localStorage.removeItem('sentinel_token');
    localStorage.removeItem('sentinel_refresh_token');
    return null;
  }
}

// Auto-store refresh token from any auth response (login, signup)
api.interceptors.response.use(
  res => {
    if (res.data?.refreshToken) {
      localStorage.setItem('sentinel_refresh_token', res.data.refreshToken);
    }
    return res;
  },
  async err => {
    const original = err.config;

    // Only attempt refresh on 401s from non-auth endpoints, once per request
    if (
      err.response?.status === 401 &&
      !original._retried &&
      !original.url?.includes('/auth/')
    ) {
      original._retried = true;

      if (isRefreshing) {
        // Queue this request until the in-flight refresh completes
        return new Promise((resolve, reject) => {
          refreshQueue.push(token => {
            if (!token) return reject(err);
            original.headers.Authorization = `Bearer ${token}`;
            resolve(api(original));
          });
        });
      }

      isRefreshing = true;
      const newToken = await tryRefresh();
      isRefreshing = false;

      if (newToken) {
        drainQueue(newToken);
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      }

      drainQueue(null);
      window.dispatchEvent(new Event('sentinel:session-expired'));
    }

    return Promise.reject(err);
  }
);

// ─── Railway keep-alive — ping every 4 minutes to prevent cold starts ─────────
// Railway free tier sleeps after ~5 min of inactivity; this keeps the server warm.
if (typeof window !== 'undefined') {
  const ping = () => fetch(`${BASE}/ping`).catch(() => {});
  ping(); // ping on load
  setInterval(ping, 4 * 60 * 1000); // then every 4 minutes
}

export default api;
