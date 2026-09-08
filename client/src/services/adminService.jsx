import axios from '../api/axios';

const API_URL = '/admin';

export async function listUsers() {
  return axios.get(`${API_URL}/users`);
}

export async function listEscrows() {
  return axios.get(`${API_URL}/escrows`);
}

export async function banUser(userId) {
  return axios.post(`${API_URL}/ban/${userId}`);
}

export async function unbanUser(userId) {
  return axios.post(`${API_URL}/unban/${userId}`);
}

export async function makeEscrow(userId) {
  return axios.post(`${API_URL}/make-escrow/${userId}`);
}

export async function removeEscrow(userId) {
  return axios.post(`${API_URL}/remove-escrow/${userId}`);
}

export async function banEscrow(userId) {
  return axios.post(`${API_URL}/ban-escrow/${userId}`);
}

export async function getStats() {
  return axios.get(`${API_URL}/stats`);
}

export async function listAdminProducts() {
  return axios.get(`${API_URL}/products`);
}

export async function listAdminChats() {
  return axios.get(`${API_URL}/chats`);
}
