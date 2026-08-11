import axios from '../api/axios';

const API_URL = '/chats/support';

export const getSupportChats = async () => {
  try {
    const response = await axios.get(`${API_URL}/list/all`);
    return response.data.data || [];
  } catch (error) {
    console.error('Error fetching support chats:', error);
    throw error;
  }
};

export const createSupportChat = async () => {
  try {
    const response = await axios.post(`${API_URL}/create`);
    return response.data.chat;
  } catch (error) {
    console.error('Error creating support chat:', error);
    throw error;
  }
};

export const getSupportChat = async (chatId) => {
  try {
    const response = await axios.get(`${API_URL}/${chatId}/get`);
    return response.data.chat;
  } catch (error) {
    console.error('Error fetching support chat:', error);
    throw error;
  }
};

export const postSupportMessage = async (chatId, text) => {
  try {
    const response = await axios.post(`${API_URL}/${chatId}/message`, { text });
    return response.data.message;
  } catch (error) {
    console.error('Error posting support message:', error);
    throw error;
  }
};

export const banSupportChat = async (chatId) => {
  try {
    const response = await axios.post(`${API_URL}/${chatId}/ban`);
    return response.data;
  } catch (error) {
    console.error('Error banning support chat:', error);
    throw error;
  }
};

export const assignSupportChat = async (chatId) => {
  try {
    const response = await axios.post(`/chats/support/${chatId}/assign`);
    return response.data.chat;
  } catch (error) {
    console.error('Error assigning support chat:', error);
    throw error;
  }
};

export const getUnreadCount = async () => {
  try {
    const response = await axios.get('/chats/meta/unread-count');
    return response.data.count || 0;
  } catch (error) {
    return 0;
  }
};
