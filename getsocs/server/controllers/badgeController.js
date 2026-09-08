const BadgeService = require('../services/badgeService');
const cacheService = require('../services/cacheService');
const { cacheKeys } = require('../utils/cacheKeys');
const BADGE_TTL = Math.max(60, Number(process.env.CACHE_BADGES_TTL_SECONDS || 300));

/**
 * Badge Controller - Handles badge operations
 */

async function getUserBadges(req, res) {
  try {
    const userId = req.params.userId || req.user.id;

    const badges = await BadgeService.getUserBadges(userId);
    const stats = await BadgeService.getUserStats(userId);

    res.json({ 
      success: true, 
      badges,
      stats
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

async function getProfileBadges(req, res) {
  try {
    const userId = req.params.userId || req.user.id;
    const badges = await BadgeService.getProfileBadges(userId);
    if (!badges) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    res.json({ success: true, badges });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

async function getAllBadges(req, res) {
  try {
    const cached = await cacheService.getOrSet(cacheKeys.badgesAll(), BADGE_TTL, async () => {
      const badges = await BadgeService.getAllBadges();
      return { success: true, badges, count: badges.length };
    });
    res.setHeader('X-Cache', cached.cache);
    res.json(cached.value);
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

async function checkAndAwardBadges(req, res) {
  try {
    const userId = req.user.id;

    const awarded = await BadgeService.checkAndAwardBadges(userId);

    res.json({ 
      success: true, 
      newBadges: awarded,
      count: awarded.length,
      message: awarded.length > 0 ? `Congratulations! You earned ${awarded.length} new badge(s)!` : 'No new badges earned'
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

async function getUserStats(req, res) {
  try {
    const userId = req.params.userId || req.user.id;

    const stats = await BadgeService.getUserStats(userId);

    if (!stats) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    res.json({ 
      success: true, 
      stats
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

async function getLeaderboard(req, res) {
  try {
    const { limit = 10 } = req.query;

    const leaderboard = await BadgeService.getLeaderboard(parseInt(limit));

    res.json({ 
      success: true, 
      leaderboard,
      count: leaderboard.length
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

// ADMIN ONLY

async function adminAwardBadge(req, res) {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Admin only' });
    }

    const { userId, badgeId } = req.body;

    if (!userId || !badgeId) {
      return res.status(400).json({ success: false, error: 'User ID and badge ID required' });
    }

    const badge = await BadgeService.awardBadge(userId, badgeId);

    if (!badge) {
      return res.status(400).json({ success: false, error: 'Failed to award badge' });
    }

    res.json({ 
      success: true, 
      badge,
      message: 'Badge awarded successfully'
    });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
}

module.exports = {
  getUserBadges,
  getProfileBadges,
  getAllBadges,
  checkAndAwardBadges,
  getUserStats,
  getLeaderboard,
  adminAwardBadge
};
