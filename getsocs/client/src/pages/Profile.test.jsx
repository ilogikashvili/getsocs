import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AuthContext from '../context/AuthContext';
import Profile from './Profile';
import { getMyProfileBadges } from '../services/badgeService';
import { getMembershipTiers, getMyMembership } from '../services/membershipService';

jest.mock('../services/badgeService', () => ({
  getMyProfileBadges: jest.fn()
}));

jest.mock('../services/membershipService', () => ({
  getMembershipTiers: jest.fn(),
  getMyMembership: jest.fn(),
  subscribeToTier: jest.fn()
}));

jest.mock('../services/authService', () => ({
  uploadProfilePhotos: jest.fn(),
  changePassword: jest.fn(),
  updateProfile: jest.fn(),
  updateUsername: jest.fn(),
  deleteAccount: jest.fn(),
  submitIdVerification: jest.fn()
}));

const user = {
  id: 'u1',
  username: 'alice',
  name: 'Alice',
  lastname: 'Example',
  role: 'user',
  verified: true,
  idVerified: false,
  pointsBought: 120,
  pointsSold: 80
};

function renderProfile(overrides = {}) {
  const value = {
    user,
    updateUser: jest.fn(),
    logout: jest.fn(),
    ...overrides
  };
  render(
    <MemoryRouter>
      <AuthContext.Provider value={value}>
        <Profile />
      </AuthContext.Provider>
    </MemoryRouter>
  );
  return value;
}

beforeEach(() => {
  getMyProfileBadges.mockResolvedValue({ data: { success: true, badges: [{ id: 'trusted-seller', earned: true, name: 'Trusted Seller' }] } });
  getMembershipTiers.mockResolvedValue({ data: { success: true, tiers: [] } });
  getMyMembership.mockResolvedValue({ data: { success: true, summary: null } });
});

describe('Profile', () => {
  test('loads real badge and membership data for the signed-in user', async () => {
    renderProfile();
    expect(screen.getAllByText('Alice Example').length).toBeGreaterThan(0);

    await waitFor(() => expect(getMyProfileBadges).toHaveBeenCalled());
    await waitFor(() => expect(getMembershipTiers).toHaveBeenCalled());
    await waitFor(() => expect(getMyMembership).toHaveBeenCalled());
  });

  test('does not fabricate membership data when the API fails', async () => {
    getMembershipTiers.mockRejectedValueOnce({ response: { data: { error: 'Membership service unavailable' } } });
    getMyMembership.mockRejectedValueOnce(new Error('offline'));
    renderProfile();

    expect(await screen.findByText('Membership service unavailable')).toBeInTheDocument();
  });

  test('shows a login requirement instead of rendering account data with no user', () => {
    renderProfile({ user: null });
    expect(screen.getByText('Please login to view your profile.')).toBeInTheDocument();
  });
});
