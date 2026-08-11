const MembershipService = require('../services/membershipService');

/**
 * Membership Controller - Handles membership and add-on operations
 */

function getAllTiers(req, res) {
  try {
    const tiers = MembershipService.getAllTiers();

    res.json({ 
      success: true, 
      tiers,
      count: tiers.length
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

function getUserMembership(req, res) {
  try {
    const userId = req.params.userId || req.user.id;

    const membership = MembershipService.getUserMembership(userId);
    const summary = MembershipService.getMembershipSummary(userId);

    res.json({ 
      success: true, 
      membership,
      summary
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

function subscribeToTier(req, res) {
  try {
    const userId = req.user.id;
    const { tierId, billingCycle = 'monthly' } = req.body;

    if (!tierId) {
      return res.status(400).json({ success: false, error: 'Tier ID required' });
    }

    const subscription = MembershipService.subscribeToTier(userId, tierId, billingCycle);

    res.json({ 
      success: true, 
      subscription,
      message: `Successfully subscribed to ${subscription.membershipTierId} tier`
    });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
}

function cancelMembership(req, res) {
  try {
    const userId = req.user.id;

    const subscription = MembershipService.cancelMembership(userId);

    res.json({ 
      success: true, 
      subscription,
      message: 'Membership cancelled'
    });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
}

function getPlatformFee(req, res) {
  try {
    const userId = req.user.id;

    const fee = MembershipService.getPlatformFee(userId);

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

function getAllAddOns(req, res) {
  try {
    const addons = MembershipService.getAllAddOns();

    res.json({ 
      success: true, 
      addons,
      count: addons.length
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

function purchaseAddOn(req, res) {
  try {
    const userId = req.user.id;
    const { addonId, value } = req.body;

    if (!addonId) {
      return res.status(400).json({ success: false, error: 'Add-on ID required' });
    }

    const purchase = MembershipService.purchaseAddOn(userId, addonId, value);

    res.json({ 
      success: true, 
      purchase,
      message: 'Add-on purchased successfully'
    });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
}

function getUserAddOns(req, res) {
  try {
    const userId = req.params.userId || req.user.id;

    const addons = MembershipService.getUserAddOns(userId);

    res.json({ 
      success: true, 
      addons,
      count: addons.length
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

function getUsernameColor(req, res) {
  try {
    const userId = req.params.userId || req.user.id;

    const color = MembershipService.getUsernameColor(userId);

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
function adminGetAllSubscriptions(req, res) {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Admin only' });
    }

    const { readDB } = require('../config/db');
    const db = readDB();

    const subscriptions = db.user_memberships.map(sub => {
      const user = db.users.find(u => u.id === sub.userId);
      const tier = db.memberships.find(t => t.id === sub.membershipTierId);
      return {
        ...sub,
        username: user?.username,
        tierName: tier?.name
      };
    });

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

function adminGetRevenueStats(req, res) {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Admin only' });
    }

    const { readDB } = require('../config/db');
    const db = readDB();

    const subscriptions = db.user_memberships.filter(s => s.status === 'active');
    const addons = db.user_addons.filter(a => a.active);

    let membershipRevenue = 0;
    let addonRevenue = 0;

    subscriptions.forEach(sub => {
      const tier = db.memberships.find(t => t.id === sub.membershipTierId);
      if (tier) membershipRevenue += tier.price;
    });

    addons.forEach(addon => {
      const addonData = db.addons.find(a => a.id === addon.addonId);
      if (addonData) addonRevenue += addonData.price;
    });

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
