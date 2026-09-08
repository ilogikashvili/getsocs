import axios from '../api/axios';
import type { AddOnListResponse, MembershipTiersResponse, SubscriptionResponse, UserMembershipResponse } from '../types/api';

export async function getMembershipTiers() { return axios.get<MembershipTiersResponse>('/membership/tiers'); }
export async function getMyMembership() { return axios.get<UserMembershipResponse>('/membership/my-membership'); }
export async function subscribeToTier(tierId: string) { return axios.post<SubscriptionResponse>('/membership/subscribe', { tierId, billingCycle: 'monthly' }); }
export async function getAddons() { return axios.get<AddOnListResponse>('/membership/addons'); }
