const { loadMembershipState, saveMembershipState, listMembershipTiers, listAddons } = require('../repositories/membershipStateRepository');

/**
 * Membership Service - Manages membership tiers and benefits
 */

class MembershipService {
  /**
   * Get all membership tiers
   */
  static async getAllTiers() {
    try {
      return await listMembershipTiers();
    } catch (e) {
      console.error('Error getting membership tiers:', e.message);
      return [];
    }
  }

  /**
   * Get specific tier by ID
   */
  static async getTierById(tierId) {
    try {
      const db = await loadMembershipState();
      return db.memberships.find(m => m.id === tierId);
    } catch (e) {
      console.error('Error getting tier:', e.message);
      return null;
    }
  }

  /**
   * Subscribe user to membership tier
   */
  static async subscribeToTier(userId, tierId, billingCycle = 'monthly') {
    try {
      if (String(process.env.PAYMENTS_ENABLED || 'false').toLowerCase() !== 'true') {
        throw new Error('Paid memberships are temporarily unavailable because payment processing is not configured');
      }
      const db = await loadMembershipState();
      const user = db.users.find(u => u.id === userId);
      const tier = db.memberships.find(m => m.id === tierId);

      if (!user) throw new Error('User not found');
      if (!tier) throw new Error('Membership tier not found');

      // Check for existing active subscription
      const existingSubscription = db.user_memberships.find(um => 
        um.userId === userId && um.status === 'active'
      );

      if (existingSubscription) {
        // Auto-renew logic - cancel old and create new
        existingSubscription.status = 'expired';
        existingSubscription.endDate = new Date().toISOString();
      }

      // Calculate end date based on billing cycle
      const startDate = new Date();
      const endDate = new Date();
      if (billingCycle === 'monthly') {
        endDate.setMonth(endDate.getMonth() + 1);
      } else if (billingCycle === 'annual') {
        endDate.setFullYear(endDate.getFullYear() + 1);
      }

      const subscription = {
        id: `user_mem_${Date.now()}`,
        userId,
        membershipTierId: tierId,
        status: 'active',
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        autoRenew: true,
        billingCycle,
        amount: tier.price
      };

      db.user_memberships.push(subscription);
      await saveMembershipState(db);

      return subscription;
    } catch (e) {
      throw new Error(`Subscription failed: ${e.message}`);
    }
  }

  /**
   * Get user's active membership
   */
  static async getUserMembership(userId) {
    try {
      const db = await loadMembershipState();
      const subscription = db.user_memberships.find(um => 
        um.userId === userId && um.status === 'active'
      );

      if (!subscription) {
        return null;
      }

      const tier = db.memberships.find(m => m.id === subscription.membershipTierId);
      
      return {
        subscription,
        tier,
        isExpired: new Date() > new Date(subscription.endDate),
        daysRemaining: Math.ceil(
          (new Date(subscription.endDate) - new Date()) / (1000 * 60 * 60 * 24)
        )
      };
    } catch (e) {
      console.error('Error getting user membership:', e.message);
      return null;
    }
  }

  /**
   * Cancel user's membership
   */
  static async cancelMembership(userId) {
    try {
      const db = await loadMembershipState();
      const subscription = db.user_memberships.find(um => 
        um.userId === userId && um.status === 'active'
      );

      if (!subscription) {
        throw new Error('No active membership found');
      }

      subscription.status = 'cancelled';
      subscription.autoRenew = false;
      subscription.cancelledAt = new Date().toISOString();

      await saveMembershipState(db);
      return subscription;
    } catch (e) {
      throw new Error(`Cancellation failed: ${e.message}`);
    }
  }

  /**
   * Get platform fee for user
   * Returns fee percentage based on membership tier
   */
  static async getPlatformFee(userId) {
    try {
      const membership = await this.getUserMembership(userId);
      
      if (!membership || membership.isExpired) {
        // Default fee: 5%
        return 0.05;
      }

      // Return reduced fee based on tier
      return membership.tier.platformFeeReduction || 0.05;
    } catch (e) {
      console.error('Error getting platform fee:', e.message);
      return 0.05;
    }
  }

  /**
   * Check if user can use daily boost
   */
  static async canUseDailyBoost(userId) {
    try {
      const membership = await this.getUserMembership(userId);
      
      if (!membership || membership.isExpired) {
        return false;
      }

      return membership.tier.dailyBoost || false;
    } catch (e) {
      console.error('Error checking daily boost:', e.message);
      return false;
    }
  }

  /**
   * Check if user has glow border (Premium only)
   */
  static async hasGlowBorder(userId) {
    try {
      const membership = await this.getUserMembership(userId);
      
      if (!membership || membership.isExpired) {
        return false;
      }

      return membership.tier.glowBorder || false;
    } catch (e) {
      console.error('Error checking glow border:', e.message);
      return false;
    }
  }

  /**
   * Get all add-ons available for purchase
   */
  static async getAllAddOns() {
    try {
      return await listAddons();
    } catch (e) {
      console.error('Error getting add-ons:', e.message);
      return [];
    }
  }

  /**
   * Purchase an add-on
   */
  static async purchaseAddOn(userId, addonId, value = null) {
    try {
      const db = await loadMembershipState();
      const user = db.users.find(u => u.id === userId);
      const addon = db.addons.find(a => a.id === addonId);

      if (!user) throw new Error('User not found');
      if (!addon) throw new Error('Add-on not found');

      // Handle permanent vs time-based add-ons
      const expiresAt = addon.duration === 'permanent' ? null : 
        new Date(Date.now() + addon.duration * 1000).toISOString();

      const purchase = {
        id: `user_addon_${Date.now()}`,
        userId,
        addonId,
        purchasedAt: new Date().toISOString(),
        expiresAt,
        value: value || null,
        active: true
      };

      db.user_addons.push(purchase);
      await saveMembershipState(db);

      return purchase;
    } catch (e) {
      throw new Error(`Add-on purchase failed: ${e.message}`);
    }
  }

  /**
   * Get user's active add-ons
   */
  static async getUserAddOns(userId) {
    try {
      const db = await loadMembershipState();
      const now = new Date();

      const addons = db.user_addons
        .filter(ua => ua.userId === userId && ua.active)
        .filter(ua => !ua.expiresAt || new Date(ua.expiresAt) > now)
        .map(ua => {
          const addonData = db.addons.find(a => a.id === ua.addonId);
          return {
            ...ua,
            ...addonData,
            daysRemaining: ua.expiresAt ? 
              Math.ceil((new Date(ua.expiresAt) - now) / (1000 * 60 * 60 * 24)) : null
          };
        });

      return addons;
    } catch (e) {
      console.error('Error getting user add-ons:', e.message);
      return [];
    }
  }

  /**
   * Check if user has specific add-on
   */
  static async hasAddOn(userId, addonId) {
    try {
      const addons = await this.getUserAddOns(userId);
      return addons.some(a => a.addonId === addonId);
    } catch (e) {
      console.error('Error checking add-on:', e.message);
      return false;
    }
  }

  /**
   * Get user's username color from add-on
   */
  static async getUsernameColor(userId) {
    try {
      const addons = await this.getUserAddOns(userId);
      const colorAddon = addons.find(a => a.addonId === 'addon_username_color');
      return colorAddon ? colorAddon.value : null;
    } catch (e) {
      console.error('Error getting username color:', e.message);
      return null;
    }
  }

  /**
   * Auto-renew expired memberships
   * Should be called periodically (e.g., via cron job)
   */
  static async processExpiredMemberships() {
    try {
      const db = await loadMembershipState();
      const now = new Date();
      let renewed = 0;

      db.user_memberships.forEach(subscription => {
        if (subscription.status === 'active' && subscription.autoRenew) {
          const endDate = new Date(subscription.endDate);
          if (now >= endDate) {
            // Calculate new end date
            const newEndDate = new Date(endDate);
            if (subscription.billingCycle === 'monthly') {
              newEndDate.setMonth(newEndDate.getMonth() + 1);
            } else if (subscription.billingCycle === 'annual') {
              newEndDate.setFullYear(newEndDate.getFullYear() + 1);
            }

            subscription.endDate = newEndDate.toISOString();
            subscription.lastRenewedAt = now.toISOString();
            renewed++;
          }
        }
      });

      if (renewed > 0) {
        await saveMembershipState(db);
        console.log(`Auto-renewed ${renewed} memberships`);
      }

      return renewed;
    } catch (e) {
      console.error('Error processing expired memberships:', e.message);
      return 0;
    }
  }

  /**
   * Get membership summary for user profile
   */
  static async getMembershipSummary(userId) {
    try {
      const membership = await this.getUserMembership(userId);
      const addons = await this.getUserAddOns(userId);
      const fee = await this.getPlatformFee(userId);

      return {
        tier: membership ? {
          id: membership.tier.id,
          name: membership.tier.name,
          benefits: membership.tier.benefits,
          daysRemaining: membership.daysRemaining
        } : null,
        addons: addons.map(a => ({
          id: a.id,
          name: a.name,
          daysRemaining: a.daysRemaining
        })),
        platformFee: `${(fee * 100).toFixed(1)}%`,
        benefits: {
          dailyBoost: await this.canUseDailyBoost(userId),
          glowBorder: await this.hasGlowBorder(userId)
        }
      };
    } catch (e) {
      console.error('Error getting membership summary:', e.message);
      return null;
    }
  }
}

module.exports = MembershipService;
