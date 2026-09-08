import axios from '../api/axios';
import type { ApiEnvelope, Transaction, TransactionResponse } from '../types/api';

export async function listTransactions() { return axios.get<ApiEnvelope<Transaction[]>>('/transactions'); }
export async function pendingTransactions() { return axios.get<ApiEnvelope<Transaction[]>>('/transactions/pending'); }
export async function confirmTransaction(transactionId: string) { return axios.post<TransactionResponse>(`/transactions/${transactionId}/confirm`); }
export async function getTransaction(transactionId: string) { return axios.get<ApiEnvelope<Transaction>>(`/transactions/${transactionId}`); }
export type TransactionList = Transaction[];
