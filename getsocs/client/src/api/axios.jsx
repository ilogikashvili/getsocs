import axios from 'axios';

export function getApiBaseUrl() {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]') return 'http://localhost:3001/api';
    return `${window.location.origin}/api`;
  }
  return 'http://localhost:3001/api';
}

const API = getApiBaseUrl();
const storedToken = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
const instance = axios.create({ baseURL: API, withCredentials: true });
if (storedToken) instance.defaults.headers.common.Authorization = `Bearer ${storedToken}`;

const uploadBase = API.replace(/\/api\/?$/, '');
export function getUploadUrl(filename) {
  if (!filename) return '';
  const trimmedFilename = filename.startsWith('/') ? filename.slice(1) : filename;
  return `${uploadBase}/uploads/${trimmedFilename}`.replace(/([^:]\/)\/+/g, '$1');
}

instance.setAuthToken = (token) => {
  if (token) instance.defaults.headers.common.Authorization = `Bearer ${token}`;
  else delete instance.defaults.headers.common.Authorization;
};

let refreshPromise = null;
async function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = axios.post(`${API}/auth/refresh`, {}, { withCredentials: true })
      .then((response) => {
        const token = response.data?.accessToken || response.data?.token;
        if (!token) throw new Error('Refresh response did not include an access token');
        localStorage.setItem('token', token);
        if (response.data?.user) localStorage.setItem('user', JSON.stringify(response.data.user));
        instance.setAuthToken(token);
        return token;
      })
      .finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}

instance.refreshAccessToken = refreshAccessToken;

instance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config || {};
    const status = error.response?.status;
    const isAuthEndpoint = /\/auth\/(login|refresh|logout|verify-email)/.test(original.url || '');
    if (status === 401 && !original.__retriedAfterRefresh && !isAuthEndpoint && typeof window !== 'undefined') {
      try {
        const token = await refreshAccessToken();
        original.__retriedAfterRefresh = true;
        original.headers = { ...(original.headers || {}), Authorization: `Bearer ${token}` };
        return instance(original);
      } catch (_) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        instance.setAuthToken(null);
        window.dispatchEvent(new CustomEvent('auth:unauthorized', { detail: error.response?.data }));
      }
    }
    return Promise.reject(error);
  }
);

export default instance;
