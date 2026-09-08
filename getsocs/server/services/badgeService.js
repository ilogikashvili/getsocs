const { loadBadgeState, saveBadgeState, listAllBadges } = require('../repositories/badgeRepository');

/**
 * Badge Service - Manages user badges and milestones
 */

class BadgeService {
  /**
   * Check if user qualifies for any badges
   */
  static async checkAndAwardBadges(userId) {
    try {
      const db = await loadBadgeState();
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
      for (const badgeId of earnedBadges) {
        await this.awardBadge(userId, badgeId);
      }

      return earnedBadges;
    } catch (e) {
      console.error('Error checking badges:', e.message);
      return [];
    }
  }

  /**
   * Award a badge to a user
   */
  static async awardBadge(userId, badgeId) {
    try {
      const db = await loadBadgeState();
      
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
      await saveBadgeState(db);

      return userBadge;
    } catch (e) {
      console.error('Error awarding badge:', e.message);
      return null;
    }
  }

  /**
   * Get all badges for a user
   */
  static async getUserBadges(userId) {
    try {
      const db = await loadBadgeState();
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
  static async getHiddenBadges(userId) {
    try {
      const db = await loadBadgeState();
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
  static async getAllBadges() {
    try {
      return await listAllBadges();
    } catch (e) {
      console.error('Error getting all badges:', e.message);
      return [];
    }
  }

  /**
   * Get user stats (for profile/ranking)
   */
  static async getUserStats(userId) {
    try {
      const db = await loadBadgeState();
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
   * Profile page badge showcase (the fixed set of 6 badges shown on the
   * public profile - ID Verified, Trusted Seller, Escrow Ready, Fast
   * Responder, Community Builder, Getsocs Member).
   *
   * These used to be hardcoded as "earned" on the frontend regardless of
   * the actual account, which meant a brand new account showed badges it
   * never earned. This computes each one from real account data instead:
   *   - id-verified: user.idVerified is true (set only after an admin
   *     approves a submitted ID document)
   *   - trusted-seller: at least 3 completed sales
   *   - escrow-ready: at least 1 completed transaction (buyer or seller)
   *   - premium-member: an active (non-expired) membership subscription
   *   - fast-responder / community-builder: no reliable signal exists yet
   *     in this codebase (would need response-time and
   *     listing/comment-quality tracking), so these always report
   *     earned:false rather than being faked.
   */
  static async getProfileBadges(userId) {
    try {
      const db = await loadBadgeState();
      const user = db.users.find(u => u.id === userId);
      if (!user) return null;

      const transactions = Array.isArray(db.transactions) ? db.transactions : [];
      const completedAsSeller = transactions.filter(t => t.sellerId === userId && t.status === 'completed').length;
      const completedTotal = transactions.filter(t =>
        (t.buyerId === userId || t.sellerId === userId) && t.status === 'completed'
      ).length;

      const now = Date.now();
      const activeMembership = (Array.isArray(db.user_memberships) ? db.user_memberships : []).some(um =>
        um.userId === userId && um.status === 'active' && (!um.endDate || new Date(um.endDate).getTime() > now)
      );

      return [
        {
          id: 'id-verified',
          title: 'ID Verified',
          text: 'Identity checked before trading on Getsocs.',
          earned: !!user.idVerified
        },
        {
          id: 'trusted-seller',
          title: 'Trusted Seller',
          text: 'Keeps listings accurate and completes clean transfers.',
          earned: completedAsSeller >= 3
        },
        {
          id: 'escrow-ready',
          title: 'Escrow Ready',
          text: 'Uses escrow flow for safer social account deals.',
          earned: completedTotal >= 1
        },
        {
          id: 'fast-responder',
          title: 'Fast Responder',
          text: 'Replies quickly to buyers, sellers, and support.',
          earned: false
        },
        {
          id: 'community-builder',
          title: 'Community Builder',
          text: 'Creates useful listings, comments, and reports.',
          earned: false
        },
        {
          id: 'premium-member',
          title: 'Getsocs Member',
          text: 'Active member with marketplace access enabled.',
          earned: activeMembership
        }
      ];
    } catch (e) {
      console.error('Error computing profile badges:', e.message);
      return null;
    }
  }

  /**
   * Check and award consecutive active day badge
   * Should be called on user login/activity
   */
  static async trackActiveDay(userId) {
    try {
      const db = await loadBadgeState();
      const user = db.users.find(u => u.id === userId);
      if (!user) throw new Error('User not found');

      // This would require tracking active days - simplified for now
      // In production, would check against daily activity log

      user.lastSeenAt = new Date().toISOString();
      await saveBadgeState(db);

      return user;
    } catch (e) {
      console.error('Error tracking active day:', e.message);
      return null;
    }
  }

  /**
   * Get leaderboard (top users by total money moved)
   */
  static async getLeaderboard(limit = 10) {
    try {
      const db = await loadBadgeState();
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
