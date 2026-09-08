import axios from '../api/axios';
import type { ApiEnvelope, Chat, ChatMessage } from '../types/api';

export async function getChat(txId: string) { return axios.get<ApiEnvelope<Chat>>(`/chats/${txId}`); }
export async function postMessage(txId: string, text: string) { return axios.post<ApiEnvelope<ChatMessage>>(`/chats/${txId}/message`, { text }); }
export async function getDirectChats() { return axios.get<ApiEnvelope<Chat[]>>('/chats/direct'); }
export async function createDirectChat(userId: string) { return axios.post<ApiEnvelope<Chat>>(`/chats/direct/${userId}`); }
export async function getDirectChat(chatId: string) { return axios.get<ApiEnvelope<Chat>>(`/chats/direct/chat/${chatId}`); }
export async function postDirectMessage(chatId: string, text: string) { return axios.post<ApiEnvelope<ChatMessage>>(`/chats/direct/chat/${chatId}/message`, { text }); }
