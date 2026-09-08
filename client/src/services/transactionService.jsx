import axios from '../api/axios';

export async function listTransactions() {
  return axios.get('/transactions');
}

export async function pendingTransactions() {
  return axios.get('/transactions/pending');
}

export async function confirmTransaction(transactionId) {
  return axios.post(`/transactions/${transactionId}/confirm`);
}

export async function getTransaction(transactionId) {
  return axios.get(`/transactions/${transactionId}`);
}
