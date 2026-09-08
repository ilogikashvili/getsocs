const MembershipService = require('../services/membershipService');
const MembershipRepository = require('../repositories/membershipRepository');
const cacheService = require('../services/cacheService');
const { cacheKeys } = require('../utils/cacheKeys');
const MEMBERSHIP_TTL = Math.max(60, Number(process.env.CACHE_MEMBERSHIP_TTL_SECONDS || 600));

/**
 * Membership Controller - Handles membership and add-on operations
 */

async function getAllTiers(req, res) {
  try {
    const cached = await cacheService.getOrSet(cacheKeys.membershipTiers(), MEMBERSHIP_TTL, async () => {
      const tiers = await MembershipService.getAllTiers();
      return { success: true, tiers, count: tiers.length };
    });
    res.setHeader('X-Cache', cached.cache);
    res.json(cached.value);
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

async function getUserMembership(req, res) {
  try {
    const userId = req.params.userId || req.user.id;
    if (userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const membership = await MembershipService.getUserMembership(userId);
    const summary = await MembershipService.getMembershipSummary(userId);

    res.json({ 
      success: true, 
      membership,
      summary
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

async function subscribeToTier(req, res) {
  try {
    const userId = req.user.id;
    const { tierId, billingCycle = 'monthly' } = req.body;

    if (!tierId) {
      return res.status(400).json({ success: false, error: 'Tier ID required' });
    }

    const subscription = await MembershipService.subscribeToTier(userId, tierId, billingCycle);

    res.json({ 
      success: true, 
      subscription,
      message: `Successfully subscribed to ${subscription.membershipTierId} tier`
    });
  } catch (e) {
    console.error('subscribeToTier error:', e.message);
    const friendly = /tier not found/i.test(e.message) ? 'That membership tier does not exist.' : 'Unable to complete subscription. Please try again.';
    res.status(400).json({ success: false, error: friendly });
  }
}

async function cancelMembership(req, res) {
  try {
    const userId = req.user.id;

    const subscription = await MembershipService.cancelMembership(userId);

    res.json({ 
      success: true, 
      subscription,
      message: 'Membership cancelled'
    });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
}

async function getPlatformFee(req, res) {
  try {
    const userId = req.user.id;

    const fee = await MembershipService.getPlatformFee(userId);

    res.json({ 
      success: true, 
      fee: `${(fee * 100).toFixed(1)}%`,
      feeDecimal: fee
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

// ADD-ON ENDPOINTS

async function getAllAddOns(req, res) {
  try {
    const cached = await cacheService.getOrSet(cacheKeys.membershipAddons(), MEMBERSHIP_TTL, async () => {
      const addons = await MembershipService.getAllAddOns();
      return { success: true, addons, count: addons.length };
    });
    res.setHeader('X-Cache', cached.cache);
    res.json(cached.value);
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

async function purchaseAddOn(req, res) {
  try {
    const userId = req.user.id;
    const { addonId, value } = req.body;

    if (!addonId) {
      return res.status(400).json({ success: false, error: 'Add-on ID required' });
    }

    const purchase = await MembershipService.purchaseAddOn(userId, addonId, value);

    res.json({ 
      success: true, 
      purchase,
      message: 'Add-on purchased successfully'
    });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
}

async function getUserAddOns(req, res) {
  try {
    const userId = req.params.userId || req.user.id;
    if (userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const addons = await MembershipService.getUserAddOns(userId);

    res.json({ 
      success: true, 
      addons,
      count: addons.length
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

async function getUsernameColor(req, res) {
  try {
    const userId = req.params.userId || req.user.id;

    const color = await MembershipService.getUsernameColor(userId);

    res.json({ 
      success: true, 
      color: color || 'default',
      hasCustomColor: color ? true : false
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

// ADMIN ONLY
//so this is backend for api which is 
async function adminGetAllSubscriptions(req, res) {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Admin only' });
    }

    const subscriptions = await MembershipRepository.listSubscriptionDetails();

    res.json({ 
      success: true, 
      subscriptions,
      stats: {
        total: subscriptions.length,
        active: subscriptions.filter(s => s.status === 'active').length,
        expired: subscriptions.filter(s => s.status === 'expired').length,
        cancelled: subscriptions.filter(s => s.status === 'cancelled').length
      }
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

async function adminGetRevenueStats(req, res) {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Admin only' });
    }

    const { subscriptions, addons, membershipRevenue, addonRevenue } = await MembershipRepository.getRevenueSnapshot();

    res.json({ 
      success: true, 
      revenue: {
        membership: membershipRevenue.toFixed(2),
        addons: addonRevenue.toFixed(2),
        total: (membershipRevenue + addonRevenue).toFixed(2)
      },
      stats: {
        activeSubscriptions: subscriptions.length,
        activePurchases: addons.length
      }
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

module.exports = {
  getAllTiers,
  getUserMembership,
  subscribeToTier,
  cancelMembership,
  getPlatformFee,
  getAllAddOns,
  purchaseAddOn,
  getUserAddOns,
  getUsernameColor,
  adminGetAllSubscriptions,
  adminGetRevenueStats
};
