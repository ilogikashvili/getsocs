import axios from '../api/axios';
import type { ApiEnvelope, Chat, ChatMessage } from '../types/api';
const API_URL = '/chats/support';

type ChatEnvelope = ApiEnvelope<Chat> & { chat?: Chat };
type ChatsEnvelope = ApiEnvelope<Chat[]>;
type MessageEnvelope = ApiEnvelope<ChatMessage> & { message?: ChatMessage };

export const getSupportChats = async (): Promise<Chat[]> => {
  const response = await axios.get<ChatsEnvelope>(`${API_URL}/list/all`);
  return response.data.data || [];
};
export const createSupportChat = async (): Promise<Chat | undefined> => {
  const response = await axios.post<ChatEnvelope>(`${API_URL}/create`);
  return response.data.chat || response.data.data;
};
export const getSupportChat = async (chatId: string): Promise<Chat | undefined> => {
  const response = await axios.get<ChatEnvelope>(`${API_URL}/${chatId}/get`);
  return response.data.chat || response.data.data;
};
export const postSupportMessage = async (chatId: string, text: string): Promise<ChatMessage | undefined> => {
  const response = await axios.post<MessageEnvelope>(`${API_URL}/${chatId}/message`, { text });
  return response.data.message || response.data.data;
};
export const banSupportChat = async (chatId: string) => axios.post<ApiEnvelope>(`${API_URL}/${chatId}/ban`);
export const assignSupportChat = async (chatId: string): Promise<Chat | undefined> => {
  const response = await axios.post<ChatEnvelope>(`/chats/support/${chatId}/assign`);
  return response.data.chat || response.data.data;
};
export const getUnreadCount = async (): Promise<number> => {
  try {
    const response = await axios.get<ApiEnvelope<number> & { count?: number }>('/chats/meta/unread-count');
    return response.data.count ?? response.data.data ?? 0;
  } catch (_) { return 0; }
};
