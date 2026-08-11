import axios from 'axios';

export function getApiBaseUrl() {
  if (process.env.REACT_APP_API) {
    return process.env.REACT_APP_API;
  }

  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]') {
      return 'http://localhost:3001/api';
    }

    return `${window.location.origin}/api`;
  }

  return 'http://localhost:3001/api';
};

const API = getApiBaseUrl();
const storedToken = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

const instance = axios.create({ baseURL: API, withCredentials: false });
if (storedToken) {
  instance.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
}

const uploadBase = API.replace(/\/api\/?$/, '');
export function getUploadUrl(filename) {
  if (!filename) return '';
  const trimmedFilename = filename.startsWith('/') ? filename.slice(1) : filename;
  return `${uploadBase}/uploads/${trimmedFilename}`.replace(/([^:]\/)\/+/g, '$1');
}

instance.setAuthToken = (token) => {
  if (token) instance.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  else delete instance.defaults.headers.common['Authorization'];
};

instance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401 && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('auth:unauthorized', { detail: error.response.data }));
    }
    return Promise.reject(error);
  }
);

export default instance;
