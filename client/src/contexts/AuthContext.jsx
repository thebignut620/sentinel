import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('sentinel_token');
    if (token) {
      api.get('/auth/me')
        .then(res => setUser(res.data))
        .catch(() => localStorage.removeItem('sentinel_token'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password, totp_code) => {
    const res = await api.post('/auth/login', { email, password, totp_code });
    // 2FA required — not yet logged in
    if (res.data.requires_2fa) return { requires_2fa: true };
    localStorage.setItem('sentinel_token', res.data.token);
    const isNew = !localStorage.getItem('sentinel_welcomed');
    setUser({ ...res.data.user, _isNew: isNew });
    return { ...res.data.user, _isNew: isNew };
  };

  const loginWithToken = (token) => {
    localStorage.setItem('sentinel_token', token);
    // Fetch user data immediately
    api.get('/auth/me').then(res => setUser(res.data)).catch(() => {});
  };

  const logout = () => {
    localStorage.removeItem('sentinel_token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, loginWithToken, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
