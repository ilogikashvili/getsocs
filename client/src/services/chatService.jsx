import axios from '../api/axios';

export async function getChat(txId) {
  return axios.get(`/chats/${txId}`);
}

export async function postMessage(txId, text) {
  return axios.post(`/chats/${txId}/message`, { text });
}

export async function getDirectChats() {
  return axios.get('/chats/direct');
}

export async function createDirectChat(userId) {
  return axios.post(`/chats/direct/${userId}`);
}

export async function getDirectChat(chatId) {
  return axios.get(`/chats/direct/chat/${chatId}`);
}

export async function postDirectMessage(chatId, text) {
  return axios.post(`/chats/direct/chat/${chatId}/message`, { text });
}
