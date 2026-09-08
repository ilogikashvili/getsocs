import axios from '../api/axios';
import type {
  ApiEnvelope,
  AuthResponse,
  DashboardReviewsResponse,
  ReviewListResponse,
  ReviewMutationResponse,
  User,
  UserResponse,
  VerificationStatus
} from '../types/api';

export interface DeleteAccountPayload { confirmation: boolean; confirmationText: string; fullName?: string; }
export interface ProfileUpdatePayload { description?: string; fullName?: string; name?: string; lastname?: string; }

export async function requestPasswordReset(email: string) { return axios.post<ApiEnvelope>('/auth/password/request', { email }); }
export async function resetPassword(token: string, password: string) { return axios.post<ApiEnvelope>('/auth/password/reset', { token, password }); }
export async function login(username: string, password: string) { return axios.post<AuthResponse>('/auth/login', { username, password }); }
export async function verifyTwoFactor(userId: string, code: string) { return axios.post<AuthResponse>('/auth/login/verify-2fa', { userId, code }); }
export async function changePassword(oldPassword: string, newPassword: string) { return axios.post<ApiEnvelope>('/auth/password/change', { oldPassword, newPassword }); }
export async function register(formData: FormData) {
  // Browser must generate the multipart boundary; do not set Content-Type manually.
  return axios.post<AuthResponse>('/auth/register', formData);
}
export async function verifyRegistrationEmail(email: string, code: string) { return axios.post<AuthResponse>('/auth/verify-email/code', { email, code }); }
export async function resendRegistrationCode(email: string) { return axios.post<ApiEnvelope>('/auth/verify-email', { email }); }
export async function uploadProfilePhotos(formData: FormData) { return axios.post<UserResponse>('/auth/profile/photos', formData); }
export async function updateProfile(data: ProfileUpdatePayload) { return axios.post<UserResponse>('/auth/profile/update', data); }
export async function updateUsername(username: string) { return axios.post<UserResponse>('/auth/username/update', { username }); }
export async function submitIdVerification(formData: FormData) { return axios.post<ApiEnvelope>('/auth/verify-user', formData); }
export async function getVerificationStatus(userId: string) { return axios.get<ApiEnvelope<VerificationStatus>>(`/auth/verification-status/${userId}`); }
export async function deleteAccount(data: DeleteAccountPayload) { return axios.post<ApiEnvelope>('/auth/account/delete', data); }
export async function getPublicProfile(userId: string) { return axios.get<ApiEnvelope<User>>(`/auth/profile/${userId}`); }
export async function getUserReviews(userId: string) { return axios.get<ReviewListResponse>(`/auth/reviews/${userId}`); }
export async function getDashboardReviews() { return axios.get<DashboardReviewsResponse>('/auth/reviews/dashboard/summary'); }
export async function submitReview(targetId: string, rating: number, text: string, type: string, transactionId: string | null = null) { return axios.post<ReviewMutationResponse>('/auth/reviews', { targetId, rating, text, type, transactionId }); }
export async function editReview(reviewId: string, rating: number, text: string) { return axios.put<ReviewMutationResponse>(`/auth/reviews/${reviewId}`, { rating, text }); }
export async function deleteReview(reviewId: string) { return axios.delete<ApiEnvelope>(`/auth/reviews/${reviewId}`); }

const authService = {
  requestPasswordReset, resetPassword, login, verifyTwoFactor, changePassword, register,
  verifyRegistrationEmail, resendRegistrationCode, uploadProfilePhotos, updateProfile,
  updateUsername, submitIdVerification, getVerificationStatus, deleteAccount, getPublicProfile,
  getUserReviews, getDashboardReviews, submitReview, editReview, deleteReview
};
export default authService;
