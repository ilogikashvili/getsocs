const { readDB, writeDB } = require('../config/db');

/**
 * Badge Service - Manages user badges and milestones
 */

class BadgeService {
  /**
   * Check if user qualifies for any badges
   */
  static checkAndAwardBadges(userId) {
    try {
      const db = readDB();
      const user = db.users.find(u => u.id === userId);
      if (!user) throw new Error('User not found');

      const earnedBadges = [];

      // Get user stats
      const userBadges = db.user_badges.filter(ub => ub.userId === userId);
      const completedTransactions = db.transactions.filter(t => 
        (t.buyerId === userId || t.sellerId === userId) && t.status === 'completed'
      );

      // Calculate totals
      let totalEarned = 0;
      let totalSpent = 0;
      completedTransactions.forEach(tx => {
        const amount = tx.amount || tx.productPrice || 0;
        if (tx.sellerId === userId) totalEarned += amount;
        if (tx.buyerId === userId) totalSpent += amount;
      });

      const createdDate = new Date(user.createdAt);
      const daysRegistered = Math.floor((new Date() - createdDate) / (1000 * 60 * 60 * 24));

      // Check seller milestones
      const sellerMilestones = [
        { badgeId: 'badge_seller_1k', amount: 1000 },
        { badgeId: 'badge_seller_5k', amount: 5000 },
        { badgeId: 'badge_seller_10k', amount: 10000 }
      ];

      sellerMilestones.forEach(milestone => {
        if (totalEarned >= milestone.amount) {
          const alreadyHas = userBadges.some(ub => ub.badgeId === milestone.badgeId);
          if (!alreadyHas) {
            earnedBadges.push(milestone.badgeId);
          }
        }
      });

      // Check buyer milestones
      const buyerMilestones = [
        { badgeId: 'badge_buyer_1k', amount: 1000 },
        { badgeId: 'badge_buyer_5k', amount: 5000 },
        { badgeId: 'badge_buyer_10k', amount: 10000 }
      ];

      buyerMilestones.forEach(milestone => {
        if (totalSpent >= milestone.amount) {
          const alreadyHas = userBadges.some(ub => ub.badgeId === milestone.badgeId);
          if (!alreadyHas) {
            earnedBadges.push(milestone.badgeId);
          }
        }
      });

      // Check registration badge
      if (daysRegistered >= 100) {
        const alreadyHas = userBadges.some(ub => ub.badgeId === 'badge_registered_100');
        if (!alreadyHas) {
          earnedBadges.push('badge_registered_100');
        }
      }

      // Award new badges
      earnedBadges.forEach(badgeId => {
        this.awardBadge(userId, badgeId);
      });

      return earnedBadges;
    } catch (e) {
      console.error('Error checking badges:', e.message);
      return [];
    }
  }

  /**
   * Award a badge to a user
   */
  static awardBadge(userId, badgeId) {
    try {
      const db = readDB();
      
      // Check if user already has this badge
      const existing = db.user_badges.find(ub => ub.userId === userId && ub.badgeId === badgeId);
      if (existing) {
        return existing;
      }

      const badge = db.badges.find(b => b.id === badgeId);
      if (!badge) {
        throw new Error('Badge not found');
      }

      const userBadge = {
        id: `user_badge_${Date.now()}`,
        userId,
        badgeId,
        earnedAt: new Date().toISOString(),
        visible: true
      };

      db.user_badges.push(userBadge);
      writeDB(db);

      return userBadge;
    } catch (e) {
      console.error('Error awarding badge:', e.message);
      return null;
    }
  }

  /**
   * Get all badges for a user
   */
  static getUserBadges(userId) {
    try {
      const db = readDB();
      const userBadges = db.user_badges.filter(ub => ub.userId === userId && ub.visible);

      const badges = userBadges.map(ub => {
        const badgeData = db.badges.find(b => b.id === ub.badgeId);
        return {
          ...ub,
          ...badgeData
        };
      });

      return badges;
    } catch (e) {
      console.error('Error getting user badges:', e.message);
      return [];
    }
  }

  /**
   * Get user's hidden badges (for private profiles)
   */
  static getHiddenBadges(userId) {
    try {
      const db = readDB();
      const userBadges = db.user_badges.filter(ub => ub.userId === userId && !ub.visible);

      const badges = userBadges.map(ub => {
        const badgeData = db.badges.find(b => b.id === ub.badgeId);
        return {
          ...ub,
          ...badgeData
        };
      });

      return badges;
    } catch (e) {
      console.error('Error getting hidden badges:', e.message);
      return [];
    }
  }

  /**
   * Get all available badges (for admin/frontend display)
   */
  static getAllBadges() {
    try {
      const db = readDB();
      return db.badges || [];
    } catch (e) {
      console.error('Error getting all badges:', e.message);
      return [];
    }
  }

  /**
   * Get user stats (for profile/ranking)
   */
  static getUserStats(userId) {
    try {
      const db = readDB();
      const user = db.users.find(u => u.id === userId);
      if (!user) throw new Error('User not found');

      const completedTransactions = db.transactions.filter(t => 
        (t.buyerId === userId || t.sellerId === userId) && t.status === 'completed'
      );

      let totalEarned = 0;
      let totalSpent = 0;
      let salesCount = 0;
      let purchasesCount = 0;

      completedTransactions.forEach(tx => {
        const amount = tx.amount || tx.productPrice || 0;
        if (tx.sellerId === userId) {
          totalEarned += amount;
          salesCount++;
        }
        if (tx.buyerId === userId) {
          totalSpent += amount;
          purchasesCount++;
        }
      });

      const createdDate = new Date(user.createdAt || new Date());
      const joinedDaysAgo = Math.floor((new Date() - createdDate) / (1000 * 60 * 60 * 24));

      // Calculate ranking (based on total money moved)
      const totalMoved = totalEarned + totalSpent;
      const allUsers = db.users.map(u => {
        const txs = db.transactions.filter(t => 
          (t.buyerId === u.id || t.sellerId === u.id) && t.status === 'completed'
        );
        let total = 0;
        txs.forEach(t => {
          const amt = t.amount || t.productPrice || 0;
          total += amt;
        });
        return { id: u.id, total };
      }).sort((a, b) => b.total - a.total);

      const ranking = allUsers.findIndex(u => u.id === userId) + 1;

      return {
        userId,
        username: user.username,
        totalEarned,
        totalSpent,
        totalMoved,
        salesCount,
        purchasesCount,
        joinedDaysAgo,
        ranking, 
        averageRating: 4.8, 
        badgeCount: db.user_badges.filter(ub => ub.userId === userId && ub.visible).length
      };
    } catch (e) {
      console.error('Error getting user stats:', e.message);
      return null;
    }
  }

  /**
   * Check and award consecutive active day badge
   * Should be called on user login/activity
   */
  static trackActiveDay(userId) {
    try {
      const db = readDB();
      const user = db.users.find(u => u.id === userId);
      if (!user) throw new Error('User not found');

      // This would require tracking active days - simplified for now
      // In production, would check against daily activity log

      user.lastSeenAt = new Date().toISOString();
      writeDB(db);

      return user;
    } catch (e) {
      console.error('Error tracking active day:', e.message);
      return null;
    }
  }

  /**
   * Get leaderboard (top users by total money moved)
   */
  static getLeaderboard(limit = 10) {
    try {
      const db = readDB();
      const leaderboard = [];

      db.users.forEach(user => {
        const stats = this.getUserStats(user.id);
        if (stats) {
          leaderboard.push(stats);
        }
      });

      return leaderboard
        .sort((a, b) => b.totalMoved - a.totalMoved)
        .slice(0, limit);
    } catch (e) {
      console.error('Error getting leaderboard:', e.message);
      return [];
    }
  }
}

module.exports = BadgeService;
