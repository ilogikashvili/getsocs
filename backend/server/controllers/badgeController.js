const BadgeService = require('../services/badgeService');

/**
 * Badge Controller - Handles badge operations
 */

function getUserBadges(req, res) {
  try {
    const userId = req.params.userId || req.user.id;

    const badges = BadgeService.getUserBadges(userId);
    const stats = BadgeService.getUserStats(userId);

    res.json({ 
      success: true, 
      badges,
      stats
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

function getAllBadges(req, res) {
  try {
    const badges = BadgeService.getAllBadges();

    res.json({ 
      success: true, 
      badges,
      count: badges.length
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

function checkAndAwardBadges(req, res) {
  try {
    const userId = req.user.id;

    const awarded = BadgeService.checkAndAwardBadges(userId);

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

function getUserStats(req, res) {
  try {
    const userId = req.params.userId || req.user.id;

    const stats = BadgeService.getUserStats(userId);

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

function getLeaderboard(req, res) {
  try {
    const { limit = 10 } = req.query;

    const leaderboard = BadgeService.getLeaderboard(parseInt(limit));

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

function adminAwardBadge(req, res) {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Admin only' });
    }

    const { userId, badgeId } = req.body;

    if (!userId || !badgeId) {
      return res.status(400).json({ success: false, error: 'User ID and badge ID required' });
    }

    const badge = BadgeService.awardBadge(userId, badgeId);

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
  getAllBadges,
  checkAndAwardBadges,
  getUserStats,
  getLeaderboard,
  adminAwardBadge
};
