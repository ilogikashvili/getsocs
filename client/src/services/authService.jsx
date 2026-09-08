import axios from '../api/axios';

export async function requestPasswordReset(email) {
  return axios.post('/auth/password/request', { email });
}

export async function resetPassword(token, password) {
  return axios.post('/auth/password/reset', { token, password });
}

export async function login(username, password) {
  return axios.post('/auth/login', { username, password });
}

export async function verifyTwoFactor(userId, code) {
  return axios.post('/auth/login/verify-2fa', { userId, code });
}

export async function changePassword(oldPassword, newPassword) {
  return axios.post('/auth/password/change', { oldPassword, newPassword });
}

export async function register(formData) {
  return axios.post('/auth/register', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
}

export async function verifyRegistrationEmail(email, code) {
  return axios.post('/auth/verify-email/code', { email, code });
}

export async function resendRegistrationCode(email) {
  return axios.post('/auth/verify-email', { email });
}

export async function uploadProfilePhotos(formData) {
  return axios.post('/auth/profile/photos', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
}

export async function unlockProfilePhotoChange(photoType, code) {
  return axios.post('/auth/profile/photos/unlock', { photoType, code });
}

export async function getPublicProfile(userId) {
  return axios.get(`/auth/profile/${userId}`);
}

export async function getUserReviews(userId) {
  return axios.get(`/auth/reviews/${userId}`);
}

export async function getDashboardReviews() {
  return axios.get('/auth/reviews/dashboard/summary');
}

export async function submitReview(targetId, rating, text, type, transactionId = null) {
  return axios.post('/auth/reviews', { targetId, rating, text, type, transactionId });
}

const authService = {
  requestPasswordReset,
  resetPassword,
  login,
  verifyTwoFactor,
  changePassword,
  register,
  verifyRegistrationEmail,
  resendRegistrationCode,
  uploadProfilePhotos,
  unlockProfilePhotoChange,
  getPublicProfile,
  getUserReviews,
  getDashboardReviews,
  submitReview
};

export default authService;
