import React, { createContext, useEffect, useRef, useState } from 'react';
import axios from '../api/axios';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [initialized, setInitialized] = useState(false);
  const initialAuthRef = useRef({ token, user });

  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      try {
        const { token: initialToken, user: initialUser } = initialAuthRef.current;
        if (!initialToken) {
          persistAuth(null, null);
          setUser(null);
          return;
        }

        persistAuth(initialToken, initialUser);

        try {
          const refreshedToken = await axios.refreshAccessToken();
          if (cancelled) return;
          setToken(refreshedToken);

          const refreshedUser = JSON.parse(localStorage.getItem('user') || 'null');
          if (refreshedUser) setUser(refreshedUser);
          return;
        } catch (_) {
          // The refresh cookie can be absent on older sessions or cross-origin
          // deployments. Fall back to the stored access token before clearing.
        }

        try {
          const res = await axios.get('/auth/me');
          if (cancelled) return;
          if (res.data.success) {
            persistAuth(initialToken, res.data.user);
            setUser(res.data.user);
            return;
          }
        } catch (_) {
          if (cancelled) return;
          persistAuth(null, null);
          setToken(null);
          setUser(null);
        }
      } finally {
        if (!cancelled) setInitialized(true);
      }
    }

    restoreSession();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (token) {
      persistAuth(token, user);
    } else {
      persistAuth(null, null);
      setUser(null);
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
        return {
          ok: false,
          requires2FA: true,
          userId: res.data.userId,
          message: res.data.message,
          canResend: !!res.data.canResend,
          verificationSent: res.data.verificationSent !== false
        };
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
      if (data?.canResend && data?.userId) {
        return { ok: false, canResend: true, userId: data.userId, error: data.error };
      }
      return { ok: false, error: data?.error || err.message || 'Login failed' };
    }
  }

  async function resendTwoFactorCode(userId) {
    try {
      const res = await axios.post('/auth/login/resend-2fa', { userId });
      if (res.data.success) return { ok: true, message: res.data.message };
      return { ok: false, error: res.data.error };
    } catch (err) {
      return { ok: false, error: err.response?.data?.error || err.message };
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

  async function logout() {
    try { await axios.post('/auth/logout'); } catch (_) { /* local logout still succeeds */ }
    persistAuth(null, null);
    setToken(null);
    setUser(null);
  }

  async function logoutEverywhere() {
    try { await axios.post('/auth/logout-everywhere'); } finally {
      persistAuth(null, null);
      setToken(null);
      setUser(null);
    }
  }

  function updateUser(nextUser) {
    setUser(prev => {
      const updated = { ...(prev || {}), ...(nextUser || {}) };
      localStorage.setItem('user', JSON.stringify(updated));
      return updated;
    });
  }

  return (
    <AuthContext.Provider value={{ user, token, initialized, login, completeTwoFactor, resendTwoFactorCode, register, completeEmailVerification, resendEmailVerificationCode, logout, logoutEverywhere, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export default AuthContext;
