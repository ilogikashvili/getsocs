import axios from '../api/axios';

export async function getProducts(params = {}) {
  return axios.get('/products', { params });
}

export async function getMyProducts() {
  return axios.get('/products/mine');
}

export async function getProduct(productId) {
  return axios.get(`/products/${productId}`);
}

export async function createProduct(data) {
  return axios.post('/products', data);
}

export async function pendingProducts() {
  return axios.get('/products/pending');
}

export async function approveProduct(productId, code) {
  return axios.post(`/products/${productId}/approve`, { code });
}

export async function deleteProduct(productId) {
  return axios.delete(`/products/${productId}`);
}

export async function commentProduct(productId, text) {
  return axios.post(`/products/${productId}/comment`, { text });
}

export async function buyProduct(productId, paymentMethod) {
  return axios.post(`/transactions/products/${productId}/buy`, { paymentMethod });
}

export async function lookupYoutubeChannel(url, verificationCode) {
  return axios.get('/products/youtube-lookup', { params: { url, verificationCode } });
}

export async function claimProduct(productId) {
  return axios.post(`/products/${productId}/claim`);
}

export async function submitProductClaim(productId) {
  return axios.post(`/products/${productId}/claim/submit`);
}

export async function listProductClaims() {
  return axios.get('/products/claims/pending');
}

export async function resolveProductClaim(productId, code, approve) {
  return axios.post(`/products/${productId}/claim/resolve`, { code, approve });
}
