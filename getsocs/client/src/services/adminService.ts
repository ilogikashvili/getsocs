import axios from '../api/axios';
import type { ApiEnvelope, Chat, Escrow, Product, User } from '../types/api';
const API_URL = '/admin';

export interface AdminStats { users?: number; products?: number; transactions?: number; revenue?: number; [key: string]: unknown; }
export async function listUsers() { return axios.get<ApiEnvelope<User[]>>(`${API_URL}/users`); }
export async function listEscrows() { return axios.get<ApiEnvelope<Escrow[]>>(`${API_URL}/escrows`); }
export async function banUser(userId: string) { return axios.post<ApiEnvelope>(`${API_URL}/ban/${userId}`); }
export async function unbanUser(userId: string) { return axios.post<ApiEnvelope>(`${API_URL}/unban/${userId}`); }
export async function makeEscrow(userId: string) { return axios.post<ApiEnvelope>(`${API_URL}/make-escrow/${userId}`); }
export async function removeEscrow(userId: string) { return axios.post<ApiEnvelope>(`${API_URL}/remove-escrow/${userId}`); }
export async function banEscrow(userId: string) { return axios.post<ApiEnvelope>(`${API_URL}/ban-escrow/${userId}`); }
export async function getStats() { return axios.get<ApiEnvelope<AdminStats>>(`${API_URL}/stats`); }
export async function listAdminProducts() { return axios.get<ApiEnvelope<Product[]>>(`${API_URL}/products`); }
export async function listAdminChats() { return axios.get<ApiEnvelope<Chat[]>>(`${API_URL}/chats`); }
