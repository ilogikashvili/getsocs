import axios from '../api/axios';
import type { BadgeListResponse } from '../types/api';

export async function getMyProfileBadges() { return axios.get<BadgeListResponse>('/badges/my-profile-badges'); }
export async function getProfileBadges(userId: string) { return axios.get<BadgeListResponse>(`/badges/profile/${userId}`); }
