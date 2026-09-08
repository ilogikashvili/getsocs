jest.mock('../repositories/membershipStateRepository', () => ({
  loadMembershipState: jest.fn(),
  saveMembershipState: jest.fn(),
  listMembershipTiers: jest.fn(),
  listAddons: jest.fn()
}));

const repo = require('../repositories/membershipStateRepository');
const MembershipService = require('../services/membershipService');

describe('MembershipService summary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    repo.loadMembershipState.mockResolvedValue({
      users: [{ id: 'u1' }],
      memberships: [{
        id: 'vip', name: 'VIP', price: 10, benefits: ['Daily boost'],
        platformFeeReduction: 0.03, dailyBoost: true, glowBorder: true
      }],
      user_memberships: [{
        id: 'um1', userId: 'u1', membershipTierId: 'vip', status: 'active',
        startDate: new Date(Date.now() - 1000).toISOString(),
        endDate: new Date(Date.now() + 86400000).toISOString(), autoRenew: true
      }],
      addons: [], user_addons: []
    });
  });

  test('summary resolves benefit flags to booleans rather than leaking Promises', async () => {
    const summary = await MembershipService.getMembershipSummary('u1');
    expect(summary.benefits).toEqual({ dailyBoost: true, glowBorder: true });
    expect(summary.benefits.dailyBoost).not.toBeInstanceOf(Promise);
    expect(summary.benefits.glowBorder).not.toBeInstanceOf(Promise);
  });
});
