import React, { createContext, useEffect, useState } from 'react';
import axios from '../api/axios';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (token) {
      persistAuth(token, user);
      if (!user) {
        axios.get('/auth/me')
          .then((res) => {
            if (res.data.success) {
              persistAuth(token, res.data.user);
              setUser(res.data.user);
            } else {
              persistAuth(null, null);
              setToken(null);
              setUser(null);
            }
          })
          .catch(() => {
            persistAuth(null, null);
            setToken(null);
            setUser(null);
          })
          .finally(() => setInitialized(true));
      } else {
        setInitialized(true);
      }
    } else {
      persistAuth(null, null);
      setUser(null);
      setInitialized(true);
    }
  }, [token, user]);

  useEffect(() => {
    function handleUnauthorized() {
      persistAuth(null, null);
      setToken(null);
      setUser(null);
    }
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, []);

  useEffect(() => {
    if (!token) return undefined;
    // Poll session validity every 20s so a ban takes effect quickly even if the
    // user isn't actively triggering other requests.
    const interval = setInterval(() => {
      axios.get('/auth/me').catch(() => {});
    }, 20000);
    return () => clearInterval(interval);
  }, [token]);

  function persistAuth(nextToken, nextUser) {
    if (nextToken) {
      axios.setAuthToken(nextToken);
      localStorage.setItem('token', nextToken);
    } else {
      axios.setAuthToken(null);
      localStorage.removeItem('token');
    }

    if (nextUser) {
      localStorage.setItem('user', JSON.stringify(nextUser));
    } else {
      localStorage.removeItem('user');
    }
  }

  async function login(username, password) {
    try {
      const res = await axios.post('/auth/login', { username, password });
      if (res.data.success && res.data.requires2FA) {
        return { ok: false, requires2FA: true, userId: res.data.userId, message: res.data.message };
      }
      if (res.data.success) {
        persistAuth(res.data.token, res.data.user);
        setToken(res.data.token);
        setUser(res.data.user);
        return { ok: true };
      }
      return { ok: false, error: res.data.error || 'Login failed' };
    } catch (err) {
      const data = err.response?.data;
      if (data?.requiresEmailVerification) {
        return { ok: false, requiresEmailVerification: true, email: data.email, error: data.error };
      }
      return { ok: false, error: data?.error || err.message || 'Login failed' };
    }
  }

  async function completeTwoFactor(userId, code) {
    try {
      const res = await axios.post('/auth/login/verify-2fa', { userId, code });
      if (res.data.success) {
        persistAuth(res.data.token, res.data.user);
        setToken(res.data.token);
        setUser(res.data.user);
        return { ok: true };
      }
      return { ok: false, error: res.data.error || 'Verification failed' };
    } catch (err) {
      return { ok: false, error: err.response?.data?.error || err.message || 'Verification failed' };
    }
  }

  async function register(formData) {
    try {
      const res = await axios.post('/auth/register', formData);
      if (res.data.success && res.data.requiresEmailVerification) {
        return { ok: false, requiresEmailVerification: true, email: res.data.email, message: res.data.message };
      }
      if (res.data.success) {
        persistAuth(res.data.token, res.data.user);
        setToken(res.data.token);
        setUser(res.data.user);
        return { ok: true };
      }
      return { ok: false, error: res.data.error || 'Register failed' };
    } catch (err) {
      return { ok: false, error: err.response?.data?.error || err.message || 'Register failed' };
    }
  }

  async function completeEmailVerification(email, code) {
    try {
      const res = await axios.post('/auth/verify-email/code', { email, code });
      if (res.data.success) {
        persistAuth(res.data.token, res.data.user);
        setToken(res.data.token);
        setUser(res.data.user);
        return { ok: true };
      }
      return { ok: false, error: res.data.error || 'Verification failed' };
    } catch (err) {
      return { ok: false, error: err.response?.data?.error || err.message || 'Verification failed' };
    }
  }

  async function resendEmailVerificationCode(email) {
    try {
      const res = await axios.post('/auth/verify-email', { email });
      return { ok: !!res.data.success, error: res.data.error };
    } catch (err) {
      return { ok: false, error: err.response?.data?.error || err.message || 'Failed to resend code' };
    }
  }

  function logout() {
    persistAuth(null, null);
    setToken(null);
    setUser(null);
  }

  function updateUser(nextUser) {
    setUser(prev => {
      const updated = { ...(prev || {}), ...(nextUser || {}) };
      localStorage.setItem('user', JSON.stringify(updated));
      return updated;
    });
  }

  return (
    <AuthContext.Provider value={{ user, token, initialized, login, completeTwoFactor, register, completeEmailVerification, resendEmailVerificationCode, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export default AuthContext;
