import axios from '../api/axios';

export async function getMembershipTiers() {
  return axios.get('/membership/tiers');
}

export async function getMyMembership() {
  return axios.get('/membership/my-membership');
}

export async function subscribeToTier(tierId) {
  return axios.post('/membership/subscribe', { tierId, billingCycle: 'monthly' });
}
